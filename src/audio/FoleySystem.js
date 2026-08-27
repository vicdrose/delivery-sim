import * as Tone from 'tone';

export class FoleySystem {
  constructor() {
    this.ready = false;
    this.muted = false;
    this._running = false;
    this._hornTimer = 0;
    this._birdTimer = 0;
    this._dogTimer = 0;
    this._barkTimer = 0;
    this._wavePhase = 0;
  }

  async init() {
    if (this.ready) return;
    await Tone.start();
    this.bus = new Tone.Gain(1).toDestination();

    const noise = new Tone.Noise('pink');
    this.trafficFilter = new Tone.Filter(500, 'lowpass');
    this.trafficGain = new Tone.Gain(0);
    noise.chain(this.trafficFilter, this.trafficGain, this.bus);
    noise.start();

    this.trafficHorn = new Tone.Oscillator(330, 'sawtooth');
    this.trafficHornFilter = new Tone.Filter(900, 'lowpass');
    this.trafficHornGain = new Tone.Gain(0);
    this.trafficHorn.chain(this.trafficHornFilter, this.trafficHornGain, this.bus);
    this.trafficHorn.start();

    this.waveNoise = new Tone.Noise('pink');
    this.waveFilter = new Tone.Filter(700, 'lowpass');
    this.waveFilter.Q.value = 0.5;
    this.waveGain = new Tone.Gain(0);
    this.waveNoise.chain(this.waveFilter, this.waveGain, this.bus);
    this.waveNoise.start();

    this.birdSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.08 },
      volume: -18
    }).connect(this.bus);

    this.dogSynth = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 6, volume: -16 })
      .connect(this.bus);

    this.ready = true;
  }

  start() {
    if (!this.ready || this._running) return;
    this._running = true;
    this.trafficGain.gain.rampTo(this.muted ? 0 : 0.022, 1.5);
    this.waveGain.gain.rampTo(this.muted ? 0 : 0.035, 1.5);
    this._hornTimer = 2 + Math.random() * 6;
    this._birdTimer = 2 + Math.random() * 4;
    this._dogTimer = 10 + Math.random() * 20;
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    this.trafficGain.gain.rampTo(0, 0.8);
    this.waveGain.gain.rampTo(0, 0.8);
    this.trafficHornGain.gain.rampTo(0, 0.1);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ready || !this._running) return;
    this.trafficGain.gain.rampTo(m ? 0 : 0.022, 0.15);
    this.waveGain.gain.rampTo(m ? 0 : 0.035, 0.15);
  }

  update(dt) {
    if (!this.ready || !this._running) return;

    this.wavePhase = (this.wavePhase || 0) + dt * 0.35;
    const swell = (Math.sin(this.wavePhase * 0.7) + Math.sin(this.wavePhase * 1.7)) * 0.5;
    this.waveGain.gain.value = this.muted ? 0 : 0.02 + Math.max(0, swell) * 0.02;

    this._hornTimer -= dt;
    if (this._hornTimer <= 0) {
      this._hornTimer = 8 + Math.random() * 14;
      this._playHorn();
    }

    this._birdTimer -= dt;
    if (this._birdTimer <= 0) {
      this._birdTimer = 4 + Math.random() * 6;
      this._playBird();
    }

    this._dogTimer -= dt;
    if (this._dogTimer <= 0) {
      this._dogTimer = 25 + Math.random() * 30;
      this._barkTimer = 0;
    }
    if (this._barkTimer >= 0) {
      this._barkTimer -= dt;
      if (this._barkTimer <= 0) {
        this._barkTimer = 0.7 + Math.random() * 0.7;
        this._playBark();
      }
    }
  }

  _playHorn() {
    if (this.muted) return;
    const t = Tone.now();
    this.trafficHornGain.gain.cancelScheduledValues(t);
    this.trafficHornGain.gain.rampTo(0.02, 0.02);
    this.trafficHornGain.gain.rampTo(0.02, t + 0.35);
    this.trafficHornGain.gain.rampTo(0, t + 0.55);
  }

  _playBird() {
    if (this.muted) return;
    const t = Tone.now();
    const base = 2600 + Math.random() * 700;
    const chirps = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < chirps; i++) {
      this.birdSynth.triggerAttackRelease(base + Math.random() * 300 - 150, '16n', t + i * (0.12 + Math.random() * 0.1), 0.35);
    }
  }

  _playBark() {
    if (this.muted) return;
    const t = Tone.now();
    this.dogSynth.triggerAttackRelease('C2', '32n', t, 0.8);
  }

  dispose() {
    this.stop();
    if (this.trafficGain) this.trafficGain.dispose();
    if (this.waveGain) this.waveGain.dispose();
  }
}
