import React, { useState, useEffect } from 'react';
import { SchoolLogo } from '../components/SchoolLogo';
import { QRCodeModal } from '../components/QRCodeModal';
import { api } from '../services/api';
import { useRealtimeGame } from '../hooks/useRealtimeGame';
import { Competition, Question, Participant, QuestionType, THPT_2510_CLASSES, THPT_2510_CLASSES_BY_GRADE } from '../types';
import { soundManager } from '../utils/soundEffects';
import { LiveLedMonitor } from '../components/LiveLedMonitor';
import { DualScreenGuideModal } from '../components/DualScreenGuideModal';
import { ImportQuestionModal } from '../components/ImportQuestionModal';
interface AdminDashboardProps {
  competitionId?: string;
  onOpenProjector?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  competitionId = 'comp-thpt-2510',
  onOpenProjector,
}) => {
  const [activeTab, setActiveTab] = useState<'control' | 'participants' | 'questions' | 'rules' | 'logs'>('control');
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [savingQuestion, setSavingQuestion] = useState<boolean>(false);
  const [showQR, setShowQR] = useState<boolean>(false);
  const [bgmPlaying, setBgmPlaying] = useState<boolean>(soundManager.isBgmPlaying());
  const [victoryPlaying, setVictoryPlaying] = useState<boolean>(soundManager.getIsVictoryPlaying());

  useEffect(() => {
    const unsubscribe = soundManager.subscribe(() => {
      setBgmPlaying(soundManager.isBgmPlaying());
      setVictoryPlaying(soundManager.getIsVictoryPlaying());
    });
    return unsubscribe;
  }, []);

  // Dual Screen & Live LED Monitor states
  const [showLiveLedMonitor, setShowLiveLedMonitor] = useState<boolean>(true);
  const [splitView, setSplitView] = useState<boolean>(false);
  const [showDualScreenGuide, setShowDualScreenGuide] = useState<boolean>(false);

  // Participant Filter & Search (33 classes, 66 students)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Rescue Modal State
  const [showRescueModal, setShowRescueModal] = useState<boolean>(false);
  const [rescueType, setRescueType] = useState<'ALL' | 'RANDOM' | 'CLASS'>('ALL');
  const [rescueCount, setRescueCount] = useState<number>(10);
  const [rescueClass, setRescueClass] = useState<string>('10A1');

  // Question Edit & Import Modal State
  const [showQuestionModal, setShowQuestionModal] = useState<boolean>(false);
  const [showImportQuestionModal, setShowImportQuestionModal] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);

  // Student Import, Edit & Add Modal State
  const [showImportStudentModal, setShowImportStudentModal] = useState<boolean>(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [showEditStudentModal, setShowEditStudentModal] = useState<boolean>(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [importStudentText, setImportStudentText] = useState<string>('');
  const [newStudent, setNewStudent] = useState<{ name: string; className: string; studentCode: string }>({
    name: '',
    className: '10A1',
    studentCode: '',
  });

  // Realtime hook
  const { gameState, secondsRemaining } = useRealtimeGame({
    competitionId,
    enableSounds: true,
  });

  // Fetch full competition data
  const loadFullData = async () => {
    try {
      setLoading(true);
      const data = await api.getCompetition(competitionId);
      setCompetition(data);
    } catch (err) {
      console.error('Failed to load competition data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFullData();
  }, [competitionId]);

  // Sync participants, answers, and logs when SSE state signals a change (no continuous polling)
  useEffect(() => {
    if (!gameState) return;
    const timer = window.setTimeout(async () => {
      if (document.hidden) return;
      try {
        const data = await api.getCompetition(competitionId);
        setCompetition((prev) =>
          prev
            ? { ...prev, participants: data.participants, answers: data.answers, logs: data.logs }
            : data
        );
      } catch (e) {
        // silent sync
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [
    competitionId,
    gameState?.gameState,
    gameState?.currentQuestionIndex,
    gameState?.stats.totalParticipants,
    gameState?.stats.activeCount,
    gameState?.stats.eliminatedCount,
    gameState?.stats.rescuedCount,
    gameState?.stats.onlineCount,
    gameState?.stats.answeredCount,
  ]);

  // Execute Master Control Action
  const handleControlAction = async (action: string, payload?: Record<string, unknown>) => {
    try {
      setActionLoading(true);
      soundManager.unlockAudio();

      // Sound triggers
      if (action === 'START_QUESTION') soundManager.playQuestionStart();
      if (action === 'LOCK_ANSWERS') soundManager.playTimesUp();
      if (action === 'REVEAL_ANSWER') soundManager.playRevealAnswer();
      if (action === 'RING_GOLDEN_BELL') soundManager.playGoldenBell();
      if (action === 'RESCUE_STUDENTS') soundManager.playRescueFanfare();

      await api.sendControlAction(competitionId, action, payload);
      await loadFullData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi thực hiện thao tác';
      alert(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Rescue Submit
  const handleExecuteRescue = async () => {
    await handleControlAction('RESCUE_STUDENTS', {
      type: rescueType,
      count: rescueCount,
      className: rescueClass,
    });
    setShowRescueModal(false);
  };

  // Manual participant status update
  const handleParticipantStatus = async (pId: string, status: string) => {
    try {
      await api.updateParticipantStatus(competitionId, pId, status);
      await loadFullData();
    } catch (err) {
      alert('Không thể cập nhật trạng thái');
    }
  };

  // Open Popout Window for Projector / LED Stage Screen
  const handleOpenLedPopoutWindow = () => {
    const url = window.location.origin + '/#projector';
    const win = window.open(
      url,
      'RCV_Projector_Stage_Window',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
    if (!win) {
      alert('Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép popup trên trình duyệt!');
    }
  };

  // Reset / Clear all participants
  const handleClearAllParticipants = async () => {
    if (
      window.confirm(
        'Bạn có chắc chắn muốn XÓA SẠCH toàn bộ danh sách thí sinh để tải lên 66 thí sinh chính thức?'
      )
    ) {
      try {
        await api.clearParticipants(competitionId);
        await loadFullData();
        alert('Đã xóa sạch danh sách thí sinh! Bạn có thể tải danh sách 66 thí sinh chính thức lên.');
      } catch (e) {
        alert('Không thể xóa danh sách');
      }
    }
  };

  // Delete single participant
  const handleDeleteParticipant = async (pId: string, name: string) => {
    if (window.confirm(`Xóa thí sinh "${name}" khỏi danh sách?`)) {
      try {
        await api.deleteParticipant(competitionId, pId);
        await loadFullData();
      } catch (e) {
        alert('Không thể xóa thí sinh');
      }
    }
  };

  // Add single participant
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name.trim()) {
      alert('Vui lòng nhập họ tên thí sinh');
      return;
    }
    try {
      await api.addParticipant(competitionId, newStudent);
      setNewStudent({ name: '', className: '10A1', studentCode: '' });
      setShowAddStudentModal(false);
      await loadFullData();
    } catch (e) {
      alert('Không thể thêm thí sinh');
    }
  };

  // Edit participant handlers
  const handleEditParticipantClick = (p: Participant) => {
    setEditingParticipant({ ...p });
    setShowEditStudentModal(true);
  };

  const handleSaveParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipant) return;
    if (!editingParticipant.name.trim()) {
      alert('Vui lòng nhập họ tên thí sinh');
      return;
    }

    try {
      await api.updateParticipant(competitionId, editingParticipant.id, {
        name: editingParticipant.name,
        className: editingParticipant.className,
        studentCode: editingParticipant.studentCode,
        status: editingParticipant.status,
      });
      setShowEditStudentModal(false);
      setEditingParticipant(null);
      await loadFullData();
    } catch (e) {
      alert('Không thể lưu thông tin thí sinh');
    }
  };

  // Repopulate 66 demo participants
  const handleRepopulateDemoParticipants = async () => {
    if (
      window.confirm(
        'Tạo lại 66 thí sinh mẫu đại diện cho 33 lớp THPT 25-10 để phục vụ thử nghiệm?'
      )
    ) {
      try {
        await api.sendControlAction(competitionId, 'SIMULATE_DEMO_PLAYERS', { count: 66 });
        await loadFullData();
      } catch (e) {
        alert('Không thể tạo danh sách thí sinh mẫu');
      }
    }
  };

  // Download 66 students CSV template
  const handleDownloadStudentTemplate = () => {
    let csv = '\uFEFFSTT,Số báo danh,Họ và tên,Lớp\n';
    let count = 1;
    THPT_2510_CLASSES.forEach((cls) => {
      for (let i = 1; i <= 2; i++) {
        const sbd = `SBD-${String(count).padStart(2, '0')}`;
        csv += `${count},${sbd},Thí sinh ${count},${cls}\n`;
        count++;
      }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mau_danh_sach_66_thi_sinh_THPT_2510.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process text or CSV file import
  const handleParseAndImportStudents = async (text: string) => {
    if (!text.trim()) {
      alert('Dữ liệu trống, vui lòng tải file hoặc dán nội dung CSV');
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    const parsed: Array<{ name: string; className: string; studentCode?: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Skip header line if detected
      if (
        i === 0 &&
        (line.toLowerCase().includes('họ và tên') ||
          line.toLowerCase().includes('sbd') ||
          line.toLowerCase().includes('lớp') ||
          line.toLowerCase().includes('stt'))
      ) {
        continue;
      }

      const parts = line.split(/[,;\t]/).map((s) => s.replace(/^["']|["']$/g, '').trim());
      if (parts.length >= 2) {
        let sbd = '';
        let name = '';
        let cls = '';

        if (parts.length >= 4) {
          sbd = parts[1];
          name = parts[2];
          cls = parts[3];
        } else if (parts.length === 3) {
          if (parts[0].toUpperCase().startsWith('SBD') || !isNaN(Number(parts[0]))) {
            sbd = parts[0];
            name = parts[1];
            cls = parts[2];
          } else {
            name = parts[0];
            cls = parts[1];
            sbd = parts[2];
          }
        } else if (parts.length === 2) {
          name = parts[0];
          cls = parts[1];
        }

        if (name && cls) {
          parsed.push({
            name,
            className: cls.toUpperCase(),
            studentCode: sbd || `SBD-${String(parsed.length + 1).padStart(2, '0')}`,
          });
        }
      }
    }

    if (parsed.length === 0) {
      alert('Không nhận diện được thí sinh nào. Vui lòng kiểm tra định dạng CSV (STT, Số báo danh, Họ và tên, Lớp)');
      return;
    }

    try {
      await api.importParticipants(competitionId, parsed, true);
      setShowImportStudentModal(false);
      setImportStudentText('');
      await loadFullData();
      alert(`Đã tải thành công ${parsed.length} thí sinh vào hệ thống!`);
    } catch (err) {
      alert('Lỗi khi tải danh sách thí sinh: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Save question (Add / Edit)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion || !competition) return;

    let updatedQuestions = [...competition.questions];
    if (editingQuestion.id) {
      updatedQuestions = updatedQuestions.map((q) =>
        q.id === editingQuestion.id ? ({ ...q, ...editingQuestion } as Question) : q
      );
    } else {
      const newQ: Question = {
        id: `q-${Date.now()}`,
        order: updatedQuestions.length + 1,
        type: editingQuestion.type || 'ABCD',
        prompt: editingQuestion.prompt || '',
        options: editingQuestion.options || [
          { id: 'A', text: '' },
          { id: 'B', text: '' },
          { id: 'C', text: '' },
          { id: 'D', text: '' },
        ],
        correctAnswer: editingQuestion.correctAnswer || 'A',
        acceptedAnswers: editingQuestion.acceptedAnswers || [],
        explanation: editingQuestion.explanation || '',
        timeLimitSeconds: editingQuestion.timeLimitSeconds || 15,
        subject: editingQuestion.subject || 'Kiến thức chung',
        gradeLevel: editingQuestion.gradeLevel || 'ALL',
        isActive: true,
      };
      updatedQuestions.push(newQ);
    }

    try {
      setSavingQuestion(true);
      await api.updateCompetition(competitionId, { questions: updatedQuestions });
      setShowQuestionModal(false);
      setEditingQuestion(null);
      await loadFullData();
    } catch (err: any) {
      console.error('Save question error:', err);
      alert('Lỗi: Không thể lưu câu hỏi vào Cloud Firestore. ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setSavingQuestion(false);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    if (!competition) return;

    const filtered = competition.questions.filter((q) => q.id !== qId);
    // re-order
    filtered.forEach((q, idx) => (q.order = idx + 1));
    await api.updateCompetition(competitionId, { questions: filtered });
    await loadFullData();
  };

  // Import questions from file or text
  const handleImportQuestions = async (
    newQuestions: Partial<Question>[],
    mode: 'REPLACE' | 'APPEND'
  ) => {
    if (!competition) return;

    let finalQuestions: Question[] = [];

    if (mode === 'REPLACE') {
      finalQuestions = newQuestions.map((q, idx) => ({
        id: q.id || `q-${Date.now()}-${idx + 1}`,
        order: idx + 1,
        type: q.type || 'ABCD',
        prompt: q.prompt || '',
        options: q.options || [
          { id: 'A', text: '' },
          { id: 'B', text: '' },
          { id: 'C', text: '' },
          { id: 'D', text: '' },
        ],
        correctAnswer: q.correctAnswer || 'A',
        acceptedAnswers: q.acceptedAnswers || [],
        explanation: q.explanation || '',
        timeLimitSeconds: q.timeLimitSeconds || 15,
        subject: q.subject || 'Kiến thức chung',
        gradeLevel: q.gradeLevel || 'ALL',
        isActive: true,
      }));
    } else {
      const existing = [...competition.questions];
      const startOrder = existing.length;
      const appended = newQuestions.map((q, idx) => ({
        id: q.id || `q-${Date.now()}-${startOrder + idx + 1}`,
        order: startOrder + idx + 1,
        type: q.type || 'ABCD',
        prompt: q.prompt || '',
        options: q.options || [
          { id: 'A', text: '' },
          { id: 'B', text: '' },
          { id: 'C', text: '' },
          { id: 'D', text: '' },
        ],
        correctAnswer: q.correctAnswer || 'A',
        acceptedAnswers: q.acceptedAnswers || [],
        explanation: q.explanation || '',
        timeLimitSeconds: q.timeLimitSeconds || 15,
        subject: q.subject || 'Kiến thức chung',
        gradeLevel: q.gradeLevel || 'ALL',
        isActive: true,
      }));
      finalQuestions = [...existing, ...appended];
    }

    try {
      await api.updateCompetition(competitionId, { questions: finalQuestions });
      await loadFullData();
      alert(`Đã lưu thành công ${finalQuestions.length} câu hỏi vào ngân hàng đề!`);
    } catch (err) {
      alert('Không thể lưu câu hỏi vào hệ thống');
    }
  };

  // Bulk update time limit for all questions
  const handleBulkUpdateQuestionsTime = async (seconds: number) => {
    if (!competition) return;
    if (
      !confirm(
        `Bạn có chắc chắn muốn đặt thời gian cho TẤT CẢ ${competition.questions.length} câu hỏi thành ${seconds} giây?`
      )
    ) {
      return;
    }

    const updated = competition.questions.map((q) => ({
      ...q,
      timeLimitSeconds: seconds,
    }));

    try {
      await api.updateCompetition(competitionId, { questions: updated });
      await loadFullData();
    } catch (err) {
      alert('Không thể cập nhật thời gian câu hỏi');
    }
  };

  // Quick change time limit for a single question
  const handleQuickChangeQuestionTime = async (qId: string, seconds: number) => {
    if (!competition) return;
    const updated = competition.questions.map((q) =>
      q.id === qId ? { ...q, timeLimitSeconds: seconds } : q
    );
    try {
      await api.updateCompetition(competitionId, { questions: updated });
      await loadFullData();
    } catch (err) {
      console.error('Failed to quick change time', err);
    }
  };

  // CSV Template download
  const handleDownloadSampleQuestions = () => {
    const sampleCsv = `Thứ tự,Nội dung câu hỏi,Loại (ABCD/TRUE_FALSE/SHORT_ANSWER),Phương án A,Phương án B,Phương án C,Phương án D,Đáp án đúng,Giải thích,Thời gian (s),Môn học
1,Trường THPT 25-10 vinh dự mang tên ngày truyền thống lịch sử vẻ vang nào của Thủy Nguyên?,ABCD,Ngày tiếp quản thị xã,Ngày Thủy Nguyên quật khởi 25/10/1948,Ngày mở trường,Ngày giải phóng Hải Phòng,B,Ngày 25/10/1948 là mốc son hào hùng của quê hương Thủy Nguyên,15,Lịch sử
2,Thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam là gì?,SHORT_ANSWER,,,,,,Hà Nội,Hà Nội là thủ đô nghìn năm văn hiến,20,Địa lý
3,Định luật vạn vật hấp dẫn do nhà bác học Isaac Newton phát minh. Đúng hay Sai?,TRUE_FALSE,Đúng,Sai,,,Đúng,Công bố năm 1687 trong tác phẩm Các nguyên lý toán học,10,Vật lý
4,Hành tinh nào trong Hệ Mặt Trời có nhiều vệ tinh tự nhiên nhất hiện nay?,ABCD,Sao Mộc,Sao Thổ,Sao Hỏa,Sao Kim,B,Sao Thổ có 146 vệ tinh được xác nhận,25,Thiên văn`;

    const blob = new Blob(['\uFEFF' + sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Mau-Cau-Hoi-Rung-Chuong-Vang-THPT-25-10.csv';
    link.click();
  };

  // Filtered Participants List
  const participants = competition?.participants || [];
  const filteredParticipants = participants.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.studentCode && p.studentCode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesClass = filterClass === 'ALL' || p.className === filterClass;
    let matchesStatus = true;
    if (filterStatus === 'ONLINE') {
      matchesStatus = (p.status === 'ACTIVE' || p.status === 'RESCUED') && Boolean(p.isOnline);
    } else if (filterStatus === 'OFFLINE') {
      matchesStatus = !p.isOnline;
    } else if (filterStatus !== 'ALL') {
      matchesStatus = p.status === filterStatus;
    }
    return matchesSearch && matchesClass && matchesStatus;
  });

  const activeCount = participants.filter((p) => p.status === 'ACTIVE' || p.status === 'RESCUED').length;
  const onlineCount = participants.filter((p) => (p.status === 'ACTIVE' || p.status === 'RESCUED') && p.isOnline).length;
  const eliminatedCount = participants.filter((p) => p.status === 'ELIMINATED').length;
  const rescuedCount = participants.filter((p) => p.status === 'RESCUED').length;

  const currentQIndex = gameState?.currentQuestionIndex ?? competition?.currentQuestionIndex ?? 0;
  const currentQ = competition?.questions[currentQIndex] || null;
  const totalQuestions = competition?.questions.length || 0;

  // Answer statistics
  const currentAnswersMap = (competition?.answers && currentQ ? competition.answers[currentQ.id] : {}) || {};
  const totalAnswered = Object.keys(currentAnswersMap).length;

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-50 text-slate-900 p-3 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* SECTION L: TOP QUICK STATUS STRIP */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SchoolLogo size={50} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-700 font-bold">
                BAN TỔ CHỨC THPT 25-10
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 border-2 border-sky-300 text-sky-950 font-mono font-black">
                Phòng: {competition?.roomCode || 'RCV2510'}
              </span>
            </div>
            <h1 className="text-base sm:text-xl font-black text-slate-950 truncate max-w-md">
              {competition?.title || 'RUNG CHUÔNG VÀNG – THPT 25-10'}
            </h1>
          </div>
        </div>

        {/* Realtime Numbers */}
        <div className="flex items-center gap-2 sm:gap-4 text-center">
          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-700 uppercase font-black block">Thí sinh</span>
            <span className="text-lg font-black text-slate-950">{participants.length} / 66</span>
          </div>
          <div className="bg-sky-50 px-3 py-2 rounded-xl border-2 border-sky-300">
            <span className="text-[10px] text-sky-800 uppercase font-black block">Đại diện</span>
            <span className="text-lg font-black text-sky-800">{new Set(participants.map((p) => p.className)).size} / 33 Lớp</span>
          </div>
          <div className="bg-emerald-50 px-3 py-2 rounded-xl border-2 border-emerald-300">
            <span className="text-[10px] text-emerald-800 uppercase font-black block">Còn thi</span>
            <span className="text-lg font-black text-emerald-700">{activeCount}</span>
          </div>
          <div className="bg-rose-50 px-3 py-2 rounded-xl border-2 border-rose-300">
            <span className="text-[10px] text-rose-800 uppercase font-black block">Đã loại</span>
            <span className="text-lg font-black text-rose-700">{eliminatedCount}</span>
          </div>
        </div>

        {/* Quick Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mở cửa sổ LED riêng cho máy chiếu */}
          <button
            type="button"
            onClick={handleOpenLedPopoutWindow}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition active:scale-95 cursor-pointer border border-purple-400/40"
            title="Mở cửa sổ LED độc lập để kéo sang máy chiếu / màn LED sân khấu"
          >
            
            <span>MỞ CỬA SỔ CHIẾU LED</span>
          </button>

          {/* Nút bật/tắt xem song song 50/50 */}
          <button
            type="button"
            onClick={() => setSplitView(!splitView)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              splitView
                ? 'bg-blue-600 text-slate-950 border-sky-400 shadow-md font-extrabold'
                : 'bg-white border border-slate-200 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
            title="Bật/Tắt chế độ xem song song: Bên trái Điều khiển - Bên phải Giám sát LED"
          >
            
            <span className="hidden md:inline">Xem song song (50/50)</span>
          </button>

          {/* Nút bật/tắt khung giám sát LED */}
          <button
            type="button"
            onClick={() => setShowLiveLedMonitor(!showLiveLedMonitor)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              showLiveLedMonitor
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                : 'bg-white border border-slate-200 text-slate-500 border-slate-200 hover:bg-slate-200'
            }`}
            title="Ẩn / Hiện màn hình giám sát LED sân khấu"
          >
            
            <span className="hidden sm:inline">Giám sát LED</span>
          </button>

          {/* Hướng dẫn kết nối 2 màn hình */}
          <button
            type="button"
            onClick={() => setShowDualScreenGuide(true)}
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 transition cursor-pointer"
            title="Hướng dẫn chiếu 2 màn hình (Win + P / HDMI)"
          >
            
          </button>

          {/* QR Code */}
          <button
            type="button"
            onClick={() => setShowQR(true)}
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 transition cursor-pointer"
            title="Chiếu mã QR phòng thi"
          >
            
          </button>
        </div>
      </div>

      {/* SECTION XVI: ONLY 1 PARTICIPANT ALERT */}
      {activeCount === 1 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-600/30 via-yellow-500/20 to-amber-600/30 border-2 border-sky-400 text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl animate-pulse">
          <div className="flex items-center gap-3">
            
            <div>
              <h3 className="text-base font-black text-slate-950 uppercase">
                CHỈ CÒN 01 THÍ SINH TRÊN SÀN THI ĐẤU!
              </h3>
              <p className="text-xs text-slate-800 font-bold">
                Thí sinh: <strong>{participants.find((p) => p.status === 'ACTIVE' || p.status === 'RESCUED')?.name}</strong>. Ban tổ chức có thể tiếp tục các câu hỏi tiếp theo hoặc Trao giải Rung Chuông Vàng!
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleControlAction('RING_GOLDEN_BELL')}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-slate-950 font-black text-xs uppercase shadow transition cursor-pointer"
            >
              TRAO GIẢI RUNG CHUÔNG VÀNG
            </button>
          </div>
        </div>
      )}

      {/* SECTION XVII: COMPETITION FINISHED / CEREMONY ACTIVE BANNER */}
      {(gameState?.gameState !== 'WAITING' && (gameState?.gameState === 'FINISHED' || Boolean(gameState?.ceremonyMode))) && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-950/90 via-amber-950/80 to-slate-900 border-2 border-rose-500 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-950 text-sky-950 border-2 border-sky-400/60 flex items-center justify-center shrink-0">
              
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider">
                  HOÀN THÀNH CUỘC THI
                </span>
                <span className="text-xs font-bold text-slate-800 font-bold">
                  Lễ vinh danh: {gameState?.ceremonyMode === 'TOP3' ? 'Bục Top 3' : gameState?.ceremonyMode === 'TOP5' ? 'Bảng Top 5' : 'Quán Quân Rung Chuông Vàng'}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-950 uppercase mt-0.5">
                RUNG CHUÔNG VÀNG – ĐÃ HOÀN THÀNH CUỘC THI
              </h3>
              <p className="text-xs text-slate-700">
                Để bắt đầu ván đấu mới, đặt lại toàn bộ câu hỏi về Câu 1 và khôi phục tất cả thí sinh:
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                soundManager.stopAll();
                handleControlAction('RESET_COMPETITION');
              }}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm uppercase flex items-center gap-2 shadow-xl shadow-rose-600/40 transition active:scale-95 cursor-pointer border border-rose-300 animate-pulse"
              title="Đặt lại toàn bộ cuộc thi về Câu 1 từ đầu"
            >
              
              <span>VÁN MỚI / QUAY LẠI TỪ ĐẦU</span>
            </button>
          </div>
        </div>
      )}

      {/* TABS HEADER */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('control')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'control' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-800 font-black hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
          }`}
        >
          
          <span>BẢNG ĐIỀU KHIỂN THI</span>
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'participants' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-800 font-black hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
          }`}
        >
          
          <span>QUẢN LÝ THÍ SINH ({participants.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'questions' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-800 font-black hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
          }`}
        >
          
          <span>NGÂN HÀNG CÂU HỎI ({totalQuestions})</span>
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'rules' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-800 font-black hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
          }`}
        >
          
          <span>CÀI ĐẶT LUẬT THI</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'logs' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-800 font-black hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
          }`}
        >
          
          <span>NHẬT KÝ HỆ THỐNG</span>
        </button>
      </div>

      {/* TAB 1: MASTER GAME CONTROL BOARD */}
      {activeTab === 'control' && (
        <div className={splitView ? 'grid grid-cols-1 xl:grid-cols-12 gap-5 items-start' : 'space-y-5'}>
          {/* Main Controls Column */}
          <div className={splitView ? 'xl:col-span-7 space-y-5' : 'space-y-5'}>
            {/* Docked Live LED Monitor when not in split view */}
            {!splitView && showLiveLedMonitor && (
              <LiveLedMonitor
                competitionId={competitionId}
                onOpenPopoutWindow={handleOpenLedPopoutWindow}
              />
            )}

            {/* CURRENT QUESTION STAGE & BIG ACTION BUTTONS */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs uppercase font-extrabold text-slate-700 font-bold tracking-wider">
                  TIẾN TRÌNH THI ĐẤU
                </span>
                <h2 className="text-2xl font-black text-slate-950">
                  CÂU HỎI {currentQ ? currentQ.order : 1} / {totalQuestions}
                  {currentQ?.isTieBreaker && (
                    <span className="ml-2 text-sm px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                      CÂU PHỤ
                    </span>
                  )}
                </h2>
              </div>

              {/* Game State Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold uppercase">Trạng thái:</span>
                <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 border border-slate-200 text-slate-800 font-bold font-mono text-xs font-bold uppercase">
                  {gameState?.gameState || 'WAITING'}
                </span>
                {gameState?.gameState === 'ANSWERING' && (
                  <span className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-400 font-mono text-sm font-black animate-pulse">
                    
                    {secondsRemaining}s
                  </span>
                )}
              </div>
            </div>

            {/* Current Question Detail Box */}
            {currentQ ? (
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 pb-2 border-b border-slate-200">
                  <span className="font-semibold text-blue-400">
                    Môn: {currentQ.subject || 'Chung'} • Loại: {currentQ.type}
                  </span>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    
                    <span className="text-slate-700 font-semibold text-[11px]">Thời gian câu này:</span>
                    <select
                      value={currentQ.timeLimitSeconds || 15}
                      onChange={(e) => handleQuickChangeQuestionTime(currentQ.id, parseInt(e.target.value) || 15)}
                      className="bg-slate-50 text-slate-800 font-bold font-mono font-black text-xs px-2 py-0.5 rounded-lg border border-slate-200 focus:outline-none cursor-pointer"
                      title="Chọn lại thời gian cho câu hỏi này trước khi bắt đầu"
                    >
                      {[5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((sec) => (
                        <option key={sec} value={sec} className="bg-white text-slate-950 font-mono font-bold">
                          {sec} giây
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-lg font-black text-slate-900 leading-relaxed">
                  {currentQ.prompt}
                </p>

                {/* Options display */}
                {currentQ.type === 'ABCD' && currentQ.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {currentQ.options.map((opt) => {
                      const isCorrect = Boolean(
                        currentQ.correctAnswer &&
                          (currentQ.correctAnswer.toUpperCase().trim() === opt.id ||
                            currentQ.correctAnswer.toUpperCase().trim().startsWith(opt.id))
                      );
                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-xl border-2 flex items-center gap-3 text-sm font-bold transition ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-600 text-slate-950 font-black'
                              : 'bg-white border-slate-200 text-slate-950'
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center shrink-0 ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {opt.id}
                          </span>
                          <span className="flex-1 break-words">{opt.text}</span>
                          {isCorrect && (
                            <span className="ml-auto text-xs font-black text-white uppercase bg-emerald-600 px-2 py-0.5 rounded shadow-sm shrink-0">
                              ĐÁP ÁN ĐÚNG
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Short answer / Numeric correct answer display */}
                {currentQ.type !== 'ABCD' && (
                  <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-slate-950 text-sm font-bold">
                    <strong>Đáp án đúng: </strong>
                    <span className="font-mono text-base font-black text-emerald-700">
                      {currentQ.correctAnswer}
                    </span>
                    {currentQ.acceptedAnswers && currentQ.acceptedAnswers.length > 0 && (
                      <span className="text-xs block text-slate-500 mt-1">
                        Biến thể chấp nhận: {currentQ.acceptedAnswers.join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 italic">
                Chưa có câu hỏi nào. Vui lòng thêm câu hỏi vào ngân hàng đề.
              </div>
            )}

            {/* SECTION XIX: MASTER CONTROL ACTION BUTTONS */}
            <div className="space-y-3">
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500 block">
                LỆNH ĐIỀU HÀNH CUỘC THI
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {/* 1. START QUESTION */}
                <button
                  disabled={actionLoading || gameState?.gameState === 'ANSWERING'}
                  onClick={() =>
                    handleControlAction('START_QUESTION', {
                      durationSeconds: currentQ?.timeLimitSeconds || 15,
                    })
                  }
                  className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-lg flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  
                  <span>BẮT ĐẦU CÂU</span>
                </button>

                {/* 2. LOCK ANSWERS */}
                <button
                  disabled={actionLoading || gameState?.gameState !== 'ANSWERING'}
                  onClick={() => handleControlAction('LOCK_ANSWERS')}
                  className="p-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-600 disabled:border disabled:border-slate-300 text-white font-black text-xs uppercase tracking-wider shadow flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  
                  <span>KHÓA ĐÁP ÁN</span>
                </button>

                {/* 3. REVEAL ANSWER */}
                <button
                  disabled={actionLoading}
                  onClick={() => handleControlAction('REVEAL_ANSWER')}
                  className="p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-lg flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  
                  <span>CÔNG BỐ ĐÁP ÁN</span>
                </button>

                {/* 4. CALCULATE RESULTS & ELIMINATE */}
                <button
                  disabled={actionLoading}
                  onClick={() => handleControlAction('CALCULATE_RESULTS')}
                  className="p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-lg flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  
                  <span>LOẠI THÍ SINH SAI</span>
                </button>

                {/* 5. NEXT QUESTION */}
                <button
                  disabled={actionLoading || currentQIndex >= totalQuestions - 1}
                  onClick={() => handleControlAction('NEXT_QUESTION')}
                  className="p-3.5 rounded-2xl bg-sky-700 hover:bg-sky-800 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-lg flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  
                  <span>CÂU TIẾP THEO</span>
                </button>
              </div>

              {/* SECONDARY ROW: RESCUE, DEMO, RESET */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setShowRescueModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-pink-100 hover:bg-pink-200 text-pink-900 border-2 border-pink-400 font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
                >
                  
                  <span>TỔ CHỨC CỨU TRỢ ({eliminatedCount} đã loại)</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllParticipants}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                  title="Xóa hết toàn bộ thí sinh để tải danh sách mới"
                >
                  
                  <span>XÓA HẾT THÍ SINH</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportStudentModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                  title="Tải lên file danh sách 66 thí sinh chính thức"
                >
                  
                  <span>TẢI LÊN 66 THÍ SINH</span>
                </button>

                <button
                  onClick={() => handleControlAction('SIMULATE_DEMO_PLAYERS', { count: 66 })}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                >
                  
                  <span>KHỞI TẠO 66 THÍ SINH DEMO</span>
                </button>

                {gameState?.gameState === 'ANSWERING' && (
                  <button
                    onClick={() => handleControlAction('SIMULATE_DEMO_ANSWERS')}
                    className="px-4 py-2.5 rounded-xl bg-sky-50 text-sky-950 text-sky-950 hover:bg-blue-600 text-white/30 text-slate-800 font-bold border border-slate-300 font-bold text-xs flex items-center gap-2 transition cursor-pointer animate-pulse"
                  >
                    <span>⚡ GIẢ LẬP THÍ SINH NỘP BÀI</span>
                  </button>
                )}

                {/* CÁC CHẾ ĐỘ VINH DANH: QUÁN QUÂN, TOP 3, TOP 5 */}
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.unlockAudio();
                      soundManager.playVictory();
                      handleControlAction('SET_CEREMONY_MODE', { mode: 'CHAMPION' });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-lg hover:from-amber-400 hover:to-yellow-300 transition cursor-pointer"
                    title="Rung Chuông Vàng - Vinh danh Quán Quân xuất sắc nhất"
                  >
                    
                    <span>RUNG CHUÔNG VÀNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.unlockAudio();
                      soundManager.playPodiumFanfare(2);
                      handleControlAction('SET_CEREMONY_MODE', { mode: 'TOP3' });
                    }}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                    title="Bục Vinh Quang Top 3 (Hạng 1, Hạng 2, Hạng 3)"
                  >
                    
                    <span>BỤC TOP 3</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.unlockAudio();
                      soundManager.playPodiumFanfare(3);
                      handleControlAction('SET_CEREMONY_MODE', { mode: 'TOP5' });
                    }}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                    title="Bảng Vàng Top 5 Thí sinh xuất sắc nhất"
                  >
                    
                    <span>BẢNG TOP 5</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.stopAll();
                      handleControlAction('RESET_COMPETITION');
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition active:scale-95 cursor-pointer border border-rose-400"
                    title="Đặt lại toàn bộ cuộc thi về Câu 1 để bắt đầu ván mới"
                  >
                    
                    <span>VÁN MỚI / QUAY LẠI TỪ ĐẦU</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BÀN ĐIỀU KHIỂN ÂM THANH TRÒ CHƠI SÔI ĐỘNG (LIVE GAME SHOW SOUNDBOARD) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-50 text-sky-950 text-sky-950 text-slate-700 font-bold border border-slate-200">
                  
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-950 tracking-wide flex items-center gap-2">
                    <span>HIỆU ỨNG ÂM THANH TRÒ CHƠI SÔI ĐỘNG</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                      Chuẩn Game Show
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Bấm để phát nhanh âm thanh phù hợp từng phần của hội thi (Kèn mở câu, đếm ngược, tiếng vỗ tay, chuông vàng...)
                  </span>
                </div>
              </div>

              {/* BGM Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.unlockAudio();
                    const active = soundManager.toggleBackgroundMusic();
                    setBgmPlaying(active);
                  }}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 border transition cursor-pointer ${
                    bgmPlaying
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse shadow-lg shadow-emerald-500/20'
                      : 'bg-white border border-slate-200 text-slate-700 border-slate-200 hover:text-slate-950 hover:bg-slate-200'
                  }`}
                  title="Bật/Tắt nhạc nền sôi động trong lúc chờ đợi và thi đấu"
                >
                  
                  <span>{bgmPlaying ? 'Nhạc nền Game: ĐANG BẬT' : 'Bật Nhạc Nền Game'}</span>
                </button>
              </div>
            </div>

            {/* Quick Trigger Sound Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundManager.unlockAudio();
                  soundManager.playQuestionStart();
                }}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-emerald-500/50 text-slate-800 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center group shadow-md"
              >
                
                <span className="text-[11px] font-bold">Kèn mở câu</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.unlockAudio();
                  soundManager.playCountdownBeat(3);
                }}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-sky-400/50 text-slate-800 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center group shadow-md"
              >
                
                <span className="text-[11px] font-bold">Đếm ngược gấp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.unlockAudio();
                  soundManager.playTimesUp();
                }}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-rose-500/50 text-slate-800 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center group shadow-md"
              >
                
                <span className="text-[11px] font-bold">Còi hết giờ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.unlockAudio();
                  soundManager.playRevealAnswer();
                }}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-500/50 text-slate-800 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center group shadow-md"
              >
                
                <span className="text-[11px] font-bold">Trống đáp án</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.unlockAudio();
                  soundManager.playCorrect();
                }}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-emerald-500/50 text-slate-800 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center group shadow-md"
              >
                
                <span className="text-[11px] font-bold">Đúng + Vỗ tay</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.unlockAudio();
                  soundManager.playEliminated();
                }}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-orange-500/50 text-slate-800 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center group shadow-md"
              >
                
                <span className="text-[11px] font-bold">Bị loại vui</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.unlockAudio();
                  soundManager.playRescueFanfare();
                }}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-pink-500/50 text-slate-800 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center group shadow-md"
              >
                
                <span className="text-[11px] font-bold">Nhạc Cứu trợ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.unlockAudio();
                  soundManager.playGoldenBell();
                }}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-sky-400/50 text-slate-800 font-bold text-xs font-black flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center group shadow-md"
              >
                
                <span className="text-[11px] font-bold">Chuông Vàng</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.unlockAudio();
                  if (soundManager.getIsVictoryPlaying() || victoryPlaying) {
                    soundManager.stopVictory();
                    soundManager.stopAll();
                    setVictoryPlaying(false);
                  } else {
                    soundManager.playVictory();
                    setVictoryPlaying(true);
                  }
                }}
                className={`p-3 rounded-2xl border text-xs font-black flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center group shadow-md col-span-2 sm:col-span-1 ${
                  victoryPlaying
                    ? 'bg-rose-950/60 hover:bg-rose-900/60 border-rose-500/50 text-rose-300 animate-pulse'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-yellow-400/50 text-yellow-300'
                }`}
                title={victoryPlaying ? 'Dừng bài ca chiến thắng lập tức' : 'Bật khúc khải hoàn Rung Chuông Vàng hào hùng'}
              >
                
                <span className="text-[11px] font-bold">{victoryPlaying ? 'DỪNG HÙNG CA' : 'Hùng Ca Vàng'}</span>
              </button>
            </div>
          </div>

          {/* SECTION XX: REALTIME ANSWER STATISTICS & DISTRIBUTION */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                
                <h3 className="text-sm font-extrabold uppercase text-slate-950 tracking-wide">
                  THỐNG KÊ ĐÁP ÁN THỜI GIAN THỰC (CÂU {currentQ ? currentQ.order : 1})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Đã nộp: <strong>{totalAnswered}</strong> / {activeCount} thí sinh
              </span>
            </div>

            {/* Breakdown for ABCD */}
            {currentQ?.type === 'ABCD' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['A', 'B', 'C', 'D'].map((opt) => {
                  const count = gameState?.stats.currentAnswersCount?.[opt as 'A' | 'B' | 'C' | 'D'] || 0;
                  const pct = totalAnswered > 0 ? ((count / totalAnswered) * 100).toFixed(1) : '0';
                  const isCorrect = currentQ.correctAnswer === opt;

                  return (
                    <div
                      key={opt}
                      className={`p-3.5 rounded-2xl border text-center ${
                        isCorrect
                          ? 'bg-emerald-950/40 border-emerald-500/50'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <span className="text-xs text-slate-500 font-bold block mb-1">
                        Phương án {opt} {isCorrect && '✓'}
                      </span>
                      <div className="text-2xl font-black text-slate-950">{count}</div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column in Split View: Live LED Monitor + Stage Direct Controls */}
        {splitView && (
          <div className="xl:col-span-5 sticky top-20 space-y-4">
            <LiveLedMonitor
              competitionId={competitionId}
              onOpenPopoutWindow={handleOpenLedPopoutWindow}
            />

            {/* Quick Monitor Helper Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4 text-xs space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-800 font-bold uppercase flex items-center gap-1.5">
                  
                  <span>TRẠNG THÁI MÀN HÌNH NGOÀI</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono text-[10px]">
                  SẴN SÀNG CHIẾU
                </span>
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Màn hình LED này đang hiển thị thời gian thực theo từng giây cho khán giả và thí sinh. Nhấn nút dưới để mở cửa sổ LED chiếu ra máy chiếu / LED hội trường.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenLedPopoutWindow}
                  className="flex-1 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                >
                  
                  <span>MỞ CỬA SỔ CHIẾU LED</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDualScreenGuide(true)}
                  className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  
                  <span>Cách dùng 2 màn hình</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

      {/* TAB 2: PARTICIPANTS MANAGEMENT */}
      {activeTab === 'participants' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-950 uppercase flex items-center gap-2">
                
                <span>DANH SÁCH THÍ SINH ({filteredParticipants.length} / {participants.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý 66 thí sinh đại diện cho 33 lớp toàn trường THPT 25-10
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Nút Xóa sạch danh sách thí sinh */}
              <button
                type="button"
                onClick={handleClearAllParticipants}
                className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Xóa sạch danh sách để chuẩn bị tải danh sách mới"
              >
                
                <span>RESET / XÓA HẾT</span>
              </button>

              {/* Nút Tạo lại 66 thí sinh mẫu */}
              <button
                type="button"
                onClick={handleRepopulateDemoParticipants}
                className="px-3 py-2 rounded-xl bg-sky-700/20 hover:bg-blue-700/30 text-purple-300 border border-purple-500/40 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Tạo lại 66 thí sinh mẫu đại diện cho 33 lớp THPT 25-10"
              >
                
                <span>TẠO 66 THÍ SINH MẪU</span>
              </button>

              {/* Nút Tải lên danh sách thí sinh */}
              <button
                type="button"
                onClick={() => setShowImportStudentModal(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                title="Tải lên danh sách 66 thí sinh chính thức từ file CSV / Excel"
              >
                
                <span>TẢI LÊN FILE CSV (66 THÍ SINH)</span>
              </button>

              {/* Nút Tải file CSV mẫu */}
              <button
                type="button"
                onClick={handleDownloadStudentTemplate}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Tải file mẫu CSV để điền tên 66 thí sinh"
              >
                
                <span>TẢI MẪU CSV</span>
              </button>

              {/* Nút Thêm thí sinh thủ công */}
              <button
                type="button"
                onClick={() => setShowAddStudentModal(true)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Thêm từng thí sinh thủ công"
              >
                
                <span>THÊM THÍ SINH</span>
              </button>

              {/* Export CSV button */}
              <a
                href={api.getExportUrl(competitionId)}
                download
                className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center gap-1.5 transition"
                title="Xuất bảng điểm / kết quả ra CSV"
              >
                
                <span>XUẤT KẾT QUẢ</span>
              </a>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              
              <input
                type="text"
                placeholder="Tìm họ tên, lớp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-950 font-bold focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Lớp:</span>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-950 font-bold focus:outline-none"
              >
                <option value="ALL">Tất cả 33 lớp</option>
                {Object.entries(THPT_2510_CLASSES_BY_GRADE).map(([gradeTitle, classList]) => (
                  <optgroup key={gradeTitle} label={gradeTitle} className="bg-slate-50 font-bold text-slate-700 font-bold">
                    {classList.map((c) => (
                      <option key={c} value={c} className="bg-white text-slate-950 font-medium">
                        Lớp {c}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Trạng thái:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-950 font-bold focus:outline-none"
              >
                <option value="ALL">Tất cả trạng thái ({participants.length})</option>
                <option value="ONLINE">🟢 Đang thi & Online ({onlineCount})</option>
                <option value="OFFLINE">⚪ Đã thoát app / Offline ({participants.length - onlineCount})</option>
                <option value="ACTIVE">Đang thi (ACTIVE - {activeCount})</option>
                <option value="ELIMINATED">Đã bị loại (ELIMINATED - {eliminatedCount})</option>
                <option value="RESCUED">Được cứu trợ (RESCUED - {rescuedCount})</option>
              </select>
            </div>
          </div>

          {/* Participants Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3">STT</th>
                  
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3">Lớp (33 lớp)</th>
                  <th className="p-3">Trạng thái thi & Kết nối</th>
                  <th className="p-3">Đúng / Sai</th>
                  <th className="p-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                      Không tìm thấy thí sinh nào phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                      
                      <td className="p-3 font-black text-slate-950">{p.name}</td>
                      <td className="p-3 font-semibold text-blue-300">{p.className}</td>
                      <td className="p-3">
                        {p.status === 'ACTIVE' && (
                          p.isOnline ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 font-bold text-[11px]">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Đang thi (Online)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-500 font-semibold text-[11px]" title="Thí sinh đã đóng app hoặc ngắt kết nối">
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              <span>Đã thoát app (Offline)</span>
                            </span>
                          )
                        )}
                        {p.status === 'ELIMINATED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-400 font-bold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Bị loại {p.eliminatedAtQuestionOrder && `(câu ${p.eliminatedAtQuestionOrder})`}</span>
                          </span>
                        )}
                        {p.status === 'RESCUED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-slate-300 text-slate-700 font-bold font-bold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Được cứu {p.isOnline ? '(Online)' : '(Offline)'}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono">
                        <span className="text-emerald-400 font-bold">{p.totalCorrect}</span> /{' '}
                        <span className="text-rose-400 font-bold">{p.totalWrong}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditParticipantClick(p)}
                            className="p-1 rounded bg-white border border-slate-200 hover:bg-sky-50 text-sky-950 text-sky-950 text-slate-500 hover:text-slate-800 font-bold transition"
                            title="Sửa thông tin thí sinh (SBD, Họ tên, Lớp)"
                          >
                            
                          </button>
                          {p.status === 'ELIMINATED' ? (
                            <button
                              onClick={() => handleParticipantStatus(p.id, 'RESCUED')}
                              className="px-2 py-1 rounded bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600 hover:text-slate-950 transition font-bold"
                              title="Khôi phục thí sinh vào thi"
                            >
                              Khôi phục
                            </button>
                          ) : (
                            <button
                              onClick={() => handleParticipantStatus(p.id, 'ELIMINATED')}
                              className="px-2 py-1 rounded bg-rose-600/30 text-rose-300 hover:bg-rose-600 hover:text-slate-950 transition font-bold"
                              title="Loại thủ công thí sinh"
                            >
                              Loại
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteParticipant(p.id, p.name)}
                            className="p-1 rounded bg-white border border-slate-200 hover:bg-rose-100 text-slate-500 hover:text-rose-400 transition"
                            title="Xóa thí sinh này khỏi danh sách"
                          >
                            
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QUESTION BANK MANAGEMENT */}
      {activeTab === 'questions' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-950 uppercase flex items-center gap-2">
                
                <span>NGÂN HÀNG CÂU HỎI ({competition?.questions.length || 0})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Quản lý các câu hỏi chính thức và câu hỏi phụ của cuộc thi.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleDownloadSampleQuestions}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Tải file mẫu CSV có cột Thời gian"
              >
                
                <span>Tải file mẫu</span>
              </button>

              <button
                onClick={() => setShowImportQuestionModal(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                title="Tải lên file câu hỏi và tùy chọn thời gian cho từng câu"
              >
                
                <span>TẢI LÊN CÂU HỎI (FILE)</span>
              </button>

              <button
                onClick={() => {
                  setEditingQuestion({
                    order: (competition?.questions.length || 0) + 1,
                    type: 'ABCD',
                    prompt: '',
                    options: [
                      { id: 'A', text: '' },
                      { id: 'B', text: '' },
                      { id: 'C', text: '' },
                      { id: 'D', text: '' },
                    ],
                    correctAnswer: 'A',
                    timeLimitSeconds: 15,
                    subject: 'Kiến thức chung',
                  });
                  setShowQuestionModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow"
              >
                
                <span>THÊM CÂU HỎI</span>
              </button>
            </div>
          </div>

          {/* Quick Bulk Time Adjustment Bar */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2">
              
              <span className="text-xs font-bold text-slate-800">
                Đổi thời gian nhanh cho TẤT CẢ ({competition?.questions.length || 0}) câu hỏi:
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[10, 15, 20, 25, 30, 45, 60].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleBulkUpdateQuestionsTime(sec)}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-blue-600 text-slate-950 font-black text-xs transition border border-slate-200 active:scale-95 cursor-pointer shadow-sm"
                  title={`Đặt tất cả câu hỏi thành ${sec} giây`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-3">
            {competition?.questions.map((q) => (
              <div
                key={q.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-slate-950 font-black text-xs">
                      CÂU {q.order}
                    </span>
                    <span className="text-xs font-bold text-purple-400 uppercase">
                      {q.type}
                    </span>
                    <span className="text-xs text-slate-500">• {q.subject || 'Chung'}</span>

                    {/* Inline Quick Time Editor */}
                    <div
                      className="relative inline-flex items-center gap-1 bg-white border border-slate-200 hover:border-sky-400/60 rounded-lg px-2 py-0.5 text-xs text-slate-800 font-bold font-mono font-bold transition"
                      title="Bấm để đổi thời gian trả lời cho câu này"
                    >
                      
                      <select
                        value={q.timeLimitSeconds || 15}
                        onChange={(e) => handleQuickChangeQuestionTime(q.id, parseInt(e.target.value) || 15)}
                        className="bg-transparent text-slate-800 font-bold font-bold font-mono focus:outline-none cursor-pointer"
                      >
                        {[5, 10, 15, 20, 25, 30, 40, 45, 60, 90, 120].map((sec) => (
                          <option key={sec} value={sec} className="bg-white text-slate-950 font-mono font-bold">
                            {sec}s
                          </option>
                        ))}
                      </select>
                    </div>

                    {q.isTieBreaker && (
                      <span className="px-2 py-0.5 rounded bg-rose-900/50 text-rose-300 text-[10px] font-bold">
                        CÂU PHỤ
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-black text-slate-950">{q.prompt}</p>
                  <p className="text-xs text-emerald-400 font-semibold">
                    Đáp án đúng: <strong>{q.correctAnswer}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setEditingQuestion(q);
                      setShowQuestionModal(true);
                    }}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-200 text-blue-400 transition"
                    title="Chỉnh sửa câu hỏi"
                  >
                    
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-rose-100 text-rose-400 transition"
                    title="Xóa câu hỏi"
                  >
                    
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RULES SETTINGS */}
      {activeTab === 'rules' && competition && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-extrabold text-slate-950 uppercase flex items-center gap-2">
              
              <span>CÀI ĐẶT LUẬT THI ĐẤU</span>
            </h3>
            <p className="text-xs text-slate-500">
              Tùy chỉnh quy chế loại trực tiếp, thời gian, và cứu trợ cho kỳ thi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-bold text-slate-950 font-black block">Trả lời sai bị loại ngay</span>
                <span className="text-xs text-slate-500">Thí sinh trả lời sai sẽ bị chuyển sang trạng thái bị loại</span>
              </div>
              <input
                type="checkbox"
                checked={competition.rules.eliminateOnWrong}
                onChange={(e) => {
                  const updated = { ...competition.rules, eliminateOnWrong: e.target.checked };
                  api.updateCompetition(competitionId, { rules: updated });
                  setCompetition({ ...competition, rules: updated });
                }}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </label>

            <label className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-bold text-slate-950 font-black block">Không trả lời bị loại</span>
                <span className="text-xs text-slate-500">Hết giờ mà chưa gửi đáp án sẽ tự động bị loại</span>
              </div>
              <input
                type="checkbox"
                checked={competition.rules.eliminateOnNoAnswer}
                onChange={(e) => {
                  const updated = { ...competition.rules, eliminateOnNoAnswer: e.target.checked };
                  api.updateCompetition(competitionId, { rules: updated });
                  setCompetition({ ...competition, rules: updated });
                }}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </label>

            <label className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-bold text-slate-950 font-black block">Khóa phòng khi bắt đầu</span>
                <span className="text-xs text-slate-500">Không cho phép thí sinh vào muộn sau khi cuộc thi bắt đầu</span>
              </div>
              <input
                type="checkbox"
                checked={competition.rules.lockRoomOnStart}
                onChange={(e) => {
                  const updated = { ...competition.rules, lockRoomOnStart: e.target.checked };
                  api.updateCompetition(competitionId, { rules: updated });
                  setCompetition({ ...competition, rules: updated });
                }}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </label>

            <label className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-bold text-slate-950 font-black block">Cho phép cứu trợ</span>
                <span className="text-xs text-slate-500">Bật tính năng cứu trợ thí sinh quay lại sàn đấu</span>
              </div>
              <input
                type="checkbox"
                checked={competition.rules.allowRescue}
                onChange={(e) => {
                  const updated = { ...competition.rules, allowRescue: e.target.checked };
                  api.updateCompetition(competitionId, { rules: updated });
                  setCompetition({ ...competition, rules: updated });
                }}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM LOGS */}
      {activeTab === 'logs' && competition && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xl space-y-4">
          <h3 className="text-base font-extrabold text-slate-950 uppercase flex items-center gap-2">
            
            <span>NHẬT KÝ HỆ THỐNG ({competition.logs.length})</span>
          </h3>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {competition.logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                  </span>
                  <span className="mx-2 text-slate-600">•</span>
                  <strong className="text-slate-950 font-black">{log.action}</strong>
                  {log.details && <span className="text-slate-500 ml-1">({log.details})</span>}
                </div>
                <span className="text-slate-700 font-bold font-semibold">{log.performedBy}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RESCUE MODAL */}
      {showRescueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-950 uppercase">CỨU TRỢ THÍ SINH</h3>
                <p className="text-xs text-slate-500">
                  Số thí sinh đang bị loại: <strong>{eliminatedCount}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Hình thức cứu trợ
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setRescueType('ALL')}
                    className={`p-2.5 rounded-xl border font-bold ${
                      rescueType === 'ALL'
                        ? 'bg-blue-600 text-slate-950 border-sky-400'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Cứu TOÀN BỘ ({eliminatedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescueType('RANDOM')}
                    className={`p-2.5 rounded-xl border font-bold ${
                      rescueType === 'RANDOM'
                        ? 'bg-blue-600 text-slate-950 border-sky-400'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Ngẫu nhiên N bạn
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescueType('CLASS')}
                    className={`p-2.5 rounded-xl border font-bold ${
                      rescueType === 'CLASS'
                        ? 'bg-blue-600 text-slate-950 border-sky-400'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Cứu theo Lớp
                  </button>
                </div>
              </div>

              {rescueType === 'RANDOM' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Số lượng thí sinh cần cứu
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={eliminatedCount}
                    value={rescueCount}
                    onChange={(e) => setRescueCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-950 font-bold"
                  />
                </div>
              )}

              {rescueType === 'CLASS' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Chọn Lớp cần cứu trợ (1 trong 33 lớp)
                  </label>
                  <select
                    value={rescueClass}
                    onChange={(e) => setRescueClass(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 font-bold font-bold"
                  >
                    {Object.entries(THPT_2510_CLASSES_BY_GRADE).map(([gradeTitle, classList]) => (
                      <optgroup key={gradeTitle} label={gradeTitle} className="bg-slate-50 font-bold text-slate-700 font-bold">
                        {classList.map((cls) => (
                          <option key={cls} value={cls} className="bg-white text-slate-950 font-bold">
                            Lớp {cls}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowRescueModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs"
              >
                HỦY BỎ
              </button>
              <button
                onClick={handleExecuteRescue}
                className="flex-1 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs uppercase"
              >
                XÁC NHẬN CỨU TRỢ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION MODAL */}
      {showQuestionModal && editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-950 uppercase">
              {editingQuestion.id ? 'CHỈNH SỬA CÂU HỎI' : 'THÊM CÂU HỎI MỚI'}
            </h3>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nội dung câu hỏi *
                </label>
                <textarea
                  required
                  rows={3}
                  value={editingQuestion.prompt || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, prompt: e.target.value })}
                  placeholder="Nhập nội dung câu hỏi tại đây..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-950 font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Loại câu hỏi
                  </label>
                  <select
                    value={editingQuestion.type || 'ABCD'}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, type: e.target.value as QuestionType })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-950 font-bold"
                  >
                    <option value="ABCD">Trắc nghiệm A-B-C-D</option>
                    <option value="TRUE_FALSE">Đúng / Sai</option>
                    <option value="SHORT_ANSWER">Điền đáp án ngắn</option>
                    <option value="NUMERIC">Câu hỏi số</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">
                      Thời gian (giây)
                    </label>
                    <span className="text-slate-700 font-bold font-mono font-black text-xs">
                      {editingQuestion.timeLimitSeconds || 15}s
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                    {[10, 15, 20, 25, 30, 45, 60].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setEditingQuestion({ ...editingQuestion, timeLimitSeconds: sec })}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          (editingQuestion.timeLimitSeconds || 15) === sec
                            ? 'bg-blue-600 text-slate-950 font-black shadow'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={editingQuestion.timeLimitSeconds || 15}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, timeLimitSeconds: parseInt(e.target.value) || 15 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-950 font-bold"
                  />
                </div>
              </div>

              {/* Options for ABCD */}
              {editingQuestion.type === 'ABCD' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Các phương án lựa chọn:
                  </label>
                  {['A', 'B', 'C', 'D'].map((optKey, idx) => (
                    <div key={optKey} className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold font-bold flex items-center justify-center shrink-0">
                        {optKey}
                      </span>
                      <input
                        type="text"
                        required
                        value={editingQuestion.options?.[idx]?.text || ''}
                        onChange={(e) => {
                          const opts = [...(editingQuestion.options || [])];
                          opts[idx] = { id: optKey, text: e.target.value };
                          setEditingQuestion({ ...editingQuestion, options: opts });
                        }}
                        placeholder={`Nội dung phương án ${optKey}`}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-950 font-bold"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs font-bold text-emerald-400 uppercase mt-2 mb-1">
                      Đáp án đúng:
                    </label>
                    <select
                      value={editingQuestion.correctAnswer || 'A'}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                      className="w-full bg-slate-50 border border-emerald-500 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold"
                    >
                      <option value="A">Phương án A</option>
                      <option value="B">Phương án B</option>
                      <option value="C">Phương án C</option>
                      <option value="D">Phương án D</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Non-ABCD Correct Answer */}
              {editingQuestion.type !== 'ABCD' && (
                <div>
                  <label className="block text-xs font-bold text-emerald-400 uppercase mb-1">
                    Đáp án đúng *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingQuestion.correctAnswer || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                    placeholder="Nhập đáp án chuẩn..."
                    className="w-full bg-slate-50 border border-emerald-500 rounded-xl px-3 py-2 text-sm text-emerald-400 font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Giải thích chi tiết (Hiện sau khi công bố)
                </label>
                <textarea
                  rows={2}
                  value={editingQuestion.explanation || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  placeholder="Giải thích thêm kiến thức bổ ích..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-950 font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs"
                >
                  ĐÓNG
                </button>
                <button
                  type="submit"
                  disabled={savingQuestion}
                  className="flex-1 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-700 text-white font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingQuestion ? 'ĐANG LƯU VÀO FIRESTORE...' : (editingQuestion.id ? 'CẬP NHẬT CÂU HỎI' : 'LƯU CÂU HỎI')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TẢI LÊN DANH SÁCH 66 THÍ SINH (CSV / EXCEL) */}
      {showImportStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                
                <h3 className="text-base font-black text-slate-950 uppercase">
                  TẢI LÊN DANH SÁCH 66 THÍ SINH CHÍNH THỨC
                </h3>
              </div>
              <button
                onClick={() => setShowImportStudentModal(false)}
                className="text-slate-500 hover:text-slate-950 p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 text-xs text-blue-200 space-y-2">
              <p className="font-black text-slate-950">
                💡 Hướng dẫn cấu trúc danh sách thí sinh (File CSV hoặc dán văn bản):
              </p>
              <p>
                Mỗi dòng là 1 thí sinh theo định dạng: <code className="bg-slate-50 px-2 py-0.5 rounded text-slate-800 font-bold font-mono">STT, Số báo danh, Họ và tên, Lớp</code> hoặc <code className="bg-slate-50 px-2 py-0.5 rounded text-slate-800 font-bold font-mono">Số báo danh, Họ và tên, Lớp</code>
              </p>
              <p className="text-[11px] text-slate-500">
                Ví dụ: <code className="text-amber-200">1, SBD-01, Nguyễn Thị Mai, 10A1</code>
              </p>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadStudentTemplate}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                
                <span>1. TẢI FILE MẪU CSV (66 THÍ SINH)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  let sample = 'STT,Số báo danh,Họ và tên,Lớp\n';
                  let count = 1;
                  THPT_2510_CLASSES.forEach((cls) => {
                    for (let i = 1; i <= 2; i++) {
                      sample += `${count},SBD-${String(count).padStart(2, '0')},Thí sinh đại diện ${count},${cls}\n`;
                      count++;
                    }
                  });
                  setImportStudentText(sample);
                }}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-emerald-300 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                
                <span>2. TỰ ĐỘNG ĐIỀN 66 DÒNG MẪU VÀO KHUNG</span>
              </button>

              <label className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow">
                
                <span>3. CHỌN FILE TỪ MÁY TÍNH (.CSV / .TXT)</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        setImportStudentText(content || '');
                      };
                      reader.readAsText(file, 'utf-8');
                    }
                  }}
                />
              </label>
            </div>

            {/* CSV Content Textarea */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nội dung danh sách thí sinh (Dán vào đây hoặc sửa trực tiếp):
              </label>
              <textarea
                rows={10}
                value={importStudentText}
                onChange={(e) => setImportStudentText(e.target.value)}
                placeholder={'STT,Số báo danh,Họ và tên,Lớp\n1,SBD-01,Nguyễn Văn An,10A1\n2,SBD-02,Trần Thị Bình,10A1\n3,SBD-03,Lê Hoàng Nam,10A2\n...'}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-blue-500"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                Số dòng hiện tại: {importStudentText.trim() ? importStudentText.trim().split(/\r?\n/).length : 0} dòng
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportStudentModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs"
              >
                HỦY BỎ
              </button>
              <button
                type="button"
                onClick={() => handleParseAndImportStudents(importStudentText)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                
                <span>LƯU VÀO DANH SÁCH CHÍNH THỨC</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: THÊM THÍ SINH THỦ CÔNG */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                
                <h3 className="text-base font-black text-slate-950 uppercase">
                  THÊM THÍ SINH THỦ CÔNG
                </h3>
              </div>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-500 hover:text-slate-950 p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Họ và tên thí sinh *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-950 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Lớp (Chọn 1 trong 33 lớp) *
                </label>
                <select
                  value={newStudent.className}
                  onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-bold font-bold"
                >
                  {Object.entries(THPT_2510_CLASSES_BY_GRADE).map(([gradeTitle, classList]) => (
                    <optgroup key={gradeTitle} label={gradeTitle} className="bg-slate-50 font-bold text-slate-700 font-bold">
                      {classList.map((cls) => (
                        <option key={cls} value={cls} className="bg-white text-slate-950 font-bold">
                          Lớp {cls}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Số báo danh (SBD)
                </label>
                <input
                  type="text"
                  placeholder={`Mặc định: SBD-${String(participants.length + 1).padStart(2, '0')}`}
                  value={newStudent.studentCode}
                  onChange={(e) => setNewStudent({ ...newStudent, studentCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-950 font-mono font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-slate-950 font-black text-xs uppercase shadow cursor-pointer"
                >
                  XÁC NHẬN THÊM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PARTICIPANT MODAL */}
      {showEditStudentModal && editingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 uppercase flex items-center gap-2">
                
                <span>SỬA THÔNG TIN THÍ SINH</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditStudentModal(false);
                  setEditingParticipant(null);
                }}
                className="text-slate-500 hover:text-slate-950 cursor-pointer"
              >
                
              </button>
            </div>

            <form onSubmit={handleSaveParticipant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Số báo danh (SBD) *
                </label>
                <input
                  type="text"
                  required
                  value={editingParticipant.studentCode || ''}
                  onChange={(e) =>
                    setEditingParticipant({ ...editingParticipant, studentCode: e.target.value.toUpperCase() })
                  }
                  placeholder="VD: SBD-01"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 font-bold font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Họ và tên thí sinh *
                </label>
                <input
                  type="text"
                  required
                  value={editingParticipant.name || ''}
                  onChange={(e) =>
                    setEditingParticipant({ ...editingParticipant, name: e.target.value })
                  }
                  placeholder="Nhập họ và tên..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-950 font-bold font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Lớp (33 Lớp)
                  </label>
                  <select
                    value={editingParticipant.className || '10A1'}
                    onChange={(e) =>
                      setEditingParticipant({ ...editingParticipant, className: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-950 font-bold"
                  >
                    {Object.entries(THPT_2510_CLASSES_BY_GRADE).map(([gradeTitle, classList]) => (
                      <optgroup key={gradeTitle} label={gradeTitle} className="bg-slate-50 font-bold text-slate-700 font-bold">
                        {classList.map((c) => (
                          <option key={c} value={c} className="bg-white text-slate-950 font-bold">
                            Lớp {c}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Trạng thái thi
                  </label>
                  <select
                    value={editingParticipant.status || 'ACTIVE'}
                    onChange={(e) =>
                      setEditingParticipant({
                        ...editingParticipant,
                        status: e.target.value as 'ACTIVE' | 'ELIMINATED' | 'RESCUED',
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-950 font-bold"
                  >
                    <option value="ACTIVE">Đang thi</option>
                    <option value="ELIMINATED">Bị loại</option>
                    <option value="RESCUED">Được cứu</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditStudentModal(false);
                    setEditingParticipant(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-slate-950 font-black text-xs uppercase shadow cursor-pointer"
                >
                  LƯU THAY ĐỔI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT QUESTIONS MODAL */}
      <ImportQuestionModal
        isOpen={showImportQuestionModal}
        onClose={() => setShowImportQuestionModal(false)}
        onImport={handleImportQuestions}
        currentQuestionsCount={competition?.questions.length || 0}
      />

      {/* DUAL SCREEN SETUP GUIDE MODAL */}
      <DualScreenGuideModal
        isOpen={showDualScreenGuide}
        onClose={() => setShowDualScreenGuide(false)}
        onOpenLedWindow={handleOpenLedPopoutWindow}
      />

      {/* QR MODAL */}
      <QRCodeModal
        roomCode={competition?.roomCode || 'RCV2510'}
        isOpen={showQR}
        onClose={() => setShowQR(false)}
      />
    </div>
  );
};
