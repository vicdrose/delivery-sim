<template>
  <div class="hud" :class="{ hidden: !inGame, sleeping: ui.sleep.active }">
    <MoneyDisplay />
    <ClockWidget />
    <ObjectiveBanner />
    <DeliveryCard />
    <InteractionPrompt />
    <Speedometer />
    <FuelGauge />
    <Minimap />
    <RadioWidget />
    <RadioStationOverlay />
    <VolumeOverlay />
    <ToastStack />
    <PaymentFlash />
    <BagSecuredFlash />
    <ShiftFlash />
    <TouchControls />
  </div>
  <SleepOverlay />
  <Screens />
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { ui, applyUiScale } from './store.js';
import MoneyDisplay from './components/MoneyDisplay.vue';
import ClockWidget from './components/ClockWidget.vue';
import ObjectiveBanner from './components/ObjectiveBanner.vue';
import DeliveryCard from './components/DeliveryCard.vue';
import InteractionPrompt from './components/InteractionPrompt.vue';
import Speedometer from './components/Speedometer.vue';
import FuelGauge from './components/FuelGauge.vue';
import Minimap from './components/Minimap.vue';
import RadioWidget from './components/RadioWidget.vue';
import RadioStationOverlay from './components/RadioStationOverlay.vue';
import VolumeOverlay from './components/VolumeOverlay.vue';
import SleepOverlay from './components/SleepOverlay.vue';
import ToastStack from './components/ToastStack.vue';
import PaymentFlash from './components/PaymentFlash.vue';
import BagSecuredFlash from './components/BagSecuredFlash.vue';
import ShiftFlash from './components/ShiftFlash.vue';
import TouchControls from './components/TouchControls.vue';
import Screens from './components/Screens.vue';

const inGame = computed(() => ui.screen === 'playing');

onMounted(() => {
  applyUiScale();
  window.addEventListener('resize', applyUiScale);
  window.addEventListener('orientationchange', applyUiScale);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', applyUiScale);
  window.removeEventListener('orientationchange', applyUiScale);
});
</script>
