import { reactive } from 'vue';

let toastId = 1;

export const ui = reactive({
  screen: 'title',
  paused: false,
  muted: false,
  padConnected: false,

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
  nearGasStation: false,

  radio: { on: true, track: null, hasTracks: false },

  minimapStatic: null,
  blipsPlayer: { x: 0, z: 0, yaw: 0 },
  blipsCar: null,
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
