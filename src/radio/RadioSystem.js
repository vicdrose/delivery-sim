import { ui, toast } from '../ui/store.js';
import { LocalStationProvider } from './providers/LocalStationProvider.js';
import { SpotifyProvider } from './providers/SpotifyProvider.js';
import { SoundCloudProvider } from './providers/SoundCloudProvider.js';
import { FreestyleKingProvider } from './FreestyleKingProvider.js';
import {
  ASTRO_CARD_BACK,
  ASTRO_BODY_CARDS,
  ASTRO_SIGN_CARDS,
  ASTRO_HOUSE_CARDS,
  ASTRO_CRYSTAL_CARDS
} from './astroBeatsCards.js';

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

function pickCard(cards) {
  return cards[Math.floor(Math.random() * cards.length)];
}

const FREESTYLE_LABELS = {
  idle: ['READY', 'idle'],
  loading: ['LOADING', 'idle'],
  playing: ['PLAYING', 'ok'],
  paused: ['PAUSED', 'idle'],
  error: ['BEAT ERROR', 'error']
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
    this.freestyle = new FreestyleKingProvider();
    this.astroBeats = {
      active: false,
      flipped: false,
      draw: 0,
      cards: []
    };
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

  get isFreestyle() {
    return this.freestyle.active;
  }

  get isAstroBeats() {
    return this.astroBeats.active;
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
    this.freestyle.deactivate();
    this.astroBeats.active = false;
    this.astroBeats.flipped = false;
    this.astroBeats.cards = [];
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
    if (this.paused || this.isFreestyle || this.isAstroBeats) return;
    this._scheduleApply(next ? 220 : 180);
  }

  gamePause() {
    if (this.paused) return;
    this.paused = true;
    this.freestyle.pause();
    this.closeSelector();
    this._cancelApply();
    this.music.pauseGame();
    this._pauseExternal();
    this._syncUi();
  }

  gameResume() {
    if (!this.paused) return;
    this.paused = false;
    this.freestyle.resume();
    this.music.resumeGame(false);
    if (this.inVehicle && !this.isFreestyle && !this.isAstroBeats) this._scheduleApply(160);
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

  toggleFreestyle() {
    const wasAstroBeats = this.isAstroBeats;
    if (wasAstroBeats) this.deactivateAstroBeats(false);
    if (this.isFreestyle) {
      this.freestyle.deactivate();
      if (this.inVehicle && !this.paused) this._scheduleApply(120);
    } else {
      this._cancelApply();
      this._pauseExternal();
      this.music.pauseLocalStations();
      this.freestyle.activate();
      this._applyFreestyleVolume();
    }
    this._syncUi();
  }

  pressAstroBeats() {
    if (!this.isAstroBeats) this.activateAstroBeats();
    else this.flipAstroBeats();
  }

  activateAstroBeats() {
    if (this.isFreestyle) this.freestyle.deactivate();
    this._cancelApply();
    this._pauseExternal();
    this.music.pauseLocalStations();
    this.astroBeats.active = true;
    this.astroBeats.flipped = false;
    this.astroBeats.draw += 1;
    this._drawAstroBeats();
    this.openSelector();
    this._syncUi();
  }

  flipAstroBeats() {
    if (!this.isAstroBeats) return;
    if (this.astroBeats.flipped) {
      this.astroBeats.flipped = false;
      this.astroBeats.draw += 1;
      this._drawAstroBeats();
    } else {
      this.astroBeats.flipped = true;
    }
    this.openSelector();
    this._syncUi();
  }

  deactivateAstroBeats(restore = true) {
    if (!this.isAstroBeats) return;
    this.astroBeats.active = false;
    this.astroBeats.flipped = false;
    this.astroBeats.cards = [];
    if (restore && this.inVehicle && !this.paused) this._scheduleApply(120);
    this._syncUi();
  }

  _drawAstroBeats() {
    const body = pickCard(ASTRO_BODY_CARDS);
    const sign = pickCard(ASTRO_SIGN_CARDS);
    const house = pickCard(ASTRO_HOUSE_CARDS);
    const crystal = pickCard(ASTRO_CRYSTAL_CARDS);
    this.astroBeats.cards = [
      {
        key: 'body',
        kind: 'BODY',
        name: body.name,
        front: ASTRO_CARD_BACK,
        back: body.image
      },
      {
        key: 'sign',
        kind: 'SIGN',
        name: sign.name,
        front: ASTRO_CARD_BACK,
        back: sign.image
      },
      {
        key: 'house',
        kind: 'HOUSE',
        name: house.name,
        front: ASTRO_CARD_BACK,
        back: house.image
      },
      {
        key: 'crystal',
        kind: 'CRYSTAL',
        name: crystal.name,
        front: crystal.front,
        back: crystal.back
      }
    ];
  }

  selectStation(id) {
    if (this.isFreestyle || this.isAstroBeats || !STATION_IDS.has(id) || id === this.station) return;
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
    if (this.isFreestyle || this.isAstroBeats) return;
    const index = RADIO_STATIONS.findIndex((s) => s.id === this.station);
    this.selectStation(RADIO_STATIONS[(index + 1) % RADIO_STATIONS.length].id);
  }

  selectPrevious() {
    if (this.isFreestyle || this.isAstroBeats) return;
    const index = RADIO_STATIONS.findIndex((s) => s.id === this.station);
    this.selectStation(RADIO_STATIONS[(index - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length].id);
  }

  selectAuxSource(id) {
    if (this.isFreestyle || this.isAstroBeats || !AUX_SOURCES.includes(id) || id === this.auxSource) return false;
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
    if (this.isFreestyle || this.isAstroBeats || this.station !== 'aux') return false;
    return this.selectAuxSource(this.auxSource === 'spotify' ? 'soundcloud' : 'spotify');
  }

  togglePower() {
    if (this.isFreestyle || this.isAstroBeats) return;
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
    if (this.isFreestyle) {
      this.freestyle.next();
      this._syncUi();
      return;
    }
    if (this.isAstroBeats || !this.inVehicle || this.paused) return;
    if (this.isLocal) this.music.nextLocal(this.localGroup, false);
    else this.providerFor().next();
    this._syncUi();
  }

  rollFreestyleWord(bank) {
    if (!this.isFreestyle) return null;
    const word = this.freestyle.rollWord(bank);
    this._syncUi();
    return word;
  }

  setFreestyleAutoWrap(ms) {
    this.freestyle.setAutoWrapMs(ms);
    this._syncUi();
  }

  previousTrack() {
    if (this.isFreestyle || this.isAstroBeats || !this.inVehicle || this.paused) return;
    if (this.isLocal) this.music.previousLocal(this.localGroup);
    else this.providerFor().previous();
    this._syncUi();
  }

  setVolume(value) {
    const percent = Math.min(100, Math.max(0, Math.round((Number(value) || 0) * 100)));
    if (this.isFreestyle) {
      this.freestyle.setVolume(this._freestyleVolume());
      return;
    }
    if (this.isAstroBeats) return;
    if (this.isLocal || !this.inVehicle || this.paused) return;
    this.providerFor().setVolume(percent);
  }

  _applyStationVolume() {
    if (this.isFreestyle) {
      this._applyFreestyleVolume();
      return;
    }
    if (this.isAstroBeats || this.isLocal) return;
    this.providerFor().setVolume(Math.min(100, Math.max(0, Math.round(this.music.radioVolume * 100))));
  }

  _freestyleVolume() {
    return this.music.muted ? 0 : Math.min(1, Math.max(0, this.music.radioVolume));
  }

  _applyFreestyleVolume() {
    this.freestyle.setVolume(this._freestyleVolume());
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
    if (this.isFreestyle || this.isAstroBeats || !this.soundcloud.configured) return false;
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
    if (this.paused || this.isFreestyle || this.isAstroBeats) return;
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
    if (this.isFreestyle) {
      this._applyFreestyleVolume();
      this.freestyle.updateWord(dt);
    }
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
    this.freestyle.deactivate();
    this.freestyle.resetAutoWrap();
    this.astroBeats.active = false;
    this.astroBeats.flipped = false;
    this.astroBeats.cards = [];
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
    const freestyle = this.freestyle.snapshot();
    const astroBeats = this._astroSnapshot();
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

    const state = {
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
        builtIn: soundcloud.builtIn,
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
      },
      freestyle,
      astroBeats
    };

    if (freestyle.active) {
      const mapped = FREESTYLE_LABELS[freestyle.status] || ['READY', 'idle'];
      Object.assign(state, {
        station: 'freestyle',
        stationName: 'FK',
        stationDetail: 'AUTO BEATS',
        playing: freestyle.playing,
        track: freestyle.track,
        artist: null,
        status: mapped[0],
        statusKind: mapped[1],
        power: true,
        on: true,
        shuffle: true
      });
    }

    if (astroBeats.active) {
      Object.assign(state, {
        station: 'astro',
        stationName: 'ASTRO',
        stationDetail: 'CARDS',
        playing: false,
        track: astroBeats.flipped ? astroBeats.spreadLine : 'FOUR CARDS READY',
        artist: null,
        status: astroBeats.flipped ? 'REVEALED' : 'FACE DOWN',
        statusKind: 'idle',
        power: true,
        on: true,
        shuffle: true
      });
    }

    return state;
  }

  _astroSnapshot() {
    return {
      active: this.astroBeats.active,
      flipped: this.astroBeats.flipped,
      draw: this.astroBeats.draw,
      cards: this.astroBeats.cards.map((card) => ({ ...card })),
      spreadLine: this.astroBeats.cards.map((card) => card.name).join(' · ')
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
    this.freestyle.dispose();
  }
}
