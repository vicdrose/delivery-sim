<template>
  <transition name="cash">
    <div v-if="ui.payment" class="payment" :class="{ late: !ui.payment.onTime }">
      <div class="pay-amount">+${{ ui.payment.amount.toFixed(2) }}</div>
      <div class="pay-tag">{{ ui.payment.onTime ? 'ON TIME — TIPPED WELL' : 'LATE... MEASLY TIP' }}</div>
    </div>
  </transition>
</template>

<script setup>
import { ui } from '../store.js';
</script>
