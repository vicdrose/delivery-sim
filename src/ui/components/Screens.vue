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
      <button class="btn ghost" @click="ui.pauseMenu = 'sound'">SOUND</button>
      <button class="btn ghost" @click="ui.pauseMenu = 'spotify'">SPOTIFY</button>
      <button class="btn ghost" @click="handleToggleTraffic">TRAFFIC (BETA): {{ ui.trafficEnabled ? 'ON' : 'OFF' }}</button>
      <button class="btn ghost" @click="handleToggleMobile">TOUCH CONTROLS: {{ ui.mobileOverride === null ? (detectedMobile ? 'AUTO (ON)' : 'AUTO (OFF)') : (ui.mobileOverride ? 'ON' : 'OFF') }}</button>
      <button class="btn ghost" @click="handleUiScale">{{ uiScaleLabel() }}</button>
      <button class="btn danger" @click="handleReset">{{ resetArmed ? 'CONFIRM RESET?' : 'RESET GAME DATA' }}</button>
      <button class="btn ghost" @click="ui.pauseMenu = 'main'">BACK</button>
    </div>

    <div v-else-if="ui.pauseMenu === 'sound'" class="pause-card sound-card">
      <h2>SOUND</h2>
      <button class="btn ghost" @click="toggleMute">{{ ui.muted ? 'MASTER SOUND: OFF' : 'MASTER SOUND: ON' }}</button>
      <div class="volume-setting">
        <div class="volume-setting-head">
          <span>RADIO VOLUME</span>
          <span class="volume-setting-value">{{ radioVolumePct }}%</span>
        </div>
        <input
          class="volume-range"
          type="range"
          min="0"
          max="200"
          step="5"
          aria-label="Radio volume"
          :value="radioVolumePct"
          @input="onRadioVolume"
        />
        <div class="volume-scale"><span>0%</span><span>100%</span><span>200%</span></div>
      </div>
      <p class="volume-note">R3 in game opens the radio volume slider. Rotate the right stick clockwise to raise it, counterclockwise to lower it. When SPOTIFY is the selected station, this also sets Spotify's volume (0-100%).</p>
      <button class="btn ghost" @click="ui.pauseMenu = 'settings'">BACK</button>
    </div>

    <div v-else-if="ui.pauseMenu === 'spotify'" class="pause-card spotify-card">
      <h2>SPOTIFY</h2>
      <div class="spotify-status" :class="ui.radio.spotify.connected ? 'ok' : 'idle'">
        <span class="spotify-dot"></span>
        <span>{{ ui.radio.spotify.connected ? 'CONNECTED' : 'NOT CONNECTED' }}</span>
        <span v-if="ui.radio.spotify.deviceName" class="spotify-device">{{ ui.radio.spotify.deviceName }}</span>
      </div>
      <p class="spotify-note">
        SNACKRUN controls the Spotify app already running on your phone. Spotify keeps
        playing its own audio. Playback control needs Spotify Premium and an active device.
      </p>
      <label class="spotify-field">
        <span>CLIENT ID</span>
        <input
          class="spotify-input"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="Paste your Spotify app client ID"
          :value="ui.radio.spotify.clientId"
          @input="onClientId"
        />
      </label>
      <div class="spotify-redirect">
        <span class="spotify-redirect-label">REDIRECT URI</span>
        <code>{{ ui.radio.spotify.redirectUri }}</code>
        <button class="btn ghost tiny" @click="copyRedirect">COPY</button>
      </div>
      <p v-if="ui.radio.spotify.error" class="spotify-error">{{ ui.radio.spotify.error }}</p>
      <button class="btn primary" @click="connectSpotify">
        {{ ui.radio.spotify.connected ? 'RECONNECT SPOTIFY' : 'CONNECT SPOTIFY' }}
      </button>
      <button v-if="ui.radio.spotify.connected" class="btn danger" @click="disconnectSpotify">
        DISCONNECT SPOTIFY
      </button>
      <div class="spotify-steps">
        <div>1. Create an app at developer.spotify.com/dashboard</div>
        <div>2. Add the redirect URI above to that app</div>
        <div>3. Paste the client ID here and connect</div>
        <div>4. Open Spotify on the phone before selecting the station</div>
      </div>
      <button class="btn ghost" @click="ui.pauseMenu = 'settings'">BACK</button>
    </div>

    <div v-else-if="ui.pauseMenu === 'songs'" class="pause-card songs-card">
      <h2>SONG CHOICE</h2>
      <p v-if="!ui.radio.hasTracks" class="songs-empty">No radio songs loaded.<br>Drop music files into src/audio/tracks/radio/</p>
      <div v-else class="song-list">
        <div
          v-for="t in ui.radio.tracks"
          :key="t.name"
          class="song-row"
          :class="{ 'song-off': !t.enabled }"
        >
          <button class="song-toggle" @click="toggleSong(t)">
            <span class="song-name">{{ t.name }}</span>
            <span class="song-state" :class="t.enabled ? 'on' : 'off'">{{ t.enabled ? 'ON' : 'OFF' }}</span>
          </button>
          <div class="song-volume">
            <input
              class="volume-range song-range"
              type="range"
              min="0"
              max="200"
              step="5"
              :aria-label="'Volume for ' + t.name"
              :value="songVolumePct(t)"
              @input="onSongVolume(t, $event)"
            />
            <span class="song-volume-value">{{ songVolumePct(t) }}%</span>
          </div>
        </div>
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
import { ui, toggleTraffic, setMobile, detectMobile, cycleUiScale, uiScaleLabel, toast } from '../store.js';
import { bus } from '../../core/bus.js';
import { CONFIG } from '../../config.js';

const controls = CONFIG.controlsHelp;
const padConnected = computed(() => ui.padConnected);
const padName = computed(() => ui.padName);
const radioVolumePct = computed(() => Math.round((ui.radio.volume ?? 1) * 100));
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
function handleUiScale() {
  cycleUiScale();
}
function toggleSong(t) {
  ui.pauseMenu = 'songs';
  bus.emit('ui:song', { name: t.name, enabled: !t.enabled });
}
function songVolumePct(t) {
  return Math.round((t.volume ?? 1) * 100);
}
function onRadioVolume(e) {
  bus.emit('ui:radio-volume', Number(e.target.value) / 100);
}
function onSongVolume(t, e) {
  bus.emit('ui:song-volume', { name: t.name, volume: Number(e.target.value) / 100 });
}
function onClientId(e) {
  bus.emit('ui:spotify-client-id', e.target.value);
}
function connectSpotify() {
  bus.emit('ui:spotify-connect');
}
function disconnectSpotify() {
  bus.emit('ui:spotify-disconnect');
}
async function copyRedirect() {
  try {
    await navigator.clipboard.writeText(ui.radio.spotify.redirectUri);
    toast('Redirect URI copied.', 'success', 2200);
  } catch {
    toast('Could not copy. Select the URI manually.', 'warn', 2600);
  }
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
