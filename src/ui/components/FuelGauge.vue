<template>
  <div class="fuel-gauge" :class="{ low: fuelF < 0.25, empty: fuelF <= 0, driving }">
    <div class="fuel-row" :class="healthRowClass">
      <span class="fuel-emoji">⚙</span>
      <div class="fuel-bar">
        <div class="fuel-fill dmg" :style="{ width: healthPct }"></div>
      </div>
      <span class="fuel-pct">{{ Math.round(healthF * 100) }}%</span>
    </div>
    <div class="fuel-row">
      <span class="fuel-emoji">⛽</span>
      <div class="fuel-bar">
        <div class="fuel-fill" :style="{ width: fuelPct }"></div>
      </div>
      <span class="fuel-pct">{{ Math.round(fuelF * 100) }}%</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const fuelF = computed(() => (ui.fuelMax > 0 ? ui.fuelLevel / ui.fuelMax : 1));
const healthMax = computed(() => (ui.healthMax > 0 ? ui.healthMax : 100));
const healthF = computed(() => Math.max(0, Math.min(1, ui.healthLevel / healthMax.value)));
const fuelPct = computed(() => `${Math.max(0, Math.min(1, fuelF.value)) * 100}%`);
const healthPct = computed(() => `${Math.max(0, Math.min(1, healthF.value)) * 100}%`);
const driving = computed(() => ui.playerMode === 'drive');
const healthRowClass = computed(() => ({
  crit: healthF.value < 0.25 && healthF.value > 0,
  dead: healthF.value <= 0
}));
</script>