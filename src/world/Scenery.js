import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { RNG } from '../core/RNG.js';

const cfg = CONFIG.city;
const T = cfg.gridN * (cfg.blockSize + cfg.roadWidth) + cfg.roadWidth;
const H = T / 2;
const SHORE_X = -(H + 95);
const OPEN_HALF_DEG = 42;

function paint(geo, hex, tint = 1) {
  const c = new THREE.Color(hex).multiplyScalar(tint);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function facesWest(angleDeg) {
  let d = angleDeg - 180;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d) < OPEN_HALF_DEG;
}

function makeMountain(rng, radius, height, tint) {
  const seg = 4 + Math.floor(rng.float(0, 3));
  const geo = new THREE.ConeGeometry(radius, height, seg, 5);
  geo.translate(0, height / 2 - 7, 0);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGreen = new THREE.Color('#5d7a4f').multiplyScalar(tint);
  const cRock = new THREE.Color('#8a8378').multiplyScalar(tint);
  const cSnow = new THREE.Color('#eef2f5');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const f = Math.max(0, pos.getY(i)) / height;
    if (f < 0.16) tmp.copy(cGreen);
    else if (f < 0.52) tmp.copy(cGreen).lerp(cRock, (f - 0.16) / 0.36);
    else if (f < 0.64) tmp.copy(cRock);
    else tmp.copy(cRock).lerp(cSnow, (f - 0.64) / 0.36);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildMountains(rng) {
  const parts = [];
  const steps = 34;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 360 + rng.float(-4, 4);
    if (facesWest(a)) continue;
    const rad = (a * Math.PI) / 180;
    const dist = 258 + Math.sin(a * 2.31) * 42 + rng.float(-28, 58);
    const dev = Math.abs(((a - 180 + 540) % 360) - 180);
    const scale = 0.72 + 0.28 * Math.min(1, dev / 60);
    parts.push(
      makeMountain(
        rng,
        rng.float(44, 82),
        rng.float(78, 188) * scale,
        rng.float(0.9, 1.06)
      ).translate(Math.cos(rad) * dist, 0, Math.sin(rad) * dist)
    );
  }
  for (let i = 0; i < 46; i++) {
    const a = rng.float(0, 360);
    if (facesWest(a)) continue;
    const rad = (a * Math.PI) / 180;
    const dist = H + rng.float(38, 98);
    parts.push(
      makeMountain(rng, rng.float(18, 34), rng.float(20, 46), rng.float(0.85, 1.02)).translate(
        Math.cos(rad) * dist,
        0,
        Math.sin(rad) * dist
      )
    );
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  );
  mesh.frustumCulled = false;
  return mesh;
}

function makePalmGeometry() {
  const parts = [];
  const trunk = paint(new THREE.CylinderGeometry(0.13, 0.24, 5.4, 5), '#8a6a45');
  trunk.translate(0, 2.7, 0);
  parts.push(trunk);
  const frondColors = ['#3f8f4f', '#4da05a', '#357d44'];
  for (let k = 0; k < 7; k++) {
    const f = new THREE.BoxGeometry(0.42, 0.05, 2.9);
    f.translate(0, 0, 1.45);
    f.rotateX(-0.62 - (k % 2) * 0.22);
    f.rotateY((k / 7) * Math.PI * 2);
    f.translate(0, 5.35, 0);
    parts.push(paint(f, frondColors[k % frondColors.length]));
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildPalms(rng) {
  const spots = [];
  for (let z = -H + 10; z < H - 6; z += 11) {
    spots.push({ x: -H - rng.float(3.5, 9), z: z + rng.float(-3, 3), s: rng.float(0.85, 1.25) });
    if (rng.chance(0.5)) {
      spots.push({
        x: SHORE_X + rng.float(16, 54),
        z: z + rng.float(-30, 30),
        s: rng.float(0.7, 1.05)
      });
    }
  }
  const mesh = new THREE.InstancedMesh(
    makePalmGeometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    spots.length
  );
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  for (let i = 0; i < spots.length; i++) {
    const p = spots[i];
    q.setFromEuler(eu.set(rng.float(-0.09, 0.09), rng.float(0, Math.PI * 2), rng.float(-0.07, 0.07)));
    m.compose(pos.set(p.x, -0.03, p.z), q, sc.set(p.s, p.s, p.s));
    mesh.setMatrixAt(i, m);
  }
  return mesh;
}

function flatPlane(w, d, x, y, z, hex, opacity = 1) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({
      color: hex,
      transparent: opacity < 1,
      opacity
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

export function createScenery(scene, collision) {
  const rng = new RNG(cfg.seed + 77);
  const group = new THREE.Group();

  group.add(flatPlane(175, 1400, -H - 86, -0.045, 0, '#e6d5a4'));
  group.add(flatPlane(30, 2 * (H + 60), SHORE_X + 9, -0.04, 0, '#cbb27e'));

  const deep = flatPlane(1100, 1600, SHORE_X - 580, -0.14, 0, '#1f6f92', 0.97);
  const shallow = flatPlane(72, 2 * (H + 80), SHORE_X - 41, -0.075, 0, '#59bccd', 0.82);
  group.add(deep, shallow);

  const foamMat = () =>
    new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.5 });
  const foamA = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2 * (H + 55)), foamMat());
  const foamB = new THREE.Mesh(new THREE.PlaneGeometry(3, 2 * (H + 55)), foamMat());
  foamA.rotation.x = -Math.PI / 2;
  foamB.rotation.x = -Math.PI / 2;
  foamA.position.set(SHORE_X - 4, -0.03, 0);
  foamB.position.set(SHORE_X - 22, -0.05, 0);
  group.add(foamA, foamB);

  group.add(buildMountains(rng));
  group.add(buildPalms(rng));

  const wingLen = H - SHORE_X;
  const wingGeoV = new THREE.BoxGeometry(wingLen, 1.2, 1);
  for (const sz of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeoV, new THREE.MeshLambertMaterial({ color: '#9aa0a6' }));
    wing.position.set((-H + SHORE_X) / 2, 0.6, sz * (H + 0.5));
    group.add(wing);
  }

  collision.addBox(SHORE_X + 4, 0, 0.6, H + 12);
  const wingHx = wingLen / 2;
  collision.addBox((-H + SHORE_X) / 2, -(H + 0.5), wingHx, 0.5);
  collision.addBox((-H + SHORE_X) / 2, H + 0.5, wingHx, 0.5);

  scene.add(group);

  let t = 0;
  return {
    group,
    update(dt) {
      t += dt;
      deep.position.y = -0.14 + Math.sin(t * 0.4) * 0.02;
      shallow.position.y = -0.075 + Math.sin(t * 0.7 + 1.2) * 0.028;
      foamA.position.x = SHORE_X - 3 + Math.sin(t * 0.55) * 6;
      foamA.material.opacity = 0.3 + 0.25 * Math.sin(t * 0.55 + 0.8);
      foamB.position.x = SHORE_X - 24 + Math.sin(t * 0.42 + 2) * 9;
      foamB.material.opacity = 0.22 + 0.18 * Math.sin(t * 0.42);
    },
    dispose() {
      scene.remove(group);
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }
  };
}
