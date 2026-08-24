<template>
  <transition name="pop">
    <div v-if="ui.prompt" class="prompt">{{ ui.prompt }}</div>
  </transition>
</template>

<script setup>
import { ui } from '../store.js';
</script>
