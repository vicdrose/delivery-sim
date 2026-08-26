import { frameAt } from './GeoUtil.js';

export const PALETTES = {
  houseBodies: ['#f2e3c9', '#bfe3c0', '#bcd9ea', '#eec9d2', '#f4e3a1', '#e8a08a', '#d9c39a', '#cdd6cf'],
  houseRoofs: ['#c96f4a', '#5c6670', '#8a6248', '#7a5546', '#946b52'],
  apartment: ['#b0604f', '#d9c39a', '#8fa3b5', '#a89f91', '#c4a484', '#97aab4'],
  commercialFascia: ['#e8615a', '#f2a541', '#2a9d8f', '#e76f51', '#457b9d', '#b56576', '#f4d35e'],
  tower: ['#7fa8c9', '#5d84a8', '#aab2bc', '#8ea4b8', '#6d98b8', '#b8c4cc'],
  campus: ['#a35d52', '#e8dcc4', '#9caf88', '#c9b18c', '#8fa3b5'],
  warehouse: ['#c8bfae', '#b5aa96', '#a8b0b8', '#d1c7b4'],
  signs: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'],
  awnings: ['#e63946', '#2a9d8f', '#457b9d', '#e9c46a', '#9d4edd'],
  concrete: '#b8bcc2',
  plinth: '#9aa0a6',
  doorDark: '#4a3f35',
  glassDay: '#31414f',
  glassStorefront: '#3d5866'
};

function l2w(f, dx, dz) {
  return {
    x: f.x + dx * f.c + dz * f.s,
    z: f.z - dx * f.s + dz * f.c
  };
}

function addPlinth(S, f, w, d) {
  const p = l2w(f, 0, 0);
  S.box(w + 0.5, 0.24, d + 0.5, p.x, 0.12, p.z, PALETTES.plinth);
}

function addDoor(S, f, dx, dz, w = 1.3, h = 2.4) {
  const p = l2w(f, dx, dz);
  S.wallQuad(w, h, p.x, h / 2 + 0.22, p.z, f.ry, PALETTES.doorDark);
  S.box(w + 0.5, 0.16, 1.0, p.x - f.s * 0.5 * 0, 0.28, p.z, PALETTES.concrete, f.ry);
}

function addAwning(S, f, dx, dy, dz, w, out, color) {
  const p = l2w(f, dx, dz);
  S.box(w, 0.12, out, p.x, dy, p.z, color, f.ry);
}

function addWindowQuad(W, f, dx, dy, dz, w, h, hex) {
  const p = l2w(f, dx, dz);
  W.wallQuad(w, h, p.x, dy, p.z, f.ry, hex || PALETTES.glassDay);
}

function windowGrid(W, f, faceDz, faceW, height, y0, cols, rows, hex) {
  const ww = Math.min(1.25, (faceW / cols) * 0.42);
  const wh = Math.min(1.5, (height / rows) * 0.42);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = cols === 1 ? 0 : (c / (cols - 1)) * 2 - 1;
      const dx = t * (faceW / 2 - ww / 2 - 0.5);
      const dy = y0 + wh / 2 + r * (height / rows);
      addWindowQuad(W, f, dx, dy, faceDz, ww, wh, hex);
    }
  }
}

function windowStrip(W, f, faceW, y, dz, hex) {
  const p1 = l2w(f, -faceW / 2 + 0.05, dz);
  const p2 = l2w(f, faceW / 2 - 0.05, dz);
  W.wallQuad(faceW - 0.1, 0.85, (p1.x + p2.x) / 2, y, (p1.z + p2.z) / 2, f.ry, hex);
}

function roofClutter(S, rng, f, hw, hd, topY) {
  const spots = [
    [-hw * 0.5, -hd * 0.4],
    [hw * 0.45, hd * 0.35],
    [0, hd * 0.3]
  ];
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const [dx, dz] = spots[i];
    const p = l2w(f, dx, dz);
    if (rng.chance(0.6)) S.box(rng.float(1.2, 2), 0.8, rng.float(1.2, 2), p.x, topY + 0.4, p.z, '#aeb6ba', f.ry);
    else S.cyl(0.7, 0.7, 1.1, 8, p.x, topY + 0.55, p.z, '#8f979c');
  }
  if (rng.chance(0.35)) {
    const p = l2w(f, hw * 0.3, -hd * 0.3);
    S.cyl(0.06, 0.08, rng.float(2.5, 4.5), 5, p.x, topY + 1.4, p.z, '#6d757c');
  }
}

export function smallHouse(S, W, rng, f) {
  const w = rng.float(6.2, 8);
  const d = rng.float(5.2, 7);
  const h = rng.float(3, 3.8);
  const body = rng.pick(PALETTES.houseBodies);
  const roofC = rng.pick(PALETTES.houseRoofs);
  addPlinth(S, f, w, d);
  const c = l2w(f, 0, 0);
  S.box(w, h, d, c.x, h / 2 + 0.22, c.z, body, f.ry);
  const rh = rng.float(1.7, 2.5);
  S.cone(Math.max(w, d) * 0.74, rh, 4, c.x, h + 0.22 + rh / 2, c.z, roofC, f.ry + Math.PI / 4);
  const doorDx = rng.float(-w * 0.22, w * 0.22);
  addDoor(S, f, doorDx, d / 2 + 0.03);
  const awnC = rng.pick(PALETTES.awnings);
  addAwning(S, f, doorDx, 2.55, d / 2 + 0.55, 1.9, 1.1, awnC);
  windowGrid(W, f, d / 2 + 0.04, w, h - 1.2, 0.9, 2, 1);
  windowGrid(W, f, -(d / 2 + 0.04), w, h - 1.2, 0.9, 2, 1);
  if (rng.chance(0.5)) {
    const cp = l2w(f, w * 0.3, -d * 0.25);
    S.box(0.8, 1.4, 0.8, cp.x, h + 0.9, cp.z, '#8a6248', f.ry);
  }
  return { hw: w / 2, hd: d / 2, doorLocal: { dx: doorDx, dz: d / 2 + 0.15 } };
}

export function townhouseRow(S, W, rng, f) {
  const units = rng.int(2, 3);
  const uw = 4.7;
  const d = rng.float(7, 8.5);
  const totalW = units * uw;
  for (let i = 0; i < units; i++) {
    const dx = -totalW / 2 + uw * (i + 0.5);
    const h = rng.float(5.4, 7.4);
    const body = rng.pick(PALETTES.apartment.concat(PALETTES.houseBodies));
    const c = l2w(f, dx, 0);
    S.box(uw, h, d, c.x, h / 2 + 0.22, c.z, body, f.ry);
    S.box(uw, 0.5, d, c.x, h + 0.42, c.z, PALETTES.concrete, f.ry);
    addDoor(S, f, dx, d / 2 + 0.03);
    addAwning(S, f, dx, 2.7, d / 2 + 0.5, 2.2, 0.9, rng.pick(PALETTES.awnings));
    windowGrid(W, f, d / 2 + 0.04, uw - 0.6, h - 3, 3.2, 1, Math.max(1, Math.floor((h - 3) / 2.8)));
  }
  return { hw: totalW / 2, hd: d / 2, doorLocal: { dx: 0, dz: d / 2 + 0.15 } };
}

export function apartmentBlock(S, W, rng, f, poiMeta = null) {
  const w = rng.float(11, 16);
  const d = rng.float(10, 13);
  const floors = rng.int(3, 5);
  const h = floors * 2.9;
  const body = rng.pick(PALETTES.apartment);
  addPlinth(S, f, w, d);
  const c = l2w(f, 0, 0);
  S.box(w, h, d, c.x, h / 2 + 0.22, c.z, body, f.ry);
  S.box(w + 0.3, 0.55, d + 0.3, c.x, h + 0.45, c.z, PALETTES.concrete, f.ry);
  S.box(w * 0.96, 1.1, d * 0.94, c.x, 0.85, c.z, rng.pick(PALETTES.commercialFascia), f.ry);
  const cols = Math.max(3, Math.floor(w / 2.4));
  windowGrid(W, f, d / 2 + 0.04, w - 1.4, h - 2.6, 3.0, cols, floors - 1);
  windowGrid(W, f, -(d / 2 + 0.04), w - 1.4, h - 2.6, 3.0, cols, floors - 1);
  addDoor(S, f, 0, d / 2 + 0.04, 1.8, 2.6);
  addAwning(S, f, 0, 3.1, d / 2 + 0.9, 3.2, 1.5, rng.pick(PALETTES.awnings));
  roofClutter(S, rng, f, w / 2 - 1, d / 2 - 1, h + 0.7);
  return { hw: w / 2, hd: d / 2, doorLocal: { dx: 0, dz: d / 2 + 0.2 } };
}

export function restaurant(S, W, rng, f) {
  const w = rng.float(10, 13);
  const d = rng.float(8, 10);
  const h = rng.float(4.2, 5);
  const fascia = rng.pick(PALETTES.commercialFascia);
  addPlinth(S, f, w, d);
  const c = l2w(f, 0, 0);
  S.box(w, h, d, c.x, h / 2 + 0.22, c.z, '#efe9dc', f.ry);
  S.box(w + 0.4, 1.3, d + 0.4, c.x, h + 0.4, c.z, fascia, f.ry);
  windowStrip(W, f, w - 2.4, h * 0.62, d / 2 + 0.06, PALETTES.glassStorefront);
  windowStrip(W, f, w - 2.4, h * 0.34, d / 2 + 0.06, PALETTES.glassStorefront);
  const doorDx = rng.float(-1.5, 1.5);
  addDoor(S, f, doorDx, d / 2 + 0.04, 1.8, 2.6);
  addAwning(S, f, 0, 3.0, d / 2 + 1.0, w * 0.55, 1.7, rng.pick(PALETTES.awnings));
  roofClutter(S, rng, f, w / 2 - 1.2, d / 2 - 1, h + 1.05);
  const sp = l2w(f, 0, d / 2 + 0.26);
  S.wallQuad(w * 0.62, 1.0, sp.x, h + 0.4, sp.z, f.ry, '#fffbe8');
  return { hw: w / 2, hd: d / 2, poiCategory: 'food', doorLocal: { dx: doorDx, dz: d / 2 + 0.15 } };
}

export function shopUnit(S, W, rng, f) {
  const w = rng.float(7.5, 10);
  const d = rng.float(7, 9);
  const h = rng.float(3.8, 4.4);
  const fascia = rng.pick(PALETTES.commercialFascia);
  addPlinth(S, f, w, d);
  const c = l2w(f, 0, 0);
  S.box(w, h, d, c.x, h / 2 + 0.22, c.z, rng.pick(['#e7e2d8', '#dde3e8', '#e8ded0']), f.ry);
  S.box(w + 0.3, 0.9, d + 0.3, c.x, h + 0.32, c.z, fascia, f.ry);
  windowStrip(W, f, w - 1.6, h * 0.5, d / 2 + 0.06, PALETTES.glassStorefront);
  addDoor(S, f, 0, d / 2 + 0.04, 1.6, 2.5);
  roofClutter(S, rng, f, w / 2 - 1, d / 2 - 1, h + 0.75);
  return { hw: w / 2, hd: d / 2, poiCategory: 'food', doorLocal: { dx: 0, dz: d / 2 + 0.15 } };
}

export function stripMall(S, W, rng, f, unitCount) {
  const uw = 6.4;
  const d = rng.float(9, 11);
  const h = 4.3;
  const totalW = uw * unitCount;
  addPlinth(S, f, totalW, d);
  const c = l2w(f, 0, 0);
  S.box(totalW, h, d, c.x, h / 2 + 0.22, c.z, '#ece6da', f.ry);
  S.box(totalW + 0.3, 1.0, d + 0.3, c.x, h + 0.35, c.z, '#d7d2c6', f.ry);
  let foodUnit = rng.int(0, unitCount - 1);
  for (let i = 0; i < unitCount; i++) {
    const dx = -totalW / 2 + uw * (i + 0.5);
    const pil = l2w(f, dx - uw / 2 + 0.25, 0);
    S.box(0.5, h + 0.6, d + 0.15, pil.x, (h + 0.6) / 2 + 0.2, pil.z, '#cfc9bc', f.ry);
    windowStrip(W, f, uw - 1.2, 2.6, d / 2 + 0.07, PALETTES.glassStorefront);
    const signP = l2w(f, dx, d / 2 + 0.2);
    S.wallQuad(uw - 1.4, 0.75, signP.x, h + 0.35, signP.z, f.ry, rng.pick(PALETTES.signs));
    if (i === foodUnit) {
      addDoor(S, f, dx, d / 2 + 0.04, 1.7, 2.5);
      addAwning(S, f, dx, 3.1, d / 2 + 0.8, uw - 1.2, 1.3, rng.pick(PALETTES.awnings));
    } else {
      addWindowQuad(W, f, dx, 1.4, d / 2 + 0.07, 1.4, 2.2, PALETTES.glassStorefront);
    }
  }
  const doorLocalX = -totalW / 2 + uw * (foodUnit + 0.5);
  const dp = l2w(f, doorLocalX, d / 2 + 0.1);
  return {
    hw: totalW / 2,
    hd: d / 2,
    poiCategory: 'food',
    doorOverride: dp
  };
}

export function officeTower(S, W, rng, f) {
  const tiers = rng.int(2, 4);
  let w = rng.float(13, 15.5);
  const d = w * rng.float(0.82, 1.0);
  let y = 0.22;
  const facade = rng.pick(PALETTES.tower);
  const accent = rng.pick(PALETTES.tower);
  const c0 = l2w(f, 0, 0);
  addPlinth(S, f, w, d);
  for (let t = 0; t < tiers; t++) {
    const th = t === 0 ? rng.float(8, 11) : rng.float(6, 10);
    S.box(w, th, d, c0.x, y + th / 2, c0.z, t % 2 === 0 ? facade : accent, f.ry);
    const bands = Math.floor(th / 1.35);
    const sideRy = f.ry + Math.PI / 2;
    for (let b = 0; b < bands; b++) {
      const by = y + 1.1 + b * 1.35;
      windowStrip(W, f, w - 0.7, by, d / 2 + 0.05);
      windowStrip(W, f, w - 0.7, by, -(d / 2 + 0.05));
      const s1 = l2w(f, w / 2 + 0.05, 0);
      const s2 = l2w(f, -(w / 2 + 0.05), 0);
      W.wallQuad(d - 0.7, 0.85, s1.x, by, s1.z, sideRy);
      W.wallQuad(d - 0.7, 0.85, s2.x, by, s2.z, sideRy);
    }
    y += th;
    w -= rng.float(1.2, 2.4);
  }
  S.box(w * 0.4, 1.0, d * 0.4, c0.x, y + 0.5, c0.z, '#8f979c', f.ry);
  S.cyl(0.09, 0.13, 5, 5, c0.x, y + 3.2, c0.z, '#6d757c');
  addDoor(S, f, 0, d / 2 + 0.05, 2.2, 2.8);
  addAwning(S, f, 0, 3.4, d / 2 + 1.1, 4, 1.8, '#37474f');
  return { hw: 15.5 / 2, hd: d / 2, doorLocal: { dx: 0, dz: d / 2 + 0.2 } };
}

export function campusHall(S, W, rng, f, poiCategory = null) {
  const w = rng.float(16, 20);
  const d = rng.float(10, 13);
  const h = rng.float(6, 8);
  const body = rng.pick(PALETTES.campus);
  addPlinth(S, f, w, d);
  const c = l2w(f, 0, 0);
  S.box(w, h, d, c.x, h / 2 + 0.22, c.z, body, f.ry);
  S.box(w + 0.4, 0.6, d + 0.4, c.x, h + 0.42, c.z, PALETTES.concrete, f.ry);
  const cols = Math.floor(w / 2.6);
  windowGrid(W, f, d / 2 + 0.05, w - 2, h - 2.2, 2.2, cols, 2);
  windowGrid(W, f, -(d / 2 + 0.05), w - 2, h - 2.2, 2.2, cols, 2);
  for (let i = -1; i <= 1; i++) {
    const pp = l2w(f, i * 2.4, d / 2 + 1.4);
    S.box(0.7, h - 1, 0.7, pp.x, (h - 1) / 2 + 0.22, pp.z, '#e8dcc4', f.ry);
  }
  const sl = l2w(f, 0, d / 2 + 1.4);
  S.box(8.5, 0.6, 3.4, sl.x, h + 0.05, sl.z, '#e8dcc4', f.ry);
  addDoor(S, f, 0, d / 2 + 0.05, 2.4, 2.8);
  return { hw: w / 2, hd: d / 2, poiCategory, doorLocal: { dx: 0, dz: d / 2 + 1.6 } };
}

export function warehouseStore(S, W, rng, f) {
  const w = rng.float(18, 22);
  const d = rng.float(13, 16);
  const h = rng.float(6.5, 8);
  const body = rng.pick(PALETTES.warehouse);
  addPlinth(S, f, w, d);
  const c = l2w(f, 0, 0);
  S.box(w, h, d, c.x, h / 2 + 0.22, c.z, body, f.ry);
  for (let dx = -w / 2 + 1; dx <= w / 2 - 1; dx += 2.2) {
    const p = l2w(f, dx, d / 2 + 0.09);
    S.box(0.35, h, 0.2, p.x, h / 2 + 0.22, p.z, '#9d9484', f.ry);
  }
  windowStrip(W, f, w - 3, h - 1.1, d / 2 + 0.06, '#4a5a66');
  const dock = l2w(f, w / 2 - 2.5, -(d / 2 + 0.05));
  S.box(3.2, 3.4, 0.25, dock.x, 1.9, dock.z, '#7d7668', f.ry);
  const sp = l2w(f, 0, d / 2 + 0.25);
  S.wallQuad(w * 0.55, 1.5, sp.x, h - 0.6, sp.z, f.ry, rng.pick(PALETTES.signs));
  addDoor(S, f, -w / 4, d / 2 + 0.04, 1.8, 2.6);
  addAwning(S, f, -w / 4, 3.2, d / 2 + 1.0, 3.4, 1.5, rng.pick(PALETTES.awnings));
  roofClutter(S, rng, f, w / 2 - 2, d / 2 - 1.5, h + 0.2);
  return { hw: w / 2, hd: d / 2, poiCategory: 'food', doorLocal: { dx: -w / 4, dz: d / 2 + 0.15 } };
}

export function gasStation(S, W, rng, f) {
  const w = rng.float(10, 12);
  const d = rng.float(8, 9);
  const h = rng.float(3.6, 4.2);
  const canopyW = rng.float(14, 16);
  const canopyD = rng.float(9, 11);
  const c = l2w(f, 0, 0);
  const canopyP = l2w(f, 0, 0);
  S.box(canopyW, 0.2, canopyD, canopyP.x, 3.8, canopyP.z, '#e8e6df', f.ry);
  S.box(0.3, 3.6, 0.3, canopyP.x - canopyW / 2 + 0.5, 2.0, canopyP.z - canopyD / 2 + 0.5, '#888', f.ry);
  S.box(0.3, 3.6, 0.3, canopyP.x + canopyW / 2 - 0.5, 2.0, canopyP.z - canopyD / 2 + 0.5, '#888', f.ry);
  S.box(0.3, 3.6, 0.3, canopyP.x - canopyW / 2 + 0.5, 2.0, canopyP.z + canopyD / 2 - 0.5, '#888', f.ry);
  S.box(0.3, 3.6, 0.3, canopyP.x + canopyW / 2 - 0.5, 2.0, canopyP.z + canopyD / 2 - 0.5, '#888', f.ry);
  const storeP = l2w(f, 0, -d / 2 - 1.8);
  S.box(w, h, d, storeP.x, h / 2 + 0.22, storeP.z, '#f2efe6', f.ry);
  S.box(w + 0.3, 0.8, d + 0.3, storeP.x, h + 0.32, storeP.z, '#e63946', f.ry);
  windowStrip(W, f, w - 2, h * 0.5, -(d / 2 + 1.8) + d / 2 + 0.06, PALETTES.glassStorefront);
  addDoor(S, f, 0, -(d / 2 + 1.8) + d / 2 + 0.04, 1.6, 2.5);
  const sp = l2w(f, 0, -(d / 2 + 1.8) + d / 2 + 0.2);
  S.wallQuad(w * 0.6, 1.0, sp.x, h + 0.32, sp.z, f.ry, '#ffca3a');
  const pumpOffsetX = rng.pick([-3.5, 3.5]);
  const pumpP = l2w(f, pumpOffsetX, 0);
  S.box(0.5, 1.6, 0.5, pumpP.x, 1.0, pumpP.z, '#3d3d3d', f.ry);
  S.box(0.6, 0.15, 0.3, pumpP.x, 1.85, pumpP.z, '#555', f.ry);
  const doorLocal = { dx: 0, dz: -(d / 2 + 1.8) + d / 2 + 0.15 };
  return { hw: canopyW / 2, hd: canopyD / 2, poiCategory: 'gas', doorLocal };
}

export { frameAt };
