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
    sub: 'Bigger city, fresh block. The car runs deliveries. The van is the studio.',
    vehicles: ['car', 'van'],
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
