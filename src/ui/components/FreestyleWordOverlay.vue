<template>
  <Transition name="freestyle-word">
    <div v-if="visible" class="freestyle-word-overlay">
      <span :key="word" class="freestyle-word-text">{{ word }}</span>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const freestyle = computed(() => ui.radio?.freestyle);
const word = computed(() => freestyle.value?.word || '');
const visible = computed(
  () =>
    ui.screen === 'playing' &&
    !ui.paused &&
    !ui.sleep.active &&
    !!freestyle.value?.active &&
    !!freestyle.value?.wordVisible &&
    !!word.value
);
</script>
