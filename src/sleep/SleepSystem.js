import * as THREE from 'three';
import { CONFIG, formatClock } from '../config.js';
import { bus } from '../core/bus.js';
import { ui, toast } from '../ui/store.js';

const STORAGE_KEY = 'snackrun_sleepiness';
const CAFFEINE_KEY = 'snackrun_caffeine_count';
const SLEEP = CONFIG.sleep;
const GAS = CONFIG.gas;
const STORAGE = CONFIG.storage;
const SAFE_ZONE_COLOR = '#35e8ff';

const clamp = (v) => Math.min(SLEEP.max, Math.max(0, Number.isFinite(v) ? v : SLEEP.startValue));
const clampCaffeine = (v) => Math.min(GAS.caffeineMax, Math.max(0, Number.isFinite(v) ? Math.floor(v) : 0));

function readCaffeineCount() {
  try {
    const raw = localStorage.getItem(CAFFEINE_KEY);
    if (raw !== null) return clampCaffeine(Number(raw));
  } catch {
    void 0;
  }
  return 0;
}

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

function currentHour(t) {
  const hour = (CONFIG.day.dayStartHour + t * 24) % 24;
  return hour < 0 ? hour + 24 : hour;
}

function storageOpenAt(t) {
  const hour = currentHour(t);
  const open = STORAGE.openHour;
  const close = STORAGE.closeHour;
  if (open === close) return true;
  if (open < close) return hour >= open && hour < close;
  return hour >= open || hour < close;
}

function roundedRectShape(width, depth, radius) {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw, hd);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return shape;
}

function roundedRectCurve(width, depth, radius) {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw, hd);
  const p = (x, z) => new THREE.Vector3(x, 0, z);
  const curve = new THREE.CurvePath();
  curve.add(new THREE.LineCurve3(p(-hw + r, -hd), p(hw - r, -hd)));
  curve.add(new THREE.QuadraticBezierCurve3(p(hw - r, -hd), p(hw, -hd), p(hw, -hd + r)));
  curve.add(new THREE.LineCurve3(p(hw, -hd + r), p(hw, hd - r)));
  curve.add(new THREE.QuadraticBezierCurve3(p(hw, hd - r), p(hw, hd), p(hw - r, hd)));
  curve.add(new THREE.LineCurve3(p(hw - r, hd), p(-hw + r, hd)));
  curve.add(new THREE.QuadraticBezierCurve3(p(-hw + r, hd), p(-hw, hd), p(-hw, hd - r)));
  curve.add(new THREE.LineCurve3(p(-hw, hd - r), p(-hw, -hd + r)));
  curve.add(new THREE.QuadraticBezierCurve3(p(-hw, -hd + r), p(-hw, -hd), p(-hw + r, -hd)));
  return curve;
}

function makeSafeZone(spec, storage) {
  const width = (Number(spec.width) || 0) + 1.2;
  const depth = (Number(spec.depth) || 0) + 1.2;
  const radius = Math.min(5, width * 0.12, depth * 0.12);
  const curve = roundedRectCurve(width, depth, radius);
  const fillGeometry = new THREE.ShapeGeometry(roundedRectShape(width, depth, radius), 12);
  fillGeometry.rotateX(Math.PI / 2);
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: SAFE_ZONE_COLOR,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const fill = new THREE.Mesh(fillGeometry, fillMaterial);
  fill.position.y = 0.075;

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: SAFE_ZONE_COLOR,
    transparent: true,
    opacity: 0.1,
    depthWrite: false
  });
  const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 128, 0.42, 6, true), glowMaterial);
  glow.position.y = 0.12;

  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: SAFE_ZONE_COLOR,
    transparent: true,
    opacity: 0.46,
    depthWrite: false
  });
  const outline = new THREE.Mesh(new THREE.TubeGeometry(curve, 128, 0.16, 6, true), outlineMaterial);
  outline.position.y = 0.14;

  const group = new THREE.Group();
  group.name = storage ? 'Storage Safe Sleep Zone' : 'Gym Safe Sleep Zone';
  group.userData.safeZone = true;
  group.userData.storage = storage;
  group.add(fill, glow, outline);
  group.position.set(Number(spec.x) || 0, 0, Number(spec.z) || 0);
  group.rotation.y = Number(spec.heading) || 0;
  group.visible = false;
  return { group, fillMaterial, glowMaterial, outlineMaterial, storage };
}

export class SleepSystem {
  constructor(game) {
    this.g = game;
    this.value = readSleepiness();
    this.caffeineCount = readCaffeineCount();
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
    this._safeZones = [];
    this._safeZoneTime = 0;
    this._saveClock = 0;
    this._unsubStand = bus.on('sleep:stand', () => {
      if (this.blocking && this.mode === 'meditate') this._endMeditation(false);
    });
    this._buildMarker();
    this._rebuildSafeZones();
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

  _rebuildSafeZones() {
    this._disposeSafeZones();
    const city = this.g.city;
    if (!city) return;
    const zones = [];
    for (const lot of city.gymLots || []) {
      zones.push(makeSafeZone({
        x: lot.centerX,
        z: lot.centerZ,
        width: lot.width,
        depth: lot.depth,
        heading: lot.heading || lot.sleepSlot?.heading || 0
      }, false));
    }
    if (city.storage?.safeZone) {
      zones.push(makeSafeZone(city.storage.safeZone, true));
    }
    this._safeZones = zones;
    for (const zone of zones) this.g.scene.add(zone.group);
  }

  _disposeSafeZones() {
    for (const zone of this._safeZones) {
      this.g.scene.remove(zone.group);
      zone.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    this._safeZones = [];
  }

  _inVan() {
    return (
      ui.vehicleId === 'van' &&
      this.g.currentMode &&
      this.g.currentMode.playerMode === 'drive'
    );
  }

  _updateSafeZones(dt) {
    if (!this._safeZones.length) return;
    this._safeZoneTime += dt;
    const inVan = this._inVan();
    const storageOpen = storageOpenAt(this.g.dayCycle.t);
    const pulse = Math.sin(this._safeZoneTime * 3);
    const scale = 1 + pulse * 0.018;
    for (const zone of this._safeZones) {
      const show =
        ui.screen === 'playing' &&
        !this.blocking &&
        inVan &&
        (!zone.storage || storageOpen);
      zone.group.visible = show;
      if (!show) continue;
      zone.group.scale.setScalar(scale);
      zone.fillMaterial.opacity = 0.05 + pulse * 0.02;
      zone.glowMaterial.opacity = 0.1 + pulse * 0.035;
      zone.outlineMaterial.opacity = 0.46 + pulse * 0.14;
    }
  }

  get spotKind() {
    return this.spot ? this.spot.kind : null;
  }

  get canSleep() {
    return this.value >= SLEEP.minSleep;
  }

  get onDelivery() {
    const fsm = this.g.fsm;
    return !!(fsm && fsm.isActive);
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

  spotReady(spot = this.getSpot()) {
    if (!spot) return false;
    if (spot.kind !== 'gym') return true;
    const van = spot.vehicle;
    return !!van && van.group.position.distanceTo(spot.position) <= 8;
  }

  _findSpot() {
    const g = this.g;
    const van = g.vehicles && g.vehicles.van;
    if (g.level.sleepSpot === 'gym' && g.city?.gym?.sleepSlot) {
      const slot = g.city.gym.sleepSlot;
      return {
        kind: 'gym',
        label: 'Sleep in the Van at the Gym',
        meditateLabel: 'Meditate at the Gym',
        name: 'The Gym',
        position: new THREE.Vector3(slot.x, 0, slot.z),
        slot,
        vehicle: van
      };
    }
    if (g.level.sleepSpot === 'van' && van) {
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
    this._rebuildSafeZones();
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
    this._updateSafeZones(dt);
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
      rate += this.g.vehicle && this.g.vehicle.id === 'bike'
        ? SLEEP.bikeDriveExtra
        : SLEEP.driveExtra;
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

  get caffeineRemaining() {
    return Math.max(0, GAS.caffeineMax - this.caffeineCount);
  }

  drinkCaffeine() {
    if (this.caffeineCount >= GAS.caffeineMax) return 0;
    const before = this.value;
    this.value = clamp(this.value - GAS.caffeineSleepReduction);
    this.caffeineCount = clampCaffeine(this.caffeineCount + 1);
    this.save();
    this._syncUi();
    this._publish();
    return Math.round(before - this.value);
  }

  _syncUi() {
    ui.sleepiness = this.value;
    ui.sleepy = this.value >= SLEEP.warnAt;
    ui.caffeineUsed = this.caffeineCount;
    ui.caffeineRemaining = this.caffeineRemaining;
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
    g.radio.gamePause();
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
    if (this.onDelivery) {
      toast('Finish the delivery before you sleep.', 'warn', 3200);
      return false;
    }
    if (!this.spotReady()) {
      toast('Drive the van to the gym first.', 'warn', 3200);
      return false;
    }
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
    if (!this.spotReady()) {
      toast('Drive the van to the gym first.', 'warn', 3200);
      return false;
    }

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
    this.caffeineCount = 0;
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
    this.g.radio.gameResume();
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
    this.g.radio.gameResume();
    this.g.foley.start();
    if (full) toast('You are fully rested.', 'success', 3600);
    else if (reduced > 0) toast(`You meditate — tiredness down ${reduced}%. It is ${clock}.`, 'success', 3600);
    else toast('You stand up.', 'info', 2400);
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, this.value.toFixed(1));
      localStorage.setItem(CAFFEINE_KEY, String(this.caffeineCount));
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
    this.caffeineCount = 0;
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
    this._disposeSafeZones();
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
