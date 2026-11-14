<template>
  <div
    v-if="active"
    class="mp-hud"
    :class="{ talking: ui.multiplayer.talking, alert: micProblem }"
  >
    <span class="mp-hud-code">ROOM {{ ui.multiplayer.roomCode }}</span>
    <span class="mp-hud-sep">·</span>
    <span>{{ ui.multiplayer.players.length }}/{{ ui.multiplayer.max }}</span>
    <span class="mp-hud-sep">·</span>
    <span class="mp-hud-voice">{{ voiceLine }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ui } from '../store.js';

const active = computed(() => ui.screen === 'playing' && ui.multiplayer.inRoom);

const micProblem = computed(() => {
  if (!ui.multiplayer.voiceEnabled) return false;
  if (['denied', 'unsupported', 'no-device'].includes(ui.multiplayer.voiceStatus)) return true;
  return ui.multiplayer.voiceFailed > 0 && ui.multiplayer.voiceConnected === 0;
});

const voiceLine = computed(() => {
  const mp = ui.multiplayer;
  const listeners = mp.voiceConnected;
  const nearest = Number.isFinite(mp.nearest) ? Math.round(mp.nearest) : null;
  if (!mp.voiceEnabled) return 'VOICE OFF';
  if (mp.micMuted) return 'MIC MUTED';
  if (mp.voiceStatus === 'requesting') return 'MIC REQUEST…';
  if (mp.voiceStatus === 'denied') return 'MIC BLOCKED';
  if (mp.voiceStatus === 'unsupported') return 'NO MIC SUPPORT';
  if (mp.voiceStatus === 'no-device') return 'NO MIC FOUND';
  if (mp.voiceStatus === 'off') return 'VOICE OFF';
  if (mp.voiceFailed > 0 && listeners === 0) return 'VOICE UNREACHABLE';
  if (mp.talking) {
    if (listeners === 0) return 'TALKING · NO ONE CONNECTED';
    return `TALKING · ${listeners} ${listeners === 1 ? 'LISTENER' : 'LISTENERS'}`;
  }
  if (mp.nearby > 0 && listeners === 0) return 'VOICE CONNECTING…';
  if (listeners > 0) {
    const where = nearest === null ? '' : ` · ${nearest}m`;
    return `VOICE ${listeners}/${mp.nearby}${where}`;
  }
  if (mp.players.length <= 1) return 'WAITING FOR DRIVERS';
  if (nearest !== null && nearest > 75) return `NO ONE IN RANGE · NEAREST ${nearest}m`;
  return 'HOLD V / SELECT TO TALK';
});
</script>

<style scoped>
.mp-hud {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(17, 24, 32, 0.72);
  border: 2px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  pointer-events: none;
  z-index: 40;
  backdrop-filter: blur(4px);
  white-space: nowrap;
}

.mp-hud-code {
  color: #ffd23f;
}

.mp-hud-sep {
  color: rgba(255, 255, 255, 0.4);
}

.mp-hud-voice {
  color: #9fb2c8;
}

.mp-hud.talking {
  border-color: rgba(158, 240, 26, 0.85);
  box-shadow: 0 0 18px rgba(158, 240, 26, 0.35);
}

.mp-hud.talking .mp-hud-voice {
  color: #9ef01a;
}

.mp-hud.alert {
  border-color: rgba(230, 57, 70, 0.8);
}

.mp-hud.alert .mp-hud-voice {
  color: #ff8f8f;
}
</style>
