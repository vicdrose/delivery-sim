<template>
  <div
    v-if="show"
    class="radio-selector"
    :class="ui.radio.statusKind"
  >
    <div class="radio-selector-head">
      <span class="radio-selector-title">RADIO</span>
      <span class="radio-selector-hint">LB + D-PAD ↑↓</span>
    </div>
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
    <div class="radio-selector-now">
      <span class="radio-selector-now-label">{{ ui.radio.playing ? 'NOW PLAYING' : 'STATION' }}</span>
      <span class="radio-selector-now-track">{{ nowLine }}</span>
    </div>
    <div class="radio-selector-foot">↑ next · ↓ previous · ← → power · release LB to close</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';
import { bus } from '../../core/bus.js';

const show = computed(
  () => ui.screen === 'playing' && ui.radio.selectorOpen && !ui.paused
);

const nowLine = computed(() => {
  const radio = ui.radio;
  if (radio.track && radio.artist) return `${radio.track} — ${radio.artist}`;
  if (radio.track) return radio.track;
  if (radio.station === 'spotify' && radio.spotify.error) return radio.spotify.error;
  if (radio.station === 'ep' && !radio.epHasTracks) return 'Drop EP files into src/audio/tracks/infinite-ep/';
  if (radio.station === 'spotify' && !radio.spotify.configured) return 'Add a Spotify client ID in Settings';
  return radio.stationDetail;
});

function pick(id) {
  bus.emit('ui:radio-select', id);
}
</script>
