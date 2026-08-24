export class Loop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.running = false;
    this.time = 0;
    this.maxDelta = 0.1;
    this._rafId = 0;
    this._last = 0;
    this._tick = (nowMs) => {
      if (!this.running) return;
      this._rafId = requestAnimationFrame(this._tick);
      const now = nowMs * 0.001;
      let dt = now - this._last;
      this._last = now;
      if (dt > this.maxDelta) dt = this.maxDelta;
      if (dt < 0) dt = 0;
      this.time += dt;
      if (this.updateFn) this.updateFn(dt, this.time);
      if (this.renderFn) this.renderFn(dt, this.time);
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now() * 0.001;
    this._rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._rafId);
  }
}
