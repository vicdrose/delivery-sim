<template>
  <div class="toast-stack">
    <transition-group name="toast">
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.kind">
        {{ t.msg }}
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { ui } from '../store.js';
</script>
