import * as THREE from 'three';
import { Player } from '../player/Player.js';
import { VEHICLE_PROFILES } from '../config.js';

const VOICE_RANGE = 75;
const BODY_COLORS = ['#e8615a', '#2a9d8f', '#f2a541', '#4cc9f0', '#9b5de5', '#f15bb5', '#80b918', '#ef8354'];

function hashColor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BODY_COLORS[h % BODY_COLORS.length];
}

function makeTag(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.9, 0.72, 1);
  return { canvas, ctx, texture, sprite, key: '' };
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTag(tag, name, mic) {
  const label = (name || 'DRIVER').slice(0, 14);
  const key = `${label}|${mic ? 1 : 0}`;
  if (tag.key === key) return;
  tag.key = key;
  const { ctx } = tag;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(17, 24, 32, 0.66)';
  roundedRect(ctx, 14, 8, 228, 48, 14);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(38, 32, 8, 0, Math.PI * 2);
  ctx.fillStyle = mic ? '#9ef01a' : '#7f8b99';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 56, 34, 176);
  tag.texture.needsUpdate = true;
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose();
    if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
    else obj.material?.dispose();
  });
}

function buildVehicleMesh(style, color) {
  const profile = style === 'van' ? VEHICLE_PROFILES.van : VEHICLE_PROFILES.car;
  const B = profile.bodyWidth;
  const L = profile.bodyLength;
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const cabinMat = new THREE.MeshLambertMaterial({ color: '#3b4652' });
  const darkMat = new THREE.MeshLambertMaterial({ color: '#22262c' });
  const tireMat = new THREE.MeshLambertMaterial({ color: '#1a1d21' });
  const rimMat = new THREE.MeshLambertMaterial({ color: '#d8d8d8' });

  if (style === 'van') {
    const lower = new THREE.Mesh(new THREE.BoxGeometry(B, 0.66, L), bodyMat);
    lower.position.y = 0.7;
    lower.castShadow = true;
    group.add(lower);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(B, 1.5, L * 0.62), bodyMat);
    cargo.position.set(0, 1.78, -L * 0.17);
    cargo.castShadow = true;
    group.add(cargo);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(B * 0.98, 0.5, L * 0.2), bodyMat);
    nose.position.set(0, 1.26, L * 0.4);
    group.add(nose);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(B * 0.92, 0.66, L * 0.2), cabinMat);
    windshield.position.set(0, 1.6, L * 0.4);
    group.add(windshield);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(B * 1.005, 0.2, L * 0.62),
      new THREE.MeshLambertMaterial({ color: '#f2f0e6' })
    );
    stripe.position.set(0, 1.24, -L * 0.17);
    group.add(stripe);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(B, 0.72, L), bodyMat);
    body.position.y = 0.72;
    body.castShadow = true;
    group.add(body);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(B * 0.96, 0.3, L * 0.28), bodyMat);
    hood.position.set(0, 1.14, L * 0.34);
    group.add(hood);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(B * 0.86, 0.62, L * 0.42), cabinMat);
    cabin.position.set(0, 1.36, -L * 0.06);
    cabin.castShadow = true;
    group.add(cabin);
  }

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(B * 1.02, 0.22, 0.24), darkMat);
  bumperF.position.set(0, 0.52, L / 2);
  group.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = -L / 2;
  group.add(bumperR);

  const wr = profile.wheelRadius;
  const wheelGeo = new THREE.CylinderGeometry(wr, wr, wr * 0.8, 10).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wr * 0.5, wr * 0.5, wr * 0.84, 8).rotateZ(Math.PI / 2);
  const wx = B / 2 - 0.05;
  const wz = L * 0.34;
  for (const [sx, sz] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(sx, wr, sz);
    wheel.castShadow = true;
    group.add(wheel);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.copy(wheel.position);
    group.add(rim);
  }

  return group;
}

class Remote {
  constructor(scene, id, name) {
    this.scene = scene;
    this.id = id;
    this.name = name;
    this.person = new Player(scene);
    this.person.setVisible(false);
    this.vehicle = null;
    this.vehicleStyle = '';
    this.tag = makeTag(name);
    scene.add(this.tag.sprite);
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
    this.tx = 0;
    this.tz = 0;
    this.tyaw = 0;
    this.mode = 3;
    this.veh = 0;
    this.speed = 0;
    this.mic = false;
    this.snap = true;
    this.lastSeen = performance.now();
  }

  setState(state) {
    const [, x, z, yaw, mode, veh, speed, mic] = state;
    this.tx = x;
    this.tz = z;
    this.tyaw = yaw;
    this.mode = mode === 0 || mode === 1 || mode === 2 ? mode : 3;
    this.veh = veh ? 1 : 0;
    this.speed = Math.max(0, Math.min(100, speed || 0));
    this.mic = !!mic;
    this.lastSeen = performance.now();
    if (this.snap) {
      this.x = this.tx;
      this.z = this.tz;
      this.yaw = this.tyaw;
      this.snap = false;
    }
  }

  setName(name) {
    const next = name || 'DRIVER';
    if (next === this.name) return;
    this.name = next;
    this.tag.key = '';
  }

  update(dt) {
    const k = 1 - Math.exp(-14 * dt);
    const gap = Math.hypot(this.tx - this.x, this.tz - this.z);
    if (gap > 45) {
      this.x = this.tx;
      this.z = this.tz;
      this.yaw = this.tyaw;
    } else {
      this.x += (this.tx - this.x) * k;
      this.z += (this.tz - this.z) * k;
      const d = Math.atan2(Math.sin(this.tyaw - this.yaw), Math.cos(this.tyaw - this.yaw));
      this.yaw += d * k;
    }

    const hidden = this.mode === 3;
    let tagY = 2.1;
    if (this.mode === 0) {
      this._ensureVehicle(this.veh ? 'van' : 'car');
      this.person.setVisible(false);
      this.vehicle.visible = !hidden;
      this.vehicle.position.set(this.x, 0, this.z);
      this.vehicle.rotation.y = this.yaw;
      tagY = this.veh ? 3.35 : 2.95;
    } else {
      if (this.vehicle) this.vehicle.visible = false;
      this.person.setVisible(!hidden);
      if (!hidden) {
        this.person.pos.set(this.x, 0, this.z);
        this.person.yaw = this.yaw;
        if (this.mode === 1) this.person.walkPhase += this.speed * dt * 2.6;
        else this.person.walkPhase *= Math.exp(-8 * dt);
        this.person.syncMesh();
      }
    }

    this.tag.sprite.position.set(this.x, tagY, this.z);
    this.tag.sprite.visible = !hidden;
    drawTag(this.tag, this.name, this.mic);
  }

  _ensureVehicle(style) {
    if (this.vehicle && this.vehicleStyle === style) return;
    if (this.vehicle) {
      this.scene.remove(this.vehicle);
      disposeGroup(this.vehicle);
      this.vehicle = null;
    }
    const group = buildVehicleMesh(style, hashColor(this.id));
    group.visible = false;
    this.scene.add(group);
    this.vehicle = group;
    this.vehicleStyle = style;
  }

  dispose() {
    this.scene.remove(this.tag.sprite);
    this.tag.texture.dispose();
    this.tag.sprite.material.dispose();
    if (this.vehicle) {
      this.scene.remove(this.vehicle);
      disposeGroup(this.vehicle);
      this.vehicle = null;
    }
    if (this.person.group.parent) this.person.group.parent.remove(this.person.group);
    disposeGroup(this.person.group);
  }
}

export class RemotePlayers {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map();
    this.roster = new Map();
    this.hostId = null;
  }

  get count() {
    return this.players.size;
  }

  setRoster(list, hostId) {
    this.roster.clear();
    this.hostId = hostId || null;
    for (const p of list || []) {
      if (p && p.id) this.roster.set(p.id, p.name || 'DRIVER');
    }
    for (const [id, remote] of this.players) {
      const name = this.roster.get(id);
      if (name) remote.setName(name);
    }
  }

  apply(states) {
    const seen = new Set();
    for (const state of states || []) {
      if (!Array.isArray(state) || state.length < 6) continue;
      const id = state[0];
      if (!id) continue;
      seen.add(id);
      let remote = this.players.get(id);
      if (!remote) {
        remote = new Remote(this.scene, id, this.roster.get(id) || 'DRIVER');
        this.players.set(id, remote);
      }
      remote.setState(state);
    }
    for (const id of [...this.players.keys()]) {
      if (seen.has(id)) continue;
      this.players.get(id).dispose();
      this.players.delete(id);
    }
  }

  update(dt) {
    for (const remote of this.players.values()) remote.update(dt);
  }

  voiceCandidates(x, z, limit = 8) {
    const list = [];
    for (const remote of this.players.values()) {
      if (remote.mode === 3) continue;
      const distance = Math.hypot(remote.x - x, remote.z - z);
      if (distance <= VOICE_RANGE) list.push({ id: remote.id, distance });
    }
    list.sort((a, b) => a.distance - b.distance);
    return list.slice(0, limit);
  }

  nearestDistance(x, z) {
    let nearest = Infinity;
    for (const remote of this.players.values()) {
      if (remote.mode === 3) continue;
      const distance = Math.hypot(remote.x - x, remote.z - z);
      if (distance < nearest) nearest = distance;
    }
    return Number.isFinite(nearest) ? nearest : null;
  }

  blips() {
    const list = [];
    for (const remote of this.players.values()) {
      if (remote.mode === 3) continue;
      list.push({ x: remote.x, z: remote.z, remote: true });
    }
    return list;
  }

  clear() {
    for (const remote of this.players.values()) remote.dispose();
    this.players.clear();
    this.roster.clear();
    this.hostId = null;
  }
}
