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
const epFiles = import.meta.glob('./tracks/infinite-ep/*.{mp3,ogg,wav,m4a,flac}', {
  eager: true,
  query: '?url',
  import: 'default'
});
const ambientFiles = import.meta.glob('./tracks/ambient/*.{mp3,ogg,wav,m4a,flac}', {
  eager: true,
  query: '?url',
  import: 'default'
});

const VOLUMES = { title: 0.65, radio: 0.55, ep: 0.55, ambient: 0.30 };
const VOLUME_MAX = 2;
const RADIO_VOLUME_KEY = 'snackrun_radio_volume';
const SONG_VOLUME_KEY = 'snackrun_song_volumes';

const clampVolume = (v) => Math.min(VOLUME_MAX, Math.max(0, Number.isFinite(v) ? v : 1));

function readRadioVolume() {
  try {
    const raw = localStorage.getItem(RADIO_VOLUME_KEY);
    if (raw === null) return 1;
    return clampVolume(Number(raw));
  } catch {
    return 1;
  }
}

function readSongVolumes() {
  const out = {};
  try {
    const raw = JSON.parse(localStorage.getItem(SONG_VOLUME_KEY) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [name, value] of Object.entries(raw)) {
      const volume = Number(value);
      if (Number.isFinite(volume) && volume !== 1) out[name] = clampVolume(volume);
    }
  } catch {
    void 0;
  }
  return out;
}

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
      title: this._list(titleFiles, 'title'),
      radio: this._list(radioFiles, 'radio'),
      ep: this._list(epFiles, 'ep'),
      ambient: this._list(ambientFiles, 'ambient')
    };
    this.radioIndex = 0;
    this.epIndex = 0;
    this.radioOn = true;
    this.radioPlaying = false;
    this.epPlaying = false;
    this.localStation = 'radio';
    this.muted = false;
    this.ambient = null;
    this.radioVolume = readRadioVolume();
    this.songVolumes = readSongVolumes();
    this._ctx = null;
    this._masterGain = null;
    this._saveTimer = null;
    this._unlocked = false;
    this._ambientPlaying = false;
    for (const entry of this.groups.radio) {
      entry.el.addEventListener('ended', () => {
        if (this.radioPlaying && this.groups.radio.length > 1) this.radioNext(true);
      });
    }
    for (const entry of this.groups.ep) {
      entry.el.addEventListener('ended', () => {
        if (this.epPlaying && this.groups.ep.length > 1) this.epNext(true);
      });
    }
    this._syncUi();
  }

  _list(files, group) {
    return Object.keys(files)
      .sort()
      .map((path) => {
        const el = new Audio();
        el.src = files[path];
        el.preload = 'auto';
        const name = trackName(path);
        return {
          el,
          name,
          group,
          disabled: group === 'radio' && this.radioDisabled.has(name),
          source: null,
          gain: null,
          graphTried: false
        };
      });
  }

  _songVolume(name) {
    const value = this.songVolumes[name];
    return value === undefined ? 1 : value;
  }

  _ensureGraph(entry) {
    if (entry.gain || entry.graphTried) return;
    entry.graphTried = true;
    const Ctx =
      typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return;
    try {
      if (!this._ctx) {
        this._ctx = new Ctx();
        this._masterGain = this._ctx.createGain();
        this._masterGain.gain.value = 1;
        this._masterGain.connect(this._ctx.destination);
      }
      if (this._ctx.state === 'suspended' && this._unlocked) {
        this._ctx.resume().catch(() => void 0);
      }
      const source = this._ctx.createMediaElementSource(entry.el);
      const gain = this._ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this._masterGain);
      entry.source = source;
      entry.gain = gain;
      entry.el.volume = 1;
    } catch {
      entry.gain = null;
    }
  }

  _applyEntryVolume(entry) {
    const base = VOLUMES[entry.group] || 0;
    const station = entry.group === 'radio' || entry.group === 'ep';
    const boost = station ? this.radioVolume * this._songVolume(entry.name) : 1;
    const target = this.muted ? 0 : base * boost;
    if (entry.gain && this._ctx) {
      const t = this._ctx.currentTime;
      entry.gain.gain.cancelScheduledValues(t);
      entry.gain.gain.setTargetAtTime(target, t, 0.02);
    } else {
      entry.el.volume = Math.min(1, Math.max(0, target));
    }
  }

  _applyGroup(group) {
    for (const entry of this.groups[group]) this._applyEntryVolume(entry);
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

  currentEpName() {
    const g = this.groups.ep;
    if (!g.length) return null;
    return g[this.epIndex % g.length].name;
  }

  currentLocalName(group) {
    return group === 'ep' ? this.currentEpName() : this.currentRadioName();
  }

  localHasTracks(group) {
    return (this.groups[group] || []).length > 0;
  }

  isLocalPlaying(group) {
    return group === 'ep' ? this.epPlaying : this.radioPlaying;
  }

  _playEl(entry, group, fromStart = true) {
    if (!entry) return;
    this._ensureGraph(entry);
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
    el.muted = !this._unlocked;
    this._applyEntryVolume(entry);
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
    this.pauseLocalStations();
    this._playEl(g[0], 'title');
  }

  autoplayTitle() {
    const g = this.groups.title;
    if (!g.length || this.ambient) return;
    this.ambient = 'title';
    const entry = g[0];
    const el = entry.el;
    this._ensureGraph(entry);
    el.loop = g.length === 1;
    el.muted = !this._unlocked;
    this._applyEntryVolume(entry);
    el.play().catch(() => void 0);
  }

  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => void 0);
    }
    for (const group of ['title', 'radio', 'ep', 'ambient']) {
      for (const entry of this.groups[group]) {
        entry.el.muted = false;
        this._applyEntryVolume(entry);
      }
    }
  }

  enterGame() {
    this.ambient = null;
    this._stopGroup('title');
    const next = this._nextRadioIndex();
    if (next !== null) this.radioIndex = next;
    this.epIndex = 0;
    this.startAmbient();
    this._syncUi();
  }

  _startRadioCurrent(resume) {
    const g = this.groups.radio;
    if (!g.length || !this.radioOn) {
      this.radioPlaying = false;
      return;
    }
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
    this.localStation = 'radio';
  }

  _startEpCurrent(resume) {
    const g = this.groups.ep;
    if (!g.length || !this.radioOn) {
      this.epPlaying = false;
      return;
    }
    this.epIndex = ((this.epIndex % g.length) + g.length) % g.length;
    this._playEl(g[this.epIndex], 'ep', !resume);
    this.epPlaying = true;
    this.localStation = 'ep';
  }

  _radioElsPause() {
    for (const entry of this.groups.radio) {
      if (!entry.el.paused) entry.el.pause();
    }
    this.radioPlaying = false;
  }

  _epElsPause() {
    for (const entry of this.groups.ep) {
      if (!entry.el.paused) entry.el.pause();
    }
    this.epPlaying = false;
  }

  pauseLocalStations() {
    this._radioElsPause();
    this._epElsPause();
  }

  playLocalStation(group, resume = true) {
    if (!this.radioOn) return;
    if (group === 'ep') {
      this._radioElsPause();
      this._startEpCurrent(resume);
    } else {
      this._epElsPause();
      this._startRadioCurrent(resume);
    }
    this._syncUi();
  }

  setLocalPower(on, play = true) {
    this.radioOn = !!on;
    if (!this.radioOn) {
      this.pauseLocalStations();
    } else if (play) {
      this.playLocalStation(this.localStation === 'ep' ? 'ep' : 'radio', true);
    }
    this._syncUi();
  }

  pauseGame() {
    this.ambient = 'pause';
    this.pauseLocalStations();
    this.stopAmbient();
  }

  resumeGame(inCar = false) {
    this.ambient = null;
    this.startAmbient();
    if (inCar && this.radioOn) {
      this.playLocalStation(this.localStation === 'ep' ? 'ep' : 'radio', true);
    }
    this._syncUi();
  }

  startAmbient() {
    if (this._ambientPlaying) return;
    this._ambientPlaying = true;
    for (const entry of this.groups.ambient) {
      this._ensureGraph(entry);
      entry.el.loop = true;
      entry.el.muted = !this._unlocked;
      this._applyEntryVolume(entry);
      entry.el.play().catch(() => void 0);
    }
  }

  stopAmbient() {
    if (!this._ambientPlaying) return;
    this._ambientPlaying = false;
    this._stopGroup('ambient');
  }

  pauseForFoot() {
    this.pauseLocalStations();
  }

  resumeInCar() {
    if (!this.ambient && this.radioOn) {
      this.playLocalStation(this.localStation === 'ep' ? 'ep' : 'radio', true);
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
      this.localStation = 'radio';
    }
    this._syncUi();
  }

  radioPrevious() {
    const g = this.groups.radio;
    if (!g.length) return;
    const i = ((this.radioIndex % g.length) + g.length) % g.length;
    this.radioIndex = (i - 1 + g.length) % g.length;
    if (this.radioOn && !this.ambient) {
      this._epElsPause();
      this._playEl(g[this.radioIndex], 'radio');
      this.radioPlaying = true;
      this.localStation = 'radio';
    }
    this._syncUi();
  }

  epNext(auto = false) {
    const g = this.groups.ep;
    if (g.length < 2) return;
    this.epIndex = (this.epIndex + 1) % g.length;
    if (auto ? this.epPlaying : this.radioOn && !this.ambient) {
      for (const [i, entry] of g.entries()) {
        if (i !== this.epIndex && !entry.el.paused) entry.el.pause();
      }
      this._playEl(g[this.epIndex], 'ep');
      this.epPlaying = true;
      this.radioPlaying = false;
      this.localStation = 'ep';
    }
    this._syncUi();
  }

  epPrevious() {
    const g = this.groups.ep;
    if (!g.length) return;
    this.epIndex = (this.epIndex - 1 + g.length) % g.length;
    if (this.radioOn && !this.ambient) {
      this._radioElsPause();
      this._epElsPause();
      this._playEl(g[this.epIndex], 'ep');
      this.epPlaying = true;
      this.localStation = 'ep';
    }
    this._syncUi();
  }

  nextLocal(group, auto = false) {
    if (group === 'ep') this.epNext(auto);
    else this.radioNext(auto);
  }

  previousLocal(group) {
    if (group === 'ep') this.epPrevious();
    else this.radioPrevious();
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

  setRadioVolume(value) {
    this.radioVolume = clampVolume(value);
    this._applyGroup('radio');
    this._applyGroup('ep');
    this._saveVolumeSoon();
    if (ui.radio) ui.radio.volume = this.radioVolume;
  }

  setSongVolume(name, value) {
    const entry = this.groups.radio.find((e) => e.name === name);
    if (!entry) return;
    const volume = clampVolume(value);
    if (volume === 1) delete this.songVolumes[name];
    else this.songVolumes[name] = volume;
    this._applyEntryVolume(entry);
    this._saveVolumeSoon();
    this._syncUi();
  }

  _saveVolumeSoon() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try {
        localStorage.setItem(RADIO_VOLUME_KEY, String(this.radioVolume));
        localStorage.setItem(SONG_VOLUME_KEY, JSON.stringify(this.songVolumes));
      } catch {
        void 0;
      }
    }, 300);
  }

  resetRadioPlaylist() {
    this.radioDisabled.clear();
    try {
      localStorage.removeItem('snackrun_radio_off');
    } catch {
      void 0;
    }
    for (const entry of this.groups.radio) entry.disabled = false;
    this._syncUi();
  }

  resetVolumes() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this.radioVolume = 1;
    this.songVolumes = {};
    try {
      localStorage.removeItem(RADIO_VOLUME_KEY);
      localStorage.removeItem(SONG_VOLUME_KEY);
    } catch {
      void 0;
    }
    this._applyGroup('title');
    this._applyGroup('radio');
    this._applyGroup('ep');
    this._applyGroup('ambient');
    this._syncUi();
  }

  toggleRadio() {
    this.setLocalPower(!this.radioOn);
  }

  setMuted(m) {
    this.muted = m;
    for (const group of ['title', 'radio', 'ep', 'ambient']) {
      for (const entry of this.groups[group]) this._applyEntryVolume(entry);
    }
  }

  dispose() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    for (const group of ['title', 'radio', 'ep', 'ambient']) this._stopGroup(group);
  }

  _syncUi() {
    if (!ui.radio) ui.radio = {};
    Object.assign(ui.radio, {
      on: this.radioOn,
      hasTracks: this.groups.radio.length > 0,
      epHasTracks: this.groups.ep.length > 0,
      volume: this.radioVolume,
      tracks: this.groups.radio.map((e) => ({
        name: e.name,
        enabled: !e.disabled,
        volume: this._songVolume(e.name)
      }))
    });
  }
}
