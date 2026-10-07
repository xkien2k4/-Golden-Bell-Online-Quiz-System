import React, { useState, useEffect, useRef } from 'react';
import { SchoolLogo } from '../components/SchoolLogo';
import { api } from '../services/api';
import { useRealtimeGame } from '../hooks/useRealtimeGame';
import { Participant, THPT_2510_CLASSES, THPT_2510_CLASSES_BY_GRADE } from '../types';
import { soundManager } from '../utils/soundEffects';

interface StudentViewProps {
  initialRoomCode?: string;
  onBackToHome?: () => void;
  isGuestMode?: boolean;
}

export const StudentView: React.FC<StudentViewProps> = ({
  initialRoomCode = 'RCV2510',
  onBackToHome,
  isGuestMode = false,
}) => {
  // Join / Registration Form State
  const [roomCode, setRoomCode] = useState<string>(() => {
    return (initialRoomCode || 'RCV2510').trim().toUpperCase();
  });
  const [name, setName] = useState<string>('');
  const [className, setClassName] = useState<string>('10A1');
  const [studentCode, setStudentCode] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Active Contestant Session State
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [competitionId, setCompetitionId] = useState<string>('comp-thpt-2510');
  const [roomInfo, setRoomInfo] = useState<{
    id: string;
    title: string;
    schoolName: string;
    totalParticipants: number;
    status: string;
  } | null>(null);

  // Rescue notification banner
  const [showRescuedBanner, setShowRescuedBanner] = useState<boolean>(false);
  const prevStatusRef = useRef<string | null>(null);

  // Answer Submission State
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [shortAnswerText, setShortAnswerText] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<string>('');
  const [submissionTimeMs, setSubmissionTimeMs] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Anti-Cheat & Screen Lock State
  const [visibilityWarnings, setVisibilityWarnings] = useState<number>(0);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);

  // Sync initialRoomCode if prop changes
  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode.trim().toUpperCase());
    }
  }, [initialRoomCode]);

  // Lookup room information and restore active participant if any
  useEffect(() => {
    const cleanCode = (roomCode || 'RCV2510').trim().toUpperCase();
    const saved = localStorage.getItem(`rcv_participant_${cleanCode}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.name) {
          setCurrentParticipant(parsed);
          prevStatusRef.current = parsed.status;
        }
      } catch (e) {}
    }

    if (cleanCode) {
      api
        .lookupRoom(cleanCode)
        .then((res) => {
          if (res && res.id) {
            setCompetitionId(res.id);
            setRoomInfo({
              id: res.id,
              title: res.title,
              schoolName: res.schoolName,
              totalParticipants: res.totalParticipants || 0,
              status: res.status,
            });
          }
        })
        .catch(() => {});
    }
  }, [roomCode]);

  // WakeLock API to keep screen awake during contest
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) {}
    };
    if (currentParticipant) {
      requestWakeLock();
    }
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [currentParticipant]);

  // Real-time Game State Hook
  const { gameState, isConnected, secondsRemaining } = useRealtimeGame({
    competitionId,
    enableSounds: true,
  });

  const currentQ = gameState?.currentQuestion;
  const isGameWaiting = !gameState || gameState.gameState === 'WAITING';
  const isAnswering = gameState?.gameState === 'ANSWERING';
  const isLocked = gameState?.gameState === 'LOCKED';
  const isRevealed = gameState?.gameState === 'ANSWER_REVEALED';
  const isResult = gameState?.gameState === 'RESULT';
  const isFinished = gameState?.gameState === 'FINISHED';
  const isQuestionReady = gameState?.gameState === 'QUESTION_READY';

  // The Question Arena is shown when participant is registered AND game is on an active question
  const showQuestionArena =
    Boolean(currentParticipant) &&
    !isGameWaiting &&
    !isFinished &&
    Boolean(currentQ);

  // Sync participant status from server in real-time
  useEffect(() => {
    if (gameState?.participantStatuses && currentParticipant) {
      const serverStatus = gameState.participantStatuses[currentParticipant.id];
      if (serverStatus && serverStatus.status !== currentParticipant.status) {
        const oldStatus = currentParticipant.status;
        const newStatus = serverStatus.status;
        
        // Detect rescue transition
        if (oldStatus === 'ELIMINATED' && (newStatus === 'RESCUED' || newStatus === 'ACTIVE')) {
          soundManager.playRescueFanfare();
          setShowRescuedBanner(true);
        } else if (newStatus === 'ELIMINATED' && oldStatus !== 'ELIMINATED') {
          soundManager.playEliminated();
        }

        const updated: Participant = {
          ...currentParticipant,
          status: newStatus,
          totalCorrect: serverStatus.totalCorrect ?? currentParticipant.totalCorrect,
          totalWrong: serverStatus.totalWrong ?? currentParticipant.totalWrong,
          eliminatedAtQuestionOrder: serverStatus.eliminatedAtQuestionOrder ?? currentParticipant.eliminatedAtQuestionOrder,
        };
        setCurrentParticipant(updated);
        localStorage.setItem(`rcv_participant_${(roomCode || 'RCV2510').trim().toUpperCase()}`, JSON.stringify(updated));
      }
    }
  }, [gameState?.participantStatuses, currentParticipant, roomCode]);

  // Reset answer board on question advance
  const currentQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentQ?.id && currentQ.id !== currentQuestionIdRef.current) {
      currentQuestionIdRef.current = currentQ.id;
      setSelectedOption('');
      setShortAnswerText('');
      setIsSubmitted(false);
      setSubmittedAnswer('');
      setSubmissionTimeMs(0);
    }
  }, [currentQ?.id]);

  // Heartbeat every 8s to guarantee live presence and sync status
  useEffect(() => {
    if (!currentParticipant || !competitionId) return;
    const interval = setInterval(() => {
      api.heartbeat(competitionId, currentParticipant.id).then((res) => {
        if (res && res.participantStatus && currentParticipant && res.participantStatus !== currentParticipant.status) {
          const oldStatus = currentParticipant.status;
          const newStatus = res.participantStatus as any;
          if (oldStatus === 'ELIMINATED' && (newStatus === 'RESCUED' || newStatus === 'ACTIVE')) {
            soundManager.playRescueFanfare();
            setShowRescuedBanner(true);
          }
          const updated: Participant = { ...currentParticipant, status: newStatus };
          setCurrentParticipant(updated);
          localStorage.setItem(`rcv_participant_${(roomCode || 'RCV2510').trim().toUpperCase()}`, JSON.stringify(updated));
        }
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, [currentParticipant, competitionId, roomCode]);

  // Anti-cheat tab visibility switch handler
  useEffect(() => {
    if (!currentParticipant || isFinished) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const next = visibilityWarnings + 1;
        setVisibilityWarnings(next);
        setShowWarningModal(true);
        api
          .updateParticipantStatus(
            competitionId,
            currentParticipant.id,
            undefined,
            `Chuyển tab / rời ứng dụng lần ${next}`
          )
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentParticipant, visibilityWarnings, competitionId, isFinished]);

  // Handle Joining Room (No Google login required)
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setJoinError('Vui lòng nhập họ và tên của bạn');
      return;
    }
    if (!className) {
      setJoinError('Vui lòng chọn lớp học');
      return;
    }

    soundManager.unlockAudio();
    setIsJoining(true);
    setJoinError(null);

    const cleanRoom = (roomCode || 'RCV2510').trim().toUpperCase();

    try {
      const res = await api.joinRoom(cleanRoom, {
        name: name.trim(),
        className: className.trim().toUpperCase(),
        studentCode: studentCode.trim().toUpperCase() || undefined,
      });

      if (res && res.success && res.participant) {
        setCurrentParticipant(res.participant);
        setCompetitionId(res.competitionId || competitionId);
        localStorage.setItem(`rcv_participant_${cleanRoom}`, JSON.stringify(res.participant));
        soundManager.playButtonClick();
      } else {
        throw new Error('Không thể tham gia phòng thi. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setJoinError(err?.message || 'Không thể vào phòng thi. Vui lòng kiểm tra lại mã phòng.');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle Answer Submission
  const handleSubmitAnswer = async (ansValue: string) => {
    if (!currentParticipant || !currentQ || !isAnswering || isSubmitting) return;

    // Strict client-side check: Eliminated or Spectator students cannot submit answers
    if (currentParticipant.status === 'ELIMINATED' || currentParticipant.status === 'SPECTATOR') {
      alert('Bạn đã dừng cuộc thi ở câu trước và đang ở chế độ quan sát. Vui lòng đợi vòng cứu trợ từ Ban Tổ Chức!');
      return;
    }

    soundManager.unlockAudio();
    setIsSubmitting(true);
    const startT = gameState?.questionStartTime || Date.now();
    const responseTime = Math.max(100, Date.now() - startT);

    try {
      await api.submitAnswer(competitionId, {
        participantId: currentParticipant.id,
        questionId: currentQ.id,
        answer: ansValue,
        clientResponseTimeMs: responseTime,
      });

      setIsSubmitted(true);
      setSubmittedAnswer(ansValue);
      setSubmissionTimeMs(responseTime);
      soundManager.playButtonClick();
    } catch (err: any) {
      const errorMsg = err?.message || 'Lỗi kết nối khi gửi đáp án';
      // If server rejected because participant is eliminated
      if (errorMsg.includes('quan sát') || errorMsg.includes('dừng cuộc thi') || errorMsg.includes('cứu trợ')) {
        const updated: Participant = { ...currentParticipant, status: 'ELIMINATED' };
        setCurrentParticipant(updated);
        localStorage.setItem(`rcv_participant_${(roomCode || 'RCV2510').trim().toUpperCase()}`, JSON.stringify(updated));
      }
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch / Re-register contestant handler
  const handleSwitchParticipant = () => {
    if (confirm('Bạn muốn đăng ký lại hoặc đổi thông tin thí sinh?')) {
      if (currentParticipant) {
        localStorage.removeItem(`rcv_participant_${roomCode}`);
      }
      setCurrentParticipant(null);
      setName('');
    }
  };

  // Leave room handler
  const handleLeaveRoom = () => {
    if (confirm('Bạn có chắc chắn muốn rời phòng thi?')) {
      if (currentParticipant) {
        api.leaveRoom(competitionId, currentParticipant.id).catch(() => {});
        localStorage.removeItem(`rcv_participant_${roomCode}`);
      }
      setCurrentParticipant(null);
    }
  };

  // ==========================================
  // 1. REGISTRATION SCREEN (NO GOOGLE AUTH)
  // ==========================================
  if (!currentParticipant) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 sm:p-6 select-none pb-safe">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SchoolLogo size={42} />
            <div>
              <span className="text-[10px] uppercase tracking-widest text-sky-700 font-black block">
                TRƯỜNG THPT 25-10
              </span>
              <span className="text-base font-black text-slate-950 uppercase">
                RUNG CHUÔNG VÀNG
              </span>
            </div>
          </div>

          {!isGuestMode && onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border-2 border-slate-300 text-xs font-black transition shadow-sm cursor-pointer"
            >
              VỀ TRANG CHỦ
            </button>
          )}
        </div>

        {/* Center Registration Card */}
        <div className="w-full max-w-md mx-auto my-auto py-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="text-center space-y-1 mb-5">
              <span className="px-3.5 py-1 rounded-full bg-sky-50 text-sky-900 text-xs font-black uppercase border-2 border-sky-300 inline-block shadow-sm">
                ĐĂNG KÝ VÀO PHÒNG THI
              </span>
              <h2 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
                THÔNG TIN THÍ SINH
              </h2>
              <p className="text-xs text-slate-600 font-bold">
                Quét mã thành công • Điền thông tin để vào sàn thi đấu ngay
              </p>
            </div>

            {joinError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs font-black text-center">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              {/* Room Code Input */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                  MÃ PHÒNG THI *
                </label>
                <input
                  type="text"
                  required
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="RCV2510"
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-2xl px-4 py-3 text-center font-mono font-black text-slate-950 text-xl tracking-widest uppercase focus:outline-none transition shadow-inner"
                />
              </div>

              {/* Student Name Input */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                  HỌ VÀ TÊN THÍ SINH *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-2xl px-4 py-3 text-sm text-slate-950 font-bold focus:outline-none transition"
                />
              </div>

              {/* Class Selection Dropdown (33 Classes) */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                  LỚP HỌC (33 LỚP THPT 25-10) *
                </label>
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-2xl px-4 py-3 text-sm text-slate-950 font-bold focus:outline-none transition"
                >
                  {Object.entries(THPT_2510_CLASSES_BY_GRADE).map(([gradeTitle, classList]) => (
                    <optgroup key={gradeTitle} label={gradeTitle} className="font-bold text-slate-900">
                      {classList.map((c) => (
                        <option key={c} value={c} className="text-slate-900 font-normal">
                          Lớp {c}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Optional Student Code (SBD) */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                  SỐ BÁO DANH (TÙY CHỌN)
                </label>
                <input
                  type="text"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                  placeholder="Để trống hệ thống sẽ tự cấp SBD"
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-2xl px-4 py-2.5 text-xs text-slate-950 font-mono font-bold focus:outline-none transition"
                />
              </div>

              {/* Submit Join Button */}
              <button
                type="submit"
                disabled={isJoining}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider shadow-lg transition active:scale-95 cursor-pointer mt-2"
              >
                {isJoining ? 'ĐANG VÀO PHÒNG...' : 'THAM GIA CUỘC THI NGAY'}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-200 text-center">
              <span className="text-[11px] text-emerald-700 font-bold flex items-center justify-center gap-1">
                ✓ Quét trực tiếp, không yêu cầu đăng nhập tài khoản Google
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-2 text-xs text-slate-500 font-bold">
          Hội thi Rung Chuông Vàng • Trường THPT 25-10
        </footer>
      </div>
    );
  }

  // ==========================================
  // 2. ACTIVE CONTESTANT ARENA & LOBBY
  // ==========================================
  const isEliminated = currentParticipant.status === 'ELIMINATED';
  const isRescued = currentParticipant.status === 'RESCUED';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-3 sm:p-5 select-none pb-safe">
      {/* Top Participant Status Header */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-3 sm:p-4 shadow-sm flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 truncate">
          <SchoolLogo size={36} />
          <div className="truncate">
            <h3 className="text-xs sm:text-sm font-black text-slate-950 truncate">
              {currentParticipant.name}
            </h3>
            <div className="text-[11px] text-slate-600 flex items-center gap-2 font-bold">
              <span className="text-blue-600 font-black">Lớp {currentParticipant.className}</span>
              {currentParticipant.studentCode && (
                <span className="font-mono text-slate-500">({currentParticipant.studentCode})</span>
              )}
            </div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase shadow-sm border-2 ${
              isEliminated
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : isRescued
                ? 'bg-sky-50 text-sky-950 border-sky-400 animate-pulse'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}
          >
            {isEliminated ? 'ĐÃ DỪNG THI' : isRescued ? 'ĐƯỢC CỨU' : 'ĐANG TRÊN SÀN'}
          </span>

          <button
            type="button"
            onClick={handleSwitchParticipant}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black border-2 border-slate-200 transition cursor-pointer"
            title="Đổi thông tin thí sinh"
          >
            ĐỔI
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2.1 WAITING LOBBY (WHEN GAME IS WAITING OR QUESTION READY) */}
      {/* Does NOT show question arena until answering starts       */}
      {/* ======================================================== */}
      {!showQuestionArena && !isFinished && (
        <div className="w-full max-w-md mx-auto my-auto py-8 text-center space-y-4 animate-fadeIn">
          <div className="p-4 bg-white rounded-full border-3 border-sky-400 shadow-md inline-block">
            <SchoolLogo size={70} />
          </div>
          <span className="px-4 py-1 rounded-full bg-sky-50 text-sky-950 text-xs font-black uppercase border-2 border-sky-400 inline-block">
            BẢNG THI ĐẤU TRỰC TUYẾN
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 uppercase tracking-tight">
            ĐÃ SẴN SÀNG THI ĐẤU
          </h2>
          <p className="text-sm text-slate-700 max-w-xs mx-auto font-bold leading-relaxed">
            Hãy chú ý lên màn hình máy chiếu trên sân khấu. Khi Ban tổ chức bắt đầu đếm ngược, bảng chọn đáp án sẽ tự động xuất hiện tại đây.
          </p>

          <div className="p-4 bg-white border-2 border-slate-300 rounded-2xl shadow-sm text-xs font-bold text-slate-800 space-y-1">
            <div>
              Phòng thi: <strong className="font-mono text-sky-700 text-base">{roomCode}</strong> • Trạng thái:{' '}
              <strong className="text-emerald-600">Đã kết nối trực tiếp</strong>
            </div>
            <div className="text-slate-500 text-[11px]">
              Thí sinh: <strong>{currentParticipant.name}</strong> ({currentParticipant.className})
            </div>
          </div>

          <div className="flex gap-2 justify-center pt-2">
            <button
              type="button"
              onClick={handleSwitchParticipant}
              className="px-4 py-2 rounded-xl bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Đổi thí sinh / Đăng ký lại
            </button>
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Rời phòng
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2.2 FINISHED CEREMONY STAGE                              */}
      {/* ======================================================== */}
      {isFinished && (
        <div className="w-full max-w-md mx-auto my-auto py-8 text-center space-y-4 animate-fadeIn">
          <div className="p-4 bg-white rounded-full border-3 border-amber-400 shadow-lg inline-block">
            <SchoolLogo size={80} />
          </div>
          <span className="px-4 py-1.5 rounded-full bg-amber-50 text-amber-950 font-black text-xs uppercase border-2 border-amber-400 inline-block shadow-sm">
            CUỘC THI ĐÃ KẾT THÚC
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 uppercase tracking-tight">
            LỄ VINH DANH QUÁN QUÂN
          </h2>
          <p className="text-sm text-slate-700 font-bold">
            Hãy theo dõi màn hình chính của sân khấu để xem kết quả chung cuộc và vinh danh trao thưởng!
          </p>
          <div className="p-4 bg-white border-2 border-slate-300 rounded-2xl shadow-sm text-xs font-bold text-slate-800 space-y-2">
            <div>
              Thành tích của bạn: <strong className="text-emerald-600">{currentParticipant.totalCorrect || 0} câu đúng</strong>
            </div>
            <div className="text-slate-600">
              Trạng thái cuối: <strong className="text-sky-800">{currentParticipant.status}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2.3 ACTIVE QUESTION & ANSWER ARENA                       */}
      {/* ======================================================== */}
      {showQuestionArena && currentQ && (
        <div className="w-full max-w-lg mx-auto my-auto py-2 space-y-3.5 animate-fadeIn">
          {/* Question Header & Clock */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-sky-600 text-white font-black text-xs uppercase shadow-sm">
                CÂU {currentQ.order} {currentQ.isTieBreaker && '(PHỤ)'}
              </span>
              <span className="text-[11px] font-black text-slate-600 uppercase truncate max-w-[160px]">
                {currentQ.subject || 'Kiến thức chung'}
              </span>
            </div>

            {/* Countdown Clock */}
            <div>
              {isAnswering ? (
                <div className="px-4 py-1.5 rounded-xl font-mono text-base font-black bg-rose-600 text-white shadow-sm">
                  <span>00:{String(secondsRemaining).padStart(2, '0')}</span>
                </div>
              ) : isLocked ? (
                <span className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-800 text-xs font-black uppercase border border-slate-300">
                  ĐÃ KHÓA
                </span>
              ) : isRevealed || isResult ? (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase shadow-sm">
                  KẾT QUẢ
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-blue-100 text-blue-900 border border-blue-300 text-xs font-black uppercase">
                  CHUẨN BỊ
                </span>
              )}
            </div>
          </div>

          {/* Question Prompt */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 sm:p-5 shadow-md">
            <p className="text-base sm:text-lg font-black text-slate-950 leading-relaxed">
              {currentQ.prompt}
            </p>
            {currentQ.imageUrl && (
              <img
                src={currentQ.imageUrl}
                alt="Hình ảnh câu hỏi"
                className="mt-3 rounded-xl max-h-48 w-full object-contain bg-slate-50 border-2 border-slate-200"
              />
            )}
          </div>

          {/* Eliminated Notification Banner */}
          {isEliminated && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-1 text-center shadow-sm animate-fadeIn">
              <div className="flex items-center justify-center gap-1.5 font-black text-xs text-rose-700 uppercase">
                <span>⚠️ BẠN ĐÃ DỪNG THI Ở CÂU {currentParticipant.eliminatedAtQuestionOrder || 'TRƯỚC'}</span>
              </div>
              <p className="text-xs font-bold leading-relaxed">
                Bạn đang ở <strong>Chế độ quan sát (Spectator)</strong> do trả lời chưa chính xác hoặc hết giờ.
                Không thể chọn đáp án cho câu này. Hãy theo dõi câu hỏi và chờ <strong>VÒNG CỨU TRỢ</strong> từ Thầy Cô để quay trở lại sàn thi đấu!
              </p>
            </div>
          )}

          {/* Answer Options Area: ABCD */}
          {currentQ.type === 'ABCD' && (
            <div className="space-y-2">
              {isEliminated && (
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-black text-center uppercase tracking-wide">
                  🔒 Bảng chọn đáp án đã khóa • Đang đợi Thầy Cô cứu trợ
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(currentQ.options || [
                  { id: 'A', text: 'Phương án A' },
                  { id: 'B', text: 'Phương án B' },
                  { id: 'C', text: 'Phương án C' },
                  { id: 'D', text: 'Phương án D' },
                ]).map((opt) => {
                  const isSelected = selectedOption === opt.id || submittedAnswer === opt.id;
                  const isCorrectAnswer = (isRevealed || isResult) && currentQ.correctAnswer?.toUpperCase().trim().startsWith(opt.id);

                  let btnStyle = 'bg-white border-slate-300 text-slate-950 hover:border-sky-400';
                  if (isSelected) {
                    btnStyle = 'bg-sky-600 text-white border-sky-700 shadow-lg ring-2 ring-sky-400';
                  }
                  if (isCorrectAnswer) {
                    btnStyle = 'bg-emerald-600 border-emerald-500 text-white shadow-lg animate-pulse';
                  }
                  if (isEliminated) {
                    btnStyle = 'bg-slate-50 border-slate-200 text-slate-700 cursor-not-allowed opacity-75';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!isAnswering || isEliminated || isSubmitting}
                      onClick={() => {
                        if (isEliminated) return;
                        setSelectedOption(opt.id);
                        handleSubmitAnswer(opt.id);
                      }}
                      className={`p-3.5 sm:p-4 rounded-2xl border-3 font-black text-left transition-all active:scale-95 min-h-[64px] flex items-center gap-3.5 ${btnStyle} ${
                        !isAnswering || isEliminated ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${
                          isSelected
                            ? 'bg-slate-950 text-white'
                            : isCorrectAnswer
                            ? 'bg-white text-emerald-700'
                            : 'bg-slate-100 text-slate-900 border border-slate-300'
                        }`}
                      >
                        {opt.id}
                      </span>
                      <span className="text-sm sm:text-base font-bold flex-1 leading-snug break-words whitespace-normal">
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* True / False Selection Buttons */}
          {currentQ.type === 'TRUE_FALSE' && (
            <div className="space-y-2">
              {isEliminated && (
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-black text-center uppercase tracking-wide">
                  🔒 Bảng chọn đáp án đã khóa • Đang đợi Thầy Cô cứu trợ
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {['ĐÚNG', 'SAI'].map((val) => {
                  const isSelected = selectedOption === val || submittedAnswer === val;
                  const isCorrectAnswer =
                    (isRevealed || isResult) &&
                    Boolean(
                      currentQ.correctAnswer &&
                        (currentQ.correctAnswer.toUpperCase() === val ||
                          (val === 'ĐÚNG' && currentQ.correctAnswer.toUpperCase() === 'TRUE') ||
                          (val === 'SAI' && currentQ.correctAnswer.toUpperCase() === 'FALSE'))
                    );

                  let btnStyle = 'bg-white border-slate-300 text-slate-950 hover:border-sky-400';
                  if (isSelected) {
                    btnStyle = 'bg-sky-600 text-white border-sky-700 shadow-md';
                  }
                  if (isCorrectAnswer) {
                    btnStyle = 'bg-emerald-600 border-emerald-500 text-white shadow-md animate-pulse';
                  }
                  if (isEliminated) {
                    btnStyle = 'bg-slate-50 border-slate-200 text-slate-700 cursor-not-allowed opacity-75';
                  }

                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={!isAnswering || isEliminated || isSubmitting}
                      onClick={() => {
                        if (isEliminated) return;
                        setSelectedOption(val);
                        handleSubmitAnswer(val);
                      }}
                      className={`py-6 rounded-2xl border-3 font-black text-lg text-center transition-all active:scale-95 ${btnStyle} ${
                        !isAnswering || isEliminated ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Short Answer / Numeric Input */}
          {(currentQ.type === 'SHORT_ANSWER' || currentQ.type === 'NUMERIC') && (
            <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 space-y-3">
              {isEliminated && (
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-black text-center uppercase tracking-wide">
                  🔒 Ô nhập đáp án đã khóa • Đang đợi Thầy Cô cứu trợ
                </div>
              )}
              <input
                type={currentQ.type === 'NUMERIC' ? 'number' : 'text'}
                disabled={!isAnswering || isEliminated || isSubmitted}
                value={shortAnswerText}
                onChange={(e) => setShortAnswerText(e.target.value)}
                placeholder={isEliminated ? 'Đang ở chế độ quan sát (chờ cứu trợ)...' : 'Nhập câu trả lời của bạn...'}
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-xl px-3.5 py-3 text-sm text-slate-950 font-bold focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled={!isAnswering || isEliminated || isSubmitted || !shortAnswerText.trim()}
                onClick={() => {
                  if (isEliminated) return;
                  handleSubmitAnswer(shortAnswerText.trim());
                }}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black text-xs uppercase shadow-sm transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                {isEliminated ? 'ĐANG CHỜ CỨU TRỢ' : isSubmitted ? 'ĐÃ GỬI ĐÁP ÁN' : 'GỬI ĐÁP ÁN'}
              </button>
            </div>
          )}

          {/* Submission Feedback Status Bar */}
          {isSubmitted && !isRevealed && !isResult && (
            <div className="p-3 rounded-2xl bg-sky-50/80 border-2 border-sky-300 flex items-center justify-between text-xs font-black text-slate-950 shadow-sm">
              <span>
                Đã xác nhận chọn: <strong className="text-sky-800 font-black text-sm">{submittedAnswer}</strong>
              </span>
              <span className="font-mono text-slate-600">{(submissionTimeMs / 1000).toFixed(2)}s</span>
            </div>
          )}

          {/* Result & Evaluation Box */}
          {(isRevealed || isResult) && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-slate-300 shadow-md text-xs sm:text-sm space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="font-black text-slate-700 uppercase">ĐÁP ÁN ĐÚNG:</span>
                <span className="font-black text-emerald-700 text-base">{currentQ.correctAnswer}</span>
              </div>

              {/* Personal Result Banner */}
              {isEliminated ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 font-black text-xs sm:text-sm text-center shadow-sm space-y-1">
                  <div className="text-rose-700 font-black uppercase flex items-center justify-center gap-1">
                    <span>✕ BẠN ĐÃ DỪNG THI (BỊ LOẠI Ở CÂU {currentParticipant.eliminatedAtQuestionOrder || 'TRƯỚC'})</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    Vui lòng theo dõi các câu hỏi trên màn hình LED và đón chờ <strong>VÒNG CỨU TRỢ</strong> từ Thầy Cô!
                  </p>
                </div>
              ) : (
                <div
                  className={`p-3.5 rounded-2xl border-2 shadow-sm ${
                    currentParticipant.status === 'ELIMINATED'
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-black text-xs sm:text-sm">
                    <span>
                      Đáp án của bạn:{' '}
                      <strong className="text-sky-800 font-mono text-base">
                        {submittedAnswer || selectedOption || shortAnswerText || 'Đã nộp'}
                      </strong>
                    </span>
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-black uppercase ${
                        currentParticipant.status === 'ELIMINATED'
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white animate-pulse'
                      }`}
                    >
                      {currentParticipant.status === 'ELIMINATED'
                        ? '✕ BỊ LOẠI'
                        : '✓ CHÍNH XÁC – ĐƯỢC ĐI TIẾP'}
                    </span>
                  </div>
                  {currentParticipant.status !== 'ELIMINATED' && (
                    <p className="text-xs font-bold text-emerald-800 mt-1.5">
                      ★ Xuất sắc! Bạn đã trả lời đúng và tiếp tục thi đấu ở câu tiếp theo.
                    </p>
                  )}
                </div>
              )}

              {currentQ.explanation && (
                <div className="pt-1">
                  <span className="font-black text-sky-950 uppercase block text-xs mb-1">GIẢI THÍCH CHI TIẾT:</span>
                  <p className="text-slate-800 font-semibold leading-relaxed">{currentQ.explanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Celebratory Rescued Modal */}
      {showRescuedBanner && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border-3 border-emerald-400 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-400 mx-auto flex items-center justify-center text-3xl shadow-md">
              🎉
            </div>
            <span className="px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black uppercase border border-emerald-300 inline-block">
              THÔNG BÁO CỨU TRỢ
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-tight">
              BẠN ĐÃ ĐƯỢC CỨU TRỢ!
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 font-bold leading-relaxed">
              Chúc mừng <strong>{currentParticipant.name}</strong>! Ban Giám Khảo & Thầy Cô đã cứu trợ bạn quay trở lại sàn thi đấu Rung Chuông Vàng. Hãy sẵn sàng cho câu hỏi tiếp theo!
            </p>
            <button
              type="button"
              onClick={() => setShowRescuedBanner(false)}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider shadow-lg transition active:scale-95 cursor-pointer"
            >
              TÔI ĐÃ SẴN SÀNG THI TIẾP!
            </button>
          </div>
        </div>
      )}

      {/* Anti-cheat tab switch warning modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-3 border-rose-400 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-black uppercase">
              CẢNH BÁO CHỐNG GIAN LẬN
            </span>
            <h3 className="text-lg font-black text-slate-950 uppercase">
              PHÁT HIỆN RỜI MÀN HÌNH
            </h3>
            <p className="text-xs text-slate-700 font-bold leading-relaxed">
              Hệ thống đã ghi nhận bạn rời khỏi ứng dụng ({visibilityWarnings} lần). Vi phạm sẽ được báo cáo tới Giám thị và Ban tổ chức.
            </p>
            <button
              type="button"
              onClick={() => setShowWarningModal(false)}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase shadow cursor-pointer"
            >
              TÔI ĐÃ HIỂU, TIẾP TỤC THI
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-1.5 text-[11px] text-slate-500 font-bold">
        Rung Chuông Vàng • Trường THPT 25-10
      </div>
    </div>
  );
};
