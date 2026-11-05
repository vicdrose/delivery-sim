<template>
  <div
    v-if="ui.sleep.active"
    class="sleep-overlay"
    :class="[ui.sleep.phase, { 'is-dream': ui.sleep.dreamVisible }]"
  >
    <div class="sleep-vignette" :style="{ opacity: ui.sleep.content }"></div>
    <div class="sleep-black" :style="{ opacity: ui.sleep.blackout }"></div>

    <div v-if="ui.sleep.dreamVisible" class="dream-world" :style="{ opacity: ui.sleep.content }">
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
        <div class="dream-progress"><span :style="{ width: progressPct + '%' }"></span></div>
        <span class="dream-hint">still dreaming…</span>
      </div>
    </div>

    <div v-else-if="ui.sleep.phase === 'meditate'" class="meditate-world" :style="{ opacity: ui.sleep.content }">
      <div class="meditate-ring" aria-hidden="true"><span></span></div>
      <div class="meditate-title">MEDITATING</div>
      <div class="meditate-sub">{{ ui.sleep.location }}</div>
      <div class="meditate-stats">
        <span>🌙 {{ Math.round(ui.sleep.sleepiness) }}%</span>
        <span>{{ ui.sleep.clock }}</span>
      </div>
      <div class="meditate-hint">
        next breath in {{ ui.sleep.meditateNext }}s
      </div>
      <button class="meditate-stop" @click="standUp">STAND UP</button>
    </div>

    <div v-else class="sleep-world" :style="{ opacity: ui.sleep.content }">
      <div class="sleep-zzz" aria-hidden="true">
        <span>Z</span><span>z</span><span>z</span>
      </div>
      <div class="sleep-title">{{ title }}</div>
      <div class="sleep-sub">{{ subtitle }}</div>
      <div class="sleep-progress"><span :style="{ width: progressPct + '%' }"></span></div>
      <div class="sleep-clock">{{ ui.sleep.clock }}</div>
      <div v-if="ui.sleep.duration" class="sleep-duration">{{ ui.sleep.duration }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';
import { bus } from '../../core/bus.js';

function standUp() {
  bus.emit('sleep:stand');
}

const title = computed(() => {
  const phase = ui.sleep.phase;
  if (phase === 'fade') return 'HEADING TO BED';
  if (phase === 'lapse') return 'SLEEPING';
  if (phase === 'wake') return 'WAKING UP';
  return '';
});

const subtitle = computed(() => ui.sleep.location || '');

const progressPct = computed(() => Math.round((ui.sleep.progress || 0) * 100));

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
