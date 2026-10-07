import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { SchoolLogo } from './SchoolLogo';
import { getDynamicJoinUrl, verifyAndResolveJoinUrl, copyToClipboard } from '../utils/urlHelper';

interface QRCodeModalProps {
  roomCode: string;
  isOpen: boolean;
  onClose: () => void;
  competitionTitle?: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  roomCode,
  isOpen,
  onClose,
  competitionTitle = 'Rung Chuông Vàng – THPT 25-10',
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [isPre404, setIsPre404] = useState<boolean>(false);
  const [preUrl, setPreUrl] = useState<string>('');
  const [devUrl, setDevUrl] = useState<string>('');
  const [checkingUrl, setCheckingUrl] = useState<boolean>(false);
  const [showDomainEdit, setShowDomainEdit] = useState<boolean>(false);
  const [customDomainInput, setCustomDomainInput] = useState<string>('');

  const generateQrImage = (targetUrl: string) => {
    setJoinUrl(targetUrl);
    QRCode.toDataURL(targetUrl, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrUrl(url))
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });
  };

  const refreshQr = async (forceRecheck: boolean = false) => {
    if (!roomCode) return;
    setCheckingUrl(true);
    try {
      const resolved = await verifyAndResolveJoinUrl(roomCode, forceRecheck);
      setIsPre404(resolved.isPre404);
      setPreUrl(resolved.preUrl);
      setDevUrl(resolved.devUrl);
      generateQrImage(resolved.joinUrl);
    } catch {
      const fallbackUrl = getDynamicJoinUrl(roomCode);
      generateQrImage(fallbackUrl);
    } finally {
      setCheckingUrl(false);
    }
  };

  useEffect(() => {
    if (isOpen && roomCode) {
      try {
        const savedCustom = localStorage.getItem('rcv_custom_domain') || '';
        setCustomDomainInput(savedCustom);
      } catch (e) {}
      refreshQr(true);
    }
  }, [isOpen, roomCode]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    const success = await copyToClipboard(joinUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.download = `QR-PhongThi-${roomCode}-THPT-25-10.png`;
    link.href = qrUrl;
    link.click();
  };

  const handleSaveCustomDomain = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (customDomainInput.trim()) {
        localStorage.setItem('rcv_custom_domain', customDomainInput.trim());
      } else {
        localStorage.removeItem('rcv_custom_domain');
      }
    } catch (e) {}
    setShowDomainEdit(false);
    refreshQr();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border-2 border-sky-300 rounded-3xl w-full max-w-md p-6 shadow-2xl relative flex flex-col items-center text-center max-h-[95vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-700 hover:text-slate-950 p-2 rounded-xl hover:bg-slate-100 font-black text-sm transition cursor-pointer"
          title="Đóng"
        >
          ✕
        </button>

        <SchoolLogo size={60} className="mb-2" />
        <span className="text-xs uppercase tracking-widest text-sky-700 font-black">
          Trường THPT 25-10
        </span>
        <h3 className="text-xl font-black text-slate-950 mt-1 mb-1">
          MÃ QR VÀO PHÒNG THI
        </h3>
        <p className="text-xs text-slate-600 font-bold max-w-xs mb-2 line-clamp-1">
          {competitionTitle}
        </p>

        {/* Public Access Badge or Unshared Remix Alert */}
        {isPre404 ? (
          <div className="w-full max-w-sm mb-3 p-3 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 text-left space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase text-amber-900">
                ⚠️ Cần bật Chia sẻ Công khai (Share)
              </span>
              <button
                type="button"
                onClick={() => refreshQr(true)}
                disabled={checkingUrl}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black cursor-pointer shrink-0"
              >
                {checkingUrl ? 'Đang kiểm tra...' : '🔄 Kiểm tra lại'}
              </button>
            </div>
            <p className="text-[11px] leading-snug font-semibold text-slate-800">
              Bản Remix chưa bật <strong>Public</strong> nên điện thoại học sinh quét link <code className="bg-amber-100 px-1 rounded">ais-pre-...</code> sẽ báo lỗi <strong>Page not found</strong>.
            </p>
            <p className="text-[11px] leading-snug font-bold text-sky-900">
              👉 Cách bật: Bấm nút <strong>Share (Chia sẻ)</strong> ở góc trên bên phải màn hình AI Studio → bật <strong>Public app</strong> → bấm <strong>Kiểm tra lại</strong>!
            </p>
            {preUrl && devUrl && preUrl !== devUrl && (
              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => generateQrImage(preUrl)}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-black border cursor-pointer ${
                    joinUrl === preUrl
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Dùng link Public (ais-pre)
                </button>
                <button
                  type="button"
                  onClick={() => generateQrImage(devUrl)}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-black border cursor-pointer ${
                    joinUrl === devUrl
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Dùng link Dev (ais-dev)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-sm mb-3 space-y-1.5">
            <div className="w-full px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-black inline-flex items-center justify-center gap-1.5 shadow-sm">
              <span>✓ Quét trực tiếp không cần đăng nhập Google</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[10.5px] font-semibold text-left">
              💡 <strong>iPhone / Safari:</strong> Nếu hiện <em>"Action required..."</em>, bấm <strong>[Close and continue]</strong> là vào thẳng thi!
            </div>
          </div>
        )}

        {/* Dynamic Join URL Indicator */}
        <div className="w-full max-w-sm mb-3 px-3 py-2 bg-sky-50 border border-sky-200 rounded-xl text-[11px] text-sky-950 font-mono font-bold flex items-center justify-between gap-2 shadow-inner">
          <span className="truncate text-left select-all">🔗 {joinUrl || 'Đang xác định link...'}</span>
          <button
            type="button"
            onClick={() => setShowDomainEdit(!showDomainEdit)}
            className="text-[10px] text-sky-700 underline font-bold hover:text-sky-900 shrink-0 cursor-pointer"
          >
            {showDomainEdit ? 'Đóng' : 'Đổi link'}
          </button>
        </div>

        {/* Optional Custom Domain Setting Form */}
        {showDomainEdit && (
          <form onSubmit={handleSaveCustomDomain} className="w-full max-w-sm mb-3 p-3 bg-slate-50 border border-slate-300 rounded-2xl text-left space-y-2">
            <label className="block text-[10px] uppercase font-black text-slate-700">
              Tên miền / URL công khai tùy chỉnh
            </label>
            <input
              type="text"
              value={customDomainInput}
              onChange={(e) => setCustomDomainInput(e.target.value)}
              placeholder="Ví dụ: https://ais-pre-...asia-east1.run.app"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-950 font-mono focus:outline-none focus:border-sky-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-black"
              >
                Lưu & Tạo lại QR
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomDomainInput('');
                  try { localStorage.removeItem('rcv_custom_domain'); } catch (e) {}
                  setShowDomainEdit(false);
                  refreshQr();
                }}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold"
              >
                Mặc định
              </button>
            </div>
          </form>
        )}

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl shadow-inner border-2 border-sky-200 mb-4 inline-block">
          {qrUrl ? (
            <img src={qrUrl} alt="Mã QR Phòng Thi" className="w-60 h-60 mx-auto rounded-xl drop-shadow-sm" />
          ) : (
            <div className="w-60 h-60 flex items-center justify-center text-sky-600 font-black text-sm">
              Đang tạo mã QR...
            </div>
          )}
        </div>

        {/* Room Code Badge */}
        <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl px-5 py-3 mb-4 flex items-center justify-between w-full max-w-sm shadow-sm">
          <div className="text-left">
            <span className="text-[10px] text-sky-900 uppercase font-black block">
              Mã phòng thi
            </span>
            <span className="text-2xl font-black text-slate-950 tracking-wider font-mono">
              {roomCode}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className={`px-3.5 py-2 rounded-xl font-black text-xs transition shadow cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-sky-600 hover:bg-sky-700 text-white'
            }`}
          >
            <span>{copied ? '✓ ĐÃ CHÉP LINK' : 'SAO CHÉP LINK'}</span>
          </button>
        </div>

        <div className="flex gap-2.5 w-full max-w-sm">
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center border-2 border-slate-300 transition shadow-sm cursor-pointer"
          >
            <span>📥 TẢI ẢNH QR</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs transition shadow cursor-pointer"
          >
            ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
};
