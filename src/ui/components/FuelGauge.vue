<template>
  <div class="fuel-gauge" :class="{ low: fraction < 0.25, empty: fraction <= 0 }">
    <div class="fuel-icon">⛽</div>
    <div class="fuel-bar">
      <div class="fuel-fill" :style="{ width: (fraction * 100) + '%' }"></div>
    </div>
    <div class="fuel-text">{{ Math.round(fraction * 100) }}%</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const fraction = computed(() => ui.fuelMax > 0 ? ui.fuelLevel / ui.fuelMax : 1);
</script>
