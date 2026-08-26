<template>
  <div class="fuel-gauge" :class="{ low: fraction < 0.25, empty: fraction <= 0 }">
    <div class="fuel-bar-track">
      <div class="fuel-bar-fill" :style="{ height: (fraction * 100) + '%' }"></div>
    </div>
    <div class="fuel-label">
      <span class="fuel-pct">{{ Math.round(fraction * 100) }}</span>
      <span class="fuel-unit">FUEL</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const fraction = computed(() => ui.fuelMax > 0 ? ui.fuelLevel / ui.fuelMax : 1);
</script>
