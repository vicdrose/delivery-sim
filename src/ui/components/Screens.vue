<template>
  <div v-if="ui.screen === 'title'" class="overlay title-screen">
    <div class="title-inner">
      <h1 class="game-title">SNACK<span>RUN</span></h1>
      <p class="tagline">drive · dash · deliver · repeat</p>
      <button class="btn primary big" @click="start">START SHIFT</button>
      <button v-if="canInstall" class="btn ghost install-btn" @click="installApp">INSTALL APP</button>
      <div class="controls-panel">
        <div v-for="row in controls" :key="row[0]" class="ctrl-row">
          <kbd>{{ row[0] }}</kbd><span>{{ row[1] }}</span>
        </div>
        <div v-if="padConnected" class="pad-note">Gamepad detected</div>
      </div>
    </div>
  </div>

  <div v-if="ui.screen === 'playing' && ui.paused" class="overlay pause-screen">
    <div class="pause-card">
      <h2>PAUSED</h2>
      <button class="btn primary" @click="resume">RESUME</button>
      <button class="btn ghost" @click="toggleMute">{{ ui.muted ? 'SOUND: OFF' : 'SOUND: ON' }}</button>
      <div class="controls-panel small">
        <div v-for="row in controls" :key="row[0]" class="ctrl-row">
          <kbd>{{ row[0] }}</kbd><span>{{ row[1] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ui } from '../store.js';
import { bus } from '../../core/bus.js';
import { CONFIG } from '../../config.js';

const controls = CONFIG.controlsHelp;
const padConnected = computed(() => ui.padConnected);

let deferredPrompt = null;
const canInstall = ref(false);

function onBeforeInstall(e) {
  e.preventDefault();
  deferredPrompt = e;
  canInstall.value = true;
}

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt = null;
  canInstall.value = false;
}

onMounted(() => window.addEventListener('beforeinstallprompt', onBeforeInstall));
onUnmounted(() => window.removeEventListener('beforeinstallprompt', onBeforeInstall));

function start() {
  bus.emit('ui:start');
}
function resume() {
  bus.emit('ui:pause', false);
}
function toggleMute() {
  bus.emit('ui:mute');
}
</script>
