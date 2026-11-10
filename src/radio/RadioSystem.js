import { ui, toast } from '../ui/store.js';
import { LocalStationProvider } from './providers/LocalStationProvider.js';
import { SpotifyProvider } from './providers/SpotifyProvider.js';

const STATION_KEY = 'snackrun_radio_station';

export const RADIO_STATIONS = [
  { id: 'default', name: 'DEFAULT', detail: 'In-game radio' },
  { id: 'ep', name: 'INFINITE EP', detail: 'Local EP playlist' },
  { id: 'spotify', name: 'SPOTIFY', detail: 'Phone playback' }
];

const STATION_IDS = new Set(RADIO_STATIONS.map((s) => s.id));

function readStation() {
  try {
    const raw = localStorage.getItem(STATION_KEY);
    if (raw && STATION_IDS.has(raw)) return raw;
  } catch {
    void 0;
  }
  return 'default';
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

export class RadioSystem {
  constructor(game, music) {
    this.g = game;
    this.music = music;
    this.station = readStation();
    this.inVehicle = false;
    this.paused = false;
    this.selectorOpen = false;
    this.spotify = new SpotifyProvider();
    this.providers = {
      default: new LocalStationProvider(music, 'radio'),
      ep: new LocalStationProvider(music, 'ep'),
      spotify: this.spotify
    };
    this._applyTimer = null;
    this._spotifyActive = false;
    this._lastSignature = '';
    this._syncUi();
  }

  get localGroup() {
    return this.station === 'ep' ? 'ep' : 'radio';
  }

  get isLocal() {
    return this.station !== 'spotify';
  }

  providerFor(id = this.station) {
    return this.providers[id] || this.providers.default;
  }

  onRunStart() {
    this.inVehicle = false;
    this.paused = false;
    this.closeSelector();
    this._cancelApply();
    this.music.pauseLocalStations();
    this.spotify.update(0, false);
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
    if (this._spotifyActive) {
      this.spotify.pause();
      this._spotifyActive = false;
    }
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

  togglePower() {
    if (this.station === 'spotify') {
      if (!this.inVehicle || this.paused) return;
      if (this.spotify.playing) this.spotify.pause();
      else {
        this.spotify.play();
        this._applySpotifyVolume();
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
    if (this.station === 'spotify') this.spotify.next();
    else this.music.nextLocal(this.localGroup, false);
    this._syncUi();
  }

  previousTrack() {
    if (!this.inVehicle || this.paused) return;
    if (this.station === 'spotify') this.spotify.previous();
    else this.music.previousLocal(this.localGroup);
    this._syncUi();
  }

  setVolume(value) {
    const percent = Math.min(100, Math.max(0, Math.round((Number(value) || 0) * 100)));
    if (this.station === 'spotify' && this.inVehicle && !this.paused && this.spotify.playing) {
      this.spotify.setVolume(percent);
    }
  }

  _applySpotifyVolume() {
    this.spotify.setVolume(Math.min(100, Math.max(0, Math.round(this.music.radioVolume * 100))), true);
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
    this._spotifyActive = false;
    this._syncUi();
  }

  _stopCurrent() {
    if (this._spotifyActive) {
      this.spotify.pause();
      this._spotifyActive = false;
    }
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
      if (this._spotifyActive) {
        this._spotifyActive = false;
        this.spotify.pause();
      }
      this._syncUi();
      return;
    }
    if (this.isLocal) {
      if (this._spotifyActive) {
        this._spotifyActive = false;
        this.spotify.pause();
      }
      if (this.music.radioOn) this.music.playLocalStation(this.localGroup, true);
    } else {
      this.music.pauseLocalStations();
      this._spotifyActive = true;
      this.spotify.play();
      this._applySpotifyVolume();
    }
    this._syncUi();
  }

  update(dt) {
    this.spotify.update(dt, this.inVehicle && !this.paused);
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
    this.inVehicle = false;
    this.paused = false;
    this.selectorOpen = false;
    this._spotifyActive = false;
    this.music.pauseLocalStations();
    this.spotify.reset();
    this._lastSignature = '';
    this._syncUi();
  }

  _buildState() {
    const local = this.isLocal;
    const group = this.localGroup;
    const available = local
      ? this.music.localHasTracks(group)
      : this.spotify.configured;
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
    } else {
      const spotify = this.spotify.snapshot();
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
    }

    const stationInfo = RADIO_STATIONS.find((s) => s.id === this.station) || RADIO_STATIONS[0];
    const spotify = this.spotify.snapshot();

    return {
      station: this.station,
      stationName: stationInfo.name,
      stationDetail: stationInfo.detail,
      stations: RADIO_STATIONS.map((s) => ({
        id: s.id,
        name: s.name,
        detail: s.detail,
        active: s.id === this.station
      })),
      selectorOpen: this.selectorOpen,
      inVehicle: this.inVehicle,
      paused: this.paused,
      power: local ? this.music.radioOn : spotify.connected,
      on: local ? this.music.radioOn : spotify.playing,
      playing,
      track,
      artist,
      status,
      statusKind,
      spotify: {
        configured: spotify.configured,
        connected: spotify.connected,
        clientId: spotify.clientId,
        deviceName: spotify.deviceName,
        error: spotify.error,
        status: spotify.status,
        redirectUri: spotify.redirectUri
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
