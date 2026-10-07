import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { getDynamicJoinUrl, copyToClipboard } from '../utils/urlHelper';
import { SchoolLogo } from '../components/SchoolLogo';

interface HomePageProps {
  onSelectRole: (role: 'student' | 'admin' | 'projector' | 'proctor' | 'guide') => void;
  roomCode: string;
  onJoinRoomDirect?: (roomCode: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectRole,
  roomCode,
}) => {
  const [inputRoomCode, setInputRoomCode] = useState<string>(roomCode || 'RCV2510');
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const activeRoom = inputRoomCode.trim().toUpperCase() || roomCode || 'RCV2510';
  const [joinUrl, setJoinUrl] = useState<string>('');

  useEffect(() => {
    if (activeRoom) {
      const dynamicUrl = getDynamicJoinUrl(activeRoom);
      setJoinUrl(dynamicUrl);

      QRCode.toDataURL(dynamicUrl, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrUrl(url))
        .catch((err) => console.error('Failed to generate QR code', err));
    }
  }, [activeRoom]);

  const handleStudentJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRoom) {
      onSelectRole('student');
    }
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(joinUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-between items-center relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-black p-4 sm:p-6">
      {/* Cinematic Stage Lighting & Rays */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-gradient-to-b from-amber-500/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-[450px] h-[450px] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-[450px] h-[450px] bg-sky-50 text-sky-950 text-sky-950 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-slate-50 blur-3xl pointer-events-none" />

      {/* Main Hero Container */}
      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center my-auto py-2">
        {/* School Logo & Title Header */}
        <div className="flex flex-col items-center text-center space-y-2 mb-4">
          <div className="relative group cursor-pointer animate-float">
            <div className="absolute -inset-2 bg-gradient-to-r from-amber-500 via-rose-500 to-blue-500 rounded-full blur-md opacity-75 group-hover:opacity-100 transition duration-500" />
            <div className="relative bg-white p-2 rounded-full border-2 border-sky-400 shadow-2xl">
              <SchoolLogo size={90} />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs sm:text-sm font-extrabold uppercase tracking-widest shadow-md">
            
            <span>TRƯỜNG THPT 25-10</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-[0_10px_25px_rgba(245,158,11,0.35)]">
            RUNG CHUÔNG VÀNG
          </h1>
        </div>

        {/* Grand QR Stage Arena Card */}
        <div className="w-full max-w-md sm:max-w-lg bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border-2 border-slate-300 rounded-3xl p-5 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(245,158,11,0.15)] backdrop-blur-xl flex flex-col items-center text-center relative overflow-hidden">
          {/* Subtle Top Glowing Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

          {/* QR Code Title Banner */}
          <div className="flex items-center justify-center gap-2 mb-3">
            
            <h2 className="text-sm sm:text-base font-black text-slate-800 font-bold uppercase tracking-widest">
              QUÉT MÃ QR ĐỂ VÀO PHÒNG THI
            </h2>
            
          </div>

          {/* Prominent Real-time QR Code */}
          <div className="relative group p-3 sm:p-4 bg-white rounded-3xl shadow-2xl border-4 border-sky-400 transition-transform duration-300 hover:scale-105 my-1">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="QR Code Vào Phòng Thi"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-2xl mx-auto"
              />
            ) : (
              <div className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center bg-slate-100 rounded-2xl">
                
              </div>
            )}
          </div>

          {/* Room Code Display Badge */}
          <div className="mt-4 w-full bg-slate-50/90 border border-slate-300 rounded-2xl p-3 flex items-center justify-between shadow-inner">
            <div className="text-left pl-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                MÃ PHÒNG THI
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-700 font-bold font-mono tracking-widest">
                {activeRoom}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold hover:text-slate-950 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
              title="Sao chép đường dẫn vào phòng thi"
            >
              {copied ? (
                <>
                  
                  <span className="text-emerald-400">ĐÃ CHÉP</span>
                </>
              ) : (
                <>
                  
                  <span>CHÉP LINK</span>
                </>
              )}
            </button>
          </div>

          {/* Direct Enter Action (For PC/Tablet without camera) */}
          <form onSubmit={handleStudentJoin} className="mt-4 w-full flex gap-2">
            <input
              type="text"
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
              placeholder="RCV2510"
              className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-mono font-black text-slate-800 font-bold text-base uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="w-1/2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <span>VÀO THI NGAY</span>
              
            </button>
          </form>

          {/* Live Indicator */}
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Đang mở phòng thi đấu trực tiếp</span>
          </div>
        </div>
      </div>

      {/* Clean Minimalist Footer */}
      <footer className="relative z-10 text-center py-2 text-[11px] text-slate-500 font-medium">
        Hội thi Rung Chuông Vàng • Trường THPT 25-10
      </footer>
    </div>
  );
};
