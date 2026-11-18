import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { RNG } from '../core/RNG.js';
import { gridMetrics } from '../city/gridMath.js';

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

function buildMountains(rng, H) {
  const parts = [];
  const steps = 34;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 360 + rng.float(-4, 4);
    if (facesWest(a)) continue;
    const rad = (a * Math.PI) / 180;
    const r = rng.float(44, 82);
    const dist = Math.max(258 + Math.sin(a * 2.31) * 42 + rng.float(-28, 58), H + 16 + r);
    const dev = Math.abs(((a - 180 + 540) % 360) - 180);
    const scale = 0.72 + 0.28 * Math.min(1, dev / 60);
    parts.push(
      makeMountain(rng, r, rng.float(78, 188) * scale, rng.float(0.9, 1.06)).translate(
        Math.cos(rad) * dist,
        0,
        Math.sin(rad) * dist
      )
    );
  }
  for (let i = 0; i < 46; i++) {
    const a = rng.float(0, 360);
    if (facesWest(a)) continue;
    const rad = (a * Math.PI) / 180;
    const fr = rng.float(18, 34);
    const fd = Math.max(H + rng.float(38, 98), H + 8 + fr);
    parts.push(
      makeMountain(rng, fr, rng.float(20, 46), rng.float(0.85, 1.02)).translate(
        Math.cos(rad) * fd,
        0,
        Math.sin(rad) * fd
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

function buildPalms(rng, H, SHORE_X) {
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

function makeMesa(rng, radius, height, tint) {
  const seg = 6 + Math.floor(rng.float(0, 3));
  const parts = [];
  const bands = rng.int(3, 5);
  const tones = ['#c98f6b', '#b56c50', '#d2a27a', '#a85f45', '#dcb08a'];
  let y = 0;
  let r = radius;
  for (let i = 0; i < bands; i++) {
    const bh = (height / bands) * rng.float(0.82, 1.22);
    const topR = r * rng.float(0.58, 0.82);
    const g = new THREE.CylinderGeometry(topR, r, bh, seg, 1);
    g.translate(0, y + bh / 2, 0);
    paint(g, tones[rng.int(0, tones.length - 1)], tint);
    parts.push(g);
    y += bh;
    r = topR;
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildMesas(rng, H) {
  const parts = [];
  const ringCount = 44;
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2 + rng.float(-0.14, 0.14);
    const near = i % 5 === 0;
    const dist = H + (near ? rng.float(26, 72) : rng.float(130, 250));
    const r = near ? rng.float(9, 18) : rng.float(22, 46);
    const h = near ? rng.float(16, 34) : rng.float(38, 88);
    parts.push(makeMesa(rng, r, h, rng.float(0.9, 1.06)).translate(
      Math.cos(a) * dist,
      -5,
      Math.sin(a) * dist
    ));
  }
  for (let i = 0; i < 12; i++) {
    const a = rng.float(0, Math.PI * 2);
    const dist = H + rng.float(13, 38);
    parts.push(makeMesa(rng, rng.float(4, 9), rng.float(9, 20), rng.float(0.9, 1.05)).translate(
      Math.cos(a) * dist,
      -3,
      Math.sin(a) * dist
    ));
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

function makeCactusGeometry() {
  const parts = [];
  const trunk = paint(new THREE.CylinderGeometry(0.32, 0.42, 3.6, 7), '#4f7a4d');
  trunk.translate(0, 1.8, 0);
  parts.push(trunk);
  for (const sx of [-1, 1]) {
    const arm = paint(new THREE.CylinderGeometry(0.2, 0.24, 1.25, 6), '#4f7a4d');
    arm.rotateZ(Math.PI / 2);
    arm.translate(sx * 0.62, 2.1, 0);
    parts.push(arm);
    const up = paint(new THREE.CylinderGeometry(0.19, 0.22, 1.1, 6), '#4f7a4d');
    up.translate(sx * 1.18, 2.6, 0);
    parts.push(up);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildCactuses(rng, H) {
  const spots = [];
  for (let i = 0; i < 210; i++) {
    const a = rng.float(0, Math.PI * 2);
    const dist = H + rng.float(16, 270);
    spots.push({
      x: Math.cos(a) * dist,
      z: Math.sin(a) * dist,
      s: rng.float(0.65, 1.5),
      ry: rng.float(0, Math.PI * 2)
    });
  }
  for (let c = 0; c < 16; c++) {
    const a = rng.float(0, Math.PI * 2);
    const dist = H + rng.float(20, 100);
    const cx = Math.cos(a) * dist;
    const cz = Math.sin(a) * dist;
    const n = rng.int(2, 5);
    for (let k = 0; k < n; k++) {
      spots.push({
        x: cx + rng.float(-9, 9),
        z: cz + rng.float(-9, 9),
        s: rng.float(0.7, 1.3),
        ry: rng.float(0, Math.PI * 2)
      });
    }
  }
  const mesh = new THREE.InstancedMesh(
    makeCactusGeometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    spots.length
  );
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  const tints = ['#ffffff', '#dbe6c9', '#c7d8ae'];
  for (let i = 0; i < spots.length; i++) {
    const p = spots[i];
    q.setFromEuler(eu.set(0, p.ry, 0));
    m.compose(pos.set(p.x, -0.04, p.z), q, sc.set(p.s, p.s, p.s));
    mesh.setMatrixAt(i, m);
    col.set(tints[i % tints.length]);
    mesh.setColorAt(i, col);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function makeDesertTreeGeometry() {
  const parts = [];
  const trunk = paint(new THREE.CylinderGeometry(0.18, 0.3, 2.6, 6).toNonIndexed(), '#6b5136');
  trunk.translate(0, 1.3, 0);
  parts.push(trunk);
  const crown = paint(new THREE.IcosahedronGeometry(1.85, 0), '#6f8f5a');
  crown.translate(0, 3.25, 0);
  parts.push(crown);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildDesertTrees(rng, H) {
  const spots = [];
  for (let g = 0; g < 18; g++) {
    const a = rng.float(0, Math.PI * 2);
    const dist = H + rng.float(45, 230);
    const cx = Math.cos(a) * dist;
    const cz = Math.sin(a) * dist;
    const n = rng.int(2, 6);
    for (let k = 0; k < n; k++) {
      spots.push({
        x: cx + rng.float(-14, 14),
        z: cz + rng.float(-14, 14),
        s: rng.float(0.7, 1.45),
        ry: rng.float(0, Math.PI * 2)
      });
    }
  }
  const mesh = new THREE.InstancedMesh(
    makeDesertTreeGeometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    spots.length
  );
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  const tints = ['#ffffff', '#dbe6c9', '#b9c99a'];
  for (let i = 0; i < spots.length; i++) {
    const p = spots[i];
    q.setFromEuler(eu.set(0, p.ry, 0));
    m.compose(pos.set(p.x, -0.04, p.z), q, sc.set(p.s, p.s, p.s));
    mesh.setMatrixAt(i, m);
    col.set(tints[i % tints.length]);
    mesh.setColorAt(i, col);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function buildBoulders(rng, H) {
  const spots = [];
  for (let i = 0; i < 170; i++) {
    const a = rng.float(0, Math.PI * 2);
    const dist = H + rng.float(12, 260);
    spots.push({
      x: Math.cos(a) * dist,
      z: Math.sin(a) * dist,
      s: rng.float(0.4, 2.2),
      ry: rng.float(0, Math.PI * 2)
    });
  }
  const geo = paint(new THREE.IcosahedronGeometry(1, 0), '#9a8874');
  geo.translate(0, 0.55, 0);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    spots.length
  );
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  const tints = ['#ffffff', '#d8bfa2', '#c4a98c'];
  for (let i = 0; i < spots.length; i++) {
    const p = spots[i];
    q.setFromEuler(eu.set(0, p.ry, 0));
    m.compose(pos.set(p.x, -0.05, p.z), q, sc.set(p.s, p.s, p.s));
    mesh.setMatrixAt(i, m);
    col.set(tints[i % tints.length]);
    mesh.setColorAt(i, col);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function createDesertScenery(scene, collision, seed, H) {
  const rng = new RNG(seed + 77);
  const group = new THREE.Group();

  group.add(flatPlane(1700, 1700, 0, -0.075, 0, '#d9bd8c'));
  const patches = ['#d2b483', '#e0c597', '#cfae7c'];
  for (let i = 0; i < 18; i++) {
    const a = rng.float(0, Math.PI * 2);
    const dist = H + rng.float(60, 420);
    group.add(flatPlane(
      rng.float(70, 190),
      rng.float(70, 190),
      Math.cos(a) * dist,
      -0.07 + i * 0.0002,
      Math.sin(a) * dist,
      patches[i % patches.length]
    ));
  }

  group.add(buildMesas(rng, H));
  group.add(buildBoulders(rng, H));
  group.add(buildCactuses(rng, H));
  group.add(buildDesertTrees(rng, H));

  const bound = H + 250;
  collision.addBox(0, -bound, bound + 30, 1);
  collision.addBox(0, bound, bound + 30, 1);
  collision.addBox(-bound, 0, 1, bound + 30);
  collision.addBox(bound, 0, 1, bound + 30);

  scene.add(group);
  return {
    group,
    update() {},
    dispose() {
      scene.remove(group);
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }
  };
}

export function createScenery(scene, collision, level) {
  const grid = level ? level.grid : CONFIG.city;
  const seed = level ? level.seed : CONFIG.city.seed;
  const m = gridMetrics(grid);
  const H = m.H;
  if (level && level.biome === 'desert') return createDesertScenery(scene, collision, seed, H);
  const SHORE_X = -(H + 95);
  const rng = new RNG(seed + 77);
  const group = new THREE.Group();

  group.add(flatPlane(175, 1400, -H - 86, -0.045, 0, '#e6d5a4'));
  group.add(flatPlane(30, 2 * (H + 60), SHORE_X + 9, 0.002, 0, '#cbb27e'));

  const deep = flatPlane(1100, 1600, SHORE_X - 580, -0.03, 0, '#1f6f92', 0.97);
  const shallow = flatPlane(72, 2 * (H + 80), SHORE_X - 41, 0.0, 0, '#59bccd', 0.82);
  group.add(deep, shallow);

  const foamMat = () =>
    new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.5 });
  const foamA = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2 * (H + 55)), foamMat());
  const foamB = new THREE.Mesh(new THREE.PlaneGeometry(3, 2 * (H + 55)), foamMat());
  foamA.rotation.x = -Math.PI / 2;
  foamB.rotation.x = -Math.PI / 2;
  foamA.position.set(SHORE_X - 4, 0.012, 0);
  foamB.position.set(SHORE_X - 22, 0.004, 0);
  group.add(foamA, foamB);

  group.add(buildMountains(rng, H));
  group.add(buildPalms(rng, H, SHORE_X));

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
      deep.position.y = -0.03 + Math.sin(t * 0.4) * 0.012;
      shallow.position.y = Math.sin(t * 0.7 + 1.2) * 0.015;
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
