<template>
  <div v-if="ui.screen === 'title'" class="overlay title-screen">
    <div class="title-inner">
      <h1 class="game-title">SNACK<span>RUN</span></h1>
      <p class="tagline">drive · dash · deliver · repeat</p>
      <div class="level-picker">
        <button
          v-for="lv in ui.levels"
          :key="lv.id"
          class="btn level-chip"
          :class="{ 'level-active': lv.id === ui.levelId }"
          :disabled="!lv.unlocked"
          @click="pickLevel(lv.id)"
        >
          <span class="level-code">{{ lv.id }}</span>
          <span class="level-name">{{ lv.name }}</span>
        </button>
      </div>
      <button class="btn primary big" @click="start">START SHIFT</button>
      <div class="controls-panel">
        <div v-for="row in controls" :key="row[0]" class="ctrl-row">
          <kbd>{{ row[0] }}</kbd><span>{{ row[1] }}</span>
        </div>
        <div v-if="padConnected" class="pad-note">Gamepad: {{ padName || 'detected' }}</div>
      </div>
    </div>
  </div>

  <div v-if="ui.screen === 'playing' && ui.paused" class="overlay pause-screen">
    <div v-if="ui.pauseMenu === 'main'" class="pause-card">
      <h2>PAUSED</h2>
      <button class="btn primary" @click="resume">RESUME</button>
      <button class="btn ghost" @click="ui.pauseMenu = 'levels'">LEVELS</button>
      <button class="btn ghost" @click="ui.pauseMenu = 'settings'">SETTINGS</button>
      <div class="controls-panel small">
        <div v-for="row in controls" :key="row[0]" class="ctrl-row">
          <kbd>{{ row[0] }}</kbd><span>{{ row[1] }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="ui.pauseMenu === 'settings'" class="pause-card">
      <h2>SETTINGS</h2>
      <button class="btn ghost" @click="ui.pauseMenu = 'songs'">SONG CHOICE</button>
      <button class="btn ghost" @click="toggleMute">{{ ui.muted ? 'SOUND: OFF' : 'SOUND: ON' }}</button>
      <button class="btn ghost" @click="handleToggleTraffic">TRAFFIC (BETA): {{ ui.trafficEnabled ? 'ON' : 'OFF' }}</button>
      <button class="btn ghost" @click="handleToggleMobile">TOUCH CONTROLS: {{ ui.mobileOverride === null ? (detectedMobile ? 'AUTO (ON)' : 'AUTO (OFF)') : (ui.mobileOverride ? 'ON' : 'OFF') }}</button>
      <button class="btn danger" @click="handleReset">{{ resetArmed ? 'CONFIRM RESET?' : 'RESET GAME DATA' }}</button>
      <button class="btn ghost" @click="ui.pauseMenu = 'main'">BACK</button>
    </div>

    <div v-else-if="ui.pauseMenu === 'songs'" class="pause-card songs-card">
      <h2>SONG CHOICE</h2>
      <p v-if="!ui.radio.hasTracks" class="songs-empty">No radio songs loaded.<br>Drop music files into src/audio/tracks/radio/</p>
      <div v-else class="song-list">
        <button v-for="t in ui.radio.tracks" :key="t.name" class="btn ghost song-row" @click="toggleSong(t)">
          <span class="song-name">{{ t.name }}</span>
          <span class="song-state" :class="t.enabled ? 'on' : 'off'">{{ t.enabled ? 'ON' : 'OFF' }}</span>
        </button>
      </div>
      <button class="btn ghost" @click="ui.pauseMenu = 'settings'">BACK</button>
    </div>

    <div v-else-if="ui.pauseMenu === 'levels'" class="pause-card">
      <h2>LEVELS</h2>
      <button
        v-for="lv in ui.levels"
        :key="lv.id"
        class="btn ghost level-chip"
        :class="{ 'level-active': lv.id === ui.levelId }"
        :disabled="!lv.unlocked"
        @click="pickLevel(lv.id)"
      >
        <span class="level-code">{{ lv.id }}</span>
        <span class="level-name">{{ lv.name }}</span>
      </button>
      <button class="btn ghost" @click="ui.pauseMenu = 'main'">BACK</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ui, toggleTraffic, setMobile, detectMobile } from '../store.js';
import { bus } from '../../core/bus.js';
import { CONFIG } from '../../config.js';

const controls = CONFIG.controlsHelp;
const padConnected = computed(() => ui.padConnected);
const padName = computed(() => ui.padName);
const detectedMobile = detectMobile();

watch(() => ui.paused, (v) => {
  if (!v) ui.pauseMenu = 'main';
});

function start() {
  bus.emit('ui:start');
}
function pickLevel(id) {
  if (id === ui.levelId) return;
  ui.levelId = id;
  bus.emit('ui:level', id);
}
function resume() {
  bus.emit('ui:pause', false);
}
function toggleMute() {
  bus.emit('ui:mute');
}
function handleToggleTraffic() {
  toggleTraffic();
}
function handleToggleMobile() {
  const next = ui.mobileOverride === null ? !detectedMobile : !ui.mobileOverride;
  setMobile(next);
}
function toggleSong(t) {
  ui.pauseMenu = 'songs';
  bus.emit('ui:song', { name: t.name, enabled: !t.enabled });
}
const resetArmed = ref(false);
let resetTimer = null;
function handleReset() {
  if (!resetArmed.value) {
    resetArmed.value = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resetArmed.value = false;
    }, 4000);
    return;
  }
  if (resetTimer) clearTimeout(resetTimer);
  resetArmed.value = false;
  bus.emit('ui:reset-data');
}
</script>
