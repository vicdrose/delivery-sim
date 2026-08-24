import * as Tone from 'tone';
import { CONFIG } from '../config.js';

export class AudioSystem {
  constructor() {
    this.ready = false;
    this.muted = false;
    this._hornOn = false;
  }

  async init() {
    if (this.ready) return;
    await Tone.start();
    const vol = CONFIG.audio.masterVolume;
    this.master = new Tone.Gain(vol).toDestination();

    this.sfx = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.004, decay: 0.16, sustain: 0.12, release: 0.18 },
      volume: -9
    }).connect(this.master);

    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.2 },
      filterEnvelope: { baseFrequency: 300, octaves: 2 },
      volume: -14
    }).connect(this.master);

    this.thud = new Tone.MembraneSynth({ volume: -8 }).connect(this.master);

    this.engineOsc = new Tone.Oscillator(CONFIG.audio.engineBaseFreq, 'sawtooth');
    this.engineFilter = new Tone.Filter(320, 'lowpass');
    this.engineGain = new Tone.Gain(0);
    this.engineOsc.chain(this.engineFilter, this.engineGain, this.master);
    this.engineOsc.start();

    this.skidNoise = new Tone.Noise('white');
    this.skidFilter = new Tone.Filter(1100, 'bandpass');
    this.skidFilter.Q.value = 1.6;
    this.skidGain = new Tone.Gain(0);
    this.skidNoise.chain(this.skidFilter, this.skidGain, this.master);
    this.skidNoise.start();

    this.hornOscA = new Tone.Oscillator(415, 'square');
    this.hornOscB = new Tone.Oscillator(554, 'square');
    this.hornGain = new Tone.Gain(0);
    const hornFilter = new Tone.Filter(1400, 'lowpass');
    this.hornOscA.connect(hornFilter);
    this.hornOscB.connect(hornFilter);
    hornFilter.connect(this.hornGain);
    this.hornGain.connect(this.master);
    this.hornOscA.start();
    this.hornOscB.start();

    this.ready = true;
  }

  toggleMute() {
    if (!this.ready) return this.muted;
    this.muted = !this.muted;
    this.master.gain.rampTo(this.muted ? 0 : CONFIG.audio.masterVolume, 0.08);
    return this.muted;
  }

  setEngine(speed01, throttle01, active) {
    if (!this.ready) return;
    const f = CONFIG.audio;
    const wobble = Math.sin(performance.now() * 0.02) * (2 + throttle01 * 5);
    this.engineOsc.frequency.value = f.engineBaseFreq + speed01 * f.engineFreqRange + wobble;
    this.engineFilter.frequency.value = 260 + speed01 * 1500 + throttle01 * 400;
    const target = active ? f.engineMaxGain * (0.35 + 0.65 * Math.max(speed01 * 0.7, throttle01)) : 0;
    this.engineGain.gain.rampTo(target, 0.09);
  }

  setSkid(amount) {
    if (!this.ready) return;
    this.skidGain.gain.rampTo(amount * 0.055, 0.06);
  }

  horn(on) {
    if (!this.ready || on === this._hornOn) return;
    this._hornOn = on;
    this.hornGain.gain.rampTo(on ? 0.07 : 0, 0.02);
  }

  _now() {
    const t = Tone.now();
    this._lastT = Math.max(this._lastT || 0, t) + 0.013;
    return this._lastT;
  }

  _seq(notes, gapSec = 0.09, dur = '16n', velocity = 0.5) {
    if (!this.ready) return;
    const t0 = this._now();
    notes.forEach((n, i) => {
      this.sfx.triggerAttackRelease(n, dur, t0 + i * gapSec, velocity);
    });
  }

  play(name) {
    if (!this.ready) return;
    switch (name) {
      case 'ui':
        this._seq(['G5'], 0, '32n', 0.25);
        break;
      case 'accept':
        this._seq(['C5', 'E5', 'G5'], 0.07);
        break;
      case 'notify':
        this._seq(['E6', 'B5'], 0.11, '16n', 0.35);
        break;
      case 'pickup':
        this._seq(['D4', 'A4'], 0.08, '8n', 0.5);
        break;
      case 'deliver':
        this._seq(['C5', 'E5', 'G5', 'C6'], 0.075, '16n', 0.5);
        break;
      case 'cash':
        this._seq(['E6', 'G6'], 0.05, '32n', 0.45);
        this._seq(['C6'], 0.13, '16n', 0.4);
        break;
      case 'fail':
        if (this.bass) {
          const t = this._now();
          this.bass.triggerAttackRelease('A2', '8n', t, 0.6);
          this.bass.triggerAttackRelease('E2', '4n', t + 0.16, 0.6);
        }
        break;
      case 'enter':
      case 'exit':
        this.thud.triggerAttackRelease('C2', '16n', this._now(), 0.5);
        break;
      case 'crash':
        this.thud.triggerAttackRelease('F1', '8n', this._now(), 0.9);
        break;
      case 'door':
        this._seq(['A4'], 0, '32n', 0.3);
        break;
      case 'dayEnd':
        this._seq(['G4', 'D4', 'G4', 'B4'], 0.16, '8n', 0.4);
        break;
      default:
        break;
    }
  }

  dispose() {
    if (this.engineOsc) this.engineOsc.stop();
    if (this.skidNoise) this.skidNoise.stop();
    if (this.hornOscA) this.hornOscA.stop();
    if (this.hornOscB) this.hornOscB.stop();
  }
}
