class OpeningState {
  skipped = false;
  valid = true;
  completed = 0;
  fallbacks = 0;
  active = /* @__PURE__ */ new Map();
  skip() {
    this.skipped = true;
    for (const controller of this.active.values()) controller.abort();
  }
  invalidate() {
    this.valid = false;
    for (const controller of this.active.values()) controller.abort();
  }
  async request(seat, operation) {
    if (!this.valid || this.skipped) return;
    if (this.active.has(seat)) throw new Error("同座位不能并发选将");
    const controller = new AbortController();
    this.active.set(seat, controller);
    try {
      return await operation(controller.signal);
    } finally {
      this.active.delete(seat);
    }
  }
}
export {
  OpeningState
};
