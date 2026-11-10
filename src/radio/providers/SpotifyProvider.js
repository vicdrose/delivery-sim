const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const CLIENT_KEY = 'snackrun_spotify_client_id';
const TOKEN_KEY = 'snackrun_spotify_token';
const VERIFIER_KEY = 'snackrun_spotify_verifier';
const STATE_KEY = 'snackrun_spotify_state';

function readText(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeText(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    void 0;
  }
}

function removeText(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    void 0;
  }
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    void 0;
  }
}

function base64Url(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes).slice(0, length);
}

async function pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(new Uint8Array(digest));
}

const SUCCESS_STATUSES = new Set(['idle', 'playing', 'paused', 'no_device']);

export class SpotifyProvider {
  constructor() {
    this.clientId = readText(CLIENT_KEY);
    this.token = readJson(TOKEN_KEY);
    this.status = this.token ? 'idle' : 'disconnected';
    this.error = '';
    this.track = null;
    this.artist = null;
    this.playing = false;
    this.deviceName = '';
    this._pollTimer = 0;
    this._polling = false;
    this._refreshPromise = null;
    this._ready = this._handleRedirect();
  }

  get redirectUri() {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    let path = url.pathname;
    if (path.endsWith('/index.html')) path = path.slice(0, -'index.html'.length);
    if (!path.endsWith('/')) path += '/';
    return url.origin + path;
  }

  get configured() {
    return !!this.clientId;
  }

  get connected() {
    return !!(this.token && (this.token.access_token || this.token.refresh_token));
  }

  setClientId(value) {
    this.clientId = String(value || '').trim();
    if (this.clientId) writeText(CLIENT_KEY, this.clientId);
    else removeText(CLIENT_KEY);
    if (!this.connected) {
      this.status = 'disconnected';
      this.error = '';
    }
  }

  async connect() {
    if (!this.clientId) {
      this.status = 'missing_client';
      this.error = 'Add a Spotify client ID first.';
      return false;
    }
    if (!window.crypto || !window.crypto.subtle) {
      this.status = 'insecure';
      this.error = 'Spotify login needs HTTPS or localhost.';
      return false;
    }
    const verifier = randomString(64);
    const state = randomString(24);
    const challenge = await pkceChallenge(verifier);
    writeText(VERIFIER_KEY, verifier);
    writeText(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
      scope: SCOPES
    });
    window.location.href = `${AUTH_URL}?${params.toString()}`;
    return true;
  }

  async disconnect() {
    if (this.connected) await this.pause();
    this.token = null;
    this.status = 'disconnected';
    this.error = '';
    this.track = null;
    this.artist = null;
    this.playing = false;
    this.deviceName = '';
    removeText(TOKEN_KEY);
  }

  async _handleRedirect() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    if (!code && !error) return;
    const expected = readText(STATE_KEY);
    const verifier = readText(VERIFIER_KEY);
    removeText(STATE_KEY);
    removeText(VERIFIER_KEY);
    this._cleanUrl();
    if (error) {
      this.status = 'auth';
      this.error = 'Spotify authorization was cancelled.';
      return;
    }
    if (!state || state !== expected || !verifier) {
      this.status = 'auth';
      this.error = 'Spotify login could not be verified. Try connecting again.';
      return;
    }
    try {
      await this._exchange(code, verifier);
      this.status = 'idle';
      this.error = '';
      this._pollTimer = 0;
    } catch {
      this.status = 'auth';
      this.error = 'Spotify login failed. Try connecting again.';
    }
  }

  _cleanUrl() {
    if (typeof window === 'undefined' || !window.history) return;
    const url = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, url);
  }

  async _exchange(code, verifier) {
    const body = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: verifier
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) throw new Error('token exchange failed');
    this._storeToken(await res.json());
  }

  _storeToken(data) {
    if (!data || !data.access_token) throw new Error('missing access token');
    this.token = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || (this.token && this.token.refresh_token) || '',
      expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      scope: data.scope || SCOPES
    };
    writeJson(TOKEN_KEY, this.token);
  }

  async _refresh() {
    if (this._refreshPromise) return this._refreshPromise;
    const refreshToken = this.token && this.token.refresh_token;
    if (!refreshToken) {
      this.token = null;
      removeText(TOKEN_KEY);
      this.status = 'auth';
      return false;
    }
    this._refreshPromise = (async () => {
      try {
        const body = new URLSearchParams({
          client_id: this.clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        });
        const res = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        if (!res.ok) {
          if (res.status === 400 || res.status === 401) {
            this.token = null;
            removeText(TOKEN_KEY);
            this.status = 'auth';
          }
          return false;
        }
        this._storeToken(await res.json());
        if (!SUCCESS_STATUSES.has(this.status) && this.status !== 'premium') this.status = 'idle';
        return true;
      } catch {
        this.status = 'offline';
        return false;
      } finally {
        this._refreshPromise = null;
      }
    })();
    return this._refreshPromise;
  }

  async _ensureToken() {
    if (!this.token) {
      this.status = this.configured ? 'auth' : 'missing_client';
      return false;
    }
    if (this.token.expires_at && this.token.expires_at - Date.now() > 60000) return true;
    return this._refresh();
  }

  _setError(status, message) {
    this.status = status;
    this.error = message;
  }

  async _request(path, options = {}, retried = false) {
    if (!(await this._ensureToken())) return { ok: false, status: 401, data: null };
    let res;
    try {
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token.access_token}`,
          ...(options.headers || {})
        }
      });
    } catch {
      this._setError('offline', 'No connection to Spotify.');
      return { ok: false, status: 0, data: null };
    }
    if (res.status === 401 && !retried) {
      if (await this._refresh()) return this._request(path, options, true);
      this._setError('auth', 'Spotify session expired. Reconnect.');
      return { ok: false, status: 401, data: null };
    }
    if (res.status === 204) return { ok: true, status: 204, data: null };
    if (res.status === 403) {
      this._setError('premium', 'Spotify Premium is required for playback control.');
      return { ok: false, status: 403, data: null };
    }
    if (res.status === 404) {
      this._setError('no_device', 'Open Spotify on your phone, then try again.');
      return { ok: false, status: 404, data: null };
    }
    if (res.status === 429) {
      this._setError('rate', 'Spotify is rate limiting. Give it a moment.');
      return { ok: false, status: 429, data: null };
    }
    if (!res.ok) {
      this._setError('error', `Spotify returned ${res.status}.`);
      return { ok: false, status: res.status, data: null };
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: true, status: res.status, data };
  }

  async _command(method, path) {
    const res = await this._request(path, { method });
    if (res.ok) {
      this.error = '';
      if (this.status !== 'no_device') this.status = this.playing ? 'playing' : 'idle';
    }
    return res;
  }

  async play() {
    if (!this.connected) {
      this.status = this.configured ? 'auth' : 'missing_client';
      return false;
    }
    const res = await this._command('PUT', '/me/player/play');
    if (res.ok) {
      this.playing = true;
      this.status = 'playing';
      this._pollTimer = 0;
      this.poll();
      return true;
    }
    return false;
  }

  async pause() {
    if (!this.connected) return false;
    const res = await this._command('PUT', '/me/player/pause');
    if (res.ok) {
      this.playing = false;
      this.status = 'paused';
      this._pollTimer = 0;
      return true;
    }
    return false;
  }

  async next() {
    if (!this.connected) return false;
    const res = await this._command('POST', '/me/player/next');
    if (res.ok) this._pollTimer = 0.6;
    return res.ok;
  }

  async previous() {
    if (!this.connected) return false;
    const res = await this._command('POST', '/me/player/previous');
    if (res.ok) this._pollTimer = 0.6;
    return res.ok;
  }

  async poll() {
    if (this._polling || !this.connected) return;
    this._polling = true;
    const res = await this._request('/me/player');
    this._polling = false;
    if (!res.ok) {
      this._pollTimer = 6;
      return;
    }
    const data = res.data;
    if (!data) {
      this.track = null;
      this.artist = null;
      this.playing = false;
      this.deviceName = '';
      this.status = 'no_device';
      this._pollTimer = 6;
      return;
    }
    const item = data.item;
    this.track = item ? item.name : null;
    this.artist = item && item.artists ? item.artists.map((a) => a.name).join(', ') : null;
    this.playing = !!data.is_playing;
    this.deviceName = data.device ? data.device.name || '' : '';
    this.status = this.playing ? 'playing' : 'paused';
    this.error = '';
    this._pollTimer = 4;
  }

  update(dt, active) {
    if (!this.connected) {
      if (this.status !== 'missing_client' && this.status !== 'auth') {
        this.status = 'disconnected';
      }
      return;
    }
    if (!active) return;
    this._pollTimer -= dt;
    if (this._pollTimer <= 0) {
      this._pollTimer = 4;
      this.poll();
    }
  }

  reset() {
    this.clientId = '';
    this.token = null;
    this.status = 'disconnected';
    this.error = '';
    this.track = null;
    this.artist = null;
    this.playing = false;
    this.deviceName = '';
    this._pollTimer = 0;
    removeText(CLIENT_KEY);
    removeText(TOKEN_KEY);
    removeText(VERIFIER_KEY);
    removeText(STATE_KEY);
  }

  snapshot() {
    return {
      track: this.track,
      artist: this.artist,
      playing: this.playing,
      status: this.status,
      configured: this.configured,
      connected: this.connected,
      clientId: this.clientId,
      deviceName: this.deviceName,
      error: this.error,
      redirectUri: this.redirectUri
    };
  }
}
