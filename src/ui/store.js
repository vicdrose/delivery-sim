import { reactive } from 'vue';

let toastId = 1;

export function detectMobile() {
  const ua = (navigator.userAgent || '');
  const coarse =
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches) ||
    (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
  const width = window.innerWidth <= 1024;
  const regex = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i;
  const viaUA = regex.test(ua) || /Tablet|iPad/i.test(ua);
  return Boolean(coarse || width || viaUA);
}

export const ui = reactive({
  screen: 'title',
  paused: false,
  pauseMenu: 'main',
  muted: false,
  trafficEnabled: JSON.parse(localStorage.getItem('snackrun_traffic') ?? 'false'),
  padConnected: false,
  padName: '',

  mobileOverride: null,
  playerMode: 'drive',

  uiScale: 1,
  uiScaleOverride: null,

  moveX: 0,
  moveY: 0,
  joystickActive: false,
  actionPressed: false,
  pausePressed: false,
  repairPressed: false,
  handbrakePressed: false,
  sprintPressed: false,

  money: 0,
  todayEarned: 0,
  deliveriesToday: 0,
  day: 1,
  clock: '7:00 AM',
  phase: 'Morning',

  objective: null,
  offer: null,
  offerExpiry: -1,
  prompt: null,
  payment: null,
  bagSecured: null,
  shiftFlash: null,
  insideName: null,
  toasts: [],

  speedMph: 0,
  hasFood: false,
  timeLeftStr: '',
  timeFrac: 1,
  timeCritical: false,
  fuelLevel: 40,
  fuelMax: 40,
  healthLevel: 100,
  healthMax: 100,
  nearGasStation: false,

  radio: { on: true, track: null, hasTracks: false },

  levelId: '1-1',
  levels: [],
  vehicleId: 'car',

  minimapStatic: null,
  minimapHalf: 180,
  blipsPlayer: { x: 0, z: 0, yaw: 0 },
  blipsCar: null,
  blipsOther: [],
  blipsTarget: null
});

export function toast(msg, kind = 'info', dur = 3400) {
  const id = toastId++;
  ui.toasts = [...ui.toasts, { id, msg, kind }];
  setTimeout(() => {
    ui.toasts = ui.toasts.filter((t) => t.id !== id);
  }, dur);
}

export function showPayment(amount, onTime) {
  ui.payment = { amount, onTime, key: Date.now() };
  setTimeout(() => {
    if (ui.payment && Date.now() - ui.payment.key >= 2400) ui.payment = null;
  }, 2500);
}

export function showBagSecured(foodItem) {
  ui.bagSecured = { foodItem, key: Date.now() };
  setTimeout(() => {
    if (ui.bagSecured && Date.now() - ui.bagSecured.key >= 500) ui.bagSecured = null;
  }, 600);
}

export function showShiftFlash(text) {
  ui.shiftFlash = { text, key: Date.now() };
  setTimeout(() => {
    if (ui.shiftFlash && Date.now() - ui.shiftFlash.key >= 800) ui.shiftFlash = null;
  }, 900);
}

export function toggleTraffic() {
  ui.trafficEnabled = !ui.trafficEnabled;
  localStorage.setItem('snackrun_traffic', JSON.stringify(ui.trafficEnabled));
}

export function setMobile(force) {
  if (force === null || force === undefined) {
    const stored = localStorage.getItem('snackrun_mobile');
    ui.mobileOverride = stored === null ? null : stored === '1';
  } else {
    ui.mobileOverride = force;
    localStorage.setItem('snackrun_mobile', force ? '1' : '0');
  }
  applyUiScale();
}

export function isMobileUI() {
  return ui.mobileOverride !== null ? ui.mobileOverride : detectMobile();
}

const UI_SCALE_STEPS = [null, 1, 0.85, 0.7, 0.55, 0.45, 0.35];

export function computeUiScale() {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 720;
  if (isMobileUI()) return clamp(Math.min(vw, vh) / 430, 0.8, 1.1);
  const base = vh > vw ? vw / 1080 : Math.min(vw / 1920, vh / 1080);
  return clamp(base * 0.6, 0.45, 1.2);
}

export function applyUiScale() {
  const stored = localStorage.getItem('snackrun_uiscale');
  const parsed = stored === null ? null : Number(stored);
  ui.uiScaleOverride = parsed !== null && parsed > 0 ? parsed : null;
  ui.uiScale = ui.uiScaleOverride ?? computeUiScale();
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.setProperty('--ui', ui.uiScale.toFixed(3));
  }
}

export function cycleUiScale() {
  const idx = UI_SCALE_STEPS.findIndex((s) => s === ui.uiScaleOverride);
  const next = UI_SCALE_STEPS[(idx + 1) % UI_SCALE_STEPS.length];
  if (next === null) localStorage.removeItem('snackrun_uiscale');
  else localStorage.setItem('snackrun_uiscale', String(next));
  applyUiScale();
}

export function uiScaleLabel() {
  const pct = Math.round(ui.uiScale * 100);
  return ui.uiScaleOverride === null ? `UI SIZE: AUTO (${pct}%)` : `UI SIZE: ${pct}%`;
}

applyUiScale();
