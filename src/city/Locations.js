import * as THREE from 'three';

let _nextId = 1;

export class LocationRegistry {
  constructor() {
    this.pois = [];
    this._byId = new Map();
  }

  register({ name, category, door, parkPos, buildingAABB = null, block = null }) {
    const poi = {
      id: 'poi' + _nextId++,
      name,
      category,
      door: door.clone ? door.clone() : new THREE.Vector3(door.x, door.y || 0, door.z),
      parkPos: parkPos.clone ? parkPos.clone() : new THREE.Vector3(parkPos.x, 0, parkPos.z),
      buildingAABB,
      block
    };
    this.pois.push(poi);
    this._byId.set(poi.id, poi);
    return poi;
  }

  byCategory(category) {
    return this.pois.filter((p) => p.category === category);
  }

  randomOf(category, rng, excludeId = null) {
    const pool = this.byCategory(category).filter((p) => p.id !== excludeId);
    if (pool.length === 0) return null;
    return rng.pick(pool);
  }

  roadDistance(a, b) {
    return Math.abs(a.door.x - b.door.x) + Math.abs(a.door.z - b.door.z);
  }
}
