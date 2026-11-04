<template>
  <div v-if="ui.screen === 'playing' && ui.musicVolumeActive && !ui.paused" class="volume-overlay">
    <div class="volume-overlay-head">
      <span class="volume-overlay-title">RADIO VOLUME</span>
      <span class="volume-overlay-value">{{ pct }}%</span>
    </div>
    <div class="volume-overlay-bar">
      <div class="volume-overlay-fill" :style="{ width: barPct + '%' }"></div>
      <span class="volume-overlay-tick"></span>
    </div>
    <div class="volume-overlay-hint">R3 to close · rotate right stick</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const pct = computed(() => Math.round((ui.radio.volume ?? 1) * 100));
const barPct = computed(() => Math.min(100, Math.max(0, (ui.radio.volume ?? 1) * 50)));
</script>
