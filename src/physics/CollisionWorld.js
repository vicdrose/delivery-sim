const CELL = 8;

export class CollisionWorld {
  constructor() {
    this._sets = new Map();
    this.set('city');
    this.set('interior');
  }

  set(name) {
    let s = this._sets.get(name);
    if (!s) {
      s = { boxes: [], grid: new Map() };
      this._sets.set(name, s);
    }
    return s;
  }

  clear(name) {
    const s = this.set(name);
    s.boxes.length = 0;
    s.grid.clear();
  }

  addBox(cx, cz, hw, hd, name = 'city', tag = null) {
    const s = this.set(name);
    const box = { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, tag };
    const idx = s.boxes.length;
    s.boxes.push(box);
    const x0 = Math.floor(box.minX / CELL);
    const x1 = Math.floor(box.maxX / CELL);
    const z0 = Math.floor(box.minZ / CELL);
    const z1 = Math.floor(box.maxZ / CELL);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const key = x * 100000 + z;
        let arr = s.grid.get(key);
        if (!arr) { arr = []; s.grid.set(key, arr); }
        arr.push(idx);
      }
    }
    return box;
  }

  _query(x, z, r, name, out) {
    const s = this.set(name);
    out.length = 0;
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL);
    const z1 = Math.floor((z + r) / CELL);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gz = z0; gz <= z1; gz++) {
        const arr = s.grid.get(gx * 100000 + gz);
        if (!arr) continue;
        for (const idx of arr) {
          if (!out.includes(s.boxes[idx])) out.push(s.boxes[idx]);
        }
      }
    }
    return out;
  }

  resolveCircle(pos, radius, name = 'city', velocity = null) {
    this._scratch ??= [];
    const candidates = this._query(pos.x, pos.z, radius + 1, name, this._scratch);
    let hit = false;
    let hitNx = 0;
    let hitNz = 0;
    for (const b of candidates) {
      const closestX = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      let dx = pos.x - closestX;
      let dz = pos.z - closestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;
      hit = true;
      let depth;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        depth = radius - d;
        dx /= d;
        dz /= d;
      } else {
        const left = pos.x - b.minX;
        const right = b.maxX - pos.x;
        const top = pos.z - b.minZ;
        const bottom = b.maxZ - pos.z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) { dx = -1; dz = 0; depth = left + radius; }
        else if (m === right) { dx = 1; dz = 0; depth = right + radius; }
        else if (m === top) { dx = 0; dz = -1; depth = top + radius; }
        else { dx = 0; dz = 1; depth = bottom + radius; }
      }
      pos.x += dx * depth;
      pos.z += dz * depth;
      if (depth > hitNx * hitNx + hitNz * hitNz || (hitNx === 0 && hitNz === 0)) {
        hitNx = dx;
        hitNz = dz;
      }
      if (velocity) {
        const vn = velocity.x * dx + velocity.z * dz;
        if (vn < 0) {
          velocity.x -= vn * dx;
          velocity.z -= vn * dz;
        }
      }
    }
    return hit ? { nx: hitNx, nz: hitNz } : null;
  }

  pointInsideAny(x, z, pad, name = 'city') {
    this._scratch2 ??= [];
    const candidates = this._query(x, z, pad + 0.5, name, this._scratch2);
    for (const b of candidates) {
      if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
    }
    return false;
  }
}
