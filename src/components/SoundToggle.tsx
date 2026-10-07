import React, { useState, useEffect } from 'react';
import { soundManager } from '../utils/soundEffects';

interface SoundToggleProps {
  className?: string;
  showTestButton?: boolean;
}

export const SoundToggle: React.FC<SoundToggleProps> = ({
  className = '',
  showTestButton = true,
}) => {
  const [enabled, setEnabled] = useState(soundManager.getEnabled());

  useEffect(() => {
    const unsubscribe = soundManager.subscribe(() => {
      setEnabled(soundManager.getEnabled());
    });
    return unsubscribe;
  }, []);

  const handleToggle = () => {
    soundManager.unlockAudio();
    const next = !enabled;
    soundManager.setEnabled(next);
    setEnabled(next);
    if (next) {
      soundManager.playCountdownTick(true);
    }
  };

  const handleTestBell = () => {
    soundManager.unlockAudio();
    soundManager.setEnabled(true);
    setEnabled(true);
    soundManager.playGoldenBell();
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
          enabled
            ? 'bg-sky-600 text-white hover:bg-sky-700'
            : 'bg-white text-slate-600 border border-sky-200 hover:bg-sky-50'
        }`}
        title={enabled ? 'Đang bật âm thanh' : 'Đang tắt âm thanh'}
      >
        <span>{enabled ? 'ÂM THANH: BẬT' : 'ÂM THANH: TẮT'}</span>
      </button>

      {showTestButton && (
        <button
          type="button"
          onClick={handleTestBell}
          className="px-2.5 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-200 text-xs font-bold transition-all cursor-pointer shadow-sm"
          title="Thử tiếng Chuông Vàng"
        >
          <span>Thử Chuông</span>
        </button>
      )}
    </div>
  );
};
