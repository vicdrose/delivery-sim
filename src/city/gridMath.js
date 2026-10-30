import { CONFIG } from '../config.js';

export function gridMetrics(grid = CONFIG.city) {
  const N = grid.gridN;
  const B = grid.blockSize;
  const R = grid.roadWidth;
  const P = B + R;
  const T = N * P + R;
  const H = T / 2;
  return {
    grid,
    N,
    B,
    R,
    SW: grid.sidewalkWidth,
    P,
    T,
    H,
    lineCoord: (i) => -H + R / 2 + i * P,
    blockMin: (i) => -H + R + i * P,
    blockCenter: (i) => -H + R + i * P + B / 2
  };
}
