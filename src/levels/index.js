import { CONFIG } from '../config.js';

function makeGrid(gridN, extra = {}) {
  return {
    gridN,
    blockSize: CONFIG.city.blockSize,
    roadWidth: CONFIG.city.roadWidth,
    sidewalkWidth: CONFIG.city.sidewalkWidth,
    laneLineEvery: CONFIG.city.laneLineEvery,
    treeChance: CONFIG.city.treeChance,
    boundaryWallPadding: CONFIG.city.boundaryWallPadding,
    zoneOf(col, row) {
      const n = gridN;
      const c = Math.min(col, n - 1 - col);
      const r = Math.min(row, n - 1 - row);
      const ring = Math.min(c, r);
      if (ring >= 2) return 'business';
      if (col >= n - 2 && row <= 1) return 'campus';
      if (ring === 1) return 'commercial';
      return 'residential';
    },
    ...extra
  };
}

function zoneOfWide(col, row) {
  const n = 12;
  const c = Math.min(col, n - 1 - col);
  const r = Math.min(row, n - 1 - row);
  const ring = Math.min(c, r);
  const mid = n / 2;
  if (col >= mid - 1 && col < mid + 1 && row <= 1) return 'campus';
  if (ring >= 3) return 'business';
  if (ring >= 2) return 'commercial';
  return 'residential';
}

const EXPANSION_SEED = 20261117;
const EXPANSION_N = 18;

function hash01(a, b) {
  let x = (EXPANSION_SEED ^ Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263)) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const CAMPUS_COL = 2 + Math.floor(hash01(91, 1) * (EXPANSION_N - 7));
const CAMPUS_ROW = 2 + Math.floor(hash01(91, 2) * (EXPANSION_N - 7));
const CAMPUS_W = 3 + Math.floor(hash01(91, 3) * 2);
const CAMPUS_H = 3 + Math.floor(hash01(91, 4) * 2);

const EXPANSION_GAS_SPOTS = [
  { col: Math.floor(hash01(1, 1) * 2), row: Math.floor(hash01(2, 1) * 2) },
  { col: Math.floor(hash01(1, 2) * 2), row: EXPANSION_N - 1 - Math.floor(hash01(2, 2) * 2) },
  { col: EXPANSION_N - 1 - Math.floor(hash01(1, 3) * 2), row: Math.floor(hash01(2, 3) * 2) },
  { col: EXPANSION_N - 1 - Math.floor(hash01(1, 4) * 2), row: EXPANSION_N - 1 - Math.floor(hash01(2, 4) * 2) }
];

function zoneOfExpansion(col, row) {
  const n = EXPANSION_N;
  if (
    col >= CAMPUS_COL && col < CAMPUS_COL + CAMPUS_W &&
    row >= CAMPUS_ROW && row < CAMPUS_ROW + CAMPUS_H
  ) return 'campus';
  const c = Math.min(col, n - 1 - col);
  const r = Math.min(row, n - 1 - row);
  const ring = Math.min(c, r);
  const jitter = hash01(col + 11, row + 17);
  if (ring === 0) return jitter < 0.14 ? 'commercial' : 'residential';
  if (ring === 1) return jitter < 0.62 ? 'commercial' : 'business';
  return jitter < 0.26 ? 'commercial' : 'business';
}

function pickGymBlocks() {
  const out = [];
  for (let attempt = 0; attempt < 120 && out.length < 2; attempt++) {
    const col = 2 + Math.floor(hash01(301, attempt) * (EXPANSION_N - 4));
    const row = 2 + Math.floor(hash01(302, attempt) * (EXPANSION_N - 4));
    const zone = zoneOfExpansion(col, row);
    if (zone !== 'commercial' && zone !== 'business') continue;
    if (EXPANSION_GAS_SPOTS.some((s) => s.col === col && s.row === row)) continue;
    if (out.some((s) => s.col === col && s.row === row)) continue;
    out.push({ col, row });
  }
  return out;
}

const EXPANSION_GYM_BLOCKS = pickGymBlocks();

export const LEVELS = [
  {
    id: '1-1',
    name: 'SHIFT START',
    sub: 'Home turf. One car, one city, the whole grind.',
    vehicles: ['car'],
    deliveryVehicle: 'car',
    seed: CONFIG.city.seed,
    grid: makeGrid(6),
    gasSpots: [
      { col: 0, row: 0 },
      { col: 5, row: 5 }
    ],
    storageBlock: null,
    spawn: { kind: 'street' }
  },
  {
    id: '1-2',
    name: 'THE MOVE',
    sub: 'Bigger city, fresh block. The car runs deliveries. The van is the studio. The bike gets you there.',
    vehicles: ['car', 'van', 'bike'],
    deliveryVehicle: 'car',
    seed: 20261102,
    grid: makeGrid(12, { zoneOf: zoneOfWide }),
    gasSpots: [
      { col: 0, row: 0 },
      { col: 0, row: 11 },
      { col: 11, row: 0 },
      { col: 11, row: 11 }
    ],
    storageBlock: { col: 6, row: 11, vanUnit: 'west-front' },
    spawn: { kind: 'storage' }
  },
  {
    id: '1-3',
    name: 'EXPANSION',
    sub: 'Desert heat. A gym with room for the van. A campus out on the edge of town.',
    vehicles: ['car', 'van', 'bike'],
    deliveryVehicle: 'car',
    seed: EXPANSION_SEED,
    biome: 'desert',
    sleepSpot: 'van',
    grid: makeGrid(EXPANSION_N, { zoneOf: zoneOfExpansion, treeChance: 0.28 }),
    gasSpots: EXPANSION_GAS_SPOTS,
    gymBlocks: EXPANSION_GYM_BLOCKS,
    storageBlock: null,
    spawn: { kind: 'gym' }
  }
];

export const DEFAULT_LEVEL_ID = LEVELS[0].id;

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

export function levelList(progression) {
  return LEVELS.map((l) => ({
    id: l.id,
    name: l.name,
    sub: l.sub,
    vehicles: l.vehicles.slice(),
    unlocked: progression ? progression.isUnlocked('levels', l.id) : false
  }));
}
