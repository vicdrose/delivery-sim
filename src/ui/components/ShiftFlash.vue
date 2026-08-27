<template>
  <transition name="shift">
    <div v-if="ui.shiftFlash" class="shift-flash" :key="ui.shiftFlash.key">
      <div class="shift-bg"></div>
      <div class="shift-text">{{ ui.shiftFlash.text }}</div>
    </div>
  </transition>
</template>

<script setup>
import { ui } from '../store.js';
</script>
