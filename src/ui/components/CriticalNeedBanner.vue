<template>
  <div v-if="needs.length" class="critical-needs">
    <div v-for="need in needs" :key="need.key" class="critical-need" :class="need.key">
      <span class="need-arrow" :style="{ transform: `rotate(${need.bearing}rad)` }">↑</span>
      <span class="need-body">
        <span class="need-title">{{ need.title }}</span>
        <span class="need-meta">{{ need.distText }} · {{ need.label }}</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const distText = (m) => {
  if (m == null) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
};

const coarseLabel = (bearing) => {
  const a = Math.abs(bearing);
  if (a <= Math.PI / 4) return 'AHEAD';
  if (a >= (3 * Math.PI) / 4) return 'BEHIND';
  return bearing > 0 ? 'RIGHT' : 'LEFT';
};

const need = (key, title, state) => ({
  key,
  title,
  distText: distText(state.distM),
  bearing: state.bearing,
  label: coarseLabel(state.bearing)
});

const needs = computed(() => {
  const out = [];
  if (ui.needGas) out.push(need('gas', 'YOU REALLY NEED GAS', ui.needGas));
  if (ui.needSleep) out.push(need('sleep', 'YOU REALLY NEED SLEEP', ui.needSleep));
  return out;
});
</script>
