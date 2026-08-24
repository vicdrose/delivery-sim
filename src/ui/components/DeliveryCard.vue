<template>
  <div v-if="ui.offer" class="offer-card clickable">
    <div class="offer-head">
      <span class="offer-badge">NEW ORDER</span>
      <span class="offer-food">{{ ui.offer.foodItem }}</span>
    </div>
    <div class="offer-row"><span class="k">PICKUP</span><span class="v">{{ ui.offer.pickupName }}</span></div>
    <div class="offer-row"><span class="k">DROPOFF</span><span class="v">{{ ui.offer.dropName }}</span></div>
    <div class="offer-stats">
      <div><span class="k">DIST</span><span class="v">{{ ui.offer.miles }}</span></div>
      <div><span class="k">PAY</span><span class="v strong">{{ ui.offer.total }}</span></div>
      <div><span class="k">TIME</span><span class="v">{{ ui.offer.time }}</span></div>
    </div>
    <div class="offer-actions">
      <button class="btn primary" @click="accept">ACCEPT · Enter / A</button>
      <button class="btn ghost" @click="decline">DECLINE · N / B</button>
    </div>
  </div>

  <div v-else-if="active" class="order-card" :class="{ critical: ui.timeCritical }">
    <div class="order-top">
      <span class="order-title">{{ active.title }}</span>
      <span class="order-timer">{{ ui.timeLeftStr }}</span>
    </div>
    <div class="order-sub">{{ active.sub }}</div>
    <div class="time-bar">
      <div class="time-fill" :style="{ width: barWidth, background: barColor }"></div>
    </div>
    <div v-if="ui.hasFood" class="food-flag">FOOD ON BOARD</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';
import { bus } from '../../core/bus.js';

const active = computed(() => (ui.screen === 'playing' ? ui.objective : null));

const barWidth = computed(() => `${Math.max(0, Math.min(1, ui.timeFrac)) * 100}%`);
const barColor = computed(() => (ui.timeCritical ? '#e63946' : '#2a9d8f'));

function accept() {
  bus.emit('ui:accept');
}
function decline() {
  bus.emit('ui:decline');
}
</script>
