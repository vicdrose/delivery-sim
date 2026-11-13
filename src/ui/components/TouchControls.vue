<template>
  <div v-if="mobile" class="touch-controls">
    <button class="touch-btn pause-btn" @pointerdown="pause">II</button>

    <div
      ref="stick"
      class="stick-base"
      @pointerdown="onStickDown"
      @pointermove="onStickMove"
      @pointerup="onStickUp"
      @pointercancel="onStickUp"
    >
      <div class="stick-thumb" :style="thumbStyle"></div>
      <div class="stick-label l-lbl">A</div>
      <div class="stick-label r-lbl">D</div>
      <div class="stick-label u-lbl">W</div>
      <div class="stick-label d-lbl">S</div>
    </div>

    <button
      class="touch-btn action-btn"
      :class="{ pulse: ui.actionPressed, running: ui.sprintPressed }"
      @pointerdown="actionDown"
      @pointerup="actionUp"
      @pointercancel="actionUp"
      @lostpointercapture="actionUp"
    >{{ actionLabel }}</button>

    <button
      v-if="showMic"
      class="touch-btn mic-btn"
      :class="{ live: ui.voiceHeld }"
      @pointerdown="micDown"
      @pointerup="micUp"
      @pointercancel="micUp"
      @lostpointercapture="micUp"
    >MIC</button>

    <button v-if="showRepair" class="touch-btn wrench-btn" @pointerdown="repair">⚙</button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { ui, isMobileUI } from '../store.js';

const mobile = computed(() => isMobileUI() && ui.screen === 'playing');
const stick = ref(null);
const dx = ref(0);
const dy = ref(0);
const active = ref(false);

const RADIUS = 58;

watch([mobile, () => ui.paused], ([shown, paused]) => {
  if (!shown || paused) ui.sprintPressed = false;
});

onBeforeUnmount(() => {
  ui.sprintPressed = false;
});

const thumbStyle = computed(() => ({
  transform: `translate(${dx.value}px, ${dy.value}px)`
}));

function onStickDown(e) {
  active.value = true;
  stick.value.setPointerCapture(e.pointerId);
  update(e);
}

function onStickMove(e) {
  if (!active.value) return;
  update(e);
}

function onStickUp() {
  active.value = false;
  dx.value = 0;
  dy.value = 0;
  ui.moveX = 0;
  ui.moveY = 0;
  ui.joystickActive = false;
}

function update(e) {
  const el = stick.value;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let x = e.clientX - cx;
  let y = e.clientY - cy;
  const len = Math.hypot(x, y);
  if (len > RADIUS) {
    x = (x / len) * RADIUS;
    y = (y / len) * RADIUS;
  }
  dx.value = x;
  dy.value = y;
  ui.moveX = x / RADIUS;
  ui.moveY = -y / RADIUS;
  ui.joystickActive = true;
}

function pulse(key) {
  ui[key] = true;
  setTimeout(() => { ui[key] = false; }, 90);
}

function actionDown(e) {
  e.currentTarget.setPointerCapture?.(e.pointerId);
  if (hasAction.value) {
    pulse('actionPressed');
  } else {
    ui.sprintPressed = true;
  }
}

function actionUp() {
  ui.sprintPressed = false;
}

function pause() {
  ui.sprintPressed = false;
  pulse('pausePressed');
}

function repair() {
  pulse('repairPressed');
}

function micDown(e) {
  e.currentTarget.setPointerCapture?.(e.pointerId);
  ui.voiceHeld = true;
}

function micUp() {
  ui.voiceHeld = false;
}

const showMic = computed(() => ui.multiplayer.inRoom && ui.multiplayer.voiceEnabled);

const showRepair = computed(() => ui.nearGasStation && ui.playerMode === 'foot' && ui.healthLevel < ui.healthMax);

const hasAction = computed(() => !!ui.offer || !!ui.prompt || ui.playerMode === 'drive');

const actionLabel = computed(() => {
  if (ui.offer) return 'ACCEPT';
  if (ui.prompt) return shortPrompt(ui.prompt);
  if (ui.playerMode === 'drive') return 'EXIT';
  return 'RUN';
});

function shortPrompt(p) {
  const s = p.replace(/·.*$/, '').trim();
  return s.length > 6 ? s.slice(0, 6) : s;
}
</script>

<style scoped>
.touch-controls {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 50;
}

.touch-btn {
  pointer-events: auto;
  position: fixed;
  border: 2px solid rgba(255, 255, 255, 0.55);
  background: rgba(29, 36, 48, 0.55);
  color: #fff;
  font-weight: 900;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  backdrop-filter: blur(3px);
}

.pause-btn {
  left: 14px;
  bottom: 14px;
  width: 46px;
  height: 46px;
  font-size: 16px;
  letter-spacing: 1px;
}

.action-btn {
  right: 22px;
  bottom: 42px;
  width: 88px;
  height: 88px;
  font-size: 22px;
  background: rgba(232, 97, 90, 0.8);
  border-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 6px 0 rgba(140, 40, 35, 0.6), 0 10px 24px rgba(0, 0, 0, 0.35);
}

.action-btn.pulse {
  transform: scale(0.92);
}

.action-btn.running {
  transform: scale(0.94);
  background: rgba(232, 97, 90, 1);
  box-shadow: 0 3px 0 rgba(140, 40, 35, 0.6), 0 0 18px rgba(232, 97, 90, 0.55);
}

.wrench-btn {
  right: 26px;
  bottom: 216px;
  width: 56px;
  height: 56px;
  font-size: 22px;
  background: rgba(242, 165, 65, 0.85);
  border-color: rgba(255, 255, 255, 0.85);
}

.mic-btn {
  right: 128px;
  bottom: 62px;
  width: 64px;
  height: 64px;
  font-size: 13px;
  background: rgba(76, 201, 240, 0.8);
  border-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 5px 0 rgba(22, 92, 116, 0.6);
}

.mic-btn.live {
  background: rgba(158, 240, 26, 0.92);
  color: #1d2430;
  box-shadow: 0 0 18px rgba(158, 240, 26, 0.7);
}

.stick-base {
  pointer-events: auto;
  position: fixed;
  left: 14px;
  bottom: 66px;
  width: 148px;
  height: 148px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06));
  border: 3px solid rgba(255, 255, 255, 0.35);
  touch-action: none;
}

.stick-thumb {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 64px;
  height: 64px;
  margin: -32px 0 0 -32px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.95), rgba(180, 190, 205, 0.85));
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stick-label {
  position: absolute;
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  font-weight: 900;
  pointer-events: none;
}

.l-lbl { left: 8px; top: 50%; transform: translateY(-50%); }
.r-lbl { right: 8px; top: 50%; transform: translateY(-50%); }
.u-lbl { top: 6px; left: 50%; transform: translateX(-50%); }
.d-lbl { bottom: 6px; left: 50%; transform: translateX(-50%); }
</style>
