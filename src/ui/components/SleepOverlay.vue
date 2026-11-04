<template>
  <div
    v-if="ui.sleep.active"
    class="sleep-overlay"
    :class="[ui.sleep.phase, { 'is-dream': ui.sleep.phase === 'dream' }]"
    :style="{ opacity: ui.sleep.opacity }"
  >
    <div v-if="ui.sleep.phase === 'dream'" class="dream-world">
      <div class="dream-stars" aria-hidden="true">
        <span v-for="n in 22" :key="n" class="dream-star" :style="starStyle(n)"></span>
      </div>
      <div class="dream-card">
        <span class="dream-kicker">DREAM SEQUENCE</span>
        <h2>THROUGH THE STATIC</h2>
        <p class="dream-copy">
          The dream mini-games are still forming. Soon, sleep will take you somewhere you can
          play.
        </p>
        <div class="dream-progress"><span :style="{ width: dreamPct + '%' }"></span></div>
        <span class="dream-hint">waking up…</span>
      </div>
    </div>

    <div v-else class="sleep-world">
      <div class="sleep-zzz" aria-hidden="true">
        <span>Z</span><span>z</span><span>z</span>
      </div>
      <div class="sleep-title">{{ title }}</div>
      <div class="sleep-sub">{{ subtitle }}</div>
      <div class="sleep-progress"><span :style="{ width: progressPct + '%' }"></span></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const title = computed(() => {
  const phase = ui.sleep.phase;
  if (phase === 'fade') return 'HEADING TO BED';
  if (phase === 'sleep') return 'SLEEPING';
  if (phase === 'wake') return 'GOOD MORNING';
  return '';
});

const subtitle = computed(() => {
  if (ui.sleep.phase === 'wake') return `Day ${ui.sleep.day}`;
  return ui.sleep.location || '';
});

const progressPct = computed(() => Math.round((ui.sleep.progress || 0) * 100));
const dreamPct = computed(() => Math.round((ui.sleep.progress || 0) * 100));

function starStyle(n) {
  const x = (n * 37 + 11) % 100;
  const y = (n * 61 + 7) % 100;
  const size = 2 + ((n * 13) % 5);
  const delay = ((n * 7) % 12) / 4;
  return {
    left: `${x}%`,
    top: `${y}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${delay}s`
  };
}
</script>
