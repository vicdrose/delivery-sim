<template>
  <div class="hud" :class="{ hidden: !inGame }">
    <MoneyDisplay />
    <ClockWidget />
    <ObjectiveBanner />
    <DeliveryCard />
    <InteractionPrompt />
    <Speedometer />
    <FuelGauge />
    <Minimap />
    <RadioWidget />
    <ToastStack />
    <PaymentFlash />
    <BagSecuredFlash />
  </div>
  <Screens />
</template>

<script setup>
import { computed } from 'vue';
import { ui } from './store.js';
import MoneyDisplay from './components/MoneyDisplay.vue';
import ClockWidget from './components/ClockWidget.vue';
import ObjectiveBanner from './components/ObjectiveBanner.vue';
import DeliveryCard from './components/DeliveryCard.vue';
import InteractionPrompt from './components/InteractionPrompt.vue';
import Speedometer from './components/Speedometer.vue';
import FuelGauge from './components/FuelGauge.vue';
import Minimap from './components/Minimap.vue';
import RadioWidget from './components/RadioWidget.vue';
import ToastStack from './components/ToastStack.vue';
import PaymentFlash from './components/PaymentFlash.vue';
import BagSecuredFlash from './components/BagSecuredFlash.vue';
import Screens from './components/Screens.vue';

const inGame = computed(() => ui.screen === 'playing');
</script>
