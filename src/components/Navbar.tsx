import React from 'react';
import { SchoolLogo } from './SchoolLogo';
import { SoundToggle } from './SoundToggle';

interface NavbarProps {
  currentTab: 'admin' | 'projector' | 'proctor' | 'guide' | 'student';
  setCurrentTab: (tab: 'admin' | 'projector' | 'proctor' | 'guide' | 'student') => void;
  roomCode?: string;
  isConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  roomCode,
  isConnected,
}) => {
  // When in projector mode, provide clear floating button to return to Admin
  const isProjectorMode = (currentTab as string) === 'projector';

  if (isProjectorMode) {
    return (
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border-2 border-slate-200 shadow-xl">
        <SoundToggle showTestButton={false} />
        <button
          type="button"
          onClick={() => setCurrentTab('admin')}
          className="px-3.5 py-1.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow transition cursor-pointer"
          title="Quay lại Bảng điều khiển Quản trị Admin"
        >
          VỀ ADMIN
        </button>
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 py-2.5 sm:px-6 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div
          onClick={() => setCurrentTab('admin')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <SchoolLogo size={40} showText={true} />
        </div>

        {/* Navigation tabs: Ban to chuc, Man hinh chieu, Giam thi, Huong dan */}
        <nav className="hidden md:flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setCurrentTab('admin')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              currentTab === 'admin'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800 font-bold hover:bg-white'
            }`}
          >
            Ban tổ chức
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('projector')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              currentTab === 'projector'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800 font-bold hover:bg-white'
            }`}
          >
            Màn hình chiếu LED
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('proctor')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              currentTab === 'proctor'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800 font-bold hover:bg-white'
            }`}
          >
            Giám thị
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('guide')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              currentTab === 'guide'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800 font-bold hover:bg-white'
            }`}
          >
            Hướng dẫn
          </button>
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {roomCode && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs font-mono font-bold">
              <span className="text-[10px] text-slate-500 uppercase">Phòng:</span>
              <span className="font-black text-slate-700 font-bold">{roomCode}</span>
            </div>
          )}

          {isConnected !== undefined && (
            <div
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="hidden sm:inline">
                {isConnected ? 'Trực tuyến' : 'Mất mạng'}
              </span>
            </div>
          )}

          <SoundToggle showTestButton={false} />
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex md:hidden items-center justify-around gap-1 mt-2 pt-2 border-t border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setCurrentTab('admin')}
          className={`py-2 px-3 rounded-xl transition ${
            currentTab === 'admin'
              ? 'text-white bg-blue-600 font-black shadow-sm'
              : 'text-slate-600 bg-slate-50'
          }`}
        >
          Ban tổ chức
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('projector')}
          className={`py-2 px-3 rounded-xl transition ${
            currentTab === 'projector'
              ? 'text-white bg-blue-600 font-black shadow-sm'
              : 'text-slate-600 bg-slate-50'
          }`}
        >
          Chiếu LED
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('proctor')}
          className={`py-2 px-3 rounded-xl transition ${
            currentTab === 'proctor'
              ? 'text-white bg-blue-600 font-black shadow-sm'
              : 'text-slate-600 bg-slate-50'
          }`}
        >
          Giám thị
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('guide')}
          className={`py-2 px-3 rounded-xl transition ${
            currentTab === 'guide'
              ? 'text-white bg-blue-600 font-black shadow-sm'
              : 'text-slate-600 bg-slate-50'
          }`}
        >
          Hướng dẫn
        </button>
      </div>
    </header>
  );
};
