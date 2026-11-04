import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus } from '../core/bus.js';
import { ui, toast } from '../ui/store.js';

const STORAGE_KEY = 'snackrun_sleepiness';
const SLEEP = CONFIG.sleep;

const clamp = (v) => Math.min(SLEEP.max, Math.max(0, Number.isFinite(v) ? v : SLEEP.startValue));

function readSleepiness() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const value = Number(raw);
      if (Number.isFinite(value)) return clamp(value);
    }
  } catch {
    void 0;
  }
  return SLEEP.startValue;
}

export class SleepSystem {
  constructor(game) {
    this.g = game;
    this.value = readSleepiness();
    this.blocking = false;
    this.phase = 'idle';
    this.timer = 0;
    this.outcome = null;
    this.spot = null;
    this._levelId = null;
    this._markerTime = 0;
    this._saveClock = 0;
    this._buildMarker();
    this._syncUi();
    this._publish(0);
  }

  _buildMarker() {
    const group = new THREE.Group();

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#b18cff',
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.09, 8, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.26;
    group.add(ring);

    const beamMat = new THREE.MeshBasicMaterial({
      color: '#b18cff',
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.55, 7, 20, 1, true), beamMat);
    beam.position.y = 3.5;
    group.add(beam);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 58px system-ui, sans-serif';
    ctx.fillStyle = '#e8ddff';
    ctx.fillText('Z', 58, 76);
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.fillStyle = '#c4a8ff';
    ctx.fillText('z', 91, 45);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.3, 2.3, 1);
    sprite.position.y = 4.3;
    group.add(sprite);

    group.visible = false;
    this.g.scene.add(group);
    this.marker = group;
    this._ring = ring;
    this._ringMat = ringMat;
    this._beamMat = beamMat;
    this._sprite = sprite;
  }

  get spotKind() {
    return this.spot ? this.spot.kind : null;
  }

  getSpot() {
    const level = this.g.level;
    if (!level) return null;
    if (this._levelId !== level.id || !this.spot) {
      this._levelId = level.id;
      this.spot = this._findSpot();
    }
    return this.spot;
  }

  _findSpot() {
    const g = this.g;
    const van = g.vehicles && g.vehicles.van;
    if (g.level.id === '1-2' && van) {
      return {
        kind: 'van',
        label: 'Sleep in the Van',
        name: 'The Van',
        position: new THREE.Vector3(),
        vehicle: van
      };
    }

    const homes = (g.city?.locations?.pois || []).filter((p) => p.category === 'home');
    if (!homes.length) return null;
    const spawn = g.city.spawn;
    let best = null;
    let bestD = Infinity;
    for (const poi of homes) {
      const dx = poi.door.x - spawn.x;
      const dz = poi.door.z - spawn.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = poi;
      }
    }
    if (!best) return null;
    return {
      kind: 'home',
      label: 'Sleep at Home',
      name: best.name,
      position: best.door,
      poi: best
    };
  }

  onLevelChange() {
    this._levelId = null;
    this.spot = null;
    this.getSpot();
  }

  _updateMarkerPosition(spot) {
    if (!spot) return;
    if (spot.kind === 'van' && spot.vehicle) {
      const van = spot.vehicle;
      const fx = Math.sin(van.heading);
      const fz = Math.cos(van.heading);
      const back = van.bodyLength / 2 + 1.2;
      spot.position.set(
        van.group.position.x - fx * back,
        0,
        van.group.position.z - fz * back
      );
    }
    if (this.marker) {
      this.marker.position.set(spot.position.x, 0, spot.position.z);
    }
  }

  _updateMarker(dt) {
    const spot = this.getSpot();
    if (!spot || !this.marker) {
      if (this.marker) this.marker.visible = false;
      return;
    }
    this._updateMarkerPosition(spot);
    const show =
      ui.screen === 'playing' &&
      !this.blocking &&
      ui.playerMode !== 'inside' &&
      !!this.g.city;
    this.marker.visible = show;
    if (!show) return;
    this._markerTime += dt;
    const pulse = 1 + Math.sin(this._markerTime * 3) * 0.08;
    this._ring.scale.setScalar(pulse);
    this._ringMat.opacity = 0.36 + Math.sin(this._markerTime * 3) * 0.14;
    this._beamMat.opacity = 0.06 + Math.sin(this._markerTime * 2) * 0.02;
    this._sprite.position.y = 4.3 + Math.sin(this._markerTime * 1.6) * 0.18;
  }

  update(dt, s) {
    this._updateMarker(dt);

    if (this.blocking) {
      this._tickSequence(dt);
      return;
    }
    if (ui.screen !== 'playing' || ui.paused) return;

    let rate = SLEEP.ratePerSecond;
    const moving =
      s && (Math.abs(s.moveForward) > 0.05 || Math.abs(s.steer) > 0.05 || s.throttle > 0.05);
    if (ui.playerMode === 'foot' || ui.playerMode === 'inside') {
      if (moving && (s.sprint || s.sprintRT)) rate += SLEEP.sprintExtra;
      else if (moving) rate += SLEEP.walkExtra;
    } else if (ui.playerMode === 'drive' && s && s.throttle > 0.05) {
      rate += SLEEP.driveExtra;
    }

    const before = this.value;
    this.value = clamp(this.value + rate * dt);
    this._saveClock += dt;
    if (this._saveClock >= 3) {
      this._saveClock = 0;
      this.save();
    }
    if (before < SLEEP.warnAt && this.value >= SLEEP.warnAt) {
      toast(
        this.spotKind === 'van'
          ? 'You are running on empty. The van is your bed — go sleep.'
          : 'You are running on empty. Head home and sleep.',
        'warn',
        5200
      );
    }
    this._syncUi();
  }

  _syncUi() {
    ui.sleepiness = this.value;
    ui.sleepy = this.value >= SLEEP.warnAt;
  }

  _publish(opacity, progress = 0) {
    ui.sleep = {
      active: this.blocking,
      phase: this.phase,
      opacity,
      progress,
      dream: this.outcome === 'dream',
      location: this.spot ? this.spot.name : '',
      day: this.g.dayCycle.day
    };
  }

  begin() {
    if (this.blocking || ui.screen !== 'playing') return false;
    this.getSpot();

    this.blocking = true;
    this.phase = 'fade';
    this.timer = 0;
    this.outcome = Math.random() < SLEEP.dreamChance ? 'dream' : 'plain';
    this._publish(0, 0);

    const g = this.g;
    g.dayCycle.paused = true;
    g.audio.horn(false);
    g.audio.setEngine(0, 0, false);
    g.audio.setSkid(0);
    g.audio.play('door');
    g.music.pauseGame();
    g.foley.stop();
    ui.prompt = null;
    return true;
  }

  _tickSequence(dt) {
    this.timer += dt;

    if (this.phase === 'fade') {
      const p = Math.min(1, this.timer / SLEEP.fadeSeconds);
      this._publish(p, p);
      if (this.timer >= SLEEP.fadeSeconds) {
        this.phase = 'sleep';
        this.timer = 0;
        this._publish(1, 0);
      }
      return;
    }

    if (this.phase === 'sleep') {
      const p = Math.min(1, this.timer / SLEEP.holdSeconds);
      this._publish(1, p);
      if (this.timer >= SLEEP.holdSeconds) {
        if (this.outcome === 'dream') {
          this.phase = 'dream';
          this.timer = 0;
          this._publish(1, 0);
          bus.emit('sleep:dream', {
            location: this.spot ? this.spot.name : 'somewhere',
            kind: this.spotKind
          });
        } else {
          this._wake();
        }
      }
      return;
    }

    if (this.phase === 'dream') {
      const p = Math.min(1, this.timer / SLEEP.dreamSeconds);
      this._publish(1, p);
      if (this.timer >= SLEEP.dreamSeconds) this._wake();
      return;
    }

    if (this.phase === 'wake') {
      const p = Math.min(1, this.timer / SLEEP.wakeSeconds);
      this._publish(1 - p, p);
      if (this.timer >= SLEEP.wakeSeconds) this._finish();
    }
  }

  _wake() {
    const g = this.g;
    g.dayCycle.day += 1;
    g.dayCycle.t = CONFIG.day.startTime;
    g.progression.endDay();
    ui.todayEarned = 0;
    ui.deliveriesToday = 0;
    this.value = SLEEP.wakeValue;
    this._saveClock = 0;
    this.save();
    this._syncUi();
    this.phase = 'wake';
    this.timer = 0;
    this._publish(1, 0);
    g.audio.play('dayEnd');
  }

  _finish() {
    const wasDream = this.outcome === 'dream';
    this.blocking = false;
    this.phase = 'idle';
    this.timer = 0;
    this.outcome = null;
    this.g.dayCycle.paused = false;
    this._publish(0, 0);
    this.g.music.resumeGame(ui.playerMode === 'drive');
    this.g.foley.start();
    toast(`Good morning — Day ${this.g.dayCycle.day}.`, 'success', 3600);
    if (wasDream) toast('You wake from a strange dream.', 'info', 3600);
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, this.value.toFixed(1));
    } catch {
      void 0;
    }
  }

  reset() {
    if (this.blocking) {
      this.blocking = false;
      this.phase = 'idle';
      this.timer = 0;
      this.outcome = null;
      this.g.dayCycle.paused = false;
    }
    this.value = SLEEP.startValue;
    this._saveClock = 0;
    this.save();
    this._syncUi();
    this._publish(0, 0);
  }

  dispose() {
    if (this.marker) {
      this.g.scene.remove(this.marker);
      this.marker.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      this.marker = null;
    }
  }
}
