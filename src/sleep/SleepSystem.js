import * as THREE from 'three';
import { CONFIG, formatClock } from '../config.js';
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

function formatDuration(hours) {
  const minutes = Math.max(1, Math.round(hours * 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export class SleepSystem {
  constructor(game) {
    this.g = game;
    this.value = readSleepiness();
    this.blocking = false;
    this.mode = null;
    this.phase = 'idle';
    this.timer = 0;
    this.outcome = null;
    this.spot = null;
    this.totalHours = 0;
    this.lapseDuration = 0;
    this.lapseElapsed = 0;
    this._advancedHours = 0;
    this._startValue = this.value;
    this._meditateTimer = 0;
    this._meditateStart = this.value;
    this._blackout = 0;
    this._content = 0;
    this._camFromPos = new THREE.Vector3();
    this._camFromQuat = new THREE.Quaternion();
    this._camDummy = new THREE.Object3D();
    this._camYaw = 0;
    this._levelId = null;
    this._markerTime = 0;
    this._saveClock = 0;
    this._unsubStand = bus.on('sleep:stand', () => {
      if (this.blocking && this.mode === 'meditate') this._endMeditation(false);
    });
    this._buildMarker();
    this._syncUi();
    this._publish();
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

  get canSleep() {
    return this.value >= SLEEP.minSleep;
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
        meditateLabel: 'Meditate in the Van',
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
      meditateLabel: 'Meditate at Home',
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
      if (this.mode === 'meditate') this._tickMeditation(dt, s);
      else this._tickSleep(dt);
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

  _progress() {
    if (this.mode === 'meditate') {
      return clamp(1 - this.value / Math.max(1, this._meditateStart));
    }
    if (this.phase === 'lapse' && this.lapseDuration > 0) {
      return this.lapseElapsed / this.lapseDuration;
    }
    if (this.phase === 'wake') return 1;
    return 0;
  }

  _publish() {
    const dreamVisible =
      this.mode === 'sleep' &&
      this.outcome === 'dream' &&
      this.phase === 'lapse' &&
      this.lapseElapsed < Math.min(SLEEP.dreamSeconds, this.lapseDuration);
    ui.sleep = {
      active: this.blocking,
      mode: this.mode,
      phase: this.phase,
      progress: this._progress(),
      blackout: this._blackout,
      content: this._content,
      dream: this.outcome === 'dream',
      dreamVisible,
      location: this.spot ? this.spot.name : '',
      clock: formatClock(this.g.dayCycle.t),
      duration: this.mode === 'sleep' ? formatDuration(this.totalHours) : '',
      day: this.g.dayCycle.day,
      sleepiness: this.value,
      meditateNext: Math.max(0, Math.ceil(SLEEP.meditateTickSeconds - this._meditateTimer))
    };
  }

  _lock(sound) {
    const g = this.g;
    g.audio.horn(false);
    g.audio.setEngine(0, 0, false);
    g.audio.setSkid(0);
    if (sound) g.audio.play(sound);
    g.music.pauseGame();
    g.foley.stop();
    ui.prompt = null;
  }

  useSpot() {
    return this.canSleep ? this.begin() : this.beginMeditation();
  }

  _captureCamera() {
    const cam = this.g.camera;
    this._camFromPos.copy(cam.position);
    this._camFromQuat.copy(cam.quaternion);
    this._camYaw = this.g.player ? this.g.player.yaw : 0;
  }

  _restoreCamera() {
    if (!this.g.camera) return;
    this.g.camera.position.copy(this._camFromPos);
    this.g.camera.quaternion.copy(this._camFromQuat);
  }

  updateCamera() {
    if (!this.blocking || this.mode !== 'sleep') return;
    const cam = this.g.camera;
    let k = 0;
    if (this.phase === 'fade') k = this.timer / SLEEP.fadeSeconds;
    else if (this.phase === 'lapse') k = 1;
    else if (this.phase === 'wake') k = 1 - this.timer / SLEEP.wakeSeconds;
    k = Math.min(1, Math.max(0, k));
    k = k * k * (3 - 2 * k);

    const yaw = this._camYaw + Math.sin(this.lapseElapsed * 0.16) * 0.25;
    const dummy = this._camDummy;
    dummy.position.copy(this._camFromPos);
    dummy.lookAt(
      this._camFromPos.x + Math.sin(yaw) * 18,
      this._camFromPos.y + 24,
      this._camFromPos.z + Math.cos(yaw) * 18
    );

    cam.position.copy(this._camFromPos);
    cam.quaternion.copy(this._camFromQuat).slerp(dummy.quaternion, k);
  }

  begin() {
    if (this.blocking || ui.screen !== 'playing' || !this.canSleep) return false;
    this.getSpot();
    this._captureCamera();

    this.blocking = true;
    this.mode = 'sleep';
    this.phase = 'fade';
    this.timer = 0;
    this.outcome = Math.random() < SLEEP.dreamChance ? 'dream' : 'plain';
    this._startValue = this.value;
    this.totalHours = Math.max(0.05, (this.value / SLEEP.max) * SLEEP.hoursAtFull);
    this.lapseDuration = Math.max(
      SLEEP.minLapseSeconds,
      this.totalHours * SLEEP.lapseSecondsPerHour
    );
    this.lapseElapsed = 0;
    this._advancedHours = 0;
    this._blackout = 0;
    this._content = 0;
    this.g.dayCycle.paused = true;
    this._lock('door');
    this._publish();
    return true;
  }

  beginMeditation() {
    if (this.blocking || ui.screen !== 'playing' || this.value <= 0) return false;
    this.getSpot();

    this.blocking = true;
    this.mode = 'meditate';
    this.phase = 'meditate';
    this.timer = 0;
    this.outcome = null;
    this._meditateTimer = 0;
    this._meditateStart = this.value;
    this._blackout = 0;
    this._content = 1;
    this.g.dayCycle.paused = false;
    this._lock('notify');
    this._publish();
    return true;
  }

  _tickSleep(dt) {
    if (this.phase === 'fade') {
      this.timer += dt;
      const p = Math.min(1, this.timer / SLEEP.fadeSeconds);
      this._blackout = p;
      this._content = p;
      this._publish();
      if (this.timer >= SLEEP.fadeSeconds) {
        this.phase = 'lapse';
        this.timer = 0;
        this.lapseElapsed = 0;
        this._blackout = 0;
        this._content = 1;
        this._publish();
        if (this.outcome === 'dream') {
          bus.emit('sleep:dream', {
            location: this.spot ? this.spot.name : 'somewhere',
            kind: this.spotKind,
            hours: this.totalHours,
            day: this.g.dayCycle.day,
            clock: formatClock(this.g.dayCycle.t)
          });
        }
      }
      return;
    }

    if (this.phase === 'lapse') {
      this.timer += dt;
      this.lapseElapsed = Math.min(this.lapseDuration, this.lapseElapsed + dt);
      const p = this.lapseDuration > 0 ? this.lapseElapsed / this.lapseDuration : 1;
      const targetHours = this.totalHours * p;
      const delta = targetHours - this._advancedHours;
      if (delta > 0) {
        this.g.dayCycle.advanceHours(delta);
        this._advancedHours = targetHours;
      }
      this.value = Math.max(0, this._startValue * (1 - p));
      this._syncUi();
      this._saveClock += dt;
      if (this._saveClock >= 1) {
        this._saveClock = 0;
        this.save();
      }
      this._publish();
      if (this.lapseElapsed >= this.lapseDuration) this._wake();
      return;
    }

    if (this.phase === 'wake') {
      this.timer += dt;
      const p = Math.min(1, this.timer / SLEEP.wakeSeconds);
      this._blackout = 0;
      this._content = 1 - p;
      this._publish();
      if (this.timer >= SLEEP.wakeSeconds) this._finish();
    }
  }

  _tickMeditation(dt, s) {
    this.timer += dt;
    this.g.dayCycle.update(dt);
    this._meditateTimer += dt;
    this._blackout = 0;
    this._content = 1;

    while (this._meditateTimer >= SLEEP.meditateTickSeconds && this.value > 0) {
      this._meditateTimer -= SLEEP.meditateTickSeconds;
      this.value = Math.max(0, this.value - SLEEP.meditateAmount);
      this._syncUi();
      this.save();
    }

    if (this.value <= 0) {
      this._endMeditation(true);
      return;
    }
    if (s && (s.interactPressed || s.pausePressed)) {
      this._endMeditation(false);
      return;
    }
    this._publish();
  }

  _wake() {
    this.value = 0;
    this._saveClock = 0;
    this.save();
    this._syncUi();
    this.phase = 'wake';
    this.timer = 0;
    this._blackout = 0;
    this._content = 1;
    this._publish();
    this.g.audio.play('dayEnd');
  }

  _finish() {
    const wasDream = this.outcome === 'dream';
    const slept = this.totalHours;
    const clock = formatClock(this.g.dayCycle.t);
    this._restoreCamera();
    this.blocking = false;
    this.mode = null;
    this.phase = 'idle';
    this.timer = 0;
    this.outcome = null;
    this._blackout = 0;
    this._content = 0;
    this.g.dayCycle.paused = false;
    this._publish();
    this.g.music.resumeGame(ui.playerMode === 'drive');
    this.g.foley.start();
    toast(`You slept ${formatDuration(slept)} and woke at ${clock}.`, 'success', 4200);
    if (wasDream) toast('You wake from a strange dream.', 'info', 3600);
  }

  _endMeditation(full) {
    const reduced = Math.max(0, Math.round(this._meditateStart - this.value));
    const clock = formatClock(this.g.dayCycle.t);
    this.blocking = false;
    this.mode = null;
    this.phase = 'idle';
    this.timer = 0;
    this._meditateTimer = 0;
    this._blackout = 0;
    this._content = 0;
    this._publish();
    this.g.music.resumeGame(ui.playerMode === 'drive');
    this.g.foley.start();
    if (full) toast('You are fully rested.', 'success', 3600);
    else if (reduced > 0) toast(`You meditate — tiredness down ${reduced}%. It is ${clock}.`, 'success', 3600);
    else toast('You stand up.', 'info', 2400);
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
      if (this.mode === 'sleep') this._restoreCamera();
      this.blocking = false;
      this.mode = null;
      this.phase = 'idle';
      this.timer = 0;
      this.outcome = null;
      this._meditateTimer = 0;
      this.g.dayCycle.paused = false;
    }
    this.value = SLEEP.startValue;
    this._saveClock = 0;
    this._blackout = 0;
    this._content = 0;
    this.save();
    this._syncUi();
    this._publish();
  }

  dispose() {
    if (this._unsubStand) {
      this._unsubStand();
      this._unsubStand = null;
    }
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
