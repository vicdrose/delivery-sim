export class InteractionSystem {
  constructor() {
    this.items = new Map();
    this.current = null;
    this._nextId = 1;
  }

  add({ position, radius, label, action, enabled }) {
    const id = this._nextId++;
    const item = {
      id,
      position,
      radius: radius ?? 2.8,
      label: label || null,
      action: action || null,
      enabled: enabled || (() => true)
    };
    this.items.set(id, item);
    return () => this.remove(id);
  }

  remove(id) {
    this.items.delete(id);
    if (this.current && this.current.id === id) this.current = null;
  }

  clear() {
    this.items.clear();
    this.current = null;
  }

  update(playerPos) {
    let best = null;
    let bestD = Infinity;
    for (const item of this.items.values()) {
      if (!item.enabled() || !item.label || !item.action) continue;
      const dx = playerPos.x - item.position.x;
      const dz = playerPos.z - item.position.z;
      if (Math.abs(item.position.y - playerPos.y) > 3) continue;
      const d2 = dx * dx + dz * dz;
      const r = item.radius;
      if (d2 <= r * r && d2 < bestD) {
        bestD = d2;
        best = item;
      }
    }
    this.current = best;
    return best;
  }

  get promptLabel() {
    return this.current ? this.current.label : null;
  }

  tryInteract() {
    if (!this.current || !this.current.action) return false;
    this.current.action();
    return true;
  }
}
