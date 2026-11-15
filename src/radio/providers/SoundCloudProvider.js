const URL_KEY = 'snackrun_soundcloud_url';
const SCRIPT_URL = 'https://w.soundcloud.com/player/api.js';
const LOAD_TIMEOUT_MS = 12000;
const SCRIPT_TIMEOUT_MS = 20000;

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

function normalize(raw) {
  let text = String(raw || '').trim();
  if (!text) return '';
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (host !== 'soundcloud.com' && !host.endsWith('.soundcloud.com')) return '';
    url.search = '';
    url.hash = '';
    const path = url.pathname.replace(/\/+$/, '');
    if (!path || path === '') return '';
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return '';
  }
}

export class SoundCloudProvider {
  constructor() {
    this.url = readText(URL_KEY);
    this.status = this.url ? 'idle' : 'unset';
    this.error = '';
    this.track = null;
    this.artist = null;
    this.playing = false;
    this.volume = 100;
    this._frame = null;
    this._frameUrl = '';
    this._widget = null;
    this._scriptPromise = null;
    this._ready = false;
    this._wanted = false;
    this._loadTimer = null;
    this._retryAt = 0;
    this._playRetries = 0;
    this._pollClock = 0;
    this._pollBusy = false;
    if (this.url) this._loadScript().catch(() => void 0);
  }

  get configured() {
    return !!this.url;
  }

  setUrl(value) {
    const next = normalize(value);
    if (!next) {
      this.error = 'Paste a public soundcloud.com profile or playlist link.';
      this.status = this.configured ? 'error' : 'unset';
      return false;
    }
    this.error = '';
    if (next === this.url && this._frame) {
      this._teardown();
      this.status = 'idle';
      if (this._wanted) this._ensureWidget();
      return true;
    }
    this.url = next;
    writeText(URL_KEY, next);
    this._teardown();
    this.status = 'idle';
    return true;
  }

  clear() {
    this.url = '';
    removeText(URL_KEY);
    this._teardown();
    this.status = 'unset';
    this.error = '';
    this.track = null;
    this.artist = null;
    this.playing = false;
  }

  play() {
    this._wanted = true;
    this._playRetries = 0;
    this._retryAt = 0;
    if (this.status === 'error' && !this._frame) {
      this.status = 'idle';
      this.error = '';
    }
    if (this._ready) {
      this._playNow();
      return;
    }
    this._ensureWidget();
  }

  pause() {
    this._wanted = false;
    this._playRetries = 0;
    this.playing = false;
    if (this._ready) {
      try {
        this._widget.pause();
      } catch {
        void 0;
      }
      if (this.status === 'playing') this.status = 'paused';
    }
  }

  next() {
    if (!this._ready) {
      this._ensureWidget();
      return;
    }
    try {
      this._widget.next();
    } catch {
      void 0;
    }
  }

  previous() {
    if (!this._ready) {
      this._ensureWidget();
      return;
    }
    try {
      this._widget.prev();
    } catch {
      void 0;
    }
  }

  setVolume(percent) {
    const value = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));
    this.volume = value;
    if (!this._ready) return;
    try {
      this._widget.setVolume(value);
    } catch {
      void 0;
    }
  }

  update(dt, active) {
    if (!this.configured) return;
    if (this._wanted && this._ready && !this.playing) {
      const now = performance.now();
      if (this._playRetries < 4 && now >= this._retryAt) {
        this._playRetries += 1;
        this._retryAt = now + 2000;
        this._playNow();
      }
    }
    if (!active && this._wanted && this.playing) this.pause();
    this._pollClock += dt;
    if (this._pollClock >= 2) {
      this._pollClock = 0;
      this._poll();
    }
  }

  snapshot() {
    return {
      configured: this.configured,
      url: this.url,
      status: this.status,
      track: this.track,
      artist: this.artist,
      playing: this.playing,
      error: this.error
    };
  }

  reset() {
    this._wanted = false;
    this._teardown();
    this.track = null;
    this.artist = null;
    this.playing = false;
    this.error = '';
    this.status = this.configured ? 'idle' : 'unset';
  }

  _teardown() {
    this._ready = false;
    this._wanted = false;
    this._playRetries = 0;
    this._widget = null;
    this._frameUrl = '';
    if (this._loadTimer) {
      clearTimeout(this._loadTimer);
      this._loadTimer = null;
    }
    if (this._frame) {
      this._frame.remove();
      this._frame = null;
    }
  }

  _armLoadTimer(frame, ms) {
    if (this._loadTimer) clearTimeout(this._loadTimer);
    this._loadTimer = setTimeout(() => {
      this._loadTimer = null;
      if (this._ready || this._frame !== frame) return;
      this.status = 'error';
      this.error = 'That SoundCloud link did not load. Use a public profile or playlist.';
      this._teardown();
    }, ms);
  }

  _applyVolume() {
    try {
      this._widget.setVolume(this.volume);
    } catch {
      void 0;
    }
  }

  _playNow() {
    if (!this._ready || !this._widget) return;
    this._applyVolume();
    try {
      this._widget.play();
    } catch {
      void 0;
    }
  }

  _poll() {
    if (!this._ready || !this._widget || this._pollBusy) return;
    this._pollBusy = true;
    let settled = false;
    const done = () => {
      settled = true;
      this._pollBusy = false;
    };
    const timer = setTimeout(() => {
      if (!settled) done();
    }, 4000);
    try {
      this._widget.getCurrentSound((sound) => {
        if (sound) {
          this.track = sound.title || null;
          this.artist = sound.user ? sound.user.username || null : null;
        }
        this._widget.isPaused((paused) => {
          if (settled) return;
          if (typeof paused === 'boolean') {
            if (paused) this.playing = false;
            else if (this._wanted) this.playing = true;
          }
          clearTimeout(timer);
          done();
        });
      });
    } catch {
      clearTimeout(timer);
      done();
    }
  }

  _ensureWidget() {
    if (!this.configured || typeof document === 'undefined') return;
    if (this._frame && this._frameUrl === this.url) return;
    this._teardown();
    this._wanted = true;
    this.status = 'loading';
    this.error = '';
    const frame = document.createElement('iframe');
    frame.title = 'SoundCloud player';
    frame.setAttribute('allow', 'autoplay; encrypted-media');
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('frameborder', 'no');
    frame.src =
      'https://w.soundcloud.com/player/?url=' +
      encodeURIComponent(this.url) +
      '&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false';
    frame.style.position = 'fixed';
    frame.style.left = '-9999px';
    frame.style.top = '0';
    frame.style.width = '320px';
    frame.style.height = '180px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    document.body.appendChild(frame);
    this._frame = frame;
    this._frameUrl = this.url;
    this._armLoadTimer(frame, SCRIPT_TIMEOUT_MS);
    this._loadScript()
      .then((SC) => {
        if (this._frame !== frame) return;
        if (!SC || !SC.Widget) throw new Error('widget unavailable');
        const widget = SC.Widget(frame);
        this._widget = widget;
        this._armLoadTimer(frame, LOAD_TIMEOUT_MS);
        widget.bind(SC.Widget.Events.READY, () => {
          if (this._frame !== frame) return;
          this._ready = true;
          if (this._loadTimer) {
            clearTimeout(this._loadTimer);
            this._loadTimer = null;
          }
          this.status = 'ready';
          this.error = '';
          this._applyVolume();
          if (this._wanted) this._playNow();
          this._poll();
        });
        widget.bind(SC.Widget.Events.PLAY, () => {
          if (this._frame !== frame) return;
          this.playing = true;
          this.status = 'playing';
          this._playRetries = 0;
          this._poll();
        });
        widget.bind(SC.Widget.Events.PAUSE, () => {
          if (this._frame !== frame) return;
          this.playing = false;
          if (this.status === 'playing') this.status = 'paused';
        });
        widget.bind(SC.Widget.Events.FINISH, () => {
          if (this._frame !== frame) return;
          this.playing = false;
          this.status = 'paused';
          this._wanted = false;
        });
        widget.bind(SC.Widget.Events.ERROR, () => {
          if (this._frame !== frame) return;
          this.status = 'error';
          this.error = 'SoundCloud could not play that link. Use a public profile or playlist.';
        });
      })
      .catch(() => {
        if (this._frame !== frame) return;
        this.status = 'error';
        this.error = 'The SoundCloud player script could not load.';
      });
  }

  _loadScript() {
    if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
    if (window.SC && window.SC.Widget) return Promise.resolve(window.SC);
    if (this._scriptPromise) return this._scriptPromise;
    this._scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => (window.SC && window.SC.Widget ? resolve(window.SC) : reject(new Error('no SC')));
      script.onerror = () => reject(new Error('script blocked'));
      document.head.appendChild(script);
    });
    this._scriptPromise.catch(() => {
      this._scriptPromise = null;
    });
    return this._scriptPromise;
  }
}
