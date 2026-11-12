const NAME_KEY = 'snackrun_mp_name';
const SERVER_KEY = 'snackrun_mp_server';
const VOICE_KEY = 'snackrun_mp_voice';
const MIC_KEY = 'snackrun_mp_micmuted';

const ADJECTIVES = [
  'FAST', 'LATE', 'HOT', 'LUCKY', 'NIGHT', 'CITY', 'ROAD', 'SODA',
  'TACO', 'MINT', 'TURBO', 'SUNNY', 'QUIET', 'BRAVE', 'SNAPPY', 'PEPPER'
];
const NOUNS = [
  'DRIVER', 'RUNNER', 'COURIER', 'RIDER', 'DASHER', 'GOPHER',
  'SPRINTER', 'DELIVERY', 'CRUISER', 'HAULER', 'SHIFTER', 'SCOUT'
];

function read(key, fallback = '') {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    void 0;
  }
}

export function defaultServerUrl() {
  const env = import.meta.env.VITE_MULTIPLAYER_URL;
  if (env) return normalizeServerUrl(env);
  const host = window.location.hostname || '127.0.0.1';
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${host}:2567`;
  }
  return 'wss://snackrun-multiplayer.onrender.com';
}

export function normalizeServerUrl(raw) {
  let text = String(raw || '').trim();
  if (!text) return defaultServerUrl();
  if (/^https:\/\//i.test(text)) text = `wss://${text.slice(8)}`;
  else if (/^http:\/\//i.test(text)) text = `ws://${text.slice(7)}`;
  else if (!/^wss?:\/\//i.test(text)) {
    const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    text = proto + text;
  }
  return text.replace(/\/+$/, '');
}

export function randomName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = String(Math.floor(Math.random() * 900) + 100);
  return `${a}-${n}-${num}`;
}

export function loadName() {
  const stored = read(NAME_KEY).trim().slice(0, 16);
  return stored || randomName();
}

export function saveName(name) {
  write(NAME_KEY, String(name || '').trim().slice(0, 16));
}

export function loadServerUrl() {
  return normalizeServerUrl(read(SERVER_KEY, '') || defaultServerUrl());
}

export function saveServerUrl(url) {
  write(SERVER_KEY, normalizeServerUrl(url));
}

export function loadVoiceEnabled() {
  return read(VOICE_KEY, '1') !== '0';
}

export function saveVoiceEnabled(enabled) {
  write(VOICE_KEY, enabled ? '1' : '0');
}

export function loadMicMuted() {
  return read(MIC_KEY, '0') === '1';
}

export function saveMicMuted(muted) {
  write(MIC_KEY, muted ? '1' : '0');
}
