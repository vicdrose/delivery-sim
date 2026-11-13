const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 12000];
const OPEN_TIMEOUT_MS = 45000;

export class MultiplayerClient {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.id = null;
    this.code = null;
    this.level = '1-1';
    this.hostId = null;
    this.inRoom = false;
    this._name = '';
    this._url = '';
    this._intent = null;
    this._attempt = 0;
    this._reconnectTimer = null;
    this._closedByUser = false;
    this._openReject = null;
  }

  get connected() {
    return !!this.ws && this.ws.readyState === 1;
  }

  async createRoom({ url, name, level }) {
    this._name = String(name || '').trim().slice(0, 16);
    this._url = url;
    this._intent = { type: 'create', level };
    this._closedByUser = false;
    this._attempt = 0;
    this.inRoom = false;
    await this._open();
  }

  async joinRoom({ url, name, code }) {
    this._name = String(name || '').trim().slice(0, 16);
    this._url = url;
    this._intent = { type: 'join', code: String(code || '').toUpperCase().trim() };
    this._closedByUser = false;
    this._attempt = 0;
    this.inRoom = false;
    await this._open();
  }

  sendState(state) {
    if (!this.connected || !this.inRoom) return;
    this._send({ t: 's', ...state });
  }

  sendSignal(to, data) {
    if (!this.connected || !this.inRoom || !to || !data) return;
    this._send({ t: 'v', to, data });
  }

  leave() {
    this._closedByUser = true;
    this.inRoom = false;
    this.id = null;
    this.code = null;
    this.hostId = null;
    this._intent = null;
    this._attempt = 0;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      try {
        ws.close(1000, 'Leaving');
      } catch {
        void 0;
      }
    }
    this.handlers.onStatus?.({ state: 'idle' });
  }

  _open() {
    return new Promise((resolve, reject) => {
      this.handlers.onStatus?.({ state: 'connecting' });
      let settled = false;
      let opened = false;
      let ws = null;
      try {
        ws = new WebSocket(this._url);
      } catch {
        reject(new Error('That multiplayer server address is not valid.'));
        return;
      }
      this.ws = ws;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
          void 0;
        }
        reject(new Error('Timed out connecting to the multiplayer server.'));
      }, OPEN_TIMEOUT_MS);
      this._openReject = reject;

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        opened = true;
        clearTimeout(timer);
        this._openReject = null;
        this._sendIntent();
        resolve();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') this._onMessage(event.data);
      };

      ws.onclose = () => {
        clearTimeout(timer);
        this._openReject = null;
        const current = this.ws === ws;
        if (current) this.ws = null;
        if (!opened) {
          if (!settled) {
            settled = true;
            reject(new Error('Could not reach the multiplayer server.'));
          }
          return;
        }
        if (current) this._onDisconnected();
      };

      ws.onerror = () => {
        void 0;
      };
    });
  }

  _send(payload) {
    if (!this.ws || this.ws.readyState !== 1) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      void 0;
    }
  }

  _sendIntent() {
    if (!this._intent) return;
    if (this._intent.type === 'create') {
      this._send({ t: 'create', name: this._name, level: this._intent.level });
    } else {
      this._send({ t: 'join', name: this._name, code: this._intent.code });
    }
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'joined':
        this.id = msg.id;
        this.code = msg.code;
        this.level = msg.level || '1-1';
        this.hostId = msg.hostId;
        this.inRoom = true;
        this._intent = { type: 'join', code: this.code };
        this._attempt = 0;
        this.handlers.onJoined?.(msg);
        break;
      case 'roster':
        this.hostId = msg.hostId;
        this.handlers.onRoster?.(msg);
        break;
      case 'p':
        this.handlers.onPlayers?.(Array.isArray(msg.p) ? msg.p : []);
        break;
      case 'v':
        this.handlers.onVoice?.(msg.from, msg.data);
        break;
      case 'error':
        if (msg.code === 'ROOM_NOT_FOUND' || msg.code === 'ROOM_FULL') {
          this._intent = null;
          this.inRoom = false;
        }
        this.handlers.onError?.({ code: msg.code, message: msg.message });
        break;
      default:
        break;
    }
  }

  _onDisconnected() {
    if (this._closedByUser || !this.inRoom || !this._intent) {
      this.inRoom = false;
      this.handlers.onStatus?.({ state: 'idle' });
      return;
    }
    this.handlers.onStatus?.({ state: 'reconnecting', message: 'Connection lost. Reconnecting…' });
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this._attempt >= RECONNECT_DELAYS.length) {
      this.inRoom = false;
      this._intent = null;
      this.handlers.onError?.({ code: 'DISCONNECTED', message: 'Lost connection to the multiplayer server.' });
      return;
    }
    const delay = RECONNECT_DELAYS[this._attempt++];
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      try {
        await this._open();
      } catch {
        this._scheduleReconnect();
      }
    }, delay);
  }
}
