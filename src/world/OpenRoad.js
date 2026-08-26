import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { RNG } from '../core/RNG.js';

const cfg = CONFIG.city;
const R = cfg.roadWidth;
const T = cfg.gridN * (cfg.blockSize + cfg.roadWidth) + cfg.roadWidth;
const H = T / 2;

const ROAD_LENGTH = 1500;
const SEG_LEN = 6;
const ROAD_Y = 0.08;
const TERRAIN_HALF_W = 280;

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function grad2d(hash, x, y) {
  const h = hash & 3;
  return (h === 0 ? x + y : h === 1 ? -x + y : h === 2 ? x - y : -x - y);
}

function noise2d(x, y, perm) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = perm[perm[X] + Y];
  const ab = perm[perm[X] + Y + 1];
  const ba = perm[perm[X + 1] + Y];
  const bb = perm[perm[X + 1] + Y + 1];
  return lerp(
    lerp(grad2d(aa, xf, yf), grad2d(ba, xf - 1, yf), u),
    lerp(grad2d(ab, xf, yf - 1), grad2d(bb, xf - 1, yf - 1), u),
    v
  );
}

function fbm(x, y, perm, octaves = 4) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise2d(x * freq, y * freq, perm) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}

function buildPerm(seed) {
  const rng = new RNG(seed);
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  return p;
}

function paint(geo, hex) {
  const c = new THREE.Color(hex);
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

function generatePath(perm) {
  const points = [];
  const segs = Math.ceil(ROAD_LENGTH / SEG_LEN);
  let x = H + 2;
  let z = 0;
  let angle = 0;
  for (let i = 0; i <= segs; i++) {
    points.push(new THREE.Vector3(x, 0, z));
    const n = fbm(i * 0.025, 0.5, perm) * 2.2;
    angle += n * 0.028;
    x += Math.cos(angle) * SEG_LEN;
    z += Math.sin(angle) * SEG_LEN;
  }
  return points;
}

function buildRoadSurface(points) {
  const verts = [];
  const indices = [];
  const halfR = R / 2;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    let nx, nz;
    if (i === 0) {
      nx = points[1].x - p.x;
      nz = points[1].z - p.z;
    } else if (i === points.length - 1) {
      nx = p.x - points[i - 1].x;
      nz = p.z - points[i - 1].z;
    } else {
      nx = points[i + 1].x - points[i - 1].x;
      nz = points[i + 1].z - points[i - 1].z;
    }
    const len = Math.sqrt(nx * nx + nz * nz) || 1;
    nx = -nz / len;
    nz = nx ? nz / len : 0;
    const lnx = nz;
    const lnz = -nx;
    verts.push(
      p.x + lnx * halfR, ROAD_Y, p.z + lnz * halfR,
      p.x - lnx * halfR, ROAD_Y, p.z - lnz * halfR
    );
    if (i < points.length - 1) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return paint(geo, '#3d4249');
}

function buildTerrain(points, perm) {
  const geos = [];
  const step = 18;
  const p0 = points[0];
  const pn = points[points.length - 1];
  const minX = Math.min(p0.x, pn.x) - TERRAIN_HALF_W;
  const maxX = Math.max(p0.x, pn.x) + TERRAIN_HALF_W;
  const minZ = Math.min(p0.z, pn.z) - TERRAIN_HALF_W;
  const maxZ = Math.max(p0.z, pn.z) + TERRAIN_HALF_W;
  for (let wx = minX; wx < maxX; wx += step) {
    for (let wz = minZ; wz < maxZ; wz += step) {
      let nearRoad = false;
      for (let k = 0; k < points.length; k += 3) {
        const dx = points[k].x - wx;
        const dz = points[k].z - wz;
        if (dx * dx + dz * dz < 900) { nearRoad = true; break; }
      }
      if (nearRoad) continue;
      const h = Math.max(0, fbm(wx * 0.008, wz * 0.008, perm, 5) * 18);
      const g = new THREE.PlaneGeometry(step + 0.5, step + 0.5);
      g.rotateX(-Math.PI / 2);
      g.translate(wx, h * 0.5 - 0.05, wz);
      const tint = 0.88 + fbm(wx * 0.03, wz * 0.03, perm) * 0.24;
      geos.push(paint(g, new THREE.Color('#6da85e').multiplyScalar(tint).getStyle()));
    }
  }
  if (geos.length === 0) return null;
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function buildRoadTrees(points, perm, rng) {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6);
  trunkGeo.translate(0, 0.8, 0);
  const foliageGeo = new THREE.IcosahedronGeometry(1.55, 0);
  foliageGeo.translate(0, 2.4, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#7a5236' });
  const leafMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const spots = [];
  const greens = ['#5ea35c', '#6fb261', '#4f9a54', '#83bd6d'];
  for (let i = 0; i < points.length; i += 2) {
    const p = points[i];
    const dens = (fbm(p.x * 0.006, p.z * 0.006, perm) + 1) * 0.5;
    const count = Math.floor(dens * 5);
    for (let j = 0; j < count; j++) {
      const ang = rng.float(0, Math.PI * 2);
      const dist = rng.float(18, TERRAIN_HALF_W * 0.85);
      const tx = p.x + Math.cos(ang) * dist;
      const tz = p.z + Math.sin(ang) * dist;
      let tooClose = false;
      for (let k = Math.max(0, i - 4); k <= Math.min(points.length - 1, i + 4); k++) {
        const dx = points[k].x - tx;
        const dz = points[k].z - tz;
        if (dx * dx + dz * dz < 100) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const h = Math.max(0, fbm(tx * 0.008, tz * 0.008, perm, 4) * 18);
      spots.push({ x: tx, y: h, z: tz, s: rng.float(0.8, 1.3), color: greens[rng.int(0, greens.length - 1)] });
    }
  }
  if (spots.length === 0) return new THREE.Group();
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(foliageGeo, leafMat, spots.length);
  trunks.castShadow = true;
  leaves.castShadow = true;
  trunks.frustumCulled = false;
  leaves.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    q.setFromEuler(new THREE.Euler(0, rng.float(0, Math.PI * 2), 0));
    pos.set(s.x, s.y, s.z);
    sc.setScalar(s.s);
    m.compose(pos, q, sc);
    trunks.setMatrixAt(i, m);
    col.set(s.color);
    leaves.setColorAt(i, col);
    pos.y += 1.6 * s.s;
    m.compose(pos, q, sc);
    leaves.setMatrixAt(i, m);
  }
  const g = new THREE.Group();
  g.add(trunks);
  g.add(leaves);
  return g;
}

function buildCollision(points, collision) {
  const halfR = R / 2 + 1;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    const hw = len / 2 + 0.5;
    const nx = -dz / len;
    const nz = dx / len;
    const cx = mx + nx * halfR;
    const cz = mz + nz * halfR;
    const cx2 = mx - nx * halfR;
    const cz2 = mz - nz * halfR;
    const angle = Math.atan2(dx, dz);
    collision.addBox(cx, cz, hw, 0.5, 'city');
    collision.addBox(cx2, cz2, hw, 0.5, 'city');
  }
}

export function createOpenRoad(scene, collision) {
  const seed = cfg.seed + 7777;
  const perm = buildPerm(seed);
  const rng = new RNG(seed + 1);
  const points = generatePath(perm);
  const group = new THREE.Group();
  const roadGeo = buildRoadSurface(points);
  if (roadGeo) {
    const mesh = new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  const terrain = buildTerrain(points, perm);
  if (terrain) group.add(terrain);
  group.add(buildRoadTrees(points, perm, rng));
  buildCollision(points, collision);
  scene.add(group);
  return { group, points };
}
