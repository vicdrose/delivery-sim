<template>
  <div class="speedo" :class="{ driving: ui.speedMph > 0 }">
    <span class="speedo-num">{{ ui.speedMph }}</span>
    <span class="speedo-unit">MPH</span>
  </div>
</template>

<script setup>
import { ui } from '../store.js';
</script>
