<template>
  <div v-if="ui.screen === 'playing'" class="radio-widget" :class="{ off: !ui.radio.on }">
    <div class="radio-head">
      <span class="radio-name">RADIO</span>
      <span class="radio-state">{{ ui.radio.on ? 'ON' : 'OFF' }}</span>
    </div>
    <div class="radio-track">
      {{ !ui.radio.hasTracks ? 'NO TRACKS LOADED' : (ui.radio.track || 'STATIC') }}
    </div>
    <div class="radio-hint">LB / R tap: next · hold: power</div>
  </div>
</template>

<script setup>
import { ui } from '../store.js';
</script>
