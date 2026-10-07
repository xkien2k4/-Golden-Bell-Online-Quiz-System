/**
 * Web Audio API synthesizer for Rung Chuông Vàng - THPT 25-10
 * 100% self-contained, zero external MP3 dependencies, zero latency, works offline.
 * Synthesizes lively game show sounds, countdown beats, crowd applause, brass fanfares, and golden bell.
 * Includes absolute hard-kill routing (Master, Victory, BGM, SFX Gain nodes) to ensure immediate 0ms silence upon STOP.
 */

type SoundEventListener = () => void;

class SoundManager {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.85;

  // Master and Sub-gain nodes for instantaneous sound cut-off
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private victoryGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  // Background music tracking
  private bgmInterval: number | null = null;
  private bgmStep: number = 0;
  private isBgmActive: boolean = false;
  private activeBgmNodes: (AudioNode & { stop?: (when?: number) => void })[] = [];

  // Victory Anthem tracking
  private victoryTimeouts: number[] = [];
  private isVictoryPlaying: boolean = false;
  private activeVictoryNodes: (AudioNode & { stop?: (when?: number) => void })[] = [];

  // SFX tracking
  private sfxTimeouts: number[] = [];
  private activeSfxNodes: (AudioNode & { stop?: (when?: number) => void })[] = [];

  // Listeners for UI state syncing
  private listeners: Set<SoundEventListener> = new Set();

  public subscribe(listener: SoundEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Error in sound listener:', err);
      }
    });
  }

  private initContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      // Initialize gain hierarchy if not yet built
      if (!this.masterGain) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isEnabled ? this.volume : 0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }

      if (!this.sfxGain && this.masterGain) {
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);
      }

      if (!this.victoryGain && this.masterGain) {
        this.victoryGain = this.ctx.createGain();
        this.victoryGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.victoryGain.connect(this.masterGain);
      }

      if (!this.bgmGain && this.masterGain) {
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.bgmGain.connect(this.masterGain);
      }
    }

    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopAll();
      if (this.masterGain && this.ctx) {
        try {
          this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        } catch (e) {}
      }
    } else {
      if (this.masterGain && this.ctx) {
        try {
          this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        } catch (e) {}
      }
    }
    this.notify();
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && this.isEnabled) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      } catch (e) {}
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public unlockAudio() {
    const ctx = this.initContext();
    if (ctx) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } catch (e) {}
    }
  }

  // Create white or pink noise buffer for percussive hits, snares, cymbals, applause
  private createNoiseBuffer(duration: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    if (bufferSize <= 0) return null;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Filtered pink-ish noise for softer, warmer body
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    return buffer;
  }

  // Synthesize an electronic punchy kick drum
  private playKick(t: number, vol = 0.5, category: 'sfx' | 'victory' | 'bgm' = 'sfx') {
    if (!this.isEnabled || !this.ctx) return;
    const dest =
      category === 'victory' ? this.victoryGain : category === 'bgm' ? this.bgmGain : this.sfxGain;
    if (!dest) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
      gain.gain.setValueAtTime(this.volume * vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.15);

      if (category === 'victory') {
        this.activeVictoryNodes.push(osc);
      } else if (category === 'bgm') {
        this.activeBgmNodes.push(osc);
      } else {
        this.activeSfxNodes.push(osc);
      }
    } catch (e) {}
  }

  // Synthesize a crisp snare / rim shot
  private playSnare(t: number, vol = 0.3, category: 'sfx' | 'victory' | 'bgm' = 'sfx') {
    if (!this.isEnabled || !this.ctx) return;
    const dest =
      category === 'victory' ? this.victoryGain : category === 'bgm' ? this.bgmGain : this.sfxGain;
    if (!dest) return;

    const noise = this.createNoiseBuffer(0.12);
    if (!noise) return;

    try {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.volume * vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noiseSource.start(t);
      noiseSource.stop(t + 0.12);

      if (category === 'victory') {
        this.activeVictoryNodes.push(noiseSource);
      } else if (category === 'bgm') {
        this.activeBgmNodes.push(noiseSource);
      } else {
        this.activeSfxNodes.push(noiseSource);
      }
    } catch (e) {}
  }

  // Synthesize realistic crowd applause & cheering
  public playApplause(durationSec = 2.5, category: 'sfx' | 'victory' = 'sfx') {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const dest = category === 'victory' ? this.victoryGain : this.sfxGain;
    if (!dest) return;

    const t = ctx.currentTime;
    const noise = this.createNoiseBuffer(durationSec);
    if (!noise) return;

    try {
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, t);
      filter.Q.value = 1.2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(this.volume * 0.45, t + 0.4);
      gain.gain.setValueAtTime(this.volume * 0.45, t + durationSec - 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);
      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noiseSource.start(t);
      noiseSource.stop(t + durationSec);

      if (category === 'victory') {
        this.activeVictoryNodes.push(noiseSource);
      } else {
        this.activeSfxNodes.push(noiseSource);
      }

      // Add intermittent cheer claps
      for (let i = 0; i < 18; i++) {
        const clapTime = t + Math.random() * (durationSec - 0.5);
        const clapOsc = ctx.createOscillator();
        const clapGain = ctx.createGain();
        clapOsc.type = 'triangle';
        clapOsc.frequency.setValueAtTime(500 + Math.random() * 400, clapTime);
        clapGain.gain.setValueAtTime(this.volume * 0.15, clapTime);
        clapGain.gain.exponentialRampToValueAtTime(0.001, clapTime + 0.08);
        clapOsc.connect(clapGain);
        clapGain.connect(dest);
        clapOsc.start(clapTime);
        clapOsc.stop(clapTime + 0.09);

        if (category === 'victory') {
          this.activeVictoryNodes.push(clapOsc);
        } else {
          this.activeSfxNodes.push(clapOsc);
        }
      }
    } catch (e) {}
  }

  // 1. PHẦN BẮT ĐẦU CÂU HỎI (Question Intro Stinger & Brass Hit)
  public playQuestionStart() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;

    // Opening sub-impact
    this.playKick(t, 0.65, 'sfx');
    this.playSnare(t + 0.08, 0.35, 'sfx');

    // Fast triumphal brass fanfare triad: C5 (523Hz) -> G5 (784Hz) -> C6 (1046Hz)
    const notes = [
      { freq: 523.25, time: 0, dur: 0.12 },
      { freq: 659.25, time: 0.1, dur: 0.12 },
      { freq: 783.99, time: 0.2, dur: 0.15 },
      { freq: 1046.5, time: 0.32, dur: 0.55 },
    ];

    notes.forEach((n) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.freq, t + n.time);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, t + n.time);
        gain.gain.setValueAtTime(this.volume * 0.32, t + n.time);
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.time + n.dur);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t + n.time);
        osc.stop(t + n.time + n.dur + 0.02);
        this.activeSfxNodes.push(osc);
      } catch (e) {}
    });
  }

  // 2. PHẦN ĐẾM NGƯỢC 15S (Tiếng đồng hồ tích tắc + Nhịp đập kịch tính Game Show)
  public playCountdownBeat(secondsRemaining: number) {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const isOdd = secondsRemaining % 2 === 1;

    try {
      if (secondsRemaining > 5) {
        // TIẾNG ĐỒNG HỒ TÍCH TẮC RÕ RÀNG (Alternating Tick - Tock)
        const tickFreq = isOdd ? 1250 : 820;
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(tickFreq, t);
        osc.frequency.exponentialRampToValueAtTime(tickFreq * 0.4, t + 0.045);
        oscGain.gain.setValueAtTime(this.volume * 0.45, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(oscGain);
        oscGain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.055);
        this.activeSfxNodes.push(osc);

        // Metallic gear click (White noise micro-click)
        const noise = this.createNoiseBuffer(0.025);
        if (noise) {
          const noiseSrc = ctx.createBufferSource();
          noiseSrc.buffer = noise;
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = isOdd ? 3500 : 2600;
          filter.Q.value = 3.0;
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(this.volume * 0.35, t);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
          noiseSrc.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(this.sfxGain);
          noiseSrc.start(t);
          noiseSrc.stop(t + 0.03);
          this.activeSfxNodes.push(noiseSrc);
        }

        // Sub-bass heartbeat pulse
        this.playKick(t, 0.3, 'sfx');
      } else {
        // 5 GIÂY CUỐI: ĐẾM NGƯỢC KHẨN CẤP
        this.playKick(t, 0.65, 'sfx');
        this.playKick(t + 0.16, 0.5, 'sfx');

        [0, 0.16].forEach((delay) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1400, t + delay);
          osc.frequency.exponentialRampToValueAtTime(600, t + delay + 0.04);
          gain.gain.setValueAtTime(this.volume * 0.4, t + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.045);
          osc.connect(gain);
          gain.connect(this.sfxGain!);
          osc.start(t + delay);
          osc.stop(t + delay + 0.05);
          this.activeSfxNodes.push(osc);
        });

        // Urgent rising countdown warning tone
        const warnOsc = ctx.createOscillator();
        const warnGain = ctx.createGain();
        const warnFreq = 750 + (6 - secondsRemaining) * 140;
        warnOsc.type = 'sawtooth';
        warnOsc.frequency.setValueAtTime(warnFreq, t);
        warnOsc.frequency.exponentialRampToValueAtTime(warnFreq * 1.3, t + 0.2);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(warnFreq * 1.8, t);
        warnGain.gain.setValueAtTime(this.volume * 0.4, t);
        warnGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        warnOsc.connect(filter);
        filter.connect(warnGain);
        warnGain.connect(this.sfxGain);
        warnOsc.start(t);
        warnOsc.stop(t + 0.23);
        this.activeSfxNodes.push(warnOsc);
      }
    } catch (e) {}
  }

  // Alias for backward compatibility
  public playCountdownTick(urgent: boolean = false) {
    this.playCountdownBeat(urgent ? 3 : 10);
  }

  // 3. PHẦN KHÓA ĐÁP ÁN / HẾT GIỜ (Dramatic Game Show Double Buzzer & Gong)
  public playTimesUp() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;

    try {
      [0, 0.18].forEach((offset) => {
        const freqs = [185, 233, 277]; // F#3 minor dissonance
        freqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t + offset);
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1400, t + offset);
          gain.gain.setValueAtTime(this.volume * 0.3, t + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.16);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.sfxGain!);
          osc.start(t + offset);
          osc.stop(t + offset + 0.17);
          this.activeSfxNodes.push(osc);
        });
      });

      this.playKick(t, 0.7, 'sfx');
    } catch (e) {}
  }

  // 4. PHẦN CÔNG BỐ ĐÁP ÁN (Suspense Drumroll into Triumphant Splash)
  public playRevealAnswer() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;

    try {
      // Snare drum roll acceleration for 0.5s
      for (let i = 0; i < 9; i++) {
        const snareTime = t + i * 0.055;
        this.playSnare(snareTime, 0.15 + i * 0.03, 'sfx');
      }

      const resolveTime = t + 0.55;
      this.playKick(resolveTime, 0.6, 'sfx');
      this.playSnare(resolveTime, 0.4, 'sfx');

      // Radiant C-Major sparkle chime
      const chords = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6
      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, resolveTime + idx * 0.06);
        gain.gain.setValueAtTime(this.volume * 0.35, resolveTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, resolveTime + idx * 0.06 + 0.5);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(resolveTime + idx * 0.06);
        osc.stop(resolveTime + idx * 0.06 + 0.52);
        this.activeSfxNodes.push(osc);
      });
    } catch (e) {}
  }

  // 5. PHẦN CHÚC MỪNG THÍ SINH ĐÚNG (Celebratory Chimes + Crowd Applause)
  public playCorrect() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.07);
        gain.gain.setValueAtTime(this.volume * 0.35, t + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.35);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t + i * 0.07);
        osc.stop(t + i * 0.07 + 0.38);
        this.activeSfxNodes.push(osc);
      });

      const applauseTimer = window.setTimeout(() => {
        if (!this.isEnabled) return;
        this.playApplause(2.0, 'sfx');
      }, 250);
      this.sfxTimeouts.push(applauseTimer);
    } catch (e) {}
  }

  // 6. PHẦN THÍ SINH BỊ LOẠI (Playful "Uh-oh" Spring Wobble - Friendly School Game Style)
  public playEliminated() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.4);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.linearRampToValueAtTime(250, t + 0.4);
      gain.gain.setValueAtTime(this.volume * 0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.48);
      this.activeSfxNodes.push(osc);
    } catch (e) {}
  }

  public playWrong() {
    this.playEliminated();
  }

  // 7. PHẦN CỨU TRỢ THẦY CÔ (Triumphant Rescue Fanfare & Magic Sparkles)
  public playRescueFanfare() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;

    try {
      this.playKick(t, 0.6, 'sfx');

      const fanfare = [
        { freq: 440, time: 0, dur: 0.12 },
        { freq: 554.37, time: 0.11, dur: 0.12 },
        { freq: 659.25, time: 0.22, dur: 0.15 },
        { freq: 880, time: 0.35, dur: 0.6 },
      ];

      fanfare.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.freq, t + n.time);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2800;
        gain.gain.setValueAtTime(this.volume * 0.36, t + n.time);
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.time + n.dur);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t + n.time);
        osc.stop(t + n.time + n.dur + 0.02);
        this.activeSfxNodes.push(osc);
      });

      // Magical glissando chimes
      for (let i = 0; i < 12; i++) {
        const sparkleOsc = ctx.createOscillator();
        const sparkleGain = ctx.createGain();
        const sTime = t + 0.3 + i * 0.04;
        sparkleOsc.type = 'sine';
        sparkleOsc.frequency.setValueAtTime(1000 + i * 180, sTime);
        sparkleGain.gain.setValueAtTime(this.volume * 0.15, sTime);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, sTime + 0.15);
        sparkleOsc.connect(sparkleGain);
        sparkleGain.connect(this.sfxGain);
        sparkleOsc.start(sTime);
        sparkleOsc.stop(sTime + 0.16);
        this.activeSfxNodes.push(sparkleOsc);
      }

      const rescueApplauseTimer = window.setTimeout(() => {
        if (!this.isEnabled) return;
        this.playApplause(2.2, 'sfx');
      }, 400);
      this.sfxTimeouts.push(rescueApplauseTimer);
    } catch (e) {}
  }

  // 8. PHẦN RUNG CHUÔNG VÀNG (Grand Resonant Bell Gong with Physical Harmonics)
  public playGoldenBell(boost = 1.0, category: 'sfx' | 'victory' = 'sfx') {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const dest = category === 'victory' ? this.victoryGain : this.sfxGain;
    if (!dest) return;

    const t = ctx.currentTime;
    const baseFreq = 440; // A4
    const partials = [
      { ratio: 0.5, gain: 0.6, decay: 5.5 },
      { ratio: 1.0, gain: 1.0, decay: 5.0 },
      { ratio: 1.19, gain: 0.65, decay: 4.2 },
      { ratio: 1.5, gain: 0.55, decay: 3.8 },
      { ratio: 2.0, gain: 0.45, decay: 3.2 },
      { ratio: 2.74, gain: 0.35, decay: 2.5 },
      { ratio: 3.0, gain: 0.25, decay: 2.0 },
      { ratio: 4.07, gain: 0.18, decay: 1.5 },
      { ratio: 5.43, gain: 0.12, decay: 1.1 },
    ];

    try {
      partials.forEach((p) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * p.ratio, t);

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(5.5, t);
        lfoGain.gain.setValueAtTime(2.2, t);
        lfo.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + p.decay);

        gain.gain.setValueAtTime(this.volume * p.gain * 0.55 * boost, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + p.decay);

        if (category === 'victory') {
          this.activeVictoryNodes.push(osc, lfo);
        } else {
          this.activeSfxNodes.push(osc, lfo);
        }
      });

      this.playKick(t, 0.7, category);
    } catch (e) {}
  }

  // Helper to schedule a brass note for Victory Anthem
  private playBrassNote(
    freq: number,
    startAt: number,
    duration: number,
    gainMul = 1.0,
    type: OscillatorType = 'sawtooth'
  ) {
    if (!this.isEnabled || !this.isVictoryPlaying || !this.ctx || !this.victoryGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startAt);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, startAt);
      filter.frequency.exponentialRampToValueAtTime(1400, startAt + duration);
      gain.gain.setValueAtTime(this.volume * 0.38 * gainMul, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.victoryGain);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.05);
      this.activeVictoryNodes.push(osc);
    } catch (e) {}
  }

  /**
   * STOP VICTORY ANTHEM IMMEDIATELY (0ms hard cut)
   * Disconnects and silences the victory audio sub-graph and stops all scheduled victory nodes.
   */
  public stopVictory() {
    this.isVictoryPlaying = false;

    // Clear all scheduled timeouts
    this.victoryTimeouts.forEach((id) => clearTimeout(id));
    this.victoryTimeouts = [];

    // Stop and disconnect all active victory audio nodes
    this.activeVictoryNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      } catch (e) {}
    });
    this.activeVictoryNodes = [];

    // Sever victory gain node immediately and recreate clean pipeline
    if (this.victoryGain && this.ctx) {
      try {
        this.victoryGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.victoryGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.victoryGain.disconnect();
      } catch (e) {}
      this.victoryGain = this.ctx.createGain();
      this.victoryGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      if (this.masterGain) {
        this.victoryGain.connect(this.masterGain);
      }
    }

    this.notify();
  }

  public getIsVictoryPlaying(): boolean {
    return this.isVictoryPlaying;
  }

  // 9. BÀI CA KHẢI HOÀN RUNG CHUÔNG VÀNG HOÀNH TRÁNG (Epic Symphonic Golden Bell Anthem)
  public playVictory() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    // Stop any existing victory audio first
    this.stopVictory();
    this.isVictoryPlaying = true;
    this.notify();

    const t = ctx.currentTime;

    // SECTION 1: KHỞI ĐẦU KHẢI HOÀN & TRỐNG ĐỒI TIMPANI (0.0s - 3.5s)
    const openingFanfare = [
      { f: 523.25, time: 0.0, d: 0.18, g: 1.0 }, // C5
      { f: 523.25, time: 0.18, d: 0.18, g: 1.0 }, // C5
      { f: 523.25, time: 0.36, d: 0.24, g: 1.1 }, // C5
      { f: 659.25, time: 0.6, d: 0.55, g: 1.2 }, // E5
      { f: 523.25, time: 1.15, d: 0.22, g: 1.0 }, // C5
      { f: 659.25, time: 1.37, d: 0.22, g: 1.1 }, // E5
      { f: 783.99, time: 1.6, d: 0.7, g: 1.3 }, // G5
      { f: 1046.5, time: 2.3, d: 1.4, g: 1.5 }, // C6 High Climax
    ];

    openingFanfare.forEach((n) => {
      this.playBrassNote(n.f, t + n.time, n.d, n.g);
      this.playBrassNote(n.f * 0.5, t + n.time, n.d, n.g * 0.75);
    });

    for (let i = 0; i < 10; i++) {
      const rollTime = t + 1.2 + i * 0.11;
      this.playKick(rollTime, 0.45 + i * 0.07, 'victory');
    }

    const bellTimeout1 = window.setTimeout(() => {
      if (!this.isEnabled || !this.isVictoryPlaying) return;
      this.playGoldenBell(1.3, 'victory');
    }, 2400);
    this.victoryTimeouts.push(bellTimeout1);

    // SECTION 2: HÀNH KHÚC CHIẾN THẮNG SÔI ĐỘNG (3.5s - 10.0s)
    const marchMelody = [
      { f: 523.25, time: 3.5, d: 0.22, g: 1.0 }, // C5
      { f: 587.33, time: 3.75, d: 0.22, g: 1.0 }, // D5
      { f: 659.25, time: 4.0, d: 0.4, g: 1.1 }, // E5
      { f: 523.25, time: 4.45, d: 0.4, g: 1.0 }, // C5
      { f: 783.99, time: 4.9, d: 0.35, g: 1.2 }, // G5
      { f: 659.25, time: 5.3, d: 0.35, g: 1.1 }, // E5
      { f: 880.0, time: 5.7, d: 0.7, g: 1.3 }, // A5
      { f: 783.99, time: 6.5, d: 0.25, g: 1.0 }, // G5
      { f: 659.25, time: 6.8, d: 0.25, g: 1.0 }, // E5
      { f: 587.33, time: 7.1, d: 0.35, g: 1.0 }, // D5
      { f: 523.25, time: 7.5, d: 0.35, g: 1.0 }, // C5
      { f: 587.33, time: 7.9, d: 0.2, g: 1.1 }, // D5
      { f: 659.25, time: 8.15, d: 0.2, g: 1.1 }, // E5
      { f: 783.99, time: 8.4, d: 0.25, g: 1.2 }, // G5
      { f: 1046.5, time: 8.7, d: 0.9, g: 1.4 }, // C6
    ];

    marchMelody.forEach((n) => {
      this.playBrassNote(n.f, t + n.time, n.d, n.g);
      this.playBrassNote(n.f * 0.75, t + n.time, n.d, n.g * 0.55);
    });

    for (let step = 0; step < 14; step++) {
      const beatTime = t + 3.5 + step * 0.45;
      this.playKick(beatTime, step % 2 === 0 ? 0.75 : 0.45, 'victory');
    }

    // SECTION 3: VỖ TAY RẦM RỘ & CHUÔNG VÀNG LẦN 2 (9.0s)
    const applauseTimeout1 = window.setTimeout(() => {
      if (!this.isEnabled || !this.isVictoryPlaying) return;
      this.playApplause(7.0, 'victory');
      this.playGoldenBell(1.35, 'victory');
    }, 9000);
    this.victoryTimeouts.push(applauseTimeout1);

    // SECTION 4: GIAI ĐIỆU CAO TRÀO ĐỈNH CAO (9.6s - 17.5s)
    const climaxMelody = [
      { f: 659.25, time: 9.6, d: 0.3, g: 1.0 }, // E5
      { f: 783.99, time: 9.95, d: 0.3, g: 1.1 }, // G5
      { f: 1046.5, time: 10.3, d: 0.6, g: 1.3 }, // C6
      { f: 1174.66, time: 11.0, d: 0.35, g: 1.2 }, // D6
      { f: 1318.51, time: 11.4, d: 0.85, g: 1.5 }, // E6 Peak
      { f: 1046.5, time: 12.35, d: 0.4, g: 1.2 }, // C6
      { f: 1174.66, time: 12.8, d: 0.45, g: 1.2 }, // D6
      { f: 1046.5, time: 13.35, d: 1.6, g: 1.5 }, // C6 Grand Sustained
      { f: 880.0, time: 15.0, d: 0.35, g: 1.1 }, // A5
      { f: 987.77, time: 15.4, d: 0.35, g: 1.1 }, // B5
      { f: 1046.5, time: 15.8, d: 1.2, g: 1.4 }, // C6
    ];

    climaxMelody.forEach((n) => {
      this.playBrassNote(n.f, t + n.time, n.d, n.g);
      this.playBrassNote(n.f * 0.5, t + n.time, n.d, n.g * 0.8);
    });

    for (let step = 0; step < 16; step++) {
      const beatTime = t + 9.6 + step * 0.45;
      this.playKick(beatTime, step % 2 === 0 ? 0.8 : 0.5, 'victory');
    }

    // SECTION 5: KHÚC BIẾN TẤU LỄ HỘI RỰC RỠ & CHUÔNG VÀNG LẦN 3 (17.5s - 25.5s)
    const festiveMelody = [
      { f: 523.25, time: 17.5, d: 0.2, g: 1.0 }, // C5
      { f: 659.25, time: 17.75, d: 0.2, g: 1.0 }, // E5
      { f: 783.99, time: 18.0, d: 0.25, g: 1.1 }, // G5
      { f: 1046.5, time: 18.3, d: 0.45, g: 1.3 }, // C6
      { f: 783.99, time: 18.8, d: 0.25, g: 1.0 }, // G5
      { f: 1046.5, time: 19.1, d: 0.5, g: 1.2 }, // C6
      { f: 1174.66, time: 19.65, d: 0.3, g: 1.2 }, // D6
      { f: 1318.51, time: 20.0, d: 0.7, g: 1.4 }, // E6
      { f: 1174.66, time: 20.75, d: 0.3, g: 1.1 }, // D6
      { f: 1046.5, time: 21.1, d: 0.6, g: 1.3 }, // C6
      { f: 880.0, time: 21.75, d: 0.3, g: 1.1 }, // A5
      { f: 783.99, time: 22.1, d: 0.3, g: 1.1 }, // G5
      { f: 659.25, time: 22.45, d: 0.35, g: 1.1 }, // E5
      { f: 783.99, time: 22.85, d: 0.35, g: 1.2 }, // G5
      { f: 1046.5, time: 23.25, d: 1.6, g: 1.5 }, // C6 Sustained
    ];

    festiveMelody.forEach((n) => {
      this.playBrassNote(n.f, t + n.time, n.d, n.g);
      this.playBrassNote(n.f * 0.5, t + n.time, n.d, n.g * 0.7);
    });

    const bellTimeout2 = window.setTimeout(() => {
      if (!this.isEnabled || !this.isVictoryPlaying) return;
      this.playGoldenBell(1.4, 'victory');
      this.playApplause(8.0, 'victory');
    }, 18000);
    this.victoryTimeouts.push(bellTimeout2);

    for (let step = 0; step < 16; step++) {
      const beatTime = t + 17.5 + step * 0.45;
      this.playKick(beatTime, step % 2 === 0 ? 0.85 : 0.5, 'victory');
    }

    // SECTION 6: ĐẠI HỢP XƯỚNG CHUNG CUỘC & HỒNG CHUNG RUNG VANG (25.5s - 34.0s)
    const grandFinaleTimeout = window.setTimeout(() => {
      if (!this.isEnabled || !this.isVictoryPlaying) return;
      this.playGoldenBell(1.6, 'victory');
      this.playApplause(8.5, 'victory');
      const nowT = ctx.currentTime;

      const finaleChords = [
        { freqs: [261.63, 329.63, 392.0, 523.25, 659.25, 1046.5], time: 0.0, d: 1.2 },
        { freqs: [349.23, 440.0, 523.25, 698.46, 880.0, 1046.5], time: 1.3, d: 1.2 },
        { freqs: [293.66, 392.0, 493.88, 587.33, 783.99, 1174.66], time: 2.6, d: 1.4 },
        { freqs: [261.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 1318.51], time: 4.1, d: 4.2 },
      ];

      finaleChords.forEach((ch) => {
        ch.freqs.forEach((freq) => {
          this.playBrassNote(freq, nowT + ch.time, ch.d, 0.85);
        });
      });

      for (let i = 0; i < 12; i++) {
        this.playKick(nowT + 4.1 + i * 0.15, 0.7 - i * 0.04, 'victory');
      }
    }, 25500);
    this.victoryTimeouts.push(grandFinaleTimeout);

    const bellTimeout3 = window.setTimeout(() => {
      if (!this.isEnabled || !this.isVictoryPlaying) return;
      this.playGoldenBell(1.5, 'victory');
    }, 30000);
    this.victoryTimeouts.push(bellTimeout3);

    const endTimeout = window.setTimeout(() => {
      this.isVictoryPlaying = false;
      this.notify();
    }, 34000);
    this.victoryTimeouts.push(endTimeout);
  }

  // 10. BỤC VINH QUANG TOP 3 (Podium Fanfare by Rank)
  public playPodiumFanfare(rank: 1 | 2 | 3) {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    if (rank === 1) {
      this.playVictory();
      return;
    }

    const t = ctx.currentTime;
    if (rank === 3) {
      const notes = [
        { f: 440, time: 0, d: 0.2 },
        { f: 554.37, time: 0.2, d: 0.2 },
        { f: 659.25, time: 0.4, d: 0.4 },
        { f: 880, time: 0.85, d: 1.2 },
      ];
      notes.forEach((n) => this.playBrassNote(n.f, t + n.time, n.d, 1.0));
      const podiumTimer = window.setTimeout(() => {
        if (!this.isEnabled) return;
        this.playApplause(2.8, 'sfx');
      }, 600);
      this.sfxTimeouts.push(podiumTimer);
    } else if (rank === 2) {
      const notes = [
        { f: 523.25, time: 0, d: 0.18 },
        { f: 659.25, time: 0.2, d: 0.18 },
        { f: 783.99, time: 0.4, d: 0.3 },
        { f: 659.25, time: 0.75, d: 0.2 },
        { f: 1046.5, time: 1.0, d: 1.5 },
      ];
      notes.forEach((n) => {
        this.playBrassNote(n.f, t + n.time, n.d, 1.1);
        this.playBrassNote(n.f * 0.5, t + n.time, n.d, 0.7);
      });
      const podiumTimer = window.setTimeout(() => {
        if (!this.isEnabled) return;
        this.playApplause(3.8, 'sfx');
        this.playGoldenBell(0.8, 'sfx');
      }, 800);
      this.sfxTimeouts.push(podiumTimer);
    }
  }

  // 11. PHẦN BẤM NÚT ĐIỆN TỬ (Crisp UI Click / Option Selected)
  public playButtonClick() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, t);
      osc.frequency.exponentialRampToValueAtTime(1400, t + 0.04);
      gain.gain.setValueAtTime(this.volume * 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.06);
      this.activeSfxNodes.push(osc);
    } catch (e) {}
  }

  // 12. NHẠC NỀN SÂN KHẤU SÔI ĐỘNG (Lively Game Show Background Loop at 124 BPM)
  public startBackgroundMusic() {
    if (!this.isEnabled || this.isBgmActive) return;
    this.initContext();
    this.isBgmActive = true;
    this.bgmStep = 0;
    this.notify();

    const tempoBpm = 124;
    const stepDurationMs = (60 / tempoBpm / 2) * 1000; // Eighth notes (~242ms)

    const bassline = [130.81, 0, 164.81, 0, 196.0, 0, 164.81, 0];
    const leadNotes = [523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 523.25];

    this.bgmInterval = window.setInterval(() => {
      if (!this.isEnabled || !this.isBgmActive || !this.ctx || !this.bgmGain) return;

      try {
        const t = this.ctx.currentTime;
        const step = this.bgmStep % 8;

        if (step === 0 || step === 4) {
          this.playKick(t, 0.22, 'bgm');
        }
        if (step % 2 === 1) {
          this.playSnare(t, 0.08, 'bgm');
        }

        const bassFreq = bassline[step];
        if (bassFreq > 0) {
          const bassOsc = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();
          bassOsc.type = 'triangle';
          bassOsc.frequency.setValueAtTime(bassFreq, t);
          bassGain.gain.setValueAtTime(this.volume * 0.18, t);
          bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          bassOsc.connect(bassGain);
          bassGain.connect(this.bgmGain);
          bassOsc.start(t);
          bassOsc.stop(t + 0.22);
          this.activeBgmNodes.push(bassOsc);
        }

        const leadFreq = leadNotes[step];
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        leadOsc.type = 'sine';
        leadOsc.frequency.setValueAtTime(leadFreq, t);
        leadGain.gain.setValueAtTime(this.volume * 0.1, t);
        leadGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        leadOsc.connect(leadGain);
        leadGain.connect(this.bgmGain);
        leadOsc.start(t);
        leadOsc.stop(t + 0.16);
        this.activeBgmNodes.push(leadOsc);

        this.bgmStep++;
      } catch (e) {}
    }, stepDurationMs);
  }

  public stopBackgroundMusic() {
    this.isBgmActive = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }

    this.activeBgmNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      } catch (e) {}
    });
    this.activeBgmNodes = [];

    if (this.bgmGain && this.ctx) {
      try {
        this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.bgmGain.disconnect();
      } catch (e) {}
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      if (this.masterGain) {
        this.bgmGain.connect(this.masterGain);
      }
    }

    this.notify();
  }

  public toggleBackgroundMusic(): boolean {
    if (this.isBgmActive) {
      this.stopBackgroundMusic();
      return false;
    } else {
      this.startBackgroundMusic();
      return true;
    }
  }

  public isBgmPlaying(): boolean {
    return this.isBgmActive;
  }

  /**
   * Hard stop all sounds immediately across the entire system.
   */
  public stopAll() {
    this.stopVictory();
    this.stopBackgroundMusic();

    this.sfxTimeouts.forEach((id) => clearTimeout(id));
    this.sfxTimeouts = [];

    this.activeSfxNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      } catch (e) {}
    });
    this.activeSfxNodes = [];

    if (this.sfxGain && this.ctx) {
      try {
        this.sfxGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.sfxGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.sfxGain.disconnect();
      } catch (e) {}
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      if (this.masterGain) {
        this.sfxGain.connect(this.masterGain);
      }
    }

    this.notify();
  }
}

export const soundManager = new SoundManager();

// Automatically unlock AudioContext on first user interaction anywhere in window
if (typeof window !== 'undefined') {
  const autoUnlock = () => {
    soundManager.unlockAudio();
    window.removeEventListener('click', autoUnlock);
    window.removeEventListener('touchstart', autoUnlock);
    window.removeEventListener('keydown', autoUnlock);
  };
  window.addEventListener('click', autoUnlock, { passive: true, capture: true });
  window.addEventListener('touchstart', autoUnlock, { passive: true, capture: true });
  window.addEventListener('keydown', autoUnlock, { passive: true, capture: true });
}
