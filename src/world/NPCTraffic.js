import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RNG } from '../core/RNG.js';
import { gridMetrics } from '../city/gridMath.js';

const NPC_SPEED = 10;
const HORN_DIST = 18;
const HORN_COOLDOWN = 6;
const DESPAWN_MARGIN = 40;
const MESH_TURN = Math.PI / 2;
const COLLISION_R = 2.0;
const RESUME_DELAY = 3;

function laneOffset(heading, LANE_OFFSET) {
  const s = Math.round(heading / (Math.PI / 2)) * (Math.PI / 2);
  if (Math.abs(s) < 0.1) return { dx: 0, dz: LANE_OFFSET };
  if (Math.abs(s - Math.PI / 2) < 0.1) return { dx: -LANE_OFFSET, dz: 0 };
  if (Math.abs(s + Math.PI / 2) < 0.1) return { dx: LANE_OFFSET, dz: 0 };
  return { dx: 0, dz: -LANE_OFFSET };
}

const DENSITY = {
  Dawn: 0.4, Morning: 1.0, Midday: 0.7, Afternoon: 1.0,
  'Golden Hour': 0.6, Dusk: 0.3, Night: 0.15
};

const COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#a8dadc', '#d4a373', '#6d6875', '#b5838d',
  '#ffb703', '#023047', '#fb8500', '#8ecae6', '#219ebc'
];

class NPCCar {
  constructor(metrics) {
    this.m = metrics;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = NPC_SPEED;
    this.active = false;
    this.hornTimer = 0;
    this.colorIdx = 0;
    this.nextI = 0;
    this.nextJ = 0;
    this.stopped = false;
    this.stopTimer = 0;
    this.honking = false;
  }

  reset(x, z, heading, colorIdx) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = NPC_SPEED * (0.7 + Math.random() * 0.6);
    this.active = true;
    this.hornTimer = HORN_COOLDOWN * Math.random();
    this.colorIdx = colorIdx;
    this._setNextIntersection();
  }

  get laneOffset() {
    return laneOffset(this.heading, this.m.R / 4);
  }

  _cell() {
    const { H, R, P } = this.m;
    return {
      i: Math.round((this.z + H - R / 2) / P),
      j: Math.round((this.x + H - R / 2) / P)
    };
  }

  _setNextIntersection() {
    const step = headingStep(this.heading);
    const c = this._cell();
    this.nextI = c.i + step.iz;
    this.nextJ = c.j + step.jx;
  }

  _atEdge() {
    const c = this._cell();
    const step = headingStep(this.heading);
    return c.i + step.iz < 0 || c.i + step.iz >= this.m.N || c.j + step.jx < 0 || c.j + step.jx >= this.m.N;
  }

  _validTurns() {
    const c = this._cell();
    const dirs = [
      { heading: 0, jx: 1, iz: 0 },
      { heading: Math.PI / 2, jx: 0, iz: 1 },
      { heading: Math.PI, jx: -1, iz: 0 },
      { heading: -Math.PI / 2, jx: 0, iz: -1 }
    ];
    return dirs.filter((d) => {
      const ni = c.i + d.iz;
      const nj = c.j + d.jx;
      return ni >= 0 && ni < this.m.N && nj >= 0 && nj < this.m.N;
    });
  }
}

function headingStep(h) {
  const snapped = Math.round(h / (Math.PI / 2)) * (Math.PI / 2);
  if (Math.abs(snapped) < 0.1) return { jx: 1, iz: 0 };
  if (Math.abs(snapped - Math.PI / 2) < 0.1) return { jx: 0, iz: 1 };
  if (Math.abs(snapped + Math.PI / 2) < 0.1) return { jx: 0, iz: -1 };
  return { jx: -1, iz: 0 };
}

export class NPCTraffic {
  constructor(scene, level) {
    this.scene = scene;
    const grid = level ? level.grid : CONFIG.city;
    this.m = gridMetrics(grid);
    this.rng = new RNG((level ? level.seed : CONFIG.city.seed) + 3333);
    this.cars = [];
    this.maxCars = 20;
    for (let i = 0; i < this.maxCars; i++) this.cars.push(new NPCCar(this.m));
    this._buildMeshes();
    this._spawnTimer = 0;
  }

  _buildMeshes() {
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.75, 4.0);
    bodyGeo.translate(0, 0.62, 0);
    const cabinGeo = new THREE.BoxGeometry(1.62, 0.58, 1.9);
    cabinGeo.translate(0, 1.26, -0.25);
    const bodyMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const cabinMat = new THREE.MeshLambertMaterial({ color: '#2e3440' });
    this.bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, this.maxCars);
    this.cabins = new THREE.InstancedMesh(cabinGeo, cabinMat, this.maxCars);
    this.bodies.castShadow = true;
    this.bodies.frustumCulled = false;
    this.cabins.frustumCulled = false;
    this.bodies.count = 0;
    this.cabins.count = 0;

    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
    this.wheels = new THREE.InstancedMesh(wheelGeo, wheelMat, this.maxCars * 4);
    this.wheels.frustumCulled = false;
    this.wheels.count = 0;

    const rimGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.32, 8);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshLambertMaterial({ color: '#d8d8d8' });
    this.rims = new THREE.InstancedMesh(rimGeo, rimMat, this.maxCars * 4);
    this.rims.frustumCulled = false;
    this.rims.count = 0;

    this.scene.add(this.bodies, this.cabins, this.wheels, this.rims);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._pos = new THREE.Vector3();
    this._one = new THREE.Vector3(1, 1, 1);
    this._yAxis = new THREE.Vector3(0, 1, 0);
    this._col = new THREE.Color();
  }

  _density(phase) {
    return DENSITY[phase] ?? 0.5;
  }

  _activeCount() {
    let n = 0;
    for (const c of this.cars) if (c.active) n++;
    return n;
  }

  _spawnPatrol() {
    const car = this.cars.find(c => !c.active);
    if (!car) return;
    const edge = this.rng.int(0, 3);
    let x, z, heading;
    const li = this.rng.int(0, this.m.N);
    const lc = this.m.lineCoord(li);
    if (edge === 0) { x = -this.m.H; z = lc; heading = 0; }
    else if (edge === 1) { x = this.m.H; z = lc; heading = Math.PI; }
    else if (edge === 2) { x = lc; z = -this.m.H; heading = Math.PI / 2; }
    else { x = lc; z = this.m.H; heading = -Math.PI / 2; }
    car.reset(x, z, heading, this.rng.int(0, COLORS.length - 1));
  }

  _spawnPatrolBatch(dt, phase) {
    this._spawnTimer -= dt;
    if (this._spawnTimer > 0) return;
    const target = Math.round(this._density(phase) * this.maxCars);
    const active = this._activeCount();
    if (active < target) {
      this._spawnPatrol();
      this._spawnTimer = 0.3;
    } else {
      this._spawnTimer = 1.0;
    }
  }

  update(dt, phase, playerPos) {
    this._spawnPatrolBatch(dt, phase);

    const m = this._m;
    const q = this._q;
    const pos = this._pos;
    const one = this._one;
    let visCount = 0;

    for (const car of this.cars) {
      if (!car.active) continue;

      let colliding = false;
      if (playerPos) {
        const lo = car.laneOffset;
        const cdx = (car.x + lo.dx) - playerPos.x;
        const cdz = (car.z + lo.dz) - playerPos.z;
        colliding = cdx * cdx + cdz * cdz < COLLISION_R * COLLISION_R;
      }

      if (colliding) {
        car.stopped = true;
        car.stopTimer = RESUME_DELAY;
        car.honking = true;
      } else if (car.stopped) {
        car.stopTimer -= dt;
        if (car.stopTimer <= 0) {
          car.stopped = false;
          car.honking = false;
        }
      }

      if (car.stopped) continue;

      const targetX = this.m.lineCoord(car.nextJ);
      const targetZ = this.m.lineCoord(car.nextI);
      const dx = targetX - car.x;
      const dz = targetZ - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.5) {
        car.x = targetX;
        car.z = targetZ;

        if (this.rng.chance(0.35) || car._atEdge()) {
          const valid = car._validTurns().filter(d => {
            const step = headingStep(d.heading);
            const cur = car._cell();
            return cur.i + step.iz >= 0 && cur.i + step.iz < this.m.N
              && cur.j + step.jx >= 0 && cur.j + step.jx < this.m.N;
          });
          if (valid.length > 1) {
            const pick = valid[this.rng.int(0, valid.length - 1)];
            car.heading = pick.heading;
          } else if (valid.length === 0) {
            car.active = false;
            continue;
          }
        }
        car._setNextIntersection();
      } else {
        const moveStep = car.speed * dt;
        if (moveStep >= dist) {
          car.x = targetX;
          car.z = targetZ;
          if (this.rng.chance(0.35) || car._atEdge()) {
            const valid = car._validTurns().filter(d => {
              const step = headingStep(d.heading);
              const cur = car._cell();
              return cur.i + step.iz >= 0 && cur.i + step.iz < this.m.N
                && cur.j + step.jx >= 0 && cur.j + step.jx < this.m.N;
            });
            if (valid.length > 1) {
              const pick = valid[this.rng.int(0, valid.length - 1)];
              car.heading = pick.heading;
            } else if (valid.length === 0) {
              car.active = false;
              continue;
            }
          }
          car._setNextIntersection();
        } else {
          car.x += (dx / dist) * moveStep;
          car.z += (dz / dist) * moveStep;
        }
      }

      if (Math.abs(car.x) > this.m.H + DESPAWN_MARGIN || Math.abs(car.z) > this.m.H + DESPAWN_MARGIN) {
        car.active = false;
        continue;
      }

      car.hornTimer -= dt;
      if (car.hornTimer <= 0 && playerPos) {
        const pdx = car.x - playerPos.x;
        const pdz = car.z - playerPos.z;
        if (pdx * pdx + pdz * pdz < HORN_DIST * HORN_DIST) {
          car.hornTimer = HORN_COOLDOWN;
        }
      }

      const lo = car.laneOffset;
      const cx = car.x + lo.dx;
      const cz = car.z + lo.dz;
      const bodyAngle = car.heading + MESH_TURN;
      q.setFromAxisAngle(this._yAxis, bodyAngle);
      pos.set(cx, 0.03, cz);
      m.compose(pos, q, one);
      this.bodies.setMatrixAt(visCount, m);
      this.cabins.setMatrixAt(visCount, m);
      this._col.set(COLORS[car.colorIdx % COLORS.length]);
      this.bodies.setColorAt(visCount, this._col);

      const wx = 0.85;
      const wz = 1.24;
      const wy = 0.38;
      const cos = Math.cos(bodyAngle);
      const sin = Math.sin(bodyAngle);
      const corners = [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]];
      for (let c = 0; c < 4; c++) {
        const lx = corners[c][0];
        const lz = corners[c][1];
        pos.set(cx + lx * cos - lz * sin, wy, cz + lx * sin + lz * cos);
        m.compose(pos, q, one);
        this.wheels.setMatrixAt(visCount * 4 + c, m);
        this.rims.setMatrixAt(visCount * 4 + c, m);
      }

      visCount++;
    }

    this.bodies.count = visCount;
    this.cabins.count = visCount;
    this.wheels.count = visCount * 4;
    this.rims.count = visCount * 4;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    if (visCount > 0) {
      this.bodies.instanceMatrix.needsUpdate = true;
      this.cabins.instanceMatrix.needsUpdate = true;
      this.wheels.instanceMatrix.needsUpdate = true;
      this.rims.instanceMatrix.needsUpdate = true;
    }
  }

  resolveCircle(cx, cz, radius) {
    for (const car of this.cars) {
      if (!car.active) continue;
      const lo = car.laneOffset;
      const dx = cx - (car.x + lo.dx);
      const dz = cz - (car.z + lo.dz);
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = radius + COLLISION_R * 0.5;
      if (dist < minDist && dist > 0.01) {
        const overlap = minDist - dist;
        return { x: (dx / dist) * overlap, z: (dz / dist) * overlap };
      }
    }
    return null;
  }

  destroy() {
    this.scene.remove(this.bodies, this.cabins);
    this.bodies.dispose();
    this.cabins.dispose();
  }
}
