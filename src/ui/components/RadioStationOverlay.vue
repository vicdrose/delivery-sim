<template>
  <div
    v-if="show"
    class="radio-selector"
    :class="[ui.radio.statusKind, { freestyle: freestyleActive }]"
  >
    <div class="radio-selector-head">
      <span class="radio-selector-title">{{ titleLine }}</span>
      <span class="radio-selector-hint">{{ hintLine }}</span>
      <div v-if="!freestyleActive" class="radio-selector-actions">
        <button
          v-if="showShuffle"
          class="radio-selector-power"
          :class="{ on: ui.radio.shuffle }"
          @click="toggleShuffle"
        >
          SHUFFLE {{ ui.radio.shuffle ? 'ON' : 'OFF' }}
        </button>
        <button class="radio-selector-power" :class="{ on: ui.radio.on }" @click="togglePower">
          POWER {{ ui.radio.on ? 'ON' : 'OFF' }}
        </button>
      </div>
    </div>
    <template v-if="freestyleActive">
      <div class="radio-freestyle">
        <div class="radio-freestyle-row">
          <span class="radio-freestyle-label">AUTO BEATS</span>
          <span class="radio-freestyle-value">{{ beatLine }}</span>
        </div>
        <div class="radio-freestyle-row">
          <span class="radio-freestyle-label">SHUFFLE</span>
          <span class="radio-freestyle-value">ON · {{ ui.radio.freestyle.count }} BEATS</span>
        </div>
        <div class="radio-freestyle-word">
          <span class="radio-freestyle-label">WORD</span>
          <span class="radio-freestyle-placeholder">{{ ui.radio.freestyle.word }} — CONTROL COMING SOON</span>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="radio-station-list">
        <button
          v-for="(station, index) in ui.radio.stations"
          :key="station.id"
          class="radio-station-row"
          :class="{ active: station.active }"
          @click="pick(station.id)"
        >
          <span class="radio-station-index">{{ index + 1 }}</span>
          <span class="radio-station-copy">
            <span class="radio-station-name">{{ station.name }}</span>
            <span class="radio-station-detail">{{ station.detail }}</span>
          </span>
          <span v-if="station.active" class="radio-station-status">{{ ui.radio.status }}</span>
        </button>
      </div>
      <div v-if="ui.radio.station === 'aux'" class="radio-aux-row">
        <span class="radio-aux-label">AUX SOURCE</span>
        <button
          class="radio-aux-btn"
          :class="{ active: ui.radio.auxSource === 'spotify' }"
          @click="pickAux('spotify')"
        >
          SPOTIFY
        </button>
        <button
          class="radio-aux-btn"
          :class="{ active: ui.radio.auxSource === 'soundcloud' }"
          @click="pickAux('soundcloud')"
        >
          SOUNDCLOUD
        </button>
      </div>
      <div v-if="showShuffle && ui.radio.soundcloud.trackCount" class="radio-aux-row radio-aux-count">
        <span class="radio-aux-label">PLAYLIST</span>
        <span class="radio-aux-figure">{{ trackCountLabel }}</span>
      </div>
    </template>
    <div class="radio-selector-now">
      <span class="radio-selector-now-label">{{ ui.radio.playing ? 'NOW PLAYING' : 'STATION' }}</span>
      <span class="radio-selector-now-track">{{ nowLine }}</span>
    </div>
    <div class="radio-selector-foot">{{ footHint }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';
import { bus } from '../../core/bus.js';

const show = computed(
  () => ui.screen === 'playing' && ui.radio.selectorOpen && !ui.paused
);

const freestyleActive = computed(() => !!(ui.radio.freestyle && ui.radio.freestyle.active));

const titleLine = computed(() => (freestyleActive.value ? 'FREESTYLE KING' : 'RADIO'));

const hintLine = computed(() => (freestyleActive.value ? 'LB + B' : 'LB + D-PAD'));

const showShuffle = computed(
  () =>
    !freestyleActive.value &&
    ui.radio.station === 'aux' &&
    ui.radio.auxSource === 'soundcloud'
);

const beatLine = computed(() => {
  if (freestyleActive.value) return ui.radio.freestyle.track || 'LOADING BEAT';
  return '';
});

const trackCountLabel = computed(() => {
  const total = ui.radio.soundcloud.trackCount || 0;
  if (total < 1) return '';
  const index = (ui.radio.soundcloud.trackIndex || 0) + 1;
  return `${index} / ${total}`;
});

const footHint = computed(() => {
  if (freestyleActive.value) return 'Hold LB + B to exit Freestyle King · release LB to close';
  return showShuffle.value
    ? '↑↓ station · ←→ source · X/H shuffle · Y/P power · release LB to close'
    : '↑↓ station · ←→ aux source · Y/P power · release LB to close';
});

const nowLine = computed(() => {
  const radio = ui.radio;
  if (freestyleActive.value) return radio.freestyle.track || 'Freestyle King';
  if (radio.track && radio.artist) return `${radio.track} — ${radio.artist}`;
  if (radio.track) return radio.track;
  if (radio.station === 'aux') {
    if (radio.auxSource === 'spotify') {
      if (radio.spotify.error) return radio.spotify.error;
      if (!radio.spotify.configured) return 'Add a Spotify client ID in Settings';
      return 'Spotify on your phone';
    }
    if (radio.soundcloud.error) return radio.soundcloud.error;
    if (!radio.soundcloud.configured) return 'Add a SoundCloud link in Settings';
    return 'SoundCloud in the game';
  }
  if (radio.station === 'ep' && !radio.epHasTracks) return 'Drop EP files into src/audio/tracks/infinite-ep/';
  return radio.stationDetail;
});

function pick(id) {
  bus.emit('ui:radio-select', id);
}

function pickAux(id) {
  bus.emit('ui:radio-aux', id);
}

function togglePower() {
  bus.emit('ui:radio-power');
}

function toggleShuffle() {
  bus.emit('ui:radio-shuffle');
}
</script>
