import { FREESTYLE_BEATS } from './freestyleBeats.js';
import { FREESTYLE_WORD_BANKS } from './freestyleWords.js';

const BEAT_BASE = 'https://freestylekingapp.com/wp-content/themes/thrive-nouveau/audios//';
const DEFAULT_WORD_BANK = 'compound';

function beatName(path) {
  const file = path.split('/').pop() || path;
  try {
    return decodeURIComponent(file).replace(/\.[^.]+$/, '');
  } catch {
    return file.replace(/\.[^.]+$/, '');
  }
}

export class FreestyleKingProvider {
  constructor() {
    this.el = new Audio();
    this.el.preload = 'none';
    this.el.loop = false;
    this.el.volume = 1;
    this.active = false;
    this.playing = false;
    this.track = null;
    this.status = 'idle';
    this.volume = 1;
    this.word = null;
    this.wordBank = DEFAULT_WORD_BANK;
    this._started = false;
    this._wanted = false;
    this._token = 0;

    this._onEnded = () => {
      if (this.active && this._wanted) this.next();
    };
    this._onError = () => {
      if (!this.active || !this._wanted) return;
      this.playing = false;
      this.status = 'error';
    };
    this._onPlaying = () => {
      if (!this.active || !this._wanted) return;
      this.playing = true;
      this.status = 'playing';
    };

    this.el.addEventListener('ended', this._onEnded);
    this.el.addEventListener('error', this._onError);
    this.el.addEventListener('playing', this._onPlaying);
  }

  get configured() {
    return FREESTYLE_BEATS.length > 0;
  }

  activate() {
    if (!this.configured) {
      this.active = true;
      this._wanted = false;
      this.status = 'error';
      return false;
    }
    this.active = true;
    this._wanted = true;
    this.status = 'loading';
    this.rollWord(DEFAULT_WORD_BANK);
    if (this._started) this._resume();
    else this.next();
    return true;
  }

  deactivate() {
    this.active = false;
    this._wanted = false;
    this.playing = false;
    this._started = false;
    this.track = null;
    this.status = 'idle';
    this.word = null;
    this.el.pause();
  }

  pause() {
    if (!this.active) return;
    this._wanted = false;
    this.playing = false;
    this.status = 'paused';
    this.el.pause();
  }

  resume() {
    if (!this.active) return;
    this._wanted = true;
    if (!this._started || this.el.ended) {
      this.next();
      return;
    }
    this._resume();
  }

  next() {
    if (!this.configured) return;
    const index = Math.floor(Math.random() * FREESTYLE_BEATS.length);
    const file = FREESTYLE_BEATS[index];
    this._started = true;
    this.track = beatName(file);
    this.el.src = `${BEAT_BASE}${file}`;
    this.el.load();
    this._resume();
  }

  rollWord(bank = DEFAULT_WORD_BANK) {
    const selected = FREESTYLE_WORD_BANKS[bank] ? bank : DEFAULT_WORD_BANK;
    const words = FREESTYLE_WORD_BANKS[selected];
    if (!words.length) return null;
    this.wordBank = selected;
    this.word = words[Math.floor(Math.random() * words.length)];
    return this.word;
  }

  setVolume(value) {
    const next = Math.min(1, Math.max(0, Number(value) || 0));
    this.volume = next;
    this.el.volume = next;
  }

  snapshot() {
    return {
      active: this.active,
      track: this.track,
      status: this.status,
      playing: this.playing,
      shuffle: true,
      count: FREESTYLE_BEATS.length,
      word: this.word,
      wordBank: this.wordBank
    };
  }

  dispose() {
    this.el.pause();
    this.el.removeEventListener('ended', this._onEnded);
    this.el.removeEventListener('error', this._onError);
    this.el.removeEventListener('playing', this._onPlaying);
    this.el.src = '';
  }

  _resume() {
    if (!this.active || !this._wanted) return;
    const token = ++this._token;
    this.status = 'loading';
    let pending;
    try {
      pending = this.el.play();
    } catch {
      this.playing = false;
      this.status = 'error';
      return;
    }
    if (!pending || typeof pending.then !== 'function') return;
    pending
      .then(() => {
        if (token !== this._token || !this.active || !this._wanted) return;
        this.playing = true;
        this.status = 'playing';
      })
      .catch(() => {
        if (token !== this._token || !this.active || !this._wanted) return;
        this.playing = false;
        this.status = 'error';
      });
  }
}
