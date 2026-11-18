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
    <template v-if="freestyleActive">
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
    <template v-else-if="astroActive">
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
            role="button"
            tabindex="0"
            @click="flipAstro"
            @keydown.enter.prevent="flipAstro"
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
</template>

<script setup>
import { computed, ref, watch } from 'vue';
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

watch(astroDraw, () => {
  astroImageErrors.value = [false, false, false, false];
});

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
  if (astroActive.value) return radio.astroBeats?.flipped ? astroStatusValue.value : 'FOUR CARDS READY';
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
