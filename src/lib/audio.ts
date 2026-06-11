/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundSynthManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private musicIntervalId: any = null;
  private tempo: number = 120;
  private tickCount: number = 0;
  private activeOscillators: Set<OscillatorNode> = new Set();
  
  // Synth states and scales
  public isMusicPlaying: boolean = false;
  public bossActive: boolean = false;
  public threatFactor: number = 1.0; // 1.0 = base, increases as threat factor grows

  init() {
    if (this.ctx) return;
    try {
      // @ts-ignore
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API não é suportado neste navegador.", e);
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  private createCustomOscillator(
    type: OscillatorType,
    freq: number,
    duration: number,
    gainStart: number,
    gainEnd: number = 0.001
  ) {
    if (!this.ctx || this.isMuted) return null;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(gainEnd, this.ctx.currentTime + duration);

    osc.connect(gainNode);
    if (this.masterGain) {
      gainNode.connect(this.masterGain);
    } else {
      gainNode.connect(this.ctx.destination);
    }

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
    
    this.activeOscillators.add(osc);
    setTimeout(() => {
      this.activeOscillators.delete(osc);
    }, duration * 1000 + 100);

    return { osc, gainNode };
  }

  // Laser sounds
  playLaserSound(isPlayer: boolean = true) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    if (isPlayer) {
      // Retro player laser (pitched slider up or down)
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gainNode.gain.setValueAtTime(0.18, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    } else {
      // Alien/Enemy synth pulse
      osc.type = "sine";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    }
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain || this.ctx.destination);
    osc.start();
    osc.stop(now + 0.25);
  }

  // Heavy blast / Laser Upgrade
  playHeavyLaserSound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(180, now);
    osc1.frequency.linearRampToValueAtTime(800, now + 0.22);
    
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(100, now);
    osc2.frequency.linearRampToValueAtTime(400, now + 0.22);
    
    gainNode.gain.setValueAtTime(0.24, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.masterGain || this.ctx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(now + 0.28);
    osc2.stop(now + 0.28);
  }

  // Explode Sound Synth
  playExplosionSound(intensity: "SMALL" | "MEDIUM" | "LARGE" | "BOSS") {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    // Noise simulation using mathematical math generator for buffer
    const bufferSize = this.ctx.sampleRate * (intensity === "BOSS" ? 1.5 : intensity === "LARGE" ? 0.8 : 0.4);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    // Lowpass filter to make it sound rumbling and deep
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    
    let frequency = 250;
    let gainValue = 0.35;
    let decayTime = 0.4;
    
    if (intensity === "SMALL") {
      frequency = 400;
      gainValue = 0.22;
      decayTime = 0.25;
    } else if (intensity === "MEDIUM") {
      frequency = 250;
      gainValue = 0.35;
      decayTime = 0.45;
    } else if (intensity === "LARGE") {
      frequency = 150;
      gainValue = 0.55;
      decayTime = 0.75;
    } else if (intensity === "BOSS") {
      frequency = 80;
      gainValue = 0.85;
      decayTime = 1.6;
    }
    
    filter.frequency.setValueAtTime(frequency, now);
    filter.frequency.exponentialRampToValueAtTime(10, now + decayTime);
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(gainValue, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + decayTime);
    
    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain || this.ctx.destination);
    
    noiseNode.start();
    noiseNode.stop(now + decayTime + 0.1);

    // Also inject a low sine sweep frequency to add visceral rumble
    if (intensity === "BOSS" || intensity === "LARGE") {
      const rumble = this.ctx.createOscillator();
      const rumbleGain = this.ctx.createGain();
      rumble.type = "sine";
      rumble.frequency.setValueAtTime(90, now);
      rumble.frequency.exponentialRampToValueAtTime(20, now + decayTime);
      rumbleGain.gain.setValueAtTime(gainValue * 0.7, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);
      
      rumble.connect(rumbleGain);
      rumbleGain.connect(this.masterGain || this.ctx.destination);
      rumble.start();
      rumble.stop(now + decayTime);
    }
  }

  // Hit sound (shield deflect vs hull armor damage)
  playHitSound(isShield: boolean) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    if (isShield) {
      // High pitch metallic ping
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    } else {
      // Low crisp crunch
      osc.type = "triangle";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    }
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain || this.ctx.destination);
    osc.start();
    osc.stop(now + 0.15);
  }

  // Collect Upgrade / Scrap Sound
  playPowerUpSound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    // Retro arpeggio chime (3 fast rising notes)
    const playNote = (freq: number, delay: number, dur: number) => {
      // @ts-ignore
      const osc = this.ctx.createOscillator();
      // @ts-ignore
      const gainNode = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + delay);
      
      gainNode.gain.setValueAtTime(0.15, now + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      
      osc.connect(gainNode);
      // @ts-ignore
      gainNode.connect(this.masterGain || this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur);
    };
    
    playNote(523.25, 0, 0.1);     // C5
    playNote(659.25, 0.06, 0.1);  // E5
    playNote(783.99, 0.12, 0.18); // G5
    playNote(1046.50, 0.18, 0.25);// C6
  }

  // Sound for normal metal scraps
  playScrapCollectSound() {
    if (!this.ctx || this.isMuted) return;
    this.createCustomOscillator("sine", 880 + Math.random() * 220, 0.08, 0.08, 0.01);
  }

  // Sirens warning boss incoming
  playBossSiren() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    const playSweep = (delay: number) => {
      // @ts-ignore
      const osc = this.ctx.createOscillator();
      // @ts-ignore
      const gainNode = this.ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now + delay);
      osc.frequency.linearRampToValueAtTime(450, now + delay + 0.4);
      osc.frequency.linearRampToValueAtTime(150, now + delay + 0.8);
      
      gainNode.gain.setValueAtTime(0.18, now + delay);
      gainNode.gain.linearRampToValueAtTime(0.18, now + delay + 0.4);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.8);
      
      osc.connect(gainNode);
      // @ts-ignore
      gainNode.connect(this.masterGain || this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.81);
    };

    playSweep(0);
    playSweep(0.9);
  }

  // Defeat chime (descending minor sad scale)
  playDefeatSound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    const playNote = (freq: number, delay: number, dur: number) => {
      // @ts-ignore
      const osc = this.ctx.createOscillator();
      // @ts-ignore
      const gainNode = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + delay);
      
      gainNode.gain.setValueAtTime(0.2, now + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      
      osc.connect(gainNode);
      // @ts-ignore
      gainNode.connect(this.masterGain || this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur);
    };

    // Minor chord descending
    playNote(493.88, 0, 0.25);    // B4
    playNote(415.30, 0.20, 0.25); // G#4
    playNote(349.23, 0.40, 0.3);  // F4
    playNote(277.18, 0.60, 0.6);  // C#4
  }

  // Victory Fanfare
  playVictorySound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    const playNote = (freq: number, delay: number, dur: number) => {
      // @ts-ignore
      const osc = this.ctx.createOscillator();
      // @ts-ignore
      const gainNode = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + delay);
      
      gainNode.gain.setValueAtTime(0.18, now + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      
      osc.connect(gainNode);
      // @ts-ignore
      gainNode.connect(this.masterGain || this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur);
    };

    // Ascending triumphal melody
    playNote(261.63, 0, 0.15);    // C4
    playNote(329.63, 0.12, 0.15); // E4
    playNote(392.00, 0.24, 0.15); // G4
    playNote(523.25, 0.36, 0.15); // C5
    playNote(493.88, 0.48, 0.12); // B4
    playNote(523.25, 0.60, 0.50); // C5
  }

  // Start the background dynamic procedural music loop!
  startMusic() {
    if (this.isMusicPlaying) return;
    this.resume();
    this.isMusicPlaying = true;
    this.tickCount = 0;
    
    // Play a background synthesizer note on intervals (acting as bassline & hi-hat)
    const intervalMs = (60 / this.tempo) * 1000 / 2; // 8th notes
    
    const synthLoop = () => {
      if (!this.isMusicPlaying || !this.ctx || this.isMuted) return;
      this.playMusicStep();
      this.musicIntervalId = setTimeout(synthLoop, (60 / this.getTempo()) * 1000 / 2);
    };
    
    synthLoop();
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicIntervalId) {
      clearTimeout(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  private getTempo(): number {
    // Dynamic tempo adjustment based on difficulty (threat factor range 1.0 to 3.0) and Boss state
    const baseTempo = this.bossActive ? 142 : 118;
    const additionalTempo = Math.min(25, (this.threatFactor - 1) * 12);
    return baseTempo + additionalTempo;
  }

  private playMusicStep() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const step = this.tickCount % 16;
    
    // Simple 4-Note scale that shifts to aggressive scale in Boss battles
    // Normal Scale (Pentatonic Major/Minor vibes in A/C)
    // A2 (110Hz), C3 (130Hz), D3 (146.8Hz), E3 (164.8Hz), G3 (196Hz)
    // Boss Scale (Phrygian Dominant - extremely tense and dramatic!)
    // D2 (73.4Hz), D#2 (77.78Hz), F#2 (92.5Hz), G2 (98Hz), A2 (110Hz)
    
    const normalScale = [110.00, 130.81, 146.83, 164.81, 196.00, 220.00];
    const bossScale = [73.42, 77.78, 92.50, 98.00, 110.00, 116.54];
    
    const activeScale = this.bossActive ? bossScale : normalScale;
    
    // Synth Bass Sequence
    // Quick patterns for and 8-step bassline loop
    let bassNoteIndex = 0;
    let playBass = false;
    
    if (this.bossActive) {
      // Sweeping dramatic fast boss patterns
      const bossPattern = [0, 1, 0, 1, 2, 1, 0, 3, 0, 1, 0, 1, 4, 3, 2, 1];
      bassNoteIndex = bossPattern[step];
      playBass = step % 2 === 0 || step === 7 || step === 15;
    } else {
      // Calm, tech progression pattern
      const normalPattern = [0, 0, 2, 0, 1, 1, 3, 2, 0, 0, 4, 0, 2, 3, 1, 0];
      bassNoteIndex = normalPattern[step];
      playBass = step % 4 === 0 || step % 4 === 2 || step === 7 || step === 15;
    }
    
    if (playBass) {
      const freq = activeScale[bassNoteIndex % activeScale.length];
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      // Warm, punchy retro triangle bass
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      
      const decay = this.bossActive ? 0.16 : 0.24;
      gainNode.gain.setValueAtTime(this.bossActive ? 0.18 : 0.14, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + decay);
      
      osc.connect(gainNode);
      gainNode.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + decay);
    }
    
    // Drum beats
    // Synth Kick Drum at 1, 5, 9, 13 step
    if (step % 8 === 0 || step % 8 === 4) {
      const oscKick = this.ctx.createOscillator();
      const gainKick = this.ctx.createGain();
      oscKick.type = "sine";
      oscKick.frequency.setValueAtTime(150, now);
      oscKick.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      
      gainKick.gain.setValueAtTime(0.25, now);
      gainKick.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      
      oscKick.connect(gainKick);
      gainKick.connect(this.masterGain || this.ctx.destination);
      oscKick.start(now);
      oscKick.stop(now + 0.12);
    }
    
    // Hi-hat / Slap Noise at off-beats (step 2, 6, 10, 14, etc.)
    if (step % 4 === 2) {
      // Fake hi-hat with high frequency oscillator decay
      const oscHat = this.ctx.createOscillator();
      const gainHat = this.ctx.createGain();
      oscHat.type = "sawtooth";
      oscHat.frequency.setValueAtTime(8000, now);
      
      gainHat.gain.setValueAtTime(0.02, now);
      gainHat.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      
      oscHat.connect(gainHat);
      gainHat.connect(this.masterGain || this.ctx.destination);
      oscHat.start(now);
      oscHat.stop(now + 0.05);
    }

    // Melodic Arpeggios triggered randomly or on specific steps to flesh out ambience
    if (!this.bossActive && step % 16 === 8 && Math.random() > 0.4) {
      const playChime = (f: number, del: number) => {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f, now + del);
        g.gain.setValueAtTime(0.05, now + del);
        g.gain.exponentialRampToValueAtTime(0.001, now + del + 0.2);
        o.connect(g);
        g.connect(this.masterGain || this.ctx.destination);
        o.start(now + del);
        o.stop(now + del + 0.2);
      };
      
      const rootChime = activeScale[3] * 2; // high octave note
      playChime(rootChime, 0);
      playChime(rootChime * 1.25, 0.08); // third
      playChime(rootChime * 1.5, 0.16);  // fifth
    }
    
    this.tickCount++;
  }
}

export const SoundSynth = new SoundSynthManager();
