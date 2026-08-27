import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Loop } from '../core/Loop.js';
import { bus } from '../core/bus.js';
import { InputManager } from '../input/InputManager.js';
import { AudioSystem } from '../audio/AudioSystem.js';
import { MusicManager } from '../audio/MusicManager.js';
import { FoleySystem } from '../audio/FoleySystem.js';
import { CollisionWorld } from '../physics/CollisionWorld.js';
import { CameraRig } from '../camera/CameraRig.js';
import { generateCity } from '../city/CityGenerator.js';
import { Vehicle } from '../vehicle/Vehicle.js';
import { Player } from '../player/Player.js';
import { InteractionSystem } from '../interaction/InteractionSystem.js';
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
import { ui } from '../ui/store.js';

const MINIMAP_ZONE_COLORS = {
  residential: '#79a860',
  commercial: '#b8b2a4',
  business: '#9aa4ad',
  campus: '#6ba06b'
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
    this.foley = new FoleySystem();
    this.progression = new Progression();

    const cityResult = generateCity(this.collision);
    this.city = cityResult;
    this.scene.add(cityResult.group);
    this.scenery = createScenery(this.scene, this.collision);
    this.npcTraffic = new NPCTraffic(this.scene);

    this.sky = new Sky(this.scene);
    this.dayCycle = new DayNightCycle(bus);
    this.envState = {};

    this.vehicle = new Vehicle(this.scene, this.collision);
    this.vehicle.resolveNpc = (x, z, r) => this.npcTraffic.resolveCircle(x, z, r);
    this.player = new Player(this.scene);
    this.player.onStep = (i) => this.foley.step(i);
    this.interaction = new InteractionSystem();
    this.interiors = new InteriorManager(this.scene, this.collision);

    this.generator = new DeliveryGenerator(this.city.locations);
    this.fsm = new DeliveryStateMachine(bus);

    this._modeFactories = new Map();
    this.currentMode = null;

    this._buildMinimap();
    this._bindEvents();

    this._titleT = 0;
    this.loop = new Loop((dt) => this.update(dt), () => this.render());
  }

  registerModes() {
    const ctx = this;
    this._modeFactories.set('delivery', () => new DeliveryMode(ctx));
    registerRhythmModes({ register: (id, fn) => this._modeFactories.set(id, fn) }, ctx);
  }

  _bindEvents() {
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
      this._lbFired = false;
    } else if (held) {
      this._lbHold += dt;
      if (!this._lbFired && this._lbHold >= 0.65) {
        this._lbFired = true;
        this.music.toggleRadio();
        this.audio.play('ui');
      }
    } else if (this._lbPrev && !this._lbFired) {
      this.music.radioNext();
      this.audio.play('ui');
    }
    this._lbPrev = held;
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
    if (this.currentMode && v) {
      this.audio.horn(false);
      this.audio.setEngine(0, 0, false);
      this.audio.setSkid(0);
    }
    if (v) {
      this.music.pauseGame();
      this.foley.stop();
    } else {
      const inCar = !this.currentMode || this.currentMode.playerMode === 'drive';
      this.music.resumeGame(inCar);
      this.foley.start();
    }
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
    this.vehicle.setNightFactor(Math.max(st.windowGlow, st.starAlpha));

    ui.clock = st.clock;
    ui.phase = st.name;
    ui.day = this.dayCycle.day;
    ui.padConnected = this.input.padConnected;
  }

  update(dt) {
    const s = this.input.getState();

    if (ui.screen === 'title') {
      this._titleT += dt * 0.05;
      this.dayCycle.update(dt);
      this._applyEnvironment();
      const t = this._titleT;
      this.camera.position.set(Math.cos(t) * 165, 62, Math.sin(t) * 165);
      this.camera.lookAt(0, 0, 0);
      this.sky.update(dt);
      this.scenery.update(dt);
      if (s.acceptPressed || s.interactPressed || s.enterExitPressed) {
        bus.emit('ui:start');
      }
      return;
    }

    if (s.pausePressed) this.setPaused(!ui.paused);
    if (ui.paused) {
      return;
    }
    if (s.mutePressed) {
      ui.muted = this.audio.toggleMute();
      this.music.setMuted(ui.muted);
      this.foley.setMuted(ui.muted);
    }
    this._updateRadio(dt, s);
    this.foley.update(dt);

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
    this.music.dispose();
    this.foley.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.city.dispose();
    this.renderer.dispose();
  }
}
