import * as THREE from 'three';
import { CONFIG, VEHICLE_PROFILES } from '../config.js';
import { Loop } from '../core/Loop.js';
import { bus } from '../core/bus.js';
import { InputManager } from '../input/InputManager.js';
import { AudioSystem } from '../audio/AudioSystem.js';
import { MusicManager } from '../audio/MusicManager.js';
import { FoleySystem } from '../audio/FoleySystem.js';
import { CollisionWorld } from '../physics/CollisionWorld.js';
import { CameraRig } from '../camera/CameraRig.js';
import { generateCity } from '../city/CityGenerator.js';
import { getLevel, DEFAULT_LEVEL_ID, levelList } from '../levels/index.js';
import { Vehicle } from '../vehicle/Vehicle.js';
import { Player } from '../player/Player.js';
import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { SleepSystem } from '../sleep/SleepSystem.js';
import { InteriorManager } from '../interiors/InteriorManager.js';
import { DayNightCycle } from '../world/DayNightCycle.js';
import { Sky } from '../world/Sky.js';
import { createScenery } from '../world/Scenery.js';
import { NPCTraffic } from '../world/NPCTraffic.js';
import { DeliveryGenerator } from '../delivery/DeliveryGenerator.js';
import { DeliveryStateMachine, DeliveryState } from '../delivery/DeliveryStateMachine.js';
import { Progression } from '../progression/Progression.js';
import { DeliveryMode } from './modes/DeliveryMode.js';
import { registerRhythmModes } from '../rhythm/index.js';
import { RadioSystem } from '../radio/RadioSystem.js';
import { Multiplayer } from '../net/Multiplayer.js';
import { ui, toast, applyUiScale } from '../ui/store.js';

const MINIMAP_ZONE_COLORS = {
  residential: '#79a860',
  commercial: '#b8b2a4',
  business: '#9aa4ad',
  campus: '#6ba06b',
  industrial: '#7d7466'
};

function buildMinimapStatic(minimapData) {
  const size = 220;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = minimapData.half;
  const scale = size / (half * 2);
  const toPx = (v) => (v + half) * scale;

  ctx.fillStyle = '#31363d';
  ctx.fillRect(0, 0, size, size);

  for (const b of minimapData.blocks) {
    ctx.fillStyle = MINIMAP_ZONE_COLORS[b.zone] || '#888';
    ctx.fillRect(toPx(b.x - b.w / 2), toPx(b.z - b.d / 2), b.w * scale, b.d * scale);
  }

  for (const p of minimapData.pois) {
    ctx.beginPath();
    ctx.arc(toPx(p.x), toPx(p.z), 2.6, 0, Math.PI * 2);
    ctx.fillStyle = p.category === 'food' ? '#ffd23f' : p.category === 'gas' ? '#4cc9f0' : '#ff8fab';
    ctx.fill();
  }

  const edge = 13;
  ctx.fillStyle = '#3f7f9e';
  ctx.fillRect(0, 0, edge, size);
  ctx.fillStyle = '#82876f';
  ctx.fillRect(0, 0, size, edge);
  ctx.fillRect(0, size - edge, size, edge);
  ctx.fillRect(size - edge, 0, edge, size);
  return canvas;
}

export class Game {
  constructor(container) {
    this.container = container;

    const r = CONFIG.render;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, r.maxPixelRatio));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      r.fov,
      container.clientWidth / container.clientHeight,
      0.1,
      2200
    );
    this.cameraRig = new CameraRig(this.camera);

    this.sunLight = new THREE.DirectionalLight('#ffffff', 1.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(r.shadowMapSize, r.shadowMapSize);
    const sc = this.sunLight.shadow.camera;
    sc.left = -95;
    sc.right = 95;
    sc.top = 95;
    sc.bottom = -95;
    sc.near = 20;
    sc.far = 420;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight('#cfe8ff', '#5a6a52', 0.7);
    this.scene.add(this.hemiLight);
    this.ambLight = new THREE.AmbientLight('#ffffff', 0.35);
    this.scene.add(this.ambLight);

    this.collision = new CollisionWorld();
    this.input = new InputManager();
    this.audio = new AudioSystem();
    this.music = new MusicManager();
    this.radio = new RadioSystem(this, this.music);
    this.foley = new FoleySystem();
    this.progression = new Progression();

    this.level = getLevel(DEFAULT_LEVEL_ID);
    ui.levelId = this.level.id;
    ui.levels = levelList(this.progression);

    this.sky = new Sky(this.scene);
    this.dayCycle = new DayNightCycle(bus);
    this.envState = {};

    this.player = new Player(this.scene);
    this.interaction = new InteractionSystem();
    this.interiors = new InteriorManager(this.scene, this.collision);

    this._buildWorld();
    this._buildFleet();

    this.sleep = new SleepSystem(this);
    this.multiplayer = new Multiplayer(this);

    this.generator = new DeliveryGenerator(this.city.locations);
    this.fsm = new DeliveryStateMachine(bus);

    this._modeFactories = new Map();
    this.currentMode = null;

    this._bindEvents();

    this._titleT = 0;
    this.loop = new Loop((dt) => this.update(dt), () => this.render());
  }

  _buildWorld() {
    const level = this.level;
    this.city = generateCity(this.collision, level);
    this.scene.add(this.city.group);
    this.scenery = createScenery(this.scene, this.collision, level);
    this.npcTraffic = new NPCTraffic(this.scene, level);
    ui.minimapHalf = this.city.minimapData.half;
    this._buildMinimap();
  }

  _buildFleet() {
    this.vehicles = {};
    const slots = this.city.storage;
    for (const id of this.level.vehicles) {
      const profile = VEHICLE_PROFILES[id];
      if (!profile) continue;
      const v = new Vehicle(this.scene, this.collision, profile);
      v.resolveNpc = (x, z, r) => this.npcTraffic.resolveCircle(x, z, r);
      const slot = slots ? slots[id + 'Slot'] : null;
      if (slot) v.reset(slot.x, slot.z, slot.heading);
      else v.reset(this.city.spawn.x + 6, this.city.spawn.z - 5, Math.PI);
      this.vehicles[id] = v;
    }
    this.activeVehicleId = this.level.vehicles[0] || 'car';
    ui.vehicleId = this.activeVehicleId;
  }

  get vehicle() {
    return this.vehicles[this.activeVehicleId] || null;
  }

  setActiveVehicle(id) {
    if (!this.vehicles[id] || id === this.activeVehicleId) return false;
    this.activeVehicleId = id;
    ui.vehicleId = id;
    return true;
  }

  loadLevel(id) {
    if (id === this.level.id) return;
    if (this.multiplayer && this.multiplayer.inRoom && !this.multiplayer.switchingLevel) {
      toast('Leave multiplayer before changing levels.', 'warn');
      return;
    }
    const next = getLevel(id);
    if (!next) return;

    const wasPlaying = ui.screen === 'playing';
    if (this.currentMode) {
      this.currentMode.exit();
      this.currentMode = null;
    }
    if (this.interiors.isInside) this.interiors.exit();

    for (const v of Object.values(this.vehicles)) v.dispose();
    this.vehicles = {};
    if (this.city) {
      this.scene.remove(this.city.group);
      this.city.dispose();
      this.city = null;
    }
    if (this.scenery) {
      this.scene.remove(this.scenery.group);
      this.scenery = null;
    }
    if (this.npcTraffic) {
      this.npcTraffic.destroy();
      this.npcTraffic = null;
    }
    this.collision.clear('city');
    this.interaction.clear();

    this.level = next;
    ui.levelId = next.id;
    this.fsm.reset();
    this._buildWorld();
    this._buildFleet();
    this.sleep.onLevelChange();
    this.generator = new DeliveryGenerator(this.city.locations);

    this.audio.horn(false);
    this.audio.setEngine(0, 0, false);
    this.audio.setSkid(0);
    ui.offer = null;
    ui.objective = null;
    ui.prompt = null;

    if (wasPlaying) {
      this.setMode('delivery');
    }
  }

  registerModes() {
    const ctx = this;
    this._modeFactories.set('delivery', () => new DeliveryMode(ctx));
    registerRhythmModes({ register: (id, fn) => this._modeFactories.set(id, fn) }, ctx);
  }

  _bindEvents() {
    this._volumeAngle = null;
    this._uiSubs = [
      bus.on('ui:start', () => {
        this.beginRun();
      }),
      bus.on('ui:pause', (v) => this.setPaused(v)),
      bus.on('ui:mute', () => {
        ui.muted = this.audio.toggleMute();
        this.music.setMuted(ui.muted);
        this.foley.setMuted(ui.muted);
      }),
      bus.on('ui:accept', () => {
        if (this.fsm.state === DeliveryState.OFFER) this.fsm.accept();
      }),
      bus.on('ui:decline', () => {
        if (this.fsm.state === DeliveryState.OFFER) this.fsm.decline();
      }),
      bus.on('ui:song', ({ name, enabled }) => {
        this.music.setRadioEnabled(name, enabled);
      }),
      bus.on('ui:radio-volume', (volume) => {
        this.music.setRadioVolume(volume);
        this.radio.setVolume(this.music.radioVolume);
      }),
      bus.on('ui:song-volume', ({ name, volume }) => {
        this.music.setSongVolume(name, volume);
      }),
      bus.on('ui:radio-select', (id) => {
        this.radio.selectStation(id);
      }),
      bus.on('ui:spotify-client-id', (id) => {
        this.radio.setSpotifyClientId(id);
      }),
      bus.on('ui:spotify-connect', () => {
        this.radio.connectSpotify();
      }),
      bus.on('ui:spotify-disconnect', () => {
        this.radio.disconnectSpotify();
      }),
      bus.on('ui:reset-data', () => {
        this.resetAllData();
      }),
      bus.on('ui:level', (id) => {
        this.loadLevel(id);
      })
    ];

    this._onResize = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);

    this._dragging = false;
    this._lastX = 0;
    const el = this.renderer.domElement;
    this._onDown = (e) => {
      this._dragging = true;
      this._lastX = e.clientX;
    };
    this._onMove = (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastX;
      this._lastX = e.clientX;
      this.cameraRig.orbitYaw -= dx * 0.006;
    };
    this._onUp = () => {
      this._dragging = false;
    };
    el.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);

    this._onFirstGesture = () => this._ensureAudio();
    window.addEventListener('pointerdown', this._onFirstGesture);
    window.addEventListener('keydown', this._onFirstGesture);

    this._onHide = () => this.sleep.save();
    window.addEventListener('beforeunload', this._onHide);
    window.addEventListener('pagehide', this._onHide);
  }

  _buildMinimap() {
    ui.minimapStatic = buildMinimapStatic(this.city.minimapData);
  }

  async beginRun() {
    this._ensureAudio();
    if (!this.currentMode) {
      this.registerModes();
      this.setMode('delivery');
    }
    ui.screen = 'playing';
    ui.paused = false;
    this.music.enterGame();
    this.radio.onRunStart();
    this._ensureAudio();
    if (this.foley.ready) this.foley.start();
  }

  _ensureAudio() {
    if (this._audioStarted) return;
    this._audioStarted = true;
    this.music.unlock();
    const start = () => {
      this.audio.init().then(() => {
        this.music.setMuted(this.audio.muted);
        return this.foley.init();
      }).then(() => {
        this.foley.setMuted(this.audio.muted);
        if (ui.screen === 'playing' && !ui.paused) this.foley.start();
      });
    };
    start();
  }

  _updateRadio(dt, s) {
    const held = !!s.radioHeld;
    if (held && !this._lbPrev) {
      this._lbHold = 0;
      this._lbSelector = false;
    } else if (held) {
      this._lbHold += dt;
      if (!this._lbSelector && this._lbHold >= 0.22) {
        this._lbSelector = true;
        this.radio.openSelector();
        this.audio.play('ui');
      }
    }
    if (held && this._lbSelector) {
      if (s.radioUpPressed) {
        this.radio.selectNext();
        this.audio.play('ui');
      } else if (s.radioDownPressed) {
        this.radio.selectPrevious();
        this.audio.play('ui');
      } else if (s.radioLeftPressed || s.radioRightPressed) {
        this.radio.togglePower();
        this.audio.play('ui');
      }
    } else if (!held && this._lbPrev) {
      if (this._lbSelector) {
        this.radio.closeSelector();
      } else {
        this.radio.nextTrack();
        this.audio.play('ui');
      }
    }
    this._lbPrev = held;
  }

  _updateMusicVolume(s) {
    if (s.musicVolumePressed) {
      ui.musicVolumeActive = !ui.musicVolumeActive;
      this._volumeAngle = null;
      this.audio.play('ui');
    }
    if (!ui.musicVolumeActive) {
      this._volumeAngle = null;
      return;
    }
    const x = s.rightStickX || 0;
    const y = s.rightStickY || 0;
    if (Math.hypot(x, y) < 0.35) {
      this._volumeAngle = null;
      return;
    }
    const angle = Math.atan2(y, x);
    if (this._volumeAngle === null) {
      this._volumeAngle = angle;
      return;
    }
    let delta = angle - this._volumeAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this._volumeAngle = angle;
    if (Math.abs(delta) < 0.002) return;
    this.music.setRadioVolume(this.music.radioVolume + (delta / (Math.PI * 2)) * 2);
    this.radio.setVolume(this.music.radioVolume);
  }

  setMode(name) {
    if (this.currentMode) {
      this.currentMode.exit();
      this.currentMode = null;
    }
    const factory = this._modeFactories.get(name);
    if (!factory) return;
    this.currentMode = factory();
    this.currentMode.enter();
  }

  setPaused(v) {
    ui.paused = v;
    this.multiplayer?.setPaused(v);
    if (v) {
      ui.musicVolumeActive = false;
      this._volumeAngle = null;
      this._lbPrev = false;
      this._lbHold = 0;
      this._lbSelector = false;
      if (this.currentMode) {
        this.audio.horn(false);
        this.audio.setEngine(0, 0, false);
        this.audio.setSkid(0);
      }
    }
    if (v) {
      this.radio.gamePause();
      this.foley.stop();
    } else {
      this.radio.gameResume();
      this.foley.start();
    }
  }

  resetAllData() {
    this.multiplayer?.leave();
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('snackrun')) localStorage.removeItem(key);
    }
    this.progression = new Progression();
    for (const veh of Object.values(this.vehicles)) {
      veh.repairFull();
      veh.refuel(veh.fuelMax);
    }
    this.music.resetRadioPlaylist();
    this.music.resetVolumes();
    this.radio.reset();
    this.sleep.reset();
    this.multiplayer?.resetSettings();
    ui.musicVolumeActive = false;
    ui.trafficEnabled = true;
    ui.mobileOverride = null;
    applyUiScale();
    ui.money = 0;
    ui.todayEarned = 0;
    ui.deliveriesToday = 0;
    toast('Game data reset to factory settings.', 'success');
  }

  _applyEnvironment() {
    const st = (this.envState = this.dayCycle.sample(this.envState));
    const focus =
      this.currentMode && this.currentMode.playerMode !== 'drive'
        ? this.player.pos
        : this.vehicle.position;

    this.sunLight.color.copy(st.sun);
    this.sunLight.intensity = st.sunI;
    this.sunLight.position.copy(focus).addScaledVector(st.sunDir, 170);
    this.sunLight.target.position.copy(focus);
    this.ambLight.intensity = st.ambI * 0.55;
    this.hemiLight.intensity = st.ambI * 1.15;
    this.sky.apply(st, this.camera.position);

    const cityMats = this.city.windowsMaterial;
    cityMats.emissiveIntensity = st.windowGlow * 1.5;
    const night = Math.max(st.windowGlow, st.starAlpha);
    for (const veh of Object.values(this.vehicles)) veh.setNightFactor(night);

    ui.clock = st.clock;
    ui.phase = st.name;
    ui.day = this.dayCycle.day;
    ui.padConnected = this.input.padConnected;
    ui.padName = this.input.padName;
  }

  update(dt) {
    const s = this.input.getState();
    this.radio.update(dt);

    if (ui.screen === 'title') {
      this._titleT += dt * 0.05;
      this.dayCycle.update(dt);
      this._applyEnvironment();
      const t = this._titleT;
      const orbit = this.city.minimapData.half * 0.92;
      this.camera.position.set(Math.cos(t) * orbit, orbit * 0.38, Math.sin(t) * orbit);
      this.camera.lookAt(0, 0, 0);
      this.sky.update(dt);
      this.scenery.update(dt);
      if (s.acceptPressed || s.interactPressed || s.enterExitPressed) {
        bus.emit('ui:start');
      }
      return;
    }

    if (s.pausePressed && !this.sleep.blocking) this.setPaused(!ui.paused);
    if (ui.paused) {
      return;
    }
    if (s.mutePressed) {
      ui.muted = this.audio.toggleMute();
      this.music.setMuted(ui.muted);
      this.foley.setMuted(ui.muted);
    }
    this._updateRadio(dt, s);
    this._updateMusicVolume(s);
    this.foley.update(dt);

    this.sleep.update(dt, s);
    if (this.sleep.blocking) {
      this.sleep.updateCamera();
      this._applyEnvironment();
      this.sky.update(dt);
      this.scenery.update(dt);
      this.multiplayer?.update(dt, s);
      return;
    }

    this.dayCycle.update(dt);
    this._applyEnvironment();
    this.sky.update(dt);
    this.scenery.update(dt);
    if (this.npcTraffic && ui.trafficEnabled) {
      const playerPos = this.vehicle.group.position;
      this.npcTraffic.update(dt, this.envState.name, playerPos);
    }

    if (this.currentMode) {
      this.currentMode.update(dt, s);
    }
    this.multiplayer?.update(dt, s);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointerdown', this._onFirstGesture);
    window.removeEventListener('keydown', this._onFirstGesture);
    window.removeEventListener('beforeunload', this._onHide);
    window.removeEventListener('pagehide', this._onHide);
    this.sleep.save();
    this.sleep.dispose();
    this.multiplayer.dispose();
    this.radio.dispose();
    this.music.dispose();
    this.foley.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.city.dispose();
    this.renderer.dispose();
  }
}
