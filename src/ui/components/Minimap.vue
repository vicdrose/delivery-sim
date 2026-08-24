<template>
  <div class="minimap">
    <canvas ref="canvasRef" width="220" height="220"></canvas>
    <div v-if="ui.insideName" class="inside-tag">{{ ui.insideName }}</div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { ui } from '../store.js';

const canvasRef = ref(null);
let raf = 0;

function draw() {
  const canvas = canvasRef.value;
  if (canvas && ui.minimapStatic) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 220, 220);
    ctx.drawImage(ui.minimapStatic, 0, 0);

    const half = 180;
    const toPx = (v) => (v + half) * (220 / (half * 2));

    if (ui.blipsCar) {
      ctx.fillStyle = '#e8615a';
      ctx.fillRect(toPx(ui.blipsCar.x) - 3, toPx(ui.blipsCar.z) - 3, 6, 6);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(toPx(ui.blipsCar.x) - 3, toPx(ui.blipsCar.z) - 3, 6, 6);
    }

    if (ui.blipsTarget) {
      const t = performance.now() * 0.004;
      const r = 4 + Math.sin(t) * 1.6;
      ctx.beginPath();
      ctx.arc(toPx(ui.blipsTarget.x), toPx(ui.blipsTarget.z), r + 2, 0, Math.PI * 2);
      ctx.fillStyle = ui.blipsTarget.food ? 'rgba(255,210,63,0.35)' : 'rgba(255,140,66,0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(toPx(ui.blipsTarget.x), toPx(ui.blipsTarget.z), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = ui.blipsTarget.food ? '#ffd23f' : '#ff8c42';
      ctx.fill();
    }

    const p = ui.blipsPlayer;
    if (p) {
      ctx.save();
      ctx.translate(toPx(p.x), toPx(p.z));
      ctx.rotate(-p.yaw + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 5);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-4.5, 5);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#222831';
      ctx.lineWidth = 1.4;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
  raf = requestAnimationFrame(draw);
}

onMounted(() => {
  draw();
});
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>
