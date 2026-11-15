import { ui, toast } from '../ui/store.js';
import { LocalStationProvider } from './providers/LocalStationProvider.js';
import { SpotifyProvider } from './providers/SpotifyProvider.js';
import { SoundCloudProvider } from './providers/SoundCloudProvider.js';

const STATION_KEY = 'snackrun_radio_station';
const AUX_KEY = 'snackrun_aux_source';

export const AUX_SOURCES = ['spotify', 'soundcloud'];

export const RADIO_STATIONS = [
  { id: 'default', name: 'DEFAULT', detail: 'In-game radio' },
  { id: 'ep', name: 'INFINITE EP', detail: 'Local EP playlist' },
  { id: 'aux', name: 'AUX', detail: 'Spotify / SoundCloud' }
];

const STATION_IDS = new Set(RADIO_STATIONS.map((s) => s.id));

function readStation() {
  try {
    const raw = localStorage.getItem(STATION_KEY);
    if (raw === 'spotify' || raw === 'soundcloud') return 'aux';
    if (raw && STATION_IDS.has(raw)) return raw;
  } catch {
    void 0;
  }
  return 'default';
}

function readAuxSource() {
  try {
    const raw = localStorage.getItem(AUX_KEY);
    if (AUX_SOURCES.includes(raw)) return raw;
    const legacy = localStorage.getItem(STATION_KEY);
    if (legacy === 'soundcloud') return 'soundcloud';
  } catch {
    void 0;
  }
  return 'spotify';
}

const SPOTIFY_LABELS = {
  disconnected: ['NOT CONNECTED', 'idle'],
  missing_client: ['SET CLIENT ID', 'warn'],
  insecure: ['HTTPS REQUIRED', 'warn'],
  auth: ['SIGN IN NEEDED', 'warn'],
  premium: ['PREMIUM REQUIRED', 'warn'],
  no_device: ['NO ACTIVE DEVICE', 'warn'],
  offline: ['OFFLINE', 'error'],
  rate: ['RATE LIMITED', 'warn'],
  error: ['SPOTIFY ERROR', 'error'],
  idle: ['READY', 'idle'],
  playing: ['PLAYING', 'ok'],
  paused: ['PAUSED', 'idle'],
  connecting: ['CONNECTING', 'idle']
};

const SOUNDCLOUD_LABELS = {
  unset: ['SET LINK', 'warn'],
  idle: ['READY', 'idle'],
  loading: ['LOADING', 'idle'],
  ready: ['READY', 'idle'],
  playing: ['PLAYING', 'ok'],
  paused: ['PAUSED', 'idle'],
  error: ['LINK FAILED', 'error']
};

export class RadioSystem {
  constructor(game, music) {
    this.g = game;
    this.music = music;
    this.station = readStation();
    this.auxSource = readAuxSource();
    this.inVehicle = false;
    this.paused = false;
    this.selectorOpen = false;
    this.spotify = new SpotifyProvider();
    this.soundcloud = new SoundCloudProvider();
    this.providers = {
      default: new LocalStationProvider(music, 'radio'),
      ep: new LocalStationProvider(music, 'ep'),
      spotify: this.spotify,
      soundcloud: this.soundcloud
    };
    this._applyTimer = null;
    this._externalActive = null;
    this._lastSignature = '';
    this._syncUi();
  }

  get localGroup() {
    return this.station === 'ep' ? 'ep' : 'radio';
  }

  get isLocal() {
    return this.station === 'default' || this.station === 'ep';
  }

  get isAux() {
    return this.station === 'aux';
  }

  get isSpotify() {
    return this.isAux && this.auxSource === 'spotify';
  }

  get isSoundCloud() {
    return this.isAux && this.auxSource === 'soundcloud';
  }

  get auxProvider() {
    return this.providers[this.auxSource];
  }

  providerFor(id = this.station) {
    if (id === 'aux') return this.auxProvider;
    return this.providers[id] || this.providers.default;
  }

  onRunStart() {
    this.inVehicle = false;
    this.paused = false;
    this.closeSelector();
    this._cancelApply();
    this.music.pauseLocalStations();
    this._pauseExternal();
    this.spotify.update(0, false);
    this.soundcloud.update(0, false);
    this._syncUi();
  }

  setInVehicle(value) {
    const next = !!value;
    if (this.inVehicle === next) return;
    this.inVehicle = next;
    this._syncUi();
    if (this.paused) return;
    this._scheduleApply(next ? 220 : 180);
  }

  gamePause() {
    if (this.paused) return;
    this.paused = true;
    this.closeSelector();
    this._cancelApply();
    this.music.pauseGame();
    this._pauseExternal();
    this._syncUi();
  }

  gameResume() {
    if (!this.paused) return;
    this.paused = false;
    this.music.resumeGame(false);
    if (this.inVehicle) this._scheduleApply(160);
    this._syncUi();
  }

  openSelector() {
    if (this.selectorOpen) return;
    this.selectorOpen = true;
    this._syncUi();
  }

  closeSelector() {
    if (!this.selectorOpen) return;
    this.selectorOpen = false;
    this._syncUi();
  }

  selectStation(id) {
    if (!STATION_IDS.has(id) || id === this.station) return;
    this._stopCurrent();
    this.station = id;
    try {
      localStorage.setItem(STATION_KEY, id);
    } catch {
      void 0;
    }
    this._syncUi();
    if (this.inVehicle && !this.paused) this._scheduleApply(140);
  }

  selectNext() {
    const index = RADIO_STATIONS.findIndex((s) => s.id === this.station);
    this.selectStation(RADIO_STATIONS[(index + 1) % RADIO_STATIONS.length].id);
  }

  selectPrevious() {
    const index = RADIO_STATIONS.findIndex((s) => s.id === this.station);
    this.selectStation(RADIO_STATIONS[(index - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length].id);
  }

  selectAuxSource(id) {
    if (!AUX_SOURCES.includes(id) || id === this.auxSource) return false;
    this._pauseExternal();
    this.auxSource = id;
    try {
      localStorage.setItem(AUX_KEY, id);
    } catch {
      void 0;
    }
    this._syncUi();
    if (this.station === 'aux' && this.inVehicle && !this.paused) this._scheduleApply(140);
    return true;
  }

  cycleAuxSource() {
    if (this.station !== 'aux') return false;
    return this.selectAuxSource(this.auxSource === 'spotify' ? 'soundcloud' : 'spotify');
  }

  togglePower() {
    if (!this.isLocal) {
      if (!this.inVehicle || this.paused) return;
      const provider = this.providerFor();
      if (provider.playing) {
        provider.pause();
        if (this._externalActive === this.auxSource) this._externalActive = null;
      } else {
        this._externalActive = this.auxSource;
        provider.play();
        this._applyStationVolume();
      }
      this._syncUi();
      return;
    }
    const next = !this.music.radioOn;
    this.music.setLocalPower(next, this.inVehicle && !this.paused);
    this._syncUi();
  }

  nextTrack() {
    if (!this.inVehicle || this.paused) return;
    if (this.isLocal) this.music.nextLocal(this.localGroup, false);
    else this.providerFor().next();
    this._syncUi();
  }

  previousTrack() {
    if (!this.inVehicle || this.paused) return;
    if (this.isLocal) this.music.previousLocal(this.localGroup);
    else this.providerFor().previous();
    this._syncUi();
  }

  setVolume(value) {
    const percent = Math.min(100, Math.max(0, Math.round((Number(value) || 0) * 100)));
    if (this.isLocal || !this.inVehicle || this.paused) return;
    this.providerFor().setVolume(percent);
  }

  _applyStationVolume() {
    if (this.isLocal) return;
    this.providerFor().setVolume(Math.min(100, Math.max(0, Math.round(this.music.radioVolume * 100))));
  }

  setSpotifyClientId(value) {
    this.spotify.setClientId(value);
    this._syncUi();
  }

  async connectSpotify() {
    if (!this.spotify.configured) {
      toast('Add a Spotify client ID in Settings first.', 'warn', 3600);
      return;
    }
    await this.spotify.connect();
    this._syncUi();
  }

  async disconnectSpotify() {
    await this.spotify.disconnect();
    this._externalActive = null;
    this._syncUi();
  }

  setSoundCloudUrl(value) {
    const ok = this.soundcloud.setUrl(value);
    if (!ok) {
      toast('Paste a public soundcloud.com profile or playlist link.', 'warn', 4200);
      this._syncUi();
      return;
    }
    if (this.inVehicle && !this.paused) this._scheduleApply(120);
    else this._syncUi();
  }

  clearSoundCloud() {
    this._pauseExternal();
    this.soundcloud.clear();
    this._syncUi();
  }

  toggleShuffle() {
    if (!this.soundcloud.configured) return false;
    this.soundcloud.toggleShuffle();
    this._syncUi();
    return true;
  }

  _pauseExternal() {
    if (!this._externalActive) return;
    this.providerFor(this._externalActive).pause();
    this._externalActive = null;
  }

  _stopCurrent() {
    this._pauseExternal();
    if (this.isLocal) this.music.pauseLocalStations();
  }

  _cancelApply() {
    if (this._applyTimer) {
      clearTimeout(this._applyTimer);
      this._applyTimer = null;
    }
  }

  _scheduleApply(delay) {
    this._cancelApply();
    this._applyTimer = setTimeout(() => {
      this._applyTimer = null;
      this._applyNow();
    }, delay);
  }

  _applyNow() {
    if (this.paused) return;
    if (!this.inVehicle) {
      this.music.pauseLocalStations();
      this._pauseExternal();
      this._syncUi();
      return;
    }
    if (this.isLocal) {
      this._pauseExternal();
      if (this.music.radioOn) this.music.playLocalStation(this.localGroup, true);
    } else {
      this.music.pauseLocalStations();
      this._externalActive = this.auxSource;
      this.providerFor().play();
      this._applyStationVolume();
    }
    this._syncUi();
  }

  update(dt) {
    const active = this.inVehicle && !this.paused;
    this.spotify.update(dt, active);
    this.soundcloud.update(dt, active);
    const state = this._buildState();
    const signature = JSON.stringify(state);
    if (signature !== this._lastSignature) {
      this._lastSignature = signature;
      this._applyUi(state);
    }
  }

  reset() {
    this._cancelApply();
    this.station = 'default';
    this.auxSource = 'spotify';
    this.inVehicle = false;
    this.paused = false;
    this.selectorOpen = false;
    this._pauseExternal();
    this.music.pauseLocalStations();
    this.spotify.reset();
    this.soundcloud.reset();
    this._lastSignature = '';
    this._syncUi();
  }

  _buildState() {
    const local = this.isLocal;
    const group = this.localGroup;
    const spotify = this.spotify.snapshot();
    const soundcloud = this.soundcloud.snapshot();
    const available = local ? this.music.localHasTracks(group) : this.providerFor().configured;
    let track = null;
    let artist = null;
    let playing = false;
    let status = 'READY';
    let statusKind = 'idle';

    if (local) {
      track = available ? this.music.currentLocalName(group) : null;
      playing = this.music.isLocalPlaying(group);
      if (!available) {
        status = 'NO TRACKS';
        statusKind = 'warn';
      } else if (!this.music.radioOn) {
        status = 'OFF';
        statusKind = 'idle';
      } else if (this.paused) {
        status = 'PAUSED';
        statusKind = 'idle';
      } else if (playing) {
        status = 'PLAYING';
        statusKind = 'ok';
      } else if (!this.inVehicle) {
        status = 'STANDBY';
        statusKind = 'idle';
      }
    } else if (this.isSpotify) {
      track = spotify.track;
      artist = spotify.artist;
      playing = spotify.playing;
      const mapped = SPOTIFY_LABELS[spotify.status] || ['NOT CONNECTED', 'idle'];
      status = mapped[0];
      statusKind = mapped[1];
      if (!spotify.configured) {
        status = 'SET CLIENT ID';
        statusKind = 'warn';
      }
    } else {
      track = soundcloud.track;
      artist = soundcloud.artist;
      playing = soundcloud.playing;
      const mapped = SOUNDCLOUD_LABELS[soundcloud.status] || ['READY', 'idle'];
      status = mapped[0];
      statusKind = mapped[1];
      if (!soundcloud.configured) {
        status = 'SET LINK';
        statusKind = 'warn';
      } else if (soundcloud.error) {
        status = 'LINK FAILED';
        statusKind = 'error';
      }
    }

    const stationInfo = RADIO_STATIONS.find((s) => s.id === this.station) || RADIO_STATIONS[0];
    const auxSourceName = this.auxSource === 'spotify' ? 'SPOTIFY' : 'SOUNDCLOUD';
    const power = local ? this.music.radioOn : this.isSpotify ? spotify.connected : soundcloud.configured;
    const on = local ? this.music.radioOn : playing;

    return {
      station: this.station,
      stationName: stationInfo.name,
      stationDetail: this.station === 'aux' ? auxSourceName : stationInfo.detail,
      auxSource: this.auxSource,
      auxSourceName,
      stations: RADIO_STATIONS.map((s) => ({
        id: s.id,
        name: s.name,
        detail: s.detail,
        active: s.id === this.station
      })),
      selectorOpen: this.selectorOpen,
      inVehicle: this.inVehicle,
      paused: this.paused,
      power,
      on,
      playing,
      track,
      artist,
      status,
      statusKind,
      shuffle: soundcloud.shuffle,
      spotify: {
        configured: spotify.configured,
        connected: spotify.connected,
        clientId: spotify.clientId,
        deviceName: spotify.deviceName,
        error: spotify.error,
        status: spotify.status,
        redirectUri: spotify.redirectUri
      },
      soundcloud: {
        configured: soundcloud.configured,
        url: soundcloud.url,
        status: soundcloud.status,
        label: !soundcloud.configured
          ? 'NO LINK'
          : soundcloud.error
            ? 'LINK FAILED'
            : (SOUNDCLOUD_LABELS[soundcloud.status] || ['READY', 'idle'])[0],
        track: soundcloud.track,
        artist: soundcloud.artist,
        shuffle: soundcloud.shuffle,
        trackCount: soundcloud.trackCount,
        trackIndex: soundcloud.trackIndex,
        error: soundcloud.error
      }
    };
  }

  _applyUi(state) {
    if (!ui.radio) ui.radio = {};
    Object.assign(ui.radio, state);
  }

  _syncUi() {
    const state = this._buildState();
    this._lastSignature = JSON.stringify(state);
    this._applyUi(state);
  }

  dispose() {
    this._cancelApply();
  }
}
