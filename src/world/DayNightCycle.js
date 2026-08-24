import * as THREE from 'three';
import { CONFIG, formatClock } from '../config.js';

const _cA = new THREE.Color();
const _cB = new THREE.Color();

export class DayNightCycle {
  constructor(bus) {
    this.bus = bus;
    this.t = CONFIG.day.startTime;
    this.day = 1;
    this.paused = false;
  }

  update(dt) {
    if (this.paused) return;
    const prev = this.t;
    this.t += dt / CONFIG.day.lengthSeconds;
    if (this.t >= 1) {
      this.t -= 1;
      this.day++;
      this.bus.emit('day:ended', { day: this.day });
    }
    void prev;
  }

  sample(out = {}) {
    const phases = CONFIG.day.phases;
    let i = 0;
    while (i < phases.length - 2 && this.t > phases[i + 1].t) i++;
    const a = phases[i];
    const b = phases[i + 1];
    const span = Math.max(1e-5, b.t - a.t);
    const f = THREE.MathUtils.clamp((this.t - a.t) / span, 0, 1);

    out.name = f < 0.5 ? a.name : b.name;
    out.sky = out.sky || new THREE.Color();
    out.fog = out.fog || new THREE.Color();
    out.sun = out.sun || new THREE.Color();
    out.sky.copy(_cA.set(a.sky).lerp(_cB.set(b.sky), f));
    out.fog.copy(_cA.set(a.fog).lerp(_cB.set(b.fog), f));
    out.sun.copy(_cA.set(a.sun).lerp(_cB.set(b.sun), f));
    out.sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, f);
    out.ambI = THREE.MathUtils.lerp(a.ambI, b.ambI, f);
    const elev = THREE.MathUtils.lerp(a.elev, b.elev, f);
    const azim = THREE.MathUtils.lerp(a.azim, b.azim, f);
    const e = (elev * Math.PI) / 180;
    const az = (azim * Math.PI) / 180;
    out.sunDir = out.sunDir || new THREE.Vector3();
    out.sunDir.set(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)).normalize();
    out.elev = elev;

    const g = CONFIG.day;
    let glow = smooth(g.windowGlowInStart, g.windowGlowInEnd, this.t);
    if (this.t < g.windowGlowOutEnd) {
      glow = Math.max(glow, 1 - smooth(0, g.windowGlowOutEnd, this.t));
    }
    out.windowGlow = glow;
    out.starAlpha = smooth(4, -8, elev);
    out.clock = formatClock(this.t);
    return out;
  }
}

function smooth(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
