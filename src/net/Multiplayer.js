import { bus } from '../core/bus.js';
import { ui, toast } from '../ui/store.js';
import { MultiplayerClient } from './client.js';
import { RemotePlayers } from './RemotePlayers.js';
import { VoiceChat } from './VoiceChat.js';
import {
  loadName,
  saveName,
  loadServerUrl,
  saveServerUrl,
  loadVoiceEnabled,
  saveVoiceEnabled,
  loadMicMuted,
  saveMicMuted
} from './settings.js';

const SEND_INTERVAL = 1 / 15;
const VOICE_PEERS = 8;

const round = (value) => Math.round(value * 100) / 100;

export class Multiplayer {
  constructor(game) {
    this.g = game;
    this.remotes = new RemotePlayers(game.scene);
    this.client = new MultiplayerClient({
      onJoined: (msg) => this._onJoined(msg),
      onRoster: (msg) => this._onRoster(msg),
      onPlayers: (players) => this.remotes.apply(players),
      onVoice: (from, data) => this.voice.handleSignal(from, data),
      onStatus: (status) => this._onStatus(status),
      onError: (error) => this._onError(error)
    });
    this.voice = new VoiceChat(this.client);
    this._sendClock = 0;
    this._state = null;
    this._lastFoot = { x: 0, z: 0 };
    this._lastFootValid = false;
    this._joinTimer = null;
    this._wakeTimer = null;
    this._switchingLevel = false;

    ui.multiplayer.name = loadName();
    ui.multiplayer.serverUrl = loadServerUrl();
    ui.multiplayer.voiceEnabled = loadVoiceEnabled();
    ui.multiplayer.micMuted = loadMicMuted();

    this.voice.setEnabled(ui.multiplayer.voiceEnabled);
    this.voice.setMuted(ui.multiplayer.micMuted);

    this._unsubs = [
      bus.on('ui:mp-open', () => this.openPanel()),
      bus.on('ui:mp-close', () => this.closePanel()),
      bus.on('ui:mp-create', () => this.create()),
      bus.on('ui:mp-join', () => this.join()),
      bus.on('ui:mp-leave', () => this.leave()),
      bus.on('ui:mp-name', (name) => this.setName(name)),
      bus.on('ui:mp-server', (url) => this.setServer(url)),
      bus.on('ui:mp-voice', () => this.toggleVoice()),
      bus.on('ui:mp-mic', () => this.toggleMic())
    ];

    this._onVisibility = () => {
      if (document.hidden) this.voice.setTalking(false);
    };
    document.addEventListener('visibilitychange', this._onVisibility);

    this._resumeVoice = () => {
      if (this.client.inRoom) this.voice.resume();
    };
    window.addEventListener('pointerdown', this._resumeVoice);
    window.addEventListener('keydown', this._resumeVoice);
  }

  get inRoom() {
    return this.client.inRoom;
  }

  get roomCode() {
    return this.client.code;
  }

  get switchingLevel() {
    return this._switchingLevel;
  }

  applyRoomLevel(id) {
    if (!id || id === this.g.level.id) return;
    this.remotes.clear();
    this._switchingLevel = true;
    try {
      this.g.loadLevel(id);
    } finally {
      this._switchingLevel = false;
    }
  }

  openPanel() {
    ui.multiplayer.panelOpen = true;
    ui.multiplayer.error = '';
  }

  closePanel() {
    if (ui.multiplayer.inRoom) return;
    ui.multiplayer.panelOpen = false;
    ui.multiplayer.error = '';
  }

  setName(name) {
    const clean = String(name || '').trim().slice(0, 16);
    ui.multiplayer.name = clean;
    saveName(clean);
  }

  setServer(url) {
    ui.multiplayer.serverUrl = String(url || '').trim();
    saveServerUrl(ui.multiplayer.serverUrl);
    ui.multiplayer.serverUrl = loadServerUrl();
  }

  async create() {
    const mp = ui.multiplayer;
    if (mp.busy) return;
    mp.busy = true;
    mp.error = '';
    mp.message = 'Opening room…';
    mp.status = 'connecting';
    saveName(mp.name);
    saveServerUrl(mp.serverUrl);
    mp.serverUrl = loadServerUrl();
    if (mp.voiceEnabled) this.voice.enable();
    this._armJoinTimer();
    try {
      await this.client.createRoom({ url: mp.serverUrl, name: mp.name, level: ui.levelId });
    } catch (error) {
      this._fail(error.message || 'Could not reach the multiplayer server.');
    }
  }

  async join() {
    const mp = ui.multiplayer;
    if (mp.busy) return;
    const code = String(mp.joinCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (code.length < 5) {
      mp.error = 'Enter the five-character room code.';
      mp.status = 'error';
      return;
    }
    mp.busy = true;
    mp.error = '';
    mp.message = 'Joining room…';
    mp.status = 'connecting';
    saveName(mp.name);
    saveServerUrl(mp.serverUrl);
    mp.serverUrl = loadServerUrl();
    if (mp.voiceEnabled) this.voice.enable();
    this._armJoinTimer();
    try {
      await this.client.joinRoom({ url: mp.serverUrl, name: mp.name, code });
    } catch (error) {
      this._fail(error.message || 'Could not reach the multiplayer server.');
    }
  }

  leave() {
    const wasInRoom = ui.multiplayer.inRoom;
    this._clearJoinTimer();
    this.voice.disable();
    this.remotes.clear();
    this.client.leave();
    const mp = ui.multiplayer;
    mp.inRoom = false;
    mp.busy = false;
    mp.status = 'idle';
    mp.message = '';
    mp.roomCode = '';
    mp.localId = '';
    mp.players = [];
    mp.isHost = false;
    mp.talking = false;
    mp.nearby = 0;
    mp.nearest = null;
    mp.voicePeers = 0;
    mp.voiceConnected = 0;
    mp.voiceFailed = 0;
    mp.voiceTurn = false;
    ui.voiceHeld = false;
    if (wasInRoom) toast('Left multiplayer.', 'info');
  }

  toggleVoice() {
    const mp = ui.multiplayer;
    mp.voiceEnabled = !mp.voiceEnabled;
    saveVoiceEnabled(mp.voiceEnabled);
    this.voice.setEnabled(mp.voiceEnabled);
    if (mp.voiceEnabled) {
      this.voice.enable();
    } else {
      this.voice.disable();
      mp.voiceStatus = 'off';
    }
  }

  toggleMic() {
    const mp = ui.multiplayer;
    mp.micMuted = !mp.micMuted;
    saveMicMuted(mp.micMuted);
    this.voice.setMuted(mp.micMuted);
  }

  resetSettings() {
    const mp = ui.multiplayer;
    mp.panelOpen = false;
    mp.status = 'idle';
    mp.message = '';
    mp.error = '';
    mp.busy = false;
    mp.name = loadName();
    mp.serverUrl = loadServerUrl();
    mp.joinCode = '';
    mp.voiceEnabled = loadVoiceEnabled();
    mp.voiceStatus = 'off';
    mp.micMuted = loadMicMuted();
    this.voice.setEnabled(mp.voiceEnabled);
    this.voice.setMuted(mp.micMuted);
  }

  setPaused(paused) {
    if (paused) this.voice.setTalking(false);
  }

  update(dt, input) {
    if (!this.client.inRoom || ui.screen !== 'playing') return;
    const local = this._localState(dt);
    this._state = local;
    this._sendClock += dt;
    if (this._sendClock >= SEND_INTERVAL) {
      this._sendClock %= SEND_INTERVAL;
      this.client.sendState(local);
    }

    this.remotes.update(dt);
    const mp = ui.multiplayer;
    const near = mp.voiceEnabled ? this.remotes.voiceCandidates(local.x, local.z, VOICE_PEERS) : [];
    this.voice.setId(this.client.id);
    this.voice.sync(near.map((p) => p.id));
    this.voice.setDistances(new Map(near.map((p) => [p.id, p.distance])));
    const canTalk = !!(input && input.voiceHeld) && !ui.paused && !this.g.sleep.blocking && !mp.micMuted;
    this.voice.setTalking(canTalk);
    const stats = this.voice.stats();
    mp.talking = this.voice.talking;
    mp.nearby = near.length;
    mp.nearest = this.remotes.nearestDistance(local.x, local.z);
    mp.voicePeers = stats.total;
    mp.voiceConnected = stats.connected;
    mp.voiceFailed = stats.failed;
  }

  blips() {
    if (!this.client.inRoom) return [];
    return this.remotes.blips();
  }

  _localState(dt) {
    const g = this.g;
    const mode = g.currentMode ? g.currentMode.playerMode : 'drive';
    let x = 0;
    let z = 0;
    let yaw = 0;
    let pose = 2;
    let veh = 0;
    let speed = 0;

    if (mode === 'drive' && g.vehicle) {
      x = g.vehicle.position.x;
      z = g.vehicle.position.z;
      yaw = g.vehicle.heading;
      pose = 0;
      veh = g.activeVehicleId === 'van' ? 1 : 0;
      speed = Math.abs(g.vehicle.speed);
      this._lastFootValid = false;
    } else {
      x = g.player.pos.x;
      z = g.player.pos.z;
      yaw = g.player.yaw;
      if (mode === 'inside') {
        pose = 3;
      } else if (this._lastFootValid && dt > 0) {
        const delta = Math.hypot(x - this._lastFoot.x, z - this._lastFoot.z);
        speed = Math.min(20, delta / dt);
        pose = speed > 0.4 ? 1 : 2;
      }
      this._lastFoot.x = x;
      this._lastFoot.z = z;
      this._lastFootValid = true;
    }

    if (g.sleep.blocking) pose = 3;

    return {
      x: round(x),
      z: round(z),
      yaw: round(Math.atan2(Math.sin(yaw), Math.cos(yaw))),
      mode: pose,
      veh,
      sp: round(speed),
      mic: this.voice.talking ? 1 : 0
    };
  }

  _onJoined(msg) {
    this._clearJoinTimer();
    const mp = ui.multiplayer;
    this.applyRoomLevel(msg.level);
    mp.inRoom = true;
    mp.busy = false;
    mp.status = 'joined';
    mp.message = '';
    mp.error = '';
    mp.panelOpen = false;
    mp.roomCode = msg.code;
    mp.localId = msg.id;
    ui.voiceHeld = false;
    mp.level = msg.level || ui.levelId;
    mp.isHost = msg.hostId === msg.id;
    mp.max = msg.max || 32;
    mp.players = msg.players || [];
    this.remotes.setRoster(msg.players || [], msg.hostId);
    this.voice.setId(msg.id);
    this.voice.setIceServers(msg.iceServers);
    mp.voiceTurn = this.voice.hasTurn();
    this.voice.setEnabled(mp.voiceEnabled);
    this.voice.setMuted(mp.micMuted);
    if (mp.voiceEnabled) this.voice.enable();
    toast(`Room ${msg.code} joined.`, 'success');
    if (ui.screen === 'title') bus.emit('ui:start');
    else if (ui.paused) bus.emit('ui:pause', false);
  }

  _onRoster(msg) {
    const mp = ui.multiplayer;
    mp.players = msg.players || [];
    mp.isHost = msg.hostId === this.client.id;
    mp.max = msg.max || mp.max;
    this.remotes.setRoster(msg.players || [], msg.hostId);
  }

  _onStatus(status) {
    const mp = ui.multiplayer;
    if (status.state === 'connecting') {
      if (!mp.inRoom) {
        mp.status = 'connecting';
        mp.message = 'Connecting…';
      }
    } else if (status.state === 'reconnecting') {
      mp.status = 'reconnecting';
      mp.message = status.message || 'Reconnecting…';
    } else if (status.state === 'idle' && !this.client.inRoom) {
      mp.busy = false;
      if (mp.status !== 'error') {
        mp.status = 'idle';
        mp.message = '';
      }
    }
  }

  _onError(error) {
    this._clearJoinTimer();
    const mp = ui.multiplayer;
    mp.busy = false;
    mp.status = 'error';
    mp.error = error.message || 'Multiplayer error.';
    mp.message = '';
    toast(mp.error, 'danger', 5000);
    if (!this.client.inRoom) {
      this.voice.disable();
      this.remotes.clear();
      this.client.leave();
      mp.inRoom = false;
      mp.roomCode = '';
      mp.localId = '';
      mp.players = [];
      mp.panelOpen = true;
    }
  }

  _fail(message) {
    this._clearJoinTimer();
    const mp = ui.multiplayer;
    mp.busy = false;
    mp.status = 'error';
    mp.message = '';
    mp.error = message;
    mp.inRoom = false;
    ui.multiplayer.panelOpen = true;
  }

  _armJoinTimer() {
    this._clearJoinTimer();
    this._wakeTimer = setTimeout(() => {
      this._wakeTimer = null;
      if (!ui.multiplayer.inRoom && ui.multiplayer.busy) {
        ui.multiplayer.message = 'Waking the multiplayer server…';
      }
    }, 5000);
    this._joinTimer = setTimeout(() => {
      this._joinTimer = null;
      if (!ui.multiplayer.inRoom && ui.multiplayer.busy) {
        this.client.leave();
        this._fail('The multiplayer server did not answer. Check the server URL and try again.');
      }
    }, 60000);
  }

  _clearJoinTimer() {
    if (this._joinTimer) {
      clearTimeout(this._joinTimer);
      this._joinTimer = null;
    }
    if (this._wakeTimer) {
      clearTimeout(this._wakeTimer);
      this._wakeTimer = null;
    }
  }

  dispose() {
    this._clearJoinTimer();
    for (const off of this._unsubs) off();
    this._unsubs = [];
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('pointerdown', this._resumeVoice);
    window.removeEventListener('keydown', this._resumeVoice);
    this.voice.disable();
    this.remotes.clear();
    this.client.leave();
  }
}
