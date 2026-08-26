import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RNG } from '../core/RNG.js';
import { GeoBucket, frameAt } from './GeoUtil.js';
import { makeSharedMaterials } from './materials.js';
import { LocationRegistry } from './Locations.js';
import {
  smallHouse, townhouseRow, apartmentBlock, restaurant, shopUnit,
  stripMall, officeTower, campusHall, gasStation
} from './Buildings.js';
import { FOOD_NAMES, HOME_NAMES, HOUSE_STREETS } from './names.js';

const ZONE_LOT = {
  residential: '#86c06a',
  commercial: '#cfc9bd',
  business: '#c4c0b6',
  campus: '#79b56b'
};

export const CAR_COLORS = ['#e8615a', '#f2a541', '#2a9d8f', '#457b9d', '#b56576', '#e8e6df', '#576066'];

export class CityWorld {
  constructor(group, locations, minimapData, spawn, materials) {
    this.group = group;
    this.locations = locations;
    this.minimapData = minimapData;
    this.spawn = spawn;
    this._materials = materials;
    this.windowsMaterial = materials.windows;
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj.isMesh || obj.isInstancedMesh) obj.geometry.dispose();
    });
    this._materials.solid.dispose();
    this._materials.windows.dispose();
  }
}

export function generateCity(collision) {
  const cfg = CONFIG.city;
  const rng = new RNG(cfg.seed);
  const N = cfg.gridN;
  const B = cfg.blockSize;
  const R = cfg.roadWidth;
  const SW = cfg.sidewalkWidth;
  const P = B + R;
  const T = N * P + R;
  const H = T / 2;

  const lineCoord = (i) => -H + R / 2 + i * P;
  const blockMin = (i) => -H + R + i * P;
  const blockCenter = (i) => blockMin(i) + B / 2;

  const S = new GeoBucket();
  const W = new GeoBucket();
  const locations = new LocationRegistry();
  const treeSpots = [];
  const buildingBoxes = [];
  const carSpots = [];
  const lampSpots = [];
  const foodNames = rng.shuffle(FOOD_NAMES);
  const homeNames = rng.shuffle(HOME_NAMES);
  let foodIdx = 0;
  let homeIdx = 0;

  const minimapBlocks = [];
  const minimapPois = [];

  S.groundQuad(T * 3, T * 3, 0, -0.06, 0, '#6da85e');

  for (let i = 0; i <= N; i++) {
    const lx = lineCoord(i);
    S.groundQuad(R, T, lx, 0, 0, '#3d4249');
    S.groundQuad(T, R, 0, 0.001, lx, '#3d4249');
  }

  for (let i = 0; i <= N; i++) {
    const lx = lineCoord(i);
    const lz = lineCoord(i);
    for (let j = 0; j < N; j++) {
      const z0 = blockMin(j) + 4;
      const z1 = blockMin(j) + B - 4;
      for (let z = z0; z < z1; z += cfg.laneLineEvery) {
        S.groundQuad(0.28, 1.8, lx, 0.015, z + 0.9, '#d9c06a');
        S.groundQuad(1.8, 0.28, z + 0.9, 0.016, lz, '#d9c06a');
      }
    }
  }

  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const ix = lineCoord(i);
      const iz = lineCoord(j);
      const offs = [];
      for (let k = 0; k < 5; k++) offs.push(-R / 2 + 1.4 + k * ((R - 2.8) / 4));
      for (const o of offs) {
        S.groundQuad(0.65, 2.6, ix + o, 0.018, iz - R / 2 - 1.7, '#e8e6df');
        S.groundQuad(0.65, 2.6, ix + o, 0.018, iz + R / 2 + 1.7, '#e8e6df');
        S.groundQuad(2.6, 0.65, ix - R / 2 - 1.7, 0.018, iz + o, '#e8e6df');
        S.groundQuad(2.6, 0.65, ix + R / 2 + 1.7, 0.018, iz + o, '#e8e6df');
      }
    }
  }

  function l2wV(f, dx, dz) {
    return new THREE.Vector3(
      f.x + dx * Math.cos(f.ry) + dz * Math.sin(f.ry),
      0,
      f.z - dx * Math.sin(f.ry) + dz * Math.cos(f.ry)
    );
  }

  function curbSpotFor(doorX, doorZ, fx, fz) {
    const useAxisX = Math.abs(fx) > Math.abs(fz) ? true : Math.abs(fx) < Math.abs(fz) ? false : true;
    const doorOnAxis = useAxisX ? doorX : doorZ;
    let targetLine = null;
    let bestD = Infinity;
    for (let i = 0; i <= N; i++) {
      const lc = lineCoord(i);
      const d = lc - doorOnAxis;
      const wantSign = useAxisX ? Math.sign(fx) : Math.sign(fz);
      if (wantSign !== 0 && Math.sign(d) !== wantSign) continue;
      const ad = Math.abs(d);
      if (ad < bestD) { bestD = ad; targetLine = lc; }
    }
    if (targetLine === null) {
      for (let i = 0; i <= N; i++) {
        const lc = lineCoord(i);
        const ad = Math.abs(lc - doorOnAxis);
        if (ad < bestD) { bestD = ad; targetLine = lc; }
      }
    }
    const sideIn = targetLine > doorOnAxis ? -1 : 1;
    const lateralOffset = (R / 2 - 2.3) * sideIn;
    let px;
    let pz;
    if (useAxisX) {
      px = targetLine + lateralOffset;
      pz = pushOffIntersections(doorZ, R);
    } else {
      pz = targetLine + lateralOffset;
      px = pushOffIntersections(doorX, R);
    }
    px = THREE.MathUtils.clamp(px, -H + 5, H - 5);
    pz = THREE.MathUtils.clamp(pz, -H + 5, H - 5);
    return new THREE.Vector3(px, 0, pz);
  }

  function pushOffIntersections(v, roadW) {
    let out = v;
    for (let i = 0; i <= N; i++) {
      const lc = lineCoord(i);
      if (Math.abs(out - lc) < roadW / 2 + 3.5) {
        out = lc + (roadW / 2 + 3.5) * (out >= lc ? 1 : -1);
      }
    }
    return out;
  }

  function facingOutward(col, row, qdx, qdz) {
    const toCenterX = (N - 1) / 2 - col;
    const toCenterZ = (N - 1) / 2 - row;
    let fx;
    let fz;
    if (Math.abs(qdx) > Math.abs(qdz)) fx = -(qdx > 0 ? 1 : -1);
    else fz = -(qdz > 0 ? 1 : -1);
    if (fx === undefined && fz === undefined) fz = toCenterZ >= 0 ? -1 : 1;
    if (fx === 0 && Math.abs(toCenterZ) > Math.abs(toCenterX)) { fz = toCenterZ > 0 ? -1 : 1; fx = 0; }
    if (fz === 0 && Math.abs(toCenterX) > Math.abs(toCenterZ)) { fx = toCenterX > 0 ? -1 : 1; fz = 0; }
    let ry = 0;
    if (fx > 0) ry = Math.PI / 2;
    else if (fx < 0) ry = -Math.PI / 2;
    else if (fz < 0) ry = Math.PI;
    return { fx, fz, ry };
  }

  function buildSidewalkAndLot(col, row, zone) {
    const bx = blockCenter(col);
    const bz = blockCenter(row);
    const inner = B / 2 - SW;
    S.box(B, 0.14, SW, bx, 0.07, bz - inner - SW / 2, '#b3b9bf');
    S.box(B, 0.14, SW, bx, 0.07, bz + inner + SW / 2, '#b3b9bf');
    S.box(SW, 0.14, B - SW * 2, bx - inner - SW / 2, 0.07, bz, '#b3b9bf');
    S.box(SW, 0.14, B - SW * 2, bx + inner + SW / 2, 0.07, bz, '#b3b9bf');
    S.groundQuad(inner * 2, inner * 2, bx, 0.02, bz, ZONE_LOT[zone]);
    minimapBlocks.push({ x: bx, z: bz, w: B, d: B, zone });

    const c0 = rng.chance(0.5) ? -1 : 1;
    lampSpots.push({ x: bx + c0 * (B / 2 - SW / 2), z: bz + c0 * (B / 2 - SW / 2), ry: c0 * Math.PI * 0.75 });
    lampSpots.push({ x: bx - c0 * (B / 2 - SW / 2), z: bz - c0 * (B / 2 - SW / 2), ry: -c0 * Math.PI * 0.25 });

    return { bx, bz, inner };
  }

  function placeBuilding(buildFn, f, args, nameFor, categoryOverride = null) {
    const meta = buildFn(S, W, rng, f, ...args);
    const rot90 = Math.abs(Math.sin(f.ry)) > 0.5;
    const hw = rot90 ? meta.hd : meta.hw;
    const hd = rot90 ? meta.hw : meta.hd;
    collision.addBox(f.x, f.z, hw, hd);
    buildingBoxes.push({ cx: f.x, cz: f.z, hw: hw + 2.5, hd: hd + 2.5 });
    const poiCat = categoryOverride || meta.poiCategory;
    if (poiCat && poiCat !== 'none') {
      let doorW;
      if (meta.doorOverride) doorW = new THREE.Vector3(meta.doorOverride.x, 0, meta.doorOverride.z);
      else if (meta.doorLocal) doorW = l2wV(f, meta.doorLocal.dx, meta.doorLocal.dz);
      else doorW = l2wV(f, 0, meta.hd + 0.2);
      const dirx = Math.abs(Math.sin(f.ry)) > 0.5 ? Math.sign(Math.sin(f.ry)) : 0;
      const dirz = Math.abs(Math.cos(f.ry)) > 0.5 ? Math.sign(Math.cos(f.ry)) : 0;
      const park = curbSpotFor(doorW.x, doorW.z, dirx, dirz);
      locations.register({
        name: nameFor(poiCat),
        category: poiCat,
        door: doorW,
        parkPos: park,
        buildingAABB: { cx: f.x, cz: f.z, hw, hd },
        block: [f.col, f.row]
      });
    }
    return meta;
  }

  function treeOverlapsBuilding(x, z) {
    for (const b of buildingBoxes) {
      if (Math.abs(x - b.cx) < b.hw && Math.abs(z - b.cz) < b.hd) return true;
    }
    return false;
  }

  function buildResidential(col, row) {
    const { bx, bz, inner } = buildSidewalkAndLot(col, row, 'residential');
    const roll = rng.next();
    const style = roll < 0.55 ? 'houses' : roll < 0.8 ? 'row' : 'mixed';
    const streetName = HOUSE_STREETS[(col * 3 + row * 7) % HOUSE_STREETS.length];

    if (style === 'houses') {
      for (const q of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (rng.chance(0.14)) continue;
        const face = facingOutward(col, row, q[0], q[1]);
        face.fx = -face.fx;
        face.fz = -face.fz;
        if (face.fx > 0) face.ry = Math.PI / 2;
        else if (face.fx < 0) face.ry = -Math.PI / 2;
        else if (face.fz < 0) face.ry = Math.PI;
        else face.ry = 0;
        const cx = bx + q[0] * inner * 0.52;
        const cz = bz + q[1] * inner * 0.52;
        const f = frameAt(cx, cz, face.ry);
        f.col = col; f.row = row;
        const num = 100 + ((col * 17 + row * 29 + (q[0] + 1) * 3 + (q[1] + 1)) % 89) * 2;
        placeBuilding(smallHouse, f, [], (cat) =>
          cat === 'food' ? `${num} ${streetName} Kitchen` : `${num} ${streetName}`
        , 'home');
        if (rng.chance(CONFIG.city.treeChance)) {
          const tx = cx + rng.float(-5, 5);
          const tz = cz + q[1] * rng.float(7, 10);
          if (!treeOverlapsBuilding(tx, tz)) treeSpots.push({ x: tx, z: tz, s: rng.float(0.8, 1.3) });
        }
      }
    } else if (style === 'row') {
      const face = facingOutward(col, row, 0, -1);
      const rz = bz + (face.fz <= 0 ? inner * 0.5 : -inner * 0.5);
      const f = frameAt(bx, rz, face.ry);
      f.col = col; f.row = row;
      placeBuilding(townhouseRow, f, [], () => `${homeNames[homeIdx++ % homeNames.length]} Row`, 'home');
      for (const q of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (rng.chance(0.55)) {
          const tx = bx + q[0] * inner * 0.55;
          const tz = bz + q[1] * inner * 0.42;
          if (!treeOverlapsBuilding(tx, tz)) treeSpots.push({ x: tx, z: tz, s: rng.float(0.9, 1.4) });
        }
      }
    } else {
      const faceA = facingOutward(col, row, 0, -1);
      const az = bz + (faceA.fz <= 0 ? inner * 0.42 : -inner * 0.42);
      const fa = frameAt(bx, az, faceA.ry);
      fa.col = col; fa.row = row;
      placeBuilding(apartmentBlock, fa, [], () => `${homeNames[homeIdx++ % homeNames.length]} Apartments`, 'home');
      const qb = [-1, 1][rng.int(0, 1)];
      const fb = frameAt(bx + qb * inner * 0.5, az > bz ? bz - inner * 0.45 : bz + inner * 0.45, qb > 0 ? Math.PI / 2 : -Math.PI / 2);
      fb.col = col; fb.row = row;
      placeBuilding(rng.chance(0.5) ? smallHouse : townhouseRow, fb, [], () => `${homeNames[homeIdx++ % homeNames.length]} Court`, 'home');
    }
  }

  function buildCommercial(col, row) {
    const { bx, bz, inner } = buildSidewalkAndLot(col, row, 'commercial');
    const face = facingOutward(col, row, 0, -1);
    const mallFacesSouth = face.fz <= 0;
    const mallRy = mallFacesSouth ? 0 : Math.PI;
    const backZ = bz - inner * 0.46;
    const frontZ = bz + inner * 0.38;

    const units = rng.int(3, 4);
    const fm = frameAt(bx, backZ, mallRy);
    fm.col = col; fm.row = row;
    const mallMeta = stripMall(S, W, rng, fm, units);
    const rot90 = Math.abs(Math.sin(mallRy)) > 0.5;
    const mhw = rot90 ? mallMeta.hd : mallMeta.hw;
    const mhd = rot90 ? mallMeta.hw : mallMeta.hd;
    collision.addBox(bx, backZ, mhw, mhd);
    const mallDoorRaw = mallMeta.doorOverride;
    const mallDoor = new THREE.Vector3(mallDoorRaw.x, 0, mallDoorRaw.z);
    const parkX = THREE.MathUtils.clamp(mallDoor.x, bx - inner * 0.8, bx + inner * 0.8);
    locations.register({
      name: foodNames[foodIdx++ % foodNames.length],
      category: 'food',
      door: mallDoor,
      parkPos: new THREE.Vector3(parkX, 0, frontZ + 1.5),
      buildingAABB: { cx: bx, cz: backZ, hw: mhw, hd: mhd },
      block: [col, row]
    });

    const lotW = inner * 2 - 3;
    const lotD = inner * 0.8;
    S.groundQuad(lotW, lotD, bx, 0.03, frontZ, '#4a4f57');
    const stalls = Math.floor(lotW / 3.2);
    for (let s2 = 0; s2 <= stalls; s2++) {
      const sx = bx - lotW / 2 + (s2 * lotW) / stalls;
      S.groundQuad(0.22, 5, sx, 0.045, frontZ, '#e8e6df');
    }
    for (let s3 = 0; s3 < stalls; s3++) {
      if (!rng.chance(0.45)) continue;
      const sx = bx - lotW / 2 + ((s3 + 0.5) * lotW) / stalls;
      carSpots.push({ x: sx, z: frontZ + 0.8, ry: mallRy, color: rng.pick(CAR_COLORS) });
      collision.addBox(sx, frontZ + 0.8, 0.9, 2.15);
    }

    if (rng.chance(0.7)) {
      const sideSign = col % 2 === 0 ? -1 : 1;
      const kindRoll = rng.next();
      const kind = kindRoll < 0.55 ? restaurant : shopUnit;
      const sf = frameAt(bx + sideSign * inner * 0.52, bz + inner * 0.02, sideSign > 0 ? Math.PI / 2 : -Math.PI / 2);
      sf.col = col; sf.row = row;
      placeBuilding(kind, sf, [], () => foodNames[foodIdx++ % foodNames.length]);
    }
  }

  function buildBusiness(col, row) {
    const { bx, bz, inner } = buildSidewalkAndLot(col, row, 'business');
    const face = facingOutward(col, row, 0, -1);
    const towerRy = face.ry;
    if (rng.chance(0.55)) {
      for (const sx of [-1, 1]) {
        const f = frameAt(bx + sx * inner * 0.44, bz - inner * 0.22, towerRy);
        f.col = col; f.row = row;
        placeBuilding(officeTower, f, [], () => 'Office Tower');
      }
    } else {
      const f = frameAt(bx, bz - inner * 0.28, towerRy);
      f.col = col; f.row = row;
      placeBuilding(officeTower, f, [], () => 'Office Tower');
      const cf = frameAt(bx + (rng.chance(0.5) ? inner * 0.5 : -inner * 0.5), bz + inner * 0.42, towerRy);
      cf.col = col; cf.row = row;
      placeBuilding(shopUnit, cf, [], () => foodNames[foodIdx++ % foodNames.length]);
    }
    for (const px of [-inner * 0.55, inner * 0.55]) {
      S.box(2.2, 0.5, 2.2, bx + px, 0.32, bz + inner * 0.5, '#8f979c');
      const tx = bx + px;
      const tz = bz + inner * 0.5;
      if (!treeOverlapsBuilding(tx, tz)) treeSpots.push({ x: tx, z: tz, s: 0.72 });
    }
  }

  function buildCampus(col, row) {
    const { bx, bz, inner } = buildSidewalkAndLot(col, row, 'campus');
    S.groundQuad(inner * 0.5, inner * 2, bx, 0.04, bz, '#cbc4b4');
    S.groundQuad(inner * 2, inner * 0.5, bx, 0.041, bz, '#cbc4b4');
    const roles = ['food', 'home', null];
    const r1 = roles[((col * 2 + row) % 3 + 3) % 3];
    const r2 = roles[((col * 2 + row + 1) % 3 + 3) % 3];
    const spots = [
      { x: bx - inner * 0.48, z: bz - inner * 0.44 },
      { x: bx + inner * 0.48, z: bz + inner * 0.44 }
    ];
    const cats = [r1, r2];
    for (let i = 0; i < 2; i++) {
      const face = facingOutward(col, row, spots[i].x > bx ? 1 : -1, spots[i].z > bz ? 1 : -1);
      const f = frameAt(spots[i].x, spots[i].z, face.ry);
      f.col = col; f.row = row;
      const cat = cats[i];
      placeBuilding(campusHall, f, [cat], (c) =>
        c === 'food' ? 'Campus Cafeteria' : c === 'home' ? `${homeNames[homeIdx++ % homeNames.length]} Dorms` : 'Campus Hall'
      );
    }
    for (let t = 0; t < 5; t++) {
      const tx = bx + rng.float(-inner * 0.85, inner * 0.85);
      const tz = bz + rng.float(-inner * 0.85, inner * 0.85);
      if (!treeOverlapsBuilding(tx, tz)) treeSpots.push({ x: tx, z: tz, s: rng.float(0.9, 1.5) });
    }
  }

  const gasSpots = [
    { col: 0, row: 0 },
    { col: N - 1, row: N - 1 }
  ];
  const gasSpotSet = new Set(gasSpots.map((s) => s.col + ',' + s.row));

  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (gasSpotSet.has(col + ',' + row)) continue;
      const zone = cfg.zoneOf(col, row);
      if (zone === 'residential') buildResidential(col, row);
      else if (zone === 'commercial') buildCommercial(col, row);
      else if (zone === 'business') buildBusiness(col, row);
      else buildCampus(col, row);
    }
  }

  for (const { col, row } of gasSpots) {
    const bx = blockCenter(col);
    const bz = blockCenter(row);
    const face = facingOutward(col, row, 0, -1);
    const f = frameAt(bx, bz, face.ry);
    f.col = col; f.row = row;
    const meta = gasStation(S, W, rng, f);
    const rot90 = Math.abs(Math.sin(face.ry)) > 0.5;
    const hw = rot90 ? meta.hd : meta.hw;
    const hd = rot90 ? meta.hw : meta.hd;
    const storeWorldX = bx + (meta.storeCz || 0) * Math.sin(face.ry);
    const storeWorldZ = bz + (meta.storeCz || 0) * Math.cos(face.ry);
    collision.addBox(storeWorldX, storeWorldZ, hw, hd);
    const doorLocal = meta.doorOverride || l2wV(f, meta.doorLocal.dx, meta.doorLocal.dz);
    const parkX = THREE.MathUtils.clamp(doorLocal.x, bx - 12, bx + 12);
    const frontZ = bz + (face.fz <= 0 ? -10 : 10);
    locations.register({
      name: 'Gas & Go',
      category: 'gas',
      door: new THREE.Vector3(doorLocal.x, 0, doorLocal.z),
      parkPos: new THREE.Vector3(parkX, 0, frontZ),
      buildingAABB: { cx: storeWorldX, cz: storeWorldZ, hw, hd },
      block: [col, row]
    });
    buildingBoxes.push({ cx: storeWorldX, cz: storeWorldZ, hw: hw + 2.5, hd: hd + 2.5 });
  }

  for (const b of locations.pois) {
    minimapPois.push({ x: b.door.x, z: b.door.z, category: b.category });
  }

  S.box(T + 2, 1.2, 1, 0, 0.6, -H - 0.5, '#9aa0a6');
  S.box(T + 2, 1.2, 1, 0, 0.6, H + 0.5, '#9aa0a6');
  S.box(1, 1.2, T + 2, H + 0.5, 0.6, 0, '#9aa0a6');
  collision.addBox(0, -H - 0.5, T / 2 + 2, 0.5);
  collision.addBox(0, H + 0.5, T / 2 + 2, 0.5);
  collision.addBox(H + 0.5, 0, 0.5, T / 2 + 2);

  const materials = makeSharedMaterials();
  const group = new THREE.Group();
  const solidMesh = S.build(materials.solid, { castShadow: true, receiveShadow: true });
  if (solidMesh) group.add(solidMesh);
  const winMesh = W.build(materials.windows, { castShadow: false, receiveShadow: false });
  if (winMesh) group.add(winMesh);

  group.add(buildTrees(treeSpots));
  group.add(buildPropCars(carSpots));
  group.add(buildLamps(lampSpots));

  const spawn = new THREE.Vector3(lineCoord(N / 2), 0, H - R / 2);

  const minimapData = {
    span: T,
    half: H,
    roadWidth: R,
    gridN: N,
    pitch: P,
    blocks: minimapBlocks,
    pois: minimapPois
  };

  return new CityWorld(group, locations, minimapData, spawn, materials);
}

function buildTrees(spots) {
  const g = new THREE.Group();
  if (spots.length === 0) return g;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6);
  trunkGeo.translate(0, 0.8, 0);
  const foliageGeo = new THREE.IcosahedronGeometry(1.55, 0);
  foliageGeo.translate(0, 2.4, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#7a5236' });
  const leafMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
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
  const yAxis = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const greens = ['#5ea35c', '#6fb261', '#4f9a54', '#83bd6d'];
  for (let i = 0; i < spots.length; i++) {
    const t = spots[i];
    const s = t.s || 1;
    q.setFromAxisAngle(yAxis, i * 1.3);
    m.compose(pos.set(t.x, 0.05, t.z), q, sc.set(s, s, s));
    trunks.setMatrixAt(i, m);
    leaves.setMatrixAt(i, m);
    col.set(greens[i % greens.length]);
    leaves.setColorAt(i, col);
  }
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  g.add(trunks, leaves);
  return g;
}

function buildPropCars(spots) {
  const g = new THREE.Group();
  if (spots.length === 0) return g;
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.75, 4.0);
  bodyGeo.translate(0, 0.62, 0);
  const cabinGeo = new THREE.BoxGeometry(1.62, 0.58, 1.9);
  cabinGeo.translate(0, 1.26, -0.25);
  const bodyMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const cabinMat = new THREE.MeshLambertMaterial({ color: '#2e3440' });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, spots.length);
  const cabins = new THREE.InstancedMesh(cabinGeo, cabinMat, spots.length);
  bodies.castShadow = true;
  bodies.frustumCulled = false;
  cabins.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    q.setFromAxisAngle(yAxis, s.ry || 0);
    m.compose(pos.set(s.x, 0.03, s.z), q, one);
    bodies.setMatrixAt(i, m);
    cabins.setMatrixAt(i, m);
    col.set(s.color || '#cccccc');
    bodies.setColorAt(i, col);
  }
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  g.add(bodies, cabins);
  return g;
}

function buildLamps(spots) {
  const g = new THREE.Group();
  if (spots.length === 0) return g;
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5, 6);
  poleGeo.translate(0, 2.5, 0);
  const headGeo = new THREE.BoxGeometry(0.45, 0.2, 1.0);
  headGeo.translate(0, 5.05, 0.42);
  const mat = new THREE.MeshLambertMaterial({ color: '#545c64' });
  const poles = new THREE.InstancedMesh(poleGeo, mat, spots.length);
  const heads = new THREE.InstancedMesh(headGeo, mat, spots.length);
  poles.castShadow = true;
  poles.frustumCulled = false;
  heads.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    q.setFromAxisAngle(yAxis, s.ry || 0);
    m.compose(pos.set(s.x, 0.12, s.z), q, one);
    poles.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
  }
  g.add(poles, heads);
  return g;
}
