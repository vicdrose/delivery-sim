<template>
  <div class="clock-card">
    <span class="clock-phase">{{ ui.phase }}</span>
    <span class="clock-time">{{ ui.clock }}</span>
    <span class="clock-day">Day {{ ui.day }}</span>
  </div>
</template>

<script setup>
import { ui } from '../store.js';
</script>
