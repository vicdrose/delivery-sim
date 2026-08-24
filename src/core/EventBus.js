export class EventBus {
  constructor() {
    this._map = new Map();
  }

  on(type, fn) {
    if (!this._map.has(type)) this._map.set(type, new Set());
    this._map.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (...args) => {
      off();
      fn(...args);
    });
    return off;
  }

  off(type, fn) {
    const set = this._map.get(type);
    if (set) set.delete(fn);
  }

  emit(type, payload) {
    const set = this._map.get(type);
    if (!set) return;
    for (const fn of [...set]) fn(payload);
  }
}
