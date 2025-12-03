
import { InstrumentType } from '../types';

interface InstrumentConfig {
  oscillators: {
    type: OscillatorType;
    freq: number; // Base frequency in Hz
    detune: number; // Cents
  }[];
  filter: {
    type: BiquadFilterType;
    baseFreq: number; // Resting frequency
    modFreq: number; // Max added frequency based on velocity
    Q: number;
  };
  gain: {
    base: number;
    mod: number; // How much velocity adds to gain
    attack: number; // seconds
  };
  delay: {
    time: number;
    feedback: number;
    mix: number;
  }
}

const INSTRUMENTS: Record<InstrumentType, InstrumentConfig> = {
  flux: {
    // Csus2 Pad (Original)
    oscillators: [
      { type: 'sine', freq: 261.63, detune: 0 }, // C4
      { type: 'sine', freq: 293.66, detune: 5 }, // D4
      { type: 'triangle', freq: 392.00, detune: -5 } // G4
    ],
    filter: { type: 'lowpass', baseFreq: 200, modFreq: 2500, Q: 0.5 },
    gain: { base: 0.05, mod: 0.35, attack: 0.3 },
    delay: { time: 0.4, feedback: 0.3, mix: 0.25 }
  },
  drone: {
    // Deep Saw Bass
    oscillators: [
      { type: 'sawtooth', freq: 65.41, detune: 0 }, // C2
      { type: 'sawtooth', freq: 130.81, detune: 8 }, // C3
      { type: 'square', freq: 98.00, detune: -8 } // G2
    ],
    filter: { type: 'lowpass', baseFreq: 80, modFreq: 800, Q: 2.0 }, // Resonant growl
    gain: { base: 0.1, mod: 0.3, attack: 0.1 }, // Fast response
    delay: { time: 0.2, feedback: 0.4, mix: 0.1 }
  },
  spark: {
    // High Crystal Bells (CMaj7)
    oscillators: [
      { type: 'sine', freq: 523.25, detune: 0 }, // C5
      { type: 'sine', freq: 659.25, detune: 0 }, // E5
      { type: 'sine', freq: 987.77, detune: 0 }  // B5
    ],
    filter: { type: 'highpass', baseFreq: 2000, modFreq: -1500, Q: 1.0 }, // Opens downwards or stays bright
    gain: { base: 0.0, mod: 0.2, attack: 0.05 }, // Very responsive, quiet when still
    delay: { time: 0.25, feedback: 0.6, mix: 0.4 } // Lots of shimmer
  },
  orbit: {
    // Sci-fi Pure Octaves
    oscillators: [
      { type: 'sine', freq: 130.81, detune: 0 }, // C3
      { type: 'sine', freq: 261.63, detune: 2 }, // C4
      { type: 'sine', freq: 523.25, detune: -2 } // C5
    ],
    filter: { type: 'bandpass', baseFreq: 300, modFreq: 1000, Q: 5.0 }, // Narrow band sweep
    gain: { base: 0.05, mod: 0.4, attack: 0.5 }, // Slow swell
    delay: { time: 0.6, feedback: 0.5, mix: 0.3 }
  }
};

export class AudioService {
  public ctx: AudioContext | null = null;
  
  private oscs: OscillatorNode[] = [];
  private mainFilter: BiquadFilterNode | null = null;
  private mainGain: GainNode | null = null;
  
  private delayNode: DelayNode | null = null;
  private delayGain: GainNode | null = null;
  private delayFeedback: GainNode | null = null;
  private globalGain: GainNode | null = null;
  
  // Music & Visualization
  private musicElement: HTMLAudioElement | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  public isMusicPlaying: boolean = false;

  private currentType: InstrumentType = 'flux';
  private masterVolume: number = 0.5;
  private isMuted: boolean = false;
  private isInitialized = false;

  public init() {
    if (this.isInitialized) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Create static nodes
    this.globalGain = this.ctx.createGain();
    this.globalGain.gain.value = this.isMuted ? 0 : this.masterVolume;
    this.globalGain.connect(this.ctx.destination);

    // Analyzer for visualization
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256; // 128 data points
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    this.mainFilter = this.ctx.createBiquadFilter();
    this.mainGain = this.ctx.createGain();
    this.delayNode = this.ctx.createDelay(1.0); // Max delay 1s
    this.delayGain = this.ctx.createGain();
    this.delayFeedback = this.ctx.createGain();
    const delayFilter = this.ctx.createBiquadFilter();

    // Wiring
    // Oscs connect to MainFilter in applyInstrument
    this.mainFilter.connect(this.mainGain);
    
    // Main Sound Path: Oscs -> Filter -> Gain -> Analyser -> GlobalGain
    // We route effects through analyser so interactions also show up visually
    this.mainGain.connect(this.delayNode);
    this.mainGain.connect(this.analyser);
    
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.analyser);
    
    // Analyser -> Global Output
    this.analyser.connect(this.globalGain);

    // Feedback Loop: DelayNode -> Filter -> FeedbackGain -> DelayNode
    this.delayNode.connect(delayFilter);
    delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);

    // Delay filter fixed settings
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1500;

    this.isInitialized = true;
    this.setInstrument(this.currentType);
  }

  // --- Music Player Logic ---

  public async playMusic(url: string | File) {
    if (!this.ctx || !this.analyser || !this.globalGain) this.init();
    
    // Reuse existing element if possible to avoid graph disconnection issues
    if (!this.musicElement) {
       this.musicElement = new Audio();
       this.musicElement.crossOrigin = "anonymous";
       this.musicElement.loop = true;
       // Create source and connect ONCE
       if (this.ctx) {
         this.musicSource = this.ctx.createMediaElementSource(this.musicElement);
         this.musicSource.connect(this.analyser!);
       }
    }

    if (typeof url === 'string') {
      this.musicElement.src = url;
    } else {
      this.musicElement.src = URL.createObjectURL(url);
    }

    try {
      await this.ctx?.resume();
      await this.musicElement.play();
      this.isMusicPlaying = true;
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  }

  public toggleMusicPause() {
    if (!this.musicElement) return;
    if (this.musicElement.paused) {
      this.musicElement.play();
      this.isMusicPlaying = true;
    } else {
      this.musicElement.pause();
      this.isMusicPlaying = false;
    }
  }

  public getAudioData(): Uint8Array | null {
    if (!this.analyser || !this.dataArray) return null;
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }

  // --- Synth Logic ---

  public setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.globalGain && this.ctx) {
      // Ramp to avoidance clicking
      const target = mute ? 0 : this.masterVolume;
      this.globalGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = vol;
    if (this.globalGain && this.ctx && !this.isMuted) {
      this.globalGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }
  }

  public setInstrument(type: InstrumentType) {
    if (!this.ctx || !this.isInitialized) {
      this.currentType = type;
      return;
    }
    
    this.currentType = type;
    const config = INSTRUMENTS[type];
    const now = this.ctx.currentTime;

    // 1. Stop and disconnect old oscillators
    this.oscs.forEach(osc => {
      try { osc.stop(); } catch(e){}
      osc.disconnect();
    });
    this.oscs = [];

    // 2. Create new oscillators
    config.oscillators.forEach(oscConfig => {
      const osc = this.ctx!.createOscillator();
      osc.type = oscConfig.type;
      osc.frequency.value = oscConfig.freq;
      osc.detune.value = oscConfig.detune;
      osc.connect(this.mainFilter!);
      osc.start(now);
      this.oscs.push(osc);
    });

    // 3. Apply Filter Settings
    this.mainFilter!.type = config.filter.type;
    this.mainFilter!.frequency.cancelScheduledValues(now);
    this.mainFilter!.frequency.setValueAtTime(config.filter.baseFreq, now);
    this.mainFilter!.Q.value = config.filter.Q;

    // 4. Apply Gain Settings (Reset to silence to prevent pops, let update handle volume)
    this.mainGain!.gain.cancelScheduledValues(now);
    this.mainGain!.gain.setValueAtTime(0, now);

    // 5. Apply Delay Settings
    this.delayNode!.delayTime.setValueAtTime(config.delay.time, now);
    this.delayFeedback!.gain.setValueAtTime(config.delay.feedback, now);
    this.delayGain!.gain.setValueAtTime(config.delay.mix, now);
  }

  public update(velocity: number) {
    if (!this.ctx || !this.isInitialized || !this.mainFilter || !this.mainGain) return;

    const time = this.ctx.currentTime;
    const config = INSTRUMENTS[this.currentType];
    
    // Clamp velocity
    const intensity = Math.min(velocity, 1.2);
    const isActive = intensity > 0.001;

    // 1. Gain Mod
    const targetGain = isActive 
      ? config.gain.base + (intensity * config.gain.mod) 
      : 0;
      
    // Use a faster release time (0.5s) if we are stopping to ensure it feels silent at rest
    const rampTime = isActive ? config.gain.attack : 0.5; 

    this.mainGain.gain.setTargetAtTime(targetGain, time, rampTime);

    // 2. Filter Mod
    const targetFreq = isActive 
        ? config.filter.baseFreq + (intensity * config.filter.modFreq)
        : config.filter.baseFreq;
        
    const safeFreq = Math.max(20, Math.min(20000, targetFreq));
    this.mainFilter.frequency.setTargetAtTime(safeFreq, time, 0.2);

    // 3. Subtle Detune Mod (Wobble)
    const detuneAmount = intensity * 10;
    this.oscs.forEach((osc, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      const baseDetune = INSTRUMENTS[this.currentType].oscillators[i].detune;
      osc.detune.setTargetAtTime(baseDetune + (detuneAmount * dir), time, 0.5);
    });
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }
}

export const audioService = new AudioService();
