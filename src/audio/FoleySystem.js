import * as Tone from 'tone';

export class FoleySystem {
  constructor() {
    this.ready = false;
    this.muted = false;
    this._running = false;
    this._wavePhase = 0;
  }

  async init() {
    if (this.ready) return;
    await Tone.start();
    this.bus = new Tone.Gain(1).toDestination();

    this.waveNoise = new Tone.Noise('pink');
    this.waveFilter = new Tone.Filter(700, 'lowpass');
    this.waveFilter.Q.value = 0.5;
    this.waveGain = new Tone.Gain(0);
    this.waveNoise.chain(this.waveFilter, this.waveGain, this.bus);
    this.waveNoise.start();

    this.ready = true;
  }

  start() {
    if (!this.ready || this._running) return;
    this._running = true;
    this.waveGain.gain.rampTo(this.muted ? 0 : 0.035, 1.5);
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    this.waveGain.gain.rampTo(0, 0.8);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ready || !this._running) return;
    this.waveGain.gain.rampTo(m ? 0 : 0.035, 0.15);
  }

  update(dt) {
    if (!this.ready || !this._running) return;

    this.wavePhase = (this.wavePhase || 0) + dt * 0.35;
    const swell = (Math.sin(this.wavePhase * 0.7) + Math.sin(this.wavePhase * 1.7)) * 0.5;
    this.waveGain.gain.value = this.muted ? 0 : 0.02 + Math.max(0, swell) * 0.02;
  }

  dispose() {
    this.stop();
    if (this.waveGain) this.waveGain.dispose();
  }
}
