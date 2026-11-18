import { FREESTYLE_BEATS } from './freestyleBeats.js';
import { FREESTYLE_WORD_BANKS } from './freestyleWords.js';

const BEAT_BASE = 'https://freestylekingapp.com/wp-content/themes/thrive-nouveau/audios//';
const DEFAULT_WORD_BANK = 'compound';
const AUTO_WRAP_KEY = 'snackrun_freestyle_auto_wrap';
const DEFAULT_AUTO_WRAP = 1000;
const MIN_AUTO_WRAP = 250;
const MAX_AUTO_WRAP = 5000;
const AUTO_WRAP_STEP = 250;

function clampAutoWrap(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return DEFAULT_AUTO_WRAP;
  const stepped = Math.round(raw / AUTO_WRAP_STEP) * AUTO_WRAP_STEP;
  return Math.min(MAX_AUTO_WRAP, Math.max(MIN_AUTO_WRAP, stepped));
}

function readAutoWrap() {
  try {
    const raw = localStorage.getItem(AUTO_WRAP_KEY);
    if (raw === null || raw === '') return DEFAULT_AUTO_WRAP;
    return clampAutoWrap(raw);
  } catch {
    return DEFAULT_AUTO_WRAP;
  }
}

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
    this.autoWrapMs = readAutoWrap();
    this._wordTimer = 0;
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
    this._wordTimer = 0;
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
    this._wordTimer = 0;
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
    this._wordTimer = 0;
    return this.word;
  }

  updateWord(dt) {
    if (!this.active || !this._wanted) return;
    this._wordTimer += Math.max(0, Number(dt) || 0) * 1000;
    if (this._wordTimer >= this.autoWrapMs) this.rollWord(this.wordBank);
  }

  setAutoWrapMs(value) {
    this.autoWrapMs = clampAutoWrap(value);
    this._wordTimer = 0;
    try {
      localStorage.setItem(AUTO_WRAP_KEY, String(this.autoWrapMs));
    } catch {
      void 0;
    }
    return this.autoWrapMs;
  }

  resetAutoWrap() {
    this.autoWrapMs = DEFAULT_AUTO_WRAP;
    this._wordTimer = 0;
    try {
      localStorage.removeItem(AUTO_WRAP_KEY);
    } catch {
      void 0;
    }
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
      wordBank: this.wordBank,
      autoWrapMs: this.autoWrapMs
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
