import { ui } from '../ui/store.js';

const VOICE_RANGE = 75;
const VOICE_FULL = 20;

export class VoiceChat {
  constructor(client) {
    this.client = client;
    this.id = null;
    this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    this.peers = new Map();
    this.audio = new Map();
    this.distances = new Map();
    this.stream = null;
    this.track = null;
    this.ready = false;
    this.enabled = false;
    this.muted = false;
    this.talking = false;
    this.ctx = null;
    this._pending = null;
    this._retry = new Map();
  }

  setId(id) {
    this.id = id;
  }

  setIceServers(list) {
    if (Array.isArray(list) && list.length) this.iceServers = list;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.setTalking(false);
      this.closeAll();
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    this._applyGating();
  }

  resume() {
    this._ensureCtx();
  }

  async enable() {
    if (this.stream) {
      this._ensureCtx();
      this._applyGating();
      this._attachLocalTracks();
      return true;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      ui.multiplayer.voiceStatus = 'unsupported';
      return false;
    }
    if (this._pending) return this._pending;
    ui.multiplayer.voiceStatus = 'requesting';
    this._pending = (async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        this.track = this.stream.getAudioTracks()[0] || null;
        this.ready = !!this.track;
        this._ensureCtx();
        this._applyGating();
        this._attachLocalTracks();
        ui.multiplayer.voiceStatus = this.ready ? 'ready' : 'no-device';
        return this.ready;
      } catch (err) {
        this.ready = false;
        ui.multiplayer.voiceStatus = err && err.name === 'NotFoundError' ? 'no-device' : 'denied';
        return false;
      } finally {
        this._pending = null;
      }
    })();
    return this._pending;
  }

  disable() {
    this.closeAll();
    this.setTalking(false);
    if (this.track) this.track.stop();
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
    }
    this.stream = null;
    this.track = null;
    this.ready = false;
    ui.multiplayer.voiceStatus = 'off';
    if (this.ctx) {
      this.ctx.close().catch(() => {
        void 0;
      });
      this.ctx = null;
    }
  }

  setTalking(value) {
    const next = !!value && this.enabled && this.ready && !this.muted;
    if (next) this._ensureCtx();
    if (next === this.talking) return;
    this.talking = next;
    this._applyGating();
  }

  setDistances(map) {
    this.distances = map;
    if (!this.ctx) return;
    for (const [id, dist] of map) {
      const entry = this.audio.get(id);
      if (entry) entry.gain.gain.setTargetAtTime(this._gainFor(dist), this.ctx.currentTime, 0.12);
    }
  }

  sync(ids) {
    if (!this.enabled) {
      if (this.peers.size) this.closeAll();
      return;
    }
    const wanted = new Set(ids);
    const now = performance.now();
    for (const id of wanted) {
      if (!id || id === this.id || this.peers.has(id)) continue;
      const retryAt = this._retry.get(id);
      if (retryAt && retryAt > now) continue;
      this._retry.delete(id);
      this._createPeer(id);
    }
    for (const id of [...this.peers.keys()]) {
      if (!wanted.has(id)) this._closePeer(id);
    }
  }

  handleSignal(from, data) {
    if (!this.enabled || !from || !data) return;
    if (data.kind === 'description' && data.description) {
      this._onDescription(from, data.description);
    } else if (data.kind === 'ice' && data.candidate) {
      this._onCandidate(from, data.candidate);
    }
  }

  _createPeer(peerId) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const entry = {
      pc,
      polite: String(this.id || '') > String(peerId),
      makingOffer: false,
      ignoreOffer: false,
      remoteSet: false,
      pending: [],
      closed: false
    };
    this.peers.set(peerId, entry);

    pc.onnegotiationneeded = async () => {
      if (entry.closed) return;
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          this._send(peerId, { kind: 'description', description: pc.localDescription });
        }
      } catch {
        void 0;
      } finally {
        entry.makingOffer = false;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) this._send(peerId, { kind: 'ice', candidate: event.candidate });
    };

    pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      this._attachAudio(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') this._retry.delete(peerId);
      if (pc.connectionState === 'failed') this._closePeer(peerId, true);
    };

    if (this.stream) {
      for (const track of this.stream.getTracks()) pc.addTrack(track, this.stream);
    }

    return entry;
  }

  _attachLocalTracks() {
    if (!this.stream) return;
    for (const entry of this.peers.values()) {
      if (entry.closed) continue;
      for (const track of this.stream.getTracks()) {
        const sender = entry.pc.getSenders().find((s) => s.track === track);
        if (!sender) entry.pc.addTrack(track, this.stream);
      }
    }
  }

  stats() {
    let connected = 0;
    let failed = 0;
    for (const entry of this.peers.values()) {
      if (entry.pc.connectionState === 'connected') connected++;
      else if (entry.pc.connectionState === 'failed') failed++;
    }
    return { total: this.peers.size, connected, failed };
  }

  async _onDescription(peerId, description) {
    let entry = this.peers.get(peerId);
    if (!entry) {
      if (description.type !== 'offer') return;
      entry = this._createPeer(peerId);
    }
    const pc = entry.pc;
    const collision = description.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable');
    entry.ignoreOffer = !entry.polite && collision;
    if (entry.ignoreOffer) return;
    try {
      if (collision) {
        await Promise.all([pc.setLocalDescription({ type: 'rollback' }), pc.setRemoteDescription(description)]);
      } else {
        await pc.setRemoteDescription(description);
      }
      entry.remoteSet = true;
      for (const candidate of entry.pending.splice(0)) {
        pc.addIceCandidate(candidate).catch(() => {
          void 0;
        });
      }
      if (description.type === 'offer') {
        await pc.setLocalDescription();
        this._send(peerId, { kind: 'description', description: pc.localDescription });
      }
    } catch {
      this._closePeer(peerId);
    }
  }

  _onCandidate(peerId, candidate) {
    let entry = this.peers.get(peerId);
    if (!entry) entry = this._createPeer(peerId);
    if (entry.remoteSet) {
      entry.pc.addIceCandidate(candidate).catch(() => {
        void 0;
      });
    } else {
      entry.pending.push(candidate);
    }
  }

  _send(peerId, data) {
    this.client.sendSignal(peerId, data);
  }

  _attachAudio(peerId, stream) {
    this._ensureCtx();
    if (!this.ctx) return;
    const existing = this.audio.get(peerId);
    if (existing) {
      existing.source.disconnect();
      existing.gain.disconnect();
    }
    const source = this.ctx.createMediaStreamSource(stream);
    const gain = this.ctx.createGain();
    gain.gain.value = this._gainFor(this.distances.get(peerId) ?? VOICE_FULL);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    this.audio.set(peerId, { source, gain });
  }

  _gainFor(distance) {
    if (!Number.isFinite(distance) || distance >= VOICE_RANGE) return 0;
    if (distance <= VOICE_FULL) return 1;
    return Math.max(0, 1 - (distance - VOICE_FULL) / (VOICE_RANGE - VOICE_FULL));
  }

  _applyGating() {
    if (this.track) this.track.enabled = this.talking && !this.muted;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        void 0;
      });
    }
  }

  _closePeer(peerId, retry = false) {
    const entry = this.peers.get(peerId);
    if (entry) {
      entry.closed = true;
      try {
        entry.pc.onnegotiationneeded = null;
        entry.pc.onicecandidate = null;
        entry.pc.ontrack = null;
        entry.pc.onconnectionstatechange = null;
        entry.pc.close();
      } catch {
        void 0;
      }
      this.peers.delete(peerId);
    }
    const audio = this.audio.get(peerId);
    if (audio) {
      try {
        audio.source.disconnect();
        audio.gain.disconnect();
      } catch {
        void 0;
      }
      this.audio.delete(peerId);
    }
    if (retry) this._retry.set(peerId, performance.now() + 5000);
  }

  closeAll() {
    for (const id of [...this.peers.keys()]) this._closePeer(id);
    this._retry.clear();
  }
}
