import { ui } from '../ui/store.js';

const titleFiles = import.meta.glob('./tracks/title/*.{mp3,ogg,wav,m4a,flac}', {
  eager: true,
  query: '?url',
  import: 'default'
});
const pauseFiles = import.meta.glob('./tracks/pause/*.{mp3,ogg,wav,m4a,flac}', {
  eager: true,
  query: '?url',
  import: 'default'
});
const radioFiles = import.meta.glob('./tracks/radio/*.{mp3,ogg,wav,m4a,flac}', {
  eager: true,
  query: '?url',
  import: 'default'
});

const VOLUMES = { title: 0.65, pause: 0.65, radio: 0.55 };

const trackName = (path) =>
  decodeURIComponent(path.split('/').pop() || '').replace(/\.[^.]+$/, '');

export class MusicManager {
  constructor() {
    this.groups = {
      title: this._list(titleFiles),
      pause: this._list(pauseFiles),
      radio: this._list(radioFiles)
    };
    this.radioIndex = 0;
    this.radioOn = true;
    this.radioPlaying = false;
    this.muted = false;
    this.ambient = null;
    this._unlocked = false;
    for (const entry of this.groups.radio) {
      entry.el.addEventListener('ended', () => {
        if (this.radioPlaying && this.groups.radio.length > 1) this.radioNext(true);
      });
    }
    this._syncUi();
  }

  _list(files) {
    return Object.keys(files)
      .sort()
      .map((path) => {
        const el = new Audio();
        el.src = files[path];
        el.preload = 'auto';
        return { el, name: trackName(path) };
      });
  }

  currentRadioName() {
    const g = this.groups.radio;
    if (!g.length) return null;
    return g[this.radioIndex % g.length].name;
  }

  _playEl(entry, group, fromStart = true) {
    if (!entry) return;
    const el = entry.el;
    if (fromStart) {
      try {
        el.currentTime = 0;
      } catch {
        void 0;
      }
    }
    el.loop = this.groups[group].length === 1;
    el.volume = this.muted ? 0 : VOLUMES[group];
    el.play().catch(() => void 0);
  }

  _stopGroup(name) {
    for (const entry of this.groups[name]) entry.el.pause();
  }

  startTitle() {
    const g = this.groups.title;
    if (!g.length) return;
    if (this.ambient === 'title' && !g[0].el.paused) return;
    this.ambient = 'title';
    this._stopGroup('pause');
    this._radioElsPause();
    this._playEl(g[0], 'title');
  }

  autoplayTitle() {
    const g = this.groups.title;
    if (!g.length || this.ambient) return;
    this.ambient = 'title';
    const el = g[0].el;
    el.loop = g.length === 1;
    el.volume = this.muted ? 0 : VOLUMES.title;
    el.muted = !this._unlocked;
    el.play().catch(() => void 0);
  }

  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    for (const group of ['title', 'pause', 'radio']) {
      for (const entry of this.groups[group]) entry.el.muted = false;
    }
  }

  enterGame() {
    this.ambient = null;
    this._stopGroup('title');
    this._stopGroup('pause');
    const n = this.groups.radio.length;
    if (n > 1) this.radioIndex = Math.floor(Math.random() * n);
    if (this.radioOn && n) {
      this._startRadioCurrent(false);
    }
    this._syncUi();
  }

  _startRadioCurrent(resume) {
    const g = this.groups.radio;
    if (!g.length || !this.radioOn) return;
    this._playEl(g[this.radioIndex % g.length], 'radio', !resume);
    this.radioPlaying = true;
  }

  _radioElsPause() {
    for (const entry of this.groups.radio) {
      if (!entry.el.paused) entry.el.pause();
    }
    this.radioPlaying = false;
  }

  pauseGame() {
    this.ambient = 'pause';
    this._radioElsPause();
    const g = this.groups.pause;
    if (g.length) this._playEl(g[0], 'pause');
  }

  resumeGame(inCar = true) {
    this.ambient = null;
    this._stopGroup('pause');
    if (inCar && this.radioOn && this.groups.radio.length) this._startRadioCurrent(true);
    this._syncUi();
  }

  pauseForFoot() {
    if (this.radioPlaying) this._radioElsPause();
  }

  resumeInCar() {
    if (!this.ambient && this.radioOn && this.groups.radio.length) {
      this._startRadioCurrent(true);
    }
  }

  radioNext(auto = false) {
    const g = this.groups.radio;
    if (g.length < 2) return;
    this.radioIndex = (this.radioIndex + 1) % g.length;
    if (auto ? this.radioPlaying : this.radioOn && !this.ambient) {
      for (const [i, entry] of g.entries()) {
        if (i !== this.radioIndex && !entry.el.paused) entry.el.pause();
      }
      this._playEl(g[this.radioIndex], 'radio');
      this.radioPlaying = true;
    }
    this._syncUi();
  }

  toggleRadio() {
    this.radioOn = !this.radioOn;
    if (this.radioOn && this.groups.radio.length && !this.ambient) {
      this._startRadioCurrent(false);
    } else if (!this.radioOn) {
      this._radioElsPause();
    }
    this._syncUi();
  }

  setMuted(m) {
    this.muted = m;
    for (const group of ['title', 'pause', 'radio']) {
      for (const entry of this.groups[group]) {
        entry.el.volume = m ? 0 : VOLUMES[group];
      }
    }
  }

  dispose() {
    for (const group of ['title', 'pause', 'radio']) this._stopGroup(group);
  }

  _syncUi() {
    ui.radio = {
      on: this.radioOn,
      track: this.radioOn ? this.currentRadioName() : null,
      hasTracks: this.groups.radio.length > 0
    };
  }
}
