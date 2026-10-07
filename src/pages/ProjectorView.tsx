import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { getDynamicJoinUrl, verifyAndResolveJoinUrl } from '../utils/urlHelper';
import { SchoolLogo } from '../components/SchoolLogo';
import { useRealtimeGame } from '../hooks/useRealtimeGame';
import { soundManager } from '../utils/soundEffects';
import { api } from '../services/api';

interface ProjectorViewProps {
  competitionId?: string;
  onBackToAdmin?: () => void;
  onBackToHome?: () => void;
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({
  competitionId = 'comp-thpt-2510',
  onBackToAdmin,
  onBackToHome,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [bgmActive, setBgmActive] = useState<boolean>(soundManager.isBgmPlaying());
  const [qrUrl, setQrUrl] = useState<string>('');
  const [activeCeremonyMode, setActiveCeremonyMode] = useState<'CHAMPION' | 'TOP3' | 'TOP5'>('CHAMPION');
  const [isVictoryAnthemPlaying, setIsVictoryAnthemPlaying] = useState<boolean>(soundManager.getIsVictoryPlaying());
  const hasCelebratedRef = useRef(false);

  const { gameState, secondsRemaining } = useRealtimeGame({
    competitionId,
    enableSounds: true,
  });

  useEffect(() => {
    const unsubscribe = soundManager.subscribe(() => {
      setIsVictoryAnthemPlaying(soundManager.getIsVictoryPlaying());
      setBgmActive(soundManager.isBgmPlaying());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (gameState?.ceremonyMode) {
      setActiveCeremonyMode(gameState.ceremonyMode);
    }
  }, [gameState?.ceremonyMode]);

  const handleToggleBgm = () => {
    soundManager.unlockAudio();
    if (bgmActive) {
      soundManager.stopBackgroundMusic();
      setBgmActive(false);
    } else {
      soundManager.startBackgroundMusic();
      setBgmActive(true);
    }
  };

  const roomCode = gameState?.roomCode || 'RCV2510';
  const [joinUrl, setJoinUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (roomCode) {
      verifyAndResolveJoinUrl(roomCode)
        .then((resolved) => {
          if (!active) return;
          setJoinUrl(resolved.joinUrl);
          return QRCode.toDataURL(resolved.joinUrl, {
            width: 500,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
        })
        .then((url) => {
          if (active && url) setQrUrl(url);
        })
        .catch(() => {
          const fallbackUrl = getDynamicJoinUrl(roomCode);
          setJoinUrl(fallbackUrl);
          QRCode.toDataURL(fallbackUrl, { width: 500, margin: 2 }).then((u) => {
            if (active) setQrUrl(u);
          });
        });
    }
    return () => {
      active = false;
    };
  }, [roomCode]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleUnlockAudio = () => {
    soundManager.unlockAudio();
    soundManager.setEnabled(true);
    setAudioUnlocked(true);
  };

  const currentQ = gameState?.currentQuestion;
  const isAnswering = gameState?.gameState === 'ANSWERING';
  const isLocked = gameState?.gameState === 'LOCKED';
  const isRevealed = gameState?.gameState === 'ANSWER_REVEALED';
  const isResult = gameState?.gameState === 'RESULT';
  const isFinished = gameState?.gameState === 'FINISHED';

  useEffect(() => {
    if (isFinished && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true;
      confetti({
        particleCount: 180,
        spread: 120,
        origin: { y: 0.6 },
      });
      const end = Date.now() + 5 * 1000;
      const interval: number = window.setInterval(() => {
        if (Date.now() > end) {
          return clearInterval(interval);
        }
        confetti({
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          origin: {
            x: Math.random(),
            y: Math.random() - 0.2,
          },
        });
      }, 350);
    } else if (!isFinished) {
      hasCelebratedRef.current = false;
    }
  }, [isFinished]);

  if (isFinished) {
    const winner = gameState?.winner;
    const leaderboard = gameState?.leaderboard || [];
    const top3 = leaderboard.slice(0, 3);
    const top5 = leaderboard.slice(0, 5);
    const winnerCorrectCount = winner?.totalCorrect ?? leaderboard[0]?.totalCorrect ?? 0;
    const totalQ = gameState?.totalQuestions || 20;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 flex flex-col justify-between relative overflow-hidden select-none">
        <div className="relative z-20 flex items-center justify-between border-b-2 border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <SchoolLogo size={52} />
            <div>
              <span className="text-xs font-black text-sky-700 tracking-widest block uppercase">
                TRƯỜNG THPT 25-10
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-tight">
                LỄ VINH DANH RUNG CHUÔNG VÀNG
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white p-1 rounded-2xl border-2 border-slate-200 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveCeremonyMode('CHAMPION')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  activeCeremonyMode === 'CHAMPION'
                    ? 'bg-sky-600 text-black shadow-sm'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                QUÁN QUÂN
              </button>
              <button
                type="button"
                onClick={() => setActiveCeremonyMode('TOP3')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  activeCeremonyMode === 'TOP3'
                    ? 'bg-sky-600 text-black shadow-sm'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                TOP 3
              </button>
              <button
                type="button"
                onClick={() => setActiveCeremonyMode('TOP5')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  activeCeremonyMode === 'TOP5'
                    ? 'bg-sky-600 text-black shadow-sm'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                BẢNG VÀNG TOP 5
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                soundManager.unlockAudio();
                if (isVictoryAnthemPlaying) {
                  soundManager.stopVictory();
                } else {
                  soundManager.playVictory();
                }
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition cursor-pointer shadow-sm ${
                isVictoryAnthemPlaying
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <span>{isVictoryAnthemPlaying ? 'NHẠC: ĐANG PHÁT' : 'PHÁT NHẠC THẮNG'}</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-2xl bg-white hover:bg-slate-100 border-2 border-slate-200 text-slate-900 text-xs font-black shadow-sm cursor-pointer"
            >
              {isFullscreen ? 'THU NHỎ' : 'TOÀN MÀN HÌNH'}
            </button>
            {onBackToAdmin && (
              <button
                type="button"
                onClick={onBackToAdmin}
                className="px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
                title="Quay lại Bảng Điều Khiển Admin"
              >
                VỀ QUẢN TRỊ ADMIN
              </button>
            )}
          </div>
        </div>

        {activeCeremonyMode === 'CHAMPION' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6 relative z-10 animate-fadeIn">
            <div className="space-y-4 max-w-3xl mx-auto">
              <span className="px-6 py-2 rounded-full bg-sky-50 text-sky-900 text-sky-950 font-black text-sm sm:text-base border-2 border-sky-400 inline-block tracking-widest uppercase shadow-sm">
                CHÚC MỪNG TÂN QUÁN QUÂN RUNG CHUÔNG VÀNG
              </span>
              <h2 className="text-4xl sm:text-7xl font-black text-slate-950 tracking-tight drop-shadow-sm uppercase">
                {winner?.name || 'THÍ SINH XUẤT SẮC'}
              </h2>
              <div className="inline-flex items-center gap-3 px-8 py-3 rounded-2xl bg-white border-2 border-sky-400 shadow-md">
                <span className="text-xl sm:text-2xl font-black text-sky-800 uppercase tracking-wide">
                  ĐẠI DIỆN LỚP: {winner?.className || 'THPT 25-10'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-8 pt-4 text-slate-700">
                <div className="text-center">
                  <span className="text-xs uppercase text-slate-500 font-black block">Tổng câu đúng</span>
                  <span className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">
                    {winnerCorrectCount}/{totalQ}
                  </span>
                </div>
                <div className="w-px h-12 bg-slate-300" />
                <div className="text-center">
                  <span className="text-xs uppercase text-slate-500 font-black block">Danh hiệu vinh dự</span>
                  <span className="text-lg sm:text-xl font-black text-sky-700 uppercase">
                    RUNG CHUÔNG VÀNG
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeCeremonyMode === 'TOP3' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6 relative z-10 animate-fadeIn">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-950 uppercase tracking-tight mb-8">
              VINH DANH TOP 3 XUẤT SẮC NHẤT
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl items-end">
              {top3[1] && (
                <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 shadow-md text-center space-y-2 order-2 sm:order-1">
                  <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-800 font-black text-lg flex items-center justify-center mx-auto border-2 border-slate-300">
                    2
                  </span>
                  <span className="text-xs font-black text-slate-500 uppercase block">Á Quân 1</span>
                  <h3 className="text-xl font-black text-slate-950 truncate">{top3[1].name}</h3>
                  <p className="text-xs font-black text-blue-600">{top3[1].className}</p>
                  <div className="pt-2 border-t border-slate-200 font-mono text-sm text-slate-700 font-bold">
                    {top3[1].totalCorrect} câu đúng
                  </div>
                </div>
              )}

              {top3[0] && (
                <div className="bg-sky-50/70 border-3 border-sky-400 rounded-3xl p-8 shadow-xl text-center space-y-3 order-1 sm:order-2 scale-105">
                  <span className="w-12 h-12 rounded-full bg-sky-600 text-black font-black text-xl flex items-center justify-center mx-auto shadow">
                    1
                  </span>
                  <span className="text-xs font-black text-sky-900 uppercase block tracking-wider">
                    QUÁN QUÂN CHUNG CUỘC
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-950 truncate">{top3[0].name}</h3>
                  <p className="text-sm font-black text-sky-800">{top3[0].className}</p>
                  <div className="pt-2 border-t-2 border-sky-300 font-mono text-base text-slate-950 font-black">
                    {top3[0].totalCorrect} câu đúng
                  </div>
                </div>
              )}

              {top3[2] && (
                <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 shadow-md text-center space-y-2 order-3 sm:order-3">
                  <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-800 font-black text-lg flex items-center justify-center mx-auto border-2 border-slate-300">
                    3
                  </span>
                  <span className="text-xs font-black text-slate-500 uppercase block">Á Quân 2</span>
                  <h3 className="text-xl font-black text-slate-950 truncate">{top3[2].name}</h3>
                  <p className="text-xs font-black text-blue-600">{top3[2].className}</p>
                  <div className="pt-2 border-t border-slate-200 font-mono text-sm text-slate-700 font-bold">
                    {top3[2].totalCorrect} câu đúng
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeCeremonyMode === 'TOP5' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6 relative z-10 animate-fadeIn">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-950 uppercase tracking-tight mb-6">
              BẢNG VÀNG THÀNH TÍCH TOP 5
            </h2>
            <div className="w-full max-w-3xl bg-white border-2 border-slate-300 rounded-3xl overflow-hidden shadow-lg">
              <div className="divide-y divide-slate-200">
                {top5.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-4 sm:p-5 flex items-center justify-between gap-4 ${
                      idx === 0 ? 'bg-sky-50/70 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                        idx === 0 ? 'bg-sky-600 text-black' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="text-left">
                        <h4 className="text-base sm:text-lg font-black text-slate-950">{p.name}</h4>
                        <span className="text-xs text-slate-600 font-bold">Lớp {p.className}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-emerald-600 font-mono">{p.totalCorrect} câu đúng</span>
                      <span className="text-xs text-slate-500 block font-mono">{(p.totalResponseTimeMs / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="relative z-20 pt-4 border-t-2 border-slate-200 flex items-center justify-between text-xs text-slate-600 font-bold">
          <span>Hội thi Rung Chuông Vàng • Trường THPT 25-10</span>
          <span>Phòng thi: {gameState?.roomCode}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 flex flex-col justify-between relative overflow-hidden select-none">
      {!audioUnlocked && (
        <div
          onClick={handleUnlockAudio}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-sky-600 text-black text-xs sm:text-sm font-black px-6 py-2.5 rounded-full shadow-2xl cursor-pointer animate-bounce flex items-center gap-2 border-2 border-sky-300"
        >
          <span>BẤM VÀO ĐÂY ĐỂ BẬT ÂM THANH MÁY CHIẾU</span>
        </div>
      )}

      {/* Top Header Navigation Bar */}
      <div className="relative z-20 flex items-center justify-between border-b-2 border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <SchoolLogo size={52} />
          <div>
            <span className="text-xs font-black text-sky-700 tracking-widest block uppercase">
              TRƯỜNG THPT 25-10
            </span>
            <h1 className="text-xl sm:text-3xl font-black text-slate-950 uppercase tracking-tight">
              HỘI THI RUNG CHUÔNG VÀNG
            </h1>
          </div>
        </div>

        {/* Real-time stats & controls */}
        <div className="flex items-center gap-3">
          <div className="px-5 py-2.5 rounded-2xl bg-white border-2 border-slate-200 shadow-sm flex items-center gap-2 text-xs font-black">
            <span className="text-slate-600">CÒN TRÊN SÀN:</span>
            <span className="text-emerald-600 font-black font-mono text-lg">
              {gameState?.stats.activeCount || 0}
            </span>
          </div>

          <div className="px-5 py-2.5 rounded-2xl bg-white border-2 border-slate-200 shadow-sm flex items-center gap-2 text-xs font-black">
            <span className="text-slate-600">ĐÃ NỘP BÀI:</span>
            <span className="text-blue-600 font-black font-mono text-lg">
              {gameState?.stats.answeredCount || 0}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleBgm}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition cursor-pointer shadow-sm ${
              bgmActive
                ? 'bg-sky-600 text-black shadow'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-2 border-slate-200'
            }`}
            title="Nhạc nền sân khấu"
          >
            <span>{bgmActive ? 'NHẠC NỀN: BẬT' : 'NHẠC NỀN: TẮT'}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-2xl bg-white hover:bg-slate-100 border-2 border-slate-200 text-slate-900 text-xs font-black shadow-sm cursor-pointer"
          >
            {isFullscreen ? 'THU NHỎ' : 'TOÀN MÀN HÌNH'}
          </button>

          {onBackToAdmin && (
            <button
              type="button"
              onClick={onBackToAdmin}
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
              title="Quay lại Bảng Điều Khiển Quản Trị Admin"
            >
              VỀ QUẢN TRỊ ADMIN
            </button>
          )}
        </div>
      </div>

      {(!currentQ || gameState?.gameState === 'WAITING') && (
        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8 relative z-10 animate-fadeIn">
          <div className="p-4 bg-white rounded-full border-3 border-sky-400 shadow-lg mb-4">
            <SchoolLogo size={100} />
          </div>
          <span className="px-5 py-1.5 rounded-full bg-sky-50 text-sky-900 text-sky-950 text-xs sm:text-sm font-black uppercase tracking-widest border-2 border-sky-400 shadow-sm mb-2">
            HỘI THI TRỰC TUYẾN 2026 - 2027
          </span>
          <h2 className="text-4xl sm:text-6xl font-black text-slate-950 uppercase tracking-tight drop-shadow-sm mb-4">
            CHINH PHỤC ĐỈNH CAO TRI THỨC
          </h2>
          <p className="text-base sm:text-lg text-slate-700 max-w-xl mx-auto mb-8 font-bold">
            Thí sinh quét mã QR bên dưới bằng camera điện thoại để vào sàn thi đấu.
          </p>

          <div className="p-4 bg-white rounded-3xl shadow-xl border-3 border-sky-300 inline-block">
            {qrUrl ? (
              <img src={qrUrl} alt="Mã QR Sân Khấu" className="w-56 h-56 sm:w-64 sm:h-64 mx-auto rounded-2xl drop-shadow-md" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-sky-700 font-black">
                Đang tạo mã QR...
              </div>
            )}
          </div>
          {joinUrl && (
            <div className="mt-3 flex flex-col items-center gap-1.5">
              <div className="px-4 py-1.5 rounded-full bg-white border-2 border-sky-300 text-sky-950 font-mono text-xs sm:text-sm font-bold shadow-sm inline-flex items-center gap-2">
                <span className="text-sky-700 font-black">🌐 Link tham gia:</span>
                <span className="underline decoration-sky-400 font-black">{joinUrl}</span>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">
                📱 iPhone / Safari: Nếu hiện <em>"Action required..."</em>, chỉ cần bấm <strong>[Close and continue]</strong> là vào thi ngay!
              </span>
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="px-6 py-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 text-sm font-bold shadow-sm">
              Mã phòng: <strong className="text-sky-700 font-mono font-black text-2xl">{roomCode}</strong>
            </div>
            <div className="px-6 py-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 text-sm font-bold shadow-sm">
              Thí sinh đã kết nối: <strong className="text-emerald-600 font-mono font-black text-2xl">{gameState?.stats.totalParticipants || 0}</strong>
            </div>
          </div>
        </div>
      )}

      {currentQ && gameState?.gameState !== 'WAITING' && (
        <div className="flex-1 flex flex-col justify-center max-w-6xl w-full mx-auto my-auto py-4 space-y-6 relative z-10 animate-fadeIn">
          {/* Question Header & Huge Countdown Timer */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="px-6 py-3 rounded-2xl bg-sky-600 text-black font-black text-xl sm:text-2xl uppercase tracking-wider shadow-md">
                CÂU {currentQ.order} {currentQ.isTieBreaker && '(PHỤ)'}
              </span>
              <span className="text-sm sm:text-base font-black text-slate-700 uppercase tracking-wider">
                MÔN: {currentQ.subject || 'KIẾN THỨC CHUNG'}
              </span>
            </div>

            {/* Giant Countdown Clock - Red background with huge crisp white text */}
            <div>
              {isAnswering ? (
                <div
                  className="px-8 py-3 rounded-2xl font-mono text-4xl sm:text-6xl font-black bg-rose-600 text-white shadow-xl transition-all"
                >
                  <span>00:{String(secondsRemaining).padStart(2, '0')}</span>
                </div>
              ) : isLocked ? (
                <div className="px-6 py-3 rounded-2xl bg-slate-200 border-2 border-slate-300 text-slate-900 font-black text-2xl uppercase tracking-wider">
                  HẾT GIỜ
                </div>
              ) : isRevealed || isResult ? (
                <div className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black text-2xl uppercase tracking-wider shadow-md">
                  CÔNG BỐ ĐÁP ÁN
                </div>
              ) : (
                <div className="px-6 py-3 rounded-2xl bg-blue-100 border-2 border-blue-300 text-blue-900 font-black text-2xl uppercase tracking-wider">
                  CHUẨN BỊ
                </div>
              )}
            </div>
          </div>

          {/* Question Text Box with High-Contrast Dark Text on Crisp White */}
          <div className="bg-white border-3 border-slate-300 rounded-3xl p-6 sm:p-10 shadow-xl">
            <h3 className="text-2xl sm:text-4xl font-black text-slate-950 leading-snug tracking-tight">
              {currentQ.prompt}
            </h3>
            {currentQ.imageUrl && (
              <div className="mt-4 flex justify-center">
                <img
                  src={currentQ.imageUrl}
                  alt="Hình ảnh câu hỏi"
                  className="max-h-72 rounded-2xl object-contain border-2 border-slate-200 shadow-md"
                />
              </div>
            )}
          </div>

          {/* 4 Large Option Cards (ABCD) with bold letter badges */}
          {currentQ.type === 'ABCD' && currentQ.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className={`p-5 sm:p-6 rounded-2xl border-3 transition-all duration-300 flex items-center gap-4 shadow-md ${
                      isCorrectAnswer
                        ? 'bg-emerald-600 border-emerald-500 text-white scale-102 shadow-2xl animate-pulse'
                        : 'bg-white border-slate-300 text-slate-950 hover:border-sky-400'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shrink-0 shadow ${
                        isCorrectAnswer
                          ? 'bg-white text-emerald-700'
                          : 'bg-sky-600 text-black'
                      }`}
                    >
                      {opt.id}
                    </div>
                    <span
                      className={`text-lg sm:text-2xl font-black flex-1 leading-snug break-words whitespace-normal ${
                        isCorrectAnswer ? 'text-white' : 'text-slate-950'
                      }`}
                    >
                      {opt.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* True / False Options */}
          {currentQ.type === 'TRUE_FALSE' && (
            <div className="grid grid-cols-2 gap-6">
              {['ĐÚNG', 'SAI'].map((val) => {
                const isCorrectAnswer =
                  (isRevealed || isResult) &&
                  Boolean(
                    currentQ.correctAnswer &&
                    (currentQ.correctAnswer.toUpperCase() === val ||
                     (val === 'ĐÚNG' && currentQ.correctAnswer.toUpperCase() === 'TRUE') ||
                     (val === 'SAI' && currentQ.correctAnswer.toUpperCase() === 'FALSE'))
                  );
                return (
                  <div
                    key={val}
                    className={`p-8 rounded-3xl border-3 text-center text-3xl sm:text-4xl font-black transition-all shadow-md ${
                      isCorrectAnswer
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-2xl animate-pulse'
                        : 'bg-white border-slate-300 text-slate-950'
                    }`}
                  >
                    {val}
                  </div>
                );
              })}
            </div>
          )}

          {/* Short Answer / Numeric Reveal */}
          {(currentQ.type === 'SHORT_ANSWER' || currentQ.type === 'NUMERIC') && (
            <div className="bg-white border-3 border-slate-300 rounded-3xl p-6 text-center shadow-md">
              {isRevealed || isResult ? (
                <div className="space-y-2">
                  <span className="text-xs uppercase font-black tracking-widest text-slate-500 block">
                    ĐÁP ÁN CHÍNH XÁC
                  </span>
                  <span className="text-4xl sm:text-6xl font-black text-emerald-600 uppercase tracking-wide">
                    {currentQ.correctAnswer}
                  </span>
                </div>
              ) : (
                <span className="text-xl font-black text-slate-500">
                  Thí sinh đang nhập câu trả lời trên thiết bị...
                </span>
              )}
            </div>
          )}

          {/* Revealed Explanation Box */}
          {(isRevealed || isResult) && currentQ.explanation && (
            <div className="bg-sky-50/70 border-2 border-sky-300 rounded-2xl p-4 sm:p-6 shadow-md animate-fadeIn">
              <span className="text-xs font-black text-sky-950 uppercase block mb-1">
                GIẢI THÍCH CHI TIẾT:
              </span>
              <p className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                {currentQ.explanation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="relative z-20 pt-4 border-t-2 border-slate-200 flex items-center justify-between text-xs text-slate-600 font-bold">
        <span>Hội thi Rung Chuông Vàng • Trường THPT 25-10</span>
        <span>Phòng thi: {roomCode}</span>
      </div>
    </div>
  );
};
