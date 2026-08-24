<template>
  <div v-if="ui.objective" class="objective">
    <div class="obj-title">{{ ui.objective.title }}</div>
    <div v-if="ui.objective.sub" class="obj-sub">{{ ui.objective.sub }}</div>
    <div v-if="distText" class="obj-dist">{{ distText }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const distText = computed(() => {
  const d = ui.objective && ui.objective.distM;
  if (d == null) return '';
  if (d < 1000) return `${Math.round(d)} m`;
  return `${(d / 1000).toFixed(2)} km`;
});
</script>
