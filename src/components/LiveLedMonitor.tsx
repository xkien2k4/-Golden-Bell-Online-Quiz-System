import confetti from 'canvas-confetti';
import React from 'react';
import { SchoolLogo } from './SchoolLogo';
import { useRealtimeGame } from '../hooks/useRealtimeGame';
import { api } from '../services/api';
import { soundManager } from '../utils/soundEffects';

interface LiveLedMonitorProps {
  competitionId?: string;
  onOpenPopoutWindow?: () => void;
  isCompact?: boolean;
}

export const LiveLedMonitor: React.FC<LiveLedMonitorProps> = ({
  competitionId = 'comp-thpt-2510',
  onOpenPopoutWindow,
  isCompact = false,
}) => {
  const { gameState, secondsRemaining } = useRealtimeGame({
    competitionId,
    enableSounds: false, // Don't duplicate audio on admin monitor
  });

  const triggerConfetti = () => {
    soundManager.playVictory();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#e11d48', '#0d5ca4', '#ffffff', '#10b981'],
    });
  };

  const currentQ = gameState?.currentQuestion;
  const isAnswering = gameState?.gameState === 'ANSWERING';
  const isLocked = gameState?.gameState === 'LOCKED';
  const isRevealed = gameState?.gameState === 'ANSWER_REVEALED';
  const isResult = gameState?.gameState === 'RESULT';
  const isFinished = gameState?.gameState === 'FINISHED';

  return (
    <div className="bg-slate-50 border-2 border-sky-400/50 rounded-3xl p-3 sm:p-4 shadow-2xl relative overflow-hidden flex flex-col justify-between select-none">
      {/* Top Header of the Live Monitor */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div className="flex items-center gap-2">
          {/* Red live pulsing dot */}
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
          </span>
          <div className="flex items-center gap-1.5">
            
            <span className="text-xs font-black text-slate-950 uppercase tracking-wider">
              MÀN HÌNH GIÁM SÁT LED SÂN KHẤU
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold uppercase">
              LIVE 16:9
            </span>
          </div>
        </div>

        {/* Action Controls for LED */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={triggerConfetti}
            className="p-1.5 rounded-lg bg-sky-50 text-sky-950 text-sky-950 hover:bg-blue-600 text-white/30 text-slate-800 font-bold border border-slate-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
            title="Bắn pháo hoa ăn mừng"
          >
            
            <span className="hidden md:inline">Pháo hoa</span>
          </button>

          {onOpenPopoutWindow && (
            <button
              type="button"
              onClick={onOpenPopoutWindow}
              className="px-2.5 py-1.5 rounded-xl bg-sky-700 text-white hover:bg-sky-800 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow transition cursor-pointer"
              title="Mở cửa sổ màn hình LED độc lập để kéo sang máy chiếu / màn LED sân khấu"
            >
              
              <span>MỞ CỬA SỔ CHIẾU LED</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 16:9 Stage Screen Simulation */}
      <div className="my-3 bg-white rounded-2xl p-4 sm:p-6 border-2 border-sky-300 relative min-h-[220px] flex flex-col justify-between shadow-md">
        {/* Stage ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-blue-600/15 blur-[60px] pointer-events-none" />

        {/* Stage Top Bar inside Preview */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2 relative z-10 text-xs">
          <div className="flex items-center gap-2">
            <SchoolLogo size={32} />
            <div>
              <span className="text-[9px] font-bold text-sky-700 block uppercase leading-none">
                TRƯỜNG THPT 25-10
              </span>
              <span className="text-xs font-black text-slate-950 uppercase tracking-tight">
                RUNG CHUÔNG VÀNG
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 flex items-center gap-1.5 font-bold">
              
              <span className="text-[10px] text-slate-700 font-bold">Còn lại:</span>
              <span className="text-emerald-600 font-mono font-black">
                {gameState?.stats.activeCount || 0}
              </span>
            </div>

            <div className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 flex items-center gap-1.5 font-bold">
              
              <span className="text-[10px] text-slate-700 font-bold">Đã nộp:</span>
              <span className="text-sky-700 font-mono font-black">
                {gameState?.stats.answeredCount || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Stage Canvas Area */}
        <div className="flex-1 flex flex-col justify-center my-3 relative z-10">
          {/* Waiting Stage */}
          {(!currentQ || gameState?.gameState === 'WAITING') && (
            <div className="text-center py-4 space-y-2">
              <SchoolLogo size={55} className="mx-auto drop-shadow" />
              <h4 className="text-base sm:text-lg font-black text-slate-950 uppercase">
                MÀN HÌNH LED SÂN KHẤU ĐANG CHỜ BẮT ĐẦU
              </h4>
              <p className="text-xs text-slate-700 font-bold">
                Phòng thi: <strong className="text-sky-700 font-mono font-black">{gameState?.roomCode}</strong> • Thí sinh kết nối: <strong className="text-emerald-600 font-black">{gameState?.stats.totalParticipants || 0}</strong>
              </p>
            </div>
          )}

          {/* Active Question Stage */}
          {currentQ && gameState?.gameState !== 'WAITING' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-black font-black text-xs uppercase">
                    CÂU {currentQ.order} {currentQ.isTieBreaker && '(PHỤ)'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-bold uppercase truncate max-w-[200px]">
                    {currentQ.subject || 'Kiến thức chung'}
                  </span>
                </div>

                {/* Clock indicator */}
                <div>
                  {isAnswering ? (
                    <div
                      className={`px-3 py-1 rounded-xl font-mono text-sm sm:text-base font-black flex items-center gap-1.5 shadow ${
                        secondsRemaining <= 5
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-blue-600 text-black'
                      }`}
                    >
                      
                      <span>00:{String(secondsRemaining).padStart(2, '0')}</span>
                    </div>
                  ) : isLocked ? (
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 border border-slate-200 text-slate-700 font-bold text-xs uppercase">
                      HẾT GIỜ
                    </span>
                  ) : isRevealed || isResult ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold text-xs uppercase">
                      CÔNG BỐ ĐÁP ÁN
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 font-bold text-xs uppercase">
                      CHUẨN BỊ
                    </span>
                  )}
                </div>
              </div>

              {/* Prompt Text */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 shadow-sm">
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed font-bold">
                  {currentQ.prompt}
                </p>
              </div>

              {/* 4 Options Grid (Compact ABCD) */}
              {currentQ.type === 'ABCD' && currentQ.options && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {currentQ.options.map((opt) => {
                    const isCorrectAnswer =
                      (isRevealed || isResult) &&
                      Boolean(
                        currentQ.correctAnswer &&
                          (currentQ.correctAnswer.toUpperCase().trim() === opt.id ||
                            currentQ.correctAnswer.toUpperCase().trim().startsWith(opt.id))
                      );
                    return (
                      <div
                        key={opt.id}
                        className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                          isCorrectAnswer
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-black shadow-md animate-pulse'
                            : 'bg-white/90 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isCorrectAnswer
                              ? 'bg-slate-50 text-emerald-700 font-black'
                              : 'bg-white border border-slate-200 text-slate-700 font-bold'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <span className="flex-1 break-words leading-tight">{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Winner Stage */}
          {isFinished && (
            <div className="text-center py-4 space-y-3">
              <span className="text-2xl animate-bounce block">🏆</span>
              <h4 className="text-base font-black text-slate-700 font-bold uppercase">
                RUNG CHUÔNG VÀNG – HOÀN THÀNH CUỘC THI!
              </h4>
              <p className="text-xs text-slate-700">
                Màn hình LED đang phát hiệu ứng chiến thắng & chúc mừng Quán quân.
              </p>
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    soundManager.stopAll();
                    try {
                      await api.sendControlAction(competitionId, 'RESET_COMPETITION');
                    } catch (e) {}
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg transition active:scale-95 cursor-pointer border border-rose-400"
                >
                  
                  <span>VÁN MỚI / QUAY LẠI TỪ ĐẦU</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stage Bottom Footer */}
        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Phòng: {gameState?.roomCode || 'RCV2510'}</span>
          <span className="text-slate-700 font-bold font-bold">Đồng bộ LED 100% thời gian thực</span>
        </div>
      </div>
    </div>
  );
};
