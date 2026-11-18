<template>
  <div
    v-if="ui.screen === 'playing'"
    class="radio-widget"
    :class="[ui.radio.statusKind, { off: !ui.radio.power, freestyle: freestyleActive }]"
  >
    <div class="radio-head">
      <span class="radio-name">RADIO</span>
      <span class="radio-station">{{ ui.radio.stationName }}</span>
      <span v-if="!freestyleActive && ui.radio.station === 'aux'" class="radio-source">{{ ui.radio.auxSourceName }}</span>
      <span class="radio-state">
        <span v-if="ui.radio.playing" class="radio-bars"><i></i><i></i><i></i></span>
        {{ ui.radio.status }}
      </span>
    </div>
    <div class="radio-track">
      <span v-if="showShuffleMark" class="radio-shfl-mark">↻</span>{{ trackLine }}
    </div>
    <div v-if="ui.radio.artist" class="radio-artist">{{ ui.radio.artist }}</div>
    <div v-if="freestyleActive" class="radio-word">WORD · {{ ui.radio.freestyle.word }}</div>
    <div class="radio-hint">{{ hintLine }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const freestyleActive = computed(() => ui.radio.freestyle && ui.radio.freestyle.active);

const showShuffleMark = computed(
  () =>
    freestyleActive.value ||
    (ui.radio.station === 'aux' && ui.radio.auxSource === 'soundcloud' && ui.radio.shuffle)
);

const trackLine = computed(() => {
  const radio = ui.radio;
  if (radio.track) return radio.track;
  if (radio.station === 'aux') {
    if (radio.auxSource === 'spotify') {
      return radio.spotify.configured ? 'OPEN SPOTIFY ON YOUR PHONE' : 'CONNECT IN SETTINGS';
    }
    return radio.soundcloud.configured ? 'LINK READY' : 'SET A LINK IN SETTINGS';
  }
  if (radio.station === 'ep') {
    return radio.epHasTracks ? 'NO TRACK SELECTED' : 'DROP EP FILES IN TRACKS';
  }
  return radio.hasTracks ? 'NO TRACK SELECTED' : 'NO TRACKS LOADED';
});

const hintLine = computed(() => {
  if (freestyleActive.value) return 'Hold LB + B: exit Freestyle King · R3: volume';
  if (ui.radio.station === 'aux') return 'Hold LB: stations · ←→: Spotify / SoundCloud · R3: volume';
  return 'Hold LB: stations · tap: next · R3: volume';
});
</script>
