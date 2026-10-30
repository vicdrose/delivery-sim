import * as THREE from 'three';
import { CONFIG } from '../config.js';

const ST = CONFIG.storage;
const UNIT_COLORS = ['#b8bcc2', '#c8bfae', '#a8b0b8', '#d1c7b4'];
const DOOR_COLORS = ['#c9ccd0', '#b7bcc2', '#d2d6da', '#aeb4ba'];
const SIGN_COLORS = ['#e63946', '#f2a541', '#2a9d8f', '#457b9d', '#f4d35e'];

export function buildStorageFacility(S, W, rng, f, collision, opts = {}) {
  const B = CONFIG.city.blockSize;
  const SW = CONFIG.city.sidewalkWidth;
  const IN = B / 2 - SW;
  const AW = ST.aisleHalfWidth;
  const UD = IN - AW;
  const N = ST.unitsPerSide;
  const wallH = ST.unitWallHeight;
  const mouthH = ST.unitMouthHeight;
  const pier = ST.pierWidth;
  const span = IN * 2;
  const unitLen = (span - (N + 1) * pier) / N;
  const vanSide = opts.vanUnit === 'west-front' ? -1 : 1;
  const openIndex = N - 1;

  const p = (dx, dz) => f.to(dx, dz);

  const box = (w, h, d, dx, dy, dz, hex) => {
    const q = p(dx, dz);
    S.box(w, h, d, q.x, dy, q.z, hex, f.ry);
  };
  const quad = (w, d, dx, dz, hex) => {
    const q = p(dx, dz);
    S.groundQuad(w, d, q.x, 0.03, q.z, hex);
  };
  const wallQuad = (w, h, dx, dy, dz, hex) => {
    const q = p(dx, dz);
    W.wallQuad(w, h, q.x, dy, q.z, f.ry, hex);
  };
  const solid = (hw, hd, dx, dz) => {
    const q = p(dx, dz);
    collision.addBox(q.x, q.z, hw, hd, 'city');
  };

  box(B, 0.14, SW, 0, 0.07, -(IN + SW / 2), '#b3b9bf');
  box(B, 0.14, SW, 0, 0.07, IN + SW / 2, '#b3b9bf');
  box(SW, 0.14, B - SW * 2, -(IN + SW / 2), 0.07, 0, '#b3b9bf');
  box(SW, 0.14, B - SW * 2, IN + SW / 2, 0.07, 0, '#b3b9bf');
  S.groundQuad((IN + SW) * 2, (IN + SW) * 2, f.x, 0.02, f.z, '#8d8578');

  quad(AW * 2, span, 0, 0, '#565b63');
  for (let i = 0; i <= 10; i++) {
    const z = -IN + (span * i) / 10;
    quad(0.22, 3.4, -AW + 1.9, z, '#e8e6df');
    quad(0.22, 3.4, AW - 1.9, z, '#e8e6df');
  }

  const unitZ = (k) => -IN + pier + unitLen / 2 + k * (unitLen + pier);

  for (const sx of [-1, 1]) {
    const wallC = UNIT_COLORS[sx > 0 ? 1 : 0];
    box(0.4, wallH, span, sx * (IN - 0.2), wallH / 2, 0, wallC);
    solid(0.2, span / 2, sx * (IN - 0.2), 0);

    for (let k = 0; k < N - 1; k++) {
      const pz = unitZ(k) + unitLen / 2 + pier / 2;
      box(pier, wallH, pier, sx * (AW + UD / 2), wallH / 2, pz, wallC);
      solid(pier / 2, pier / 2, sx * (AW + UD / 2), pz);
    }

    for (let k = 0; k < N; k++) {
      const cz = unitZ(k);
      const isOpen = sx === vanSide && k === openIndex;
      quad(UD, unitLen, sx * (AW + UD / 2), cz, isOpen ? '#4d525a' : '#6a6f77');
      box(UD, 0.3, unitLen, sx * (AW + UD / 2), wallH + 0.15, cz, '#9aa0a6');

      if (isOpen) {
        box(0.5, wallH - mouthH, unitLen, sx * (AW + 0.25), mouthH + (wallH - mouthH) / 2, cz, wallC);
        box(0.5, 0.5, unitLen * 0.94, sx * (AW + 0.22), mouthH + 0.2, cz, '#8d949b');
        box(0.14, 0.14, unitLen * 0.8, sx * (AW + 0.02), mouthH - 0.1, cz, '#f4d35e');
      } else {
        const doorC = DOOR_COLORS[k % DOOR_COLORS.length];
        box(0.16, mouthH, unitLen * 0.9, sx * AW, mouthH / 2, cz, doorC);
        for (let r2 = 0; r2 < 4; r2++) {
          const ry2 = 0.45 + r2 * (mouthH / 4.4);
          box(0.22, 0.12, unitLen * 0.9, sx * (AW - 0.03), ry2, cz, '#a4abb2');
        }
        box(0.1, 0.3, unitLen * 0.4, sx * (AW - 0.06), 1.5, cz, '#7f868d');
      }

      box(0.12, 0.6, unitLen * 0.66, sx * (AW + 0.07), wallH - 0.55, cz, SIGN_COLORS[k % SIGN_COLORS.length]);
    }
  }

  box(AW * 2, wallH, 0.4, 0, wallH / 2, -(IN - 0.2), '#b8bcc2');
  solid(AW, 0.2, 0, -(IN - 0.2));

  for (const sx of [-1, 1]) {
    box(UD, ST.fenceHeight, 0.4, sx * (AW + UD / 2), ST.fenceHeight / 2, IN - 0.2, '#a4abb2');
    solid(UD / 2, 0.2, sx * (AW + UD / 2), IN - 0.2);
    box(0.6, wallH, 0.6, sx * AW, wallH / 2, IN - 0.2, '#8d949b');
    solid(0.3, 0.3, sx * AW, IN - 0.2);
  }

  box(AW * 2 + 1.8, 0.7, 0.6, 0, wallH + 0.35, IN - 0.2, '#5d646b');
  box(AW * 2, 0.5, 0.35, 0, mouthH + 1.0, IN - 0.25, '#8d949b');
  box(10, 1.5, 0.22, 0, wallH + 1.7, IN - 0.25, '#e63946');
  box(7.4, 0.7, 0.24, 0, wallH + 1.7, IN - 0.27, '#fffbe8');

  const boothX = -(AW + UD / 2);
  box(2.6, 2.7, 2.2, boothX, 1.35, IN + 1.6, '#e8e2d4');
  box(2.9, 0.35, 2.5, boothX, 2.85, IN + 1.6, '#e63946');
  wallQuad(1.9, 1.0, boothX, 1.85, IN + 2.72, '#3d5866');
  solid(1.3, 1.1, boothX, IN + 1.6);

  for (let i = 0; i < 4; i++) {
    const lx = -AW + 3 + (i % 2) * 4;
    const lz = -IN + 6 + i * 9;
    box(0.9, 0.5, 0.9, lx, 0.25, lz, rng.pick(['#a67c52', '#8d949b', '#b08968']));
  }

  const vanP = p(vanSide * (AW - 2.4), unitZ(openIndex) - 1.0);
  const carP = p(6.5, IN + 3.6);
  const footP = p(0, IN + 1.6);
  const gateP = p(0, IN + 0.6);

  return {
    unitLength: unitLen,
    vanSlot: { x: vanP.x, z: vanP.z, heading: -vanSide * (Math.PI / 2) },
    carSlot: { x: carP.x, z: carP.z, heading: -Math.PI / 2 },
    footSlot: { x: footP.x, z: footP.z, yaw: Math.PI },
    gate: new THREE.Vector3(gateP.x, 0, gateP.z),
    lampSpots: [
      { x: p(-AW - 1.2, -IN + 4).x, z: p(-AW - 1.2, -IN + 4).z, ry: f.ry + Math.PI / 2 },
      { x: p(AW + 1.2, -IN + 4).x, z: p(AW + 1.2, -IN + 4).z, ry: f.ry - Math.PI / 2 },
      { x: p(-AW - 1.2, IN - 8).x, z: p(-AW - 1.2, IN - 8).z, ry: f.ry + Math.PI / 2 },
      { x: p(AW + 1.2, IN - 8).x, z: p(AW + 1.2, IN - 8).z, ry: f.ry - Math.PI / 2 }
    ]
  };
}
