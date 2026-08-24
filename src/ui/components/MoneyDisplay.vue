<template>
  <div class="money-card">
    <div class="money-label">CASH</div>
    <div class="money-value">${{ formatted }}</div>
    <div class="money-sub">+${{ ui.todayEarned.toFixed(2) }} today · {{ ui.deliveriesToday }} runs</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const formatted = computed(() => ui.money.toFixed(2));
</script>
