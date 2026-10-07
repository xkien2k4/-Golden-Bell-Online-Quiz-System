import { SchoolLogo } from '../components/SchoolLogo';
import React, { useState, useEffect } from 'react';
import { useRealtimeGame } from '../hooks/useRealtimeGame';
import { api } from '../services/api';
import { Participant, THPT_2510_CLASSES_BY_GRADE } from '../types';

interface ProctorViewProps {
  competitionId?: string;
}

export const ProctorView: React.FC<ProctorViewProps> = ({
  competitionId = 'comp-thpt-2510',
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [violationText, setViolationText] = useState<string>('');
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);

  const { gameState } = useRealtimeGame({
    competitionId,
    enableSounds: false,
  });

  const loadData = async () => {
    try {
      const comp = await api.getCompetition(competitionId);
      setParticipants(comp.participants || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
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

  const handleFlagViolation = async (pId: string) => {
    if (!violationText.trim()) return;
    try {
      await api.updateParticipantStatus(competitionId, pId, undefined, violationText.trim());
      setViolationText('');
      setActiveParticipantId(null);
      await loadData();
    } catch (e) {
      alert('Không thể ghi nhận vi phạm');
    }
  };

  const handleUpdateStatus = async (pId: string, status: string) => {
    try {
      await api.updateParticipantStatus(competitionId, pId, status);
      await loadData();
    } catch (e) {
      alert('Không thể cập nhật trạng thái');
    }
  };

  const filtered = participants.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.className.toLowerCase().includes(search.toLowerCase()) ||
      (p.studentCode && p.studentCode.toLowerCase().includes(search.toLowerCase()));
    const matchesClass = selectedClass === 'ALL' || p.className === selectedClass;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-50 text-slate-900 p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SchoolLogo size={46} />
          <div>
            <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
              KHU VỰC GIÁM THỊ & GIÁO VIÊN
            </span>
            <h1 className="text-xl font-black text-white">
              GIÁM SÁT THI ĐẤU TRỰC TIẾP
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-500">Phòng: </span>
            <strong className="text-slate-700 font-bold font-mono">{gameState?.roomCode}</strong>
          </div>
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-500">Thí sinh phụ trách: </span>
            <strong className="text-emerald-400">{filtered.length}</strong>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-2xl border border-slate-200">
        <div className="relative">
          
          <input
            type="text"
            placeholder="Tìm thí sinh hoặc lớp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Chọn Lớp:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="ALL">Tất cả 33 lớp ({participants.length} thí sinh)</option>
            {Object.entries(THPT_2510_CLASSES_BY_GRADE).map(([gradeTitle, classList]) => (
              <optgroup key={gradeTitle} label={gradeTitle} className="bg-slate-50 font-bold text-slate-700 font-bold">
                {classList.map((c) => (
                  <option key={c} value={c} className="bg-white text-white font-normal">
                    Lớp {c}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Participants Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white/95 border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-lg">
          <div className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 border border-slate-200 mx-auto flex items-center justify-center text-slate-700 font-bold">
            
          </div>
          <h3 className="text-base font-bold text-white uppercase tracking-wide">
            CHƯA CÓ THÍ SINH NÀO TRONG PHÒNG
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Toàn bộ danh sách thí sinh ảo đã được xóa sạch. Khi học sinh thực tế quét mã QR từ điện thoại và vào thi, danh sách sẽ tự động xuất hiện tại đây theo thời gian thực.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filtered.map((p) => {
          const isOnline = (Date.now() - p.lastSeenAt < 20000) && p.isOnline !== false;

          return (
            <div
              key={p.id}
              className={`p-4 rounded-2xl border transition ${
                p.status === 'ELIMINATED'
                  ? 'bg-slate-50/60 border-rose-900/40 opacity-75'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{p.name}</h4>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="text-slate-700 font-bold font-bold">{p.className}</span>
                    
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isOnline ? (
                    <span
                      title="Thiết bị đang trực tuyến"
                      className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"
                    />
                  ) : (
                    <span
                      title="Thiết bị có thể đã mất kết nối"
                      className="w-2.5 h-2.5 rounded-full bg-slate-600"
                    />
                  )}
                </div>
              </div>

              {/* Status and Stats */}
              <div className="flex items-center justify-between text-xs py-2 border-y border-slate-200 my-2">
                <div>
                  <span className="text-slate-500 block text-[10px]">Trạng thái</span>
                  <span
                    className={`font-bold ${
                      p.status === 'ACTIVE'
                        ? 'text-emerald-400'
                        : p.status === 'RESCUED'
                        ? 'text-slate-700 font-bold'
                        : 'text-rose-400'
                    }`}
                  >
                    {p.status === 'ACTIVE'
                      ? 'Đang thi'
                      : p.status === 'RESCUED'
                      ? 'Được cứu'
                      : 'Đã loại'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Đúng/Sai</span>
                  <span className="font-mono text-white">
                    {p.totalCorrect} / {p.totalWrong}
                  </span>
                </div>
              </div>

              {/* Violations List */}
              {p.violations && p.violations.length > 0 && (
                <div className="mb-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    
                    <span>Ghi nhận vi phạm:</span>
                  </div>
                  {p.violations.map((v, i) => (
                    <div key={i}>• {v}</div>
                  ))}
                </div>
              )}

              {/* Proctor Actions */}
              <div className="flex items-center gap-1.5 pt-1">
                {p.status === 'ELIMINATED' ? (
                  <button
                    onClick={() => handleUpdateStatus(p.id, 'RESCUED')}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition"
                  >
                    Đề xuất cứu
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus(p.id, 'ELIMINATED')}
                    className="flex-1 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold text-xs transition"
                  >
                    Đề xuất loại
                  </button>
                )}

                <button
                  onClick={() =>
                    setActiveParticipantId(activeParticipantId === p.id ? null : p.id)
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-950 text-xs font-semibold"
                >
                  Ghi chú
                </button>
              </div>

              {/* Violation Note input */}
              {activeParticipantId === p.id && (
                <div className="mt-2 pt-2 border-t border-slate-200 flex gap-1">
                  <input
                    type="text"
                    placeholder="Lý do vi phạm..."
                    value={violationText}
                    onChange={(e) => setViolationText(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-white"
                  />
                  <button
                    onClick={() => handleFlagViolation(p.id)}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold"
                  >
                    
                  </button>
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
