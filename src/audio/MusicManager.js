import { ui } from '../ui/store.js';

const titleFiles = import.meta.glob('./tracks/title/*.{mp3,ogg,wav,m4a,flac}', {
  eager: true,
  query: '?url',
  import: 'default'
});
const radioFiles = import.meta.glob('./tracks/radio/*.{mp3,ogg,wav,m4a,flac}', {
  eager: true,
  query: '?url',
  import: 'default'
});
const ambientFiles = import.meta.glob('./tracks/ambient/*.{mp3,ogg,wav,m4a,flac}', {
  eager: true,
  query: '?url',
  import: 'default'
});

const VOLUMES = { title: 0.65, radio: 0.55, ambient: 0.30 };

const trackName = (path) =>
  decodeURIComponent(path.split('/').pop() || '').replace(/\.[^.]+$/, '');

export class MusicManager {
  constructor() {
    this.radioDisabled = new Set(
      (() => {
        try {
          return JSON.parse(localStorage.getItem('snackrun_radio_off') || '[]');
        } catch {
          return [];
        }
      })()
    );
    this.groups = {
      title: this._list(titleFiles),
      radio: this._list(radioFiles),
      ambient: this._list(ambientFiles)
    };
    this.radioIndex = 0;
    this.radioOn = true;
    this.radioPlaying = false;
    this.muted = false;
    this.ambient = null;
    this._unlocked = false;
    this._ambientPlaying = false;
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
        const name = trackName(path);
        return { el, name, disabled: this.radioDisabled.has(name) };
      });
  }

  _radioEnabledList() {
    return this.groups.radio.filter((e) => !e.disabled);
  }

  _nextRadioIndex(exclude) {
    const enabled = this._radioEnabledList();
    if (!enabled.length) return null;
    if (enabled.length === 1) return this.groups.radio.indexOf(enabled[0]);
    let pick;
    do {
      pick = enabled[Math.floor(Math.random() * enabled.length)];
    } while (pick === exclude);
    return this.groups.radio.indexOf(pick);
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
    const single =
      this.groups[group].length === 1 ||
      (group === 'radio' && this._radioEnabledList().length === 1);
    el.loop = single;
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
    for (const group of ['title', 'radio', 'ambient']) {
      for (const entry of this.groups[group]) entry.el.muted = false;
    }
  }

  enterGame() {
    this.ambient = null;
    this._stopGroup('title');
    const next = this._nextRadioIndex();
    if (next !== null) this.radioIndex = next;
    this.startAmbient();
    this._syncUi();
  }

  _startRadioCurrent(resume) {
    const g = this.groups.radio;
    if (!g.length || !this.radioOn) return;
    if (g[this.radioIndex % g.length].disabled) {
      const next = this._nextRadioIndex(this.radioIndex);
      if (next === null) {
        this.radioPlaying = false;
        return;
      }
      this.radioIndex = next;
    }
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
    this.stopAmbient();
  }

  resumeGame(inCar = true) {
    this.ambient = null;
    this.startAmbient();
    if (inCar && this.radioOn && this.groups.radio.length) this._startRadioCurrent(true);
    this._syncUi();
  }

  startAmbient() {
    if (this._ambientPlaying) return;
    this._ambientPlaying = true;
    for (const entry of this.groups.ambient) {
      entry.el.loop = true;
      entry.el.volume = this.muted ? 0 : VOLUMES.ambient;
      entry.el.play().catch(() => void 0);
    }
  }

  stopAmbient() {
    if (!this._ambientPlaying) return;
    this._ambientPlaying = false;
    this._stopGroup('ambient');
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
    const next = this._nextRadioIndex(this.radioIndex);
    if (next === null) {
      this._radioElsPause();
      this._syncUi();
      return;
    }
    this.radioIndex = next;
    if (auto ? this.radioPlaying : this.radioOn && !this.ambient) {
      for (const [i, entry] of g.entries()) {
        if (i !== this.radioIndex && !entry.el.paused) entry.el.pause();
      }
      this._playEl(g[this.radioIndex], 'radio');
      this.radioPlaying = true;
    }
    this._syncUi();
  }

  setRadioEnabled(name, enabled) {
    const entry = this.groups.radio.find((e) => e.name === name);
    if (!entry) return;
    entry.disabled = !enabled;
    if (entry.disabled) {
      this.radioDisabled.add(name);
    } else {
      this.radioDisabled.delete(name);
    }
    try {
      localStorage.setItem('snackrun_radio_off', JSON.stringify([...this.radioDisabled]));
    } catch {
      void 0;
    }
    if (entry.disabled && this.groups.radio[this.radioIndex] === entry) {
      this.radioNext(true);
    } else {
      this._syncUi();
    }
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
    for (const group of ['title', 'radio', 'ambient']) {
      for (const entry of this.groups[group]) {
        entry.el.volume = m ? 0 : VOLUMES[group];
      }
    }
  }

  dispose() {
    for (const group of ['title', 'radio', 'ambient']) this._stopGroup(group);
  }

  _syncUi() {
    ui.radio = {
      on: this.radioOn,
      track: this.radioOn ? this.currentRadioName() : null,
      hasTracks: this.groups.radio.length > 0,
      tracks: this.groups.radio.map((e) => ({ name: e.name, enabled: !e.disabled }))
    };
  }
}
