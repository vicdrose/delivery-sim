<template>
  <div
    v-if="show"
    class="radio-selector"
    :class="[ui.radio.statusKind, { freestyle: freestyleActive, astro: astroActive }]"
  >
    <div class="radio-selector-head">
      <span class="radio-selector-title">{{ titleLine }}</span>
      <span class="radio-selector-hint">{{ hintLine }}</span>
      <div v-if="astroActive" class="radio-selector-actions">
        <button class="radio-selector-power" @click="exitAstro">CLOSE</button>
      </div>
      <div v-else-if="!freestyleActive" class="radio-selector-actions">
        <button
          v-if="showShuffle"
          class="radio-selector-power"
          :class="{ on: ui.radio.shuffle }"
          @click="toggleShuffle"
        >
          SHUFFLE {{ ui.radio.shuffle ? 'ON' : 'OFF' }}
        </button>
        <button class="radio-selector-power" :class="{ on: ui.radio.on }" @click="togglePower">
          POWER {{ ui.radio.on ? 'ON' : 'OFF' }}
        </button>
      </div>
    </div>
    <template v-if="astroActive">
      <div class="radio-astro">
        <div class="radio-astro-status">
          <span class="radio-astro-status-label">{{ astroStatusLabel }}</span>
          <span class="radio-astro-status-value">{{ astroStatusValue }}</span>
        </div>
        <div class="radio-astro-cards" :class="{ flipped: astroFlipped }">
          <div
            v-for="(card, index) in astroCards"
            :key="`${astroDraw}-${card.key}`"
            class="astro-card"
            :class="{ 'zoom-source': zoomIndex === index }"
            :style="{ aspectRatio: astroAspectRatios[index] }"
            role="button"
            tabindex="0"
            @click="onCardClick($event, index)"
            @keydown.enter.prevent="onCardKey($event, index)"
            @keydown.space.prevent="onCardKey($event, index)"
          >
            <div class="astro-card-inner">
              <div class="astro-card-face astro-card-front">
                <img
                  v-if="!astroImageErrors[index]"
                  :src="card.front"
                  :alt="`${card.kind} card back`"
                  @error="astroImageErrors[index] = true"
                />
                <div v-else class="astro-card-fallback">{{ card.kind }}</div>
              </div>
              <div class="astro-card-face astro-card-back">
                <img
                  v-if="!astroImageErrors[index]"
                  :src="card.back"
                  :alt="card.name"
                  @load="onCardImageLoad($event, index)"
                  @error="astroImageErrors[index] = true"
                />
                <div v-else class="astro-card-fallback">{{ card.name }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="radio-astro-controls">{{ astroControlsLine }}</div>
      </div>
    </template>
    <template v-else-if="freestyleActive">
      <div class="radio-freestyle">
        <div class="radio-freestyle-row">
          <span class="radio-freestyle-label">AUTO BEATS</span>
          <span class="radio-freestyle-value">{{ beatLine }}</span>
        </div>
        <div class="radio-freestyle-row">
          <span class="radio-freestyle-label">SHUFFLE</span>
          <span class="radio-freestyle-value">ON · {{ ui.radio.freestyle.count }} BEATS</span>
        </div>
        <div class="radio-freestyle-word">
          <span class="radio-freestyle-bank">{{ wordBankLabel }}</span>
          <span class="radio-freestyle-word-text">{{ wordLine }}</span>
        </div>
        <div class="radio-freestyle-controls">{{ wordHint }}</div>
      </div>
    </template>
    <template v-else>
      <div class="radio-station-list">
        <button
          v-for="(station, index) in ui.radio.stations"
          :key="station.id"
          class="radio-station-row"
          :class="{ active: station.active }"
          @click="pick(station.id)"
        >
          <span class="radio-station-index">{{ index + 1 }}</span>
          <span class="radio-station-copy">
            <span class="radio-station-name">{{ station.name }}</span>
            <span class="radio-station-detail">{{ station.detail }}</span>
          </span>
          <span v-if="station.active" class="radio-station-status">{{ ui.radio.status }}</span>
        </button>
      </div>
      <div v-if="ui.radio.station === 'aux'" class="radio-aux-row">
        <span class="radio-aux-label">AUX SOURCE</span>
        <button
          class="radio-aux-btn"
          :class="{ active: ui.radio.auxSource === 'spotify' }"
          @click="pickAux('spotify')"
        >
          SPOTIFY
        </button>
        <button
          class="radio-aux-btn"
          :class="{ active: ui.radio.auxSource === 'soundcloud' }"
          @click="pickAux('soundcloud')"
        >
          SOUNDCLOUD
        </button>
      </div>
      <div v-if="showShuffle && ui.radio.soundcloud.trackCount" class="radio-aux-row radio-aux-count">
        <span class="radio-aux-label">PLAYLIST</span>
        <span class="radio-aux-figure">{{ trackCountLabel }}</span>
      </div>
    </template>
    <div class="radio-selector-now">
      <span class="radio-selector-now-label">{{ ui.radio.playing ? 'NOW PLAYING' : 'STATION' }}</span>
      <span class="radio-selector-now-track">{{ nowLine }}</span>
    </div>
    <div class="radio-selector-foot">{{ footHint }}</div>
  </div>
  <div
    v-if="show && zoomIndex !== null && selectedCard"
    class="astro-zoom-layer"
    :class="{ open: zoomOpen }"
  >
    <div
      class="astro-zoom-scrim"
      @click="closeZoom"
      @transitionend="onScrimTransitionEnd"
    ></div>
    <div class="astro-zoom-card" :style="zoomCardStyle">
      <div class="astro-card-inner astro-zoom-card-inner" :class="{ flipped: zoomFaceUp }">
        <div class="astro-card-face astro-card-front">
          <img
            v-if="!astroImageErrors[zoomIndex]"
            :src="selectedCard.front"
            :alt="`${selectedCard.kind} card back`"
            @error="astroImageErrors[zoomIndex] = true"
          />
          <div v-else class="astro-card-fallback">{{ selectedCard.kind }}</div>
        </div>
        <div class="astro-card-face astro-card-back">
          <img
            v-if="!astroImageErrors[zoomIndex]"
            :src="selectedCard.back"
            :alt="selectedCard.name"
            @error="astroImageErrors[zoomIndex] = true"
          />
          <div v-else class="astro-card-fallback">{{ selectedCard.name }}</div>
        </div>
      </div>
    </div>
    <div class="astro-zoom-title">{{ selectedCard.kind }} · {{ selectedCard.name }}</div>
    <div class="astro-zoom-actions">
      <button class="astro-zoom-btn" @click="toggleZoomFace">FLIP</button>
      <button class="astro-zoom-btn close" @click="closeZoom">CLOSE</button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ui } from '../store.js';
import { bus } from '../../core/bus.js';

const show = computed(
  () => ui.screen === 'playing' && ui.radio.selectorOpen && !ui.paused
);

const freestyleActive = computed(() => !!(ui.radio.freestyle && ui.radio.freestyle.active));
const astroActive = computed(() => !!(ui.radio.astroBeats && ui.radio.astroBeats.active));
const astroFlipped = computed(() => !!ui.radio.astroBeats?.flipped);
const astroCards = computed(() => ui.radio.astroBeats?.cards || []);
const astroDraw = computed(() => ui.radio.astroBeats?.draw || 0);
const astroImageErrors = ref([false, false, false, false]);
const ASTRO_ASPECT_DEFAULTS = [150 / 220, 150 / 220, 150 / 220, 150 / 260];
const astroAspectRatios = ref([...ASTRO_ASPECT_DEFAULTS]);
const ZOOM_SCALE = 2.5;
const zoomIndex = ref(null);
const zoomSource = ref(null);
const zoomOpen = ref(false);
const zoomFaceUp = ref(true);

const selectedCard = computed(() => {
  if (zoomIndex.value === null) return null;
  return astroCards.value[zoomIndex.value] || null;
});

const zoomFinal = computed(() => {
  const source = zoomSource.value;
  if (!source) return null;
  const width = source.width * ZOOM_SCALE;
  const height = source.height * ZOOM_SCALE;
  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height
  };
});

const zoomCardStyle = computed(() => {
  const source = zoomSource.value;
  if (!source) return {};
  const target = zoomOpen.value && zoomFinal.value ? zoomFinal.value : source;
  return {
    left: `${target.left}px`,
    top: `${target.top}px`,
    width: `${target.width}px`,
    height: `${target.height}px`
  };
});

watch(astroDraw, () => {
  astroImageErrors.value = [false, false, false, false];
  astroAspectRatios.value = [...ASTRO_ASPECT_DEFAULTS];
  resetZoom();
});

watch(astroActive, (active) => {
  if (!active) resetZoom();
});

watch(show, (visible) => {
  if (!visible) resetZoom();
});

onMounted(() => window.addEventListener('resize', resetZoom));
onBeforeUnmount(() => window.removeEventListener('resize', resetZoom));

const titleLine = computed(() => {
  if (astroActive.value) return 'ASTRO BEATS';
  return freestyleActive.value ? 'FREESTYLE KING' : 'RADIO';
});

const hintLine = computed(() => {
  if (astroActive.value) return 'LB + A · FLIP';
  return freestyleActive.value ? 'LB + B · WORDS' : 'LB + D-PAD';
});

const showShuffle = computed(
  () =>
    !freestyleActive.value &&
    !astroActive.value &&
    ui.radio.station === 'aux' &&
    ui.radio.auxSource === 'soundcloud'
);

const beatLine = computed(() => {
  if (freestyleActive.value) return ui.radio.freestyle.track || 'LOADING BEAT';
  return '';
});

const wordBankLabel = computed(() => {
  const labels = {
    adjective: 'ADJECTIVE',
    verb: 'VERB',
    emotion: 'EMOTION',
    compound: 'COMPOUND WORD'
  };
  return labels[ui.radio.freestyle?.wordBank] || 'COMPOUND WORD';
});

const wordLine = computed(() => ui.radio.freestyle?.word || 'ROLL A WORD');

const wordHint = computed(() => '↑ adjective · ↓ verb · ← emotion · → compound');

const astroStatusLabel = computed(() => (astroFlipped.value ? 'SPREAD' : 'DECK'));

const astroStatusValue = computed(() => {
  if (!astroFlipped.value) return '4 CARDS · FACE DOWN';
  return ui.radio.astroBeats?.spreadLine || astroCards.value.map((card) => card.name).join(' · ');
});

const astroControlsLine = computed(() =>
  astroFlipped.value
    ? 'LB + A: flip back and shuffle · LB + B: Freestyle King'
    : 'LB + A: reveal cards · LB + B: Freestyle King'
);

const trackCountLabel = computed(() => {
  const total = ui.radio.soundcloud.trackCount || 0;
  if (total < 1) return '';
  const index = (ui.radio.soundcloud.trackIndex || 0) + 1;
  return `${index} / ${total}`;
});

const footHint = computed(() => {
  if (astroActive.value) {
    return 'LB + A flip / shuffle · LB + B Freestyle King · Y/P close · release LB to close';
  }
  if (freestyleActive.value) {
    return '↑ adjective · ↓ verb · ← emotion · → compound · LB + B exit · release LB to close';
  }
  return showShuffle.value
    ? '↑↓ station · ←→ source · X/H shuffle · Y/P power · release LB to close'
    : '↑↓ station · ←→ aux source · Y/P power · release LB to close';
});

const nowLine = computed(() => {
  const radio = ui.radio;
  if (freestyleActive.value) return radio.freestyle.track || 'Freestyle King';
  if (radio.track && radio.artist) return `${radio.track} — ${radio.artist}`;
  if (radio.track) return radio.track;
  if (radio.station === 'aux') {
    if (radio.auxSource === 'spotify') {
      if (radio.spotify.error) return radio.spotify.error;
      if (!radio.spotify.configured) return 'Add a Spotify client ID in Settings';
      return 'Spotify on your phone';
    }
    if (radio.soundcloud.error) return radio.soundcloud.error;
    if (!radio.soundcloud.configured) return 'Add a SoundCloud link in Settings';
    return 'SoundCloud in the game';
  }
  if (radio.station === 'ep' && !radio.epHasTracks) return 'Drop EP files into src/audio/tracks/infinite-ep/';
  return radio.stationDetail;
});

function onCardImageLoad(event, index) {
  const img = event.target;
  if (!img.naturalWidth || !img.naturalHeight) return;
  astroAspectRatios.value[index] = img.naturalWidth / img.naturalHeight;
}

function resetZoom() {
  zoomIndex.value = null;
  zoomSource.value = null;
  zoomOpen.value = false;
  zoomFaceUp.value = true;
}

function onCardClick(event, index) {
  if (!astroFlipped.value) {
    flipAstro();
    return;
  }
  openZoom(event.currentTarget || event.target, index);
}

function onCardKey(event, index) {
  onCardClick(event, index);
}

function openZoom(el, index) {
  if (!el || zoomIndex.value !== null) return;
  const rect = el.getBoundingClientRect();
  zoomSource.value = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
  zoomIndex.value = index;
  zoomFaceUp.value = true;
  zoomOpen.value = false;
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (zoomIndex.value === index) zoomOpen.value = true;
      });
    });
  });
}

function closeZoom() {
  if (zoomIndex.value === null) return;
  if (!zoomOpen.value) {
    resetZoom();
    return;
  }
  zoomOpen.value = false;
}

function toggleZoomFace() {
  zoomFaceUp.value = !zoomFaceUp.value;
}

function onScrimTransitionEnd(event) {
  if (event.propertyName !== 'opacity' || zoomOpen.value) return;
  resetZoom();
}

function flipAstro() {
  bus.emit('ui:astro-flip');
}

function exitAstro() {
  bus.emit('ui:astro-exit');
}

function pick(id) {
  bus.emit('ui:radio-select', id);
}

function pickAux(id) {
  bus.emit('ui:radio-aux', id);
}

function togglePower() {
  bus.emit('ui:radio-power');
}

function toggleShuffle() {
  bus.emit('ui:radio-shuffle');
}
</script>
