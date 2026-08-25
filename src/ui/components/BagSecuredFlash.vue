<template>
  <transition name="bag">
    <div v-if="ui.bagSecured" class="bag-flash" :key="ui.bagSecured.key">
      <div class="bag-bg"></div>
      <div class="bag-text-wrap">
        <div class="bag-text">BAG<br/>SECURED!</div>
        <div class="bag-sub">+{{ ui.bagSecured.foodItem }}</div>
      </div>
      <div class="bag-star bag-star-1"></div>
      <div class="bag-star bag-star-2"></div>
      <div class="bag-star bag-star-3"></div>
      <div class="bag-star bag-star-4"></div>
    </div>
  </transition>
</template>

<script setup>
import { ui } from '../store.js';
</script>
