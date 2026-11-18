const HEARTBEAT_MS = 3e4;
const LEASE_MS = 9e4;
function createInstanceId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `llm_${cryptoApi.randomUUID()}`;
  return `llm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function defaultBroadcastChannel(name) {
  const Channel = globalThis.BroadcastChannel;
  return Channel ? new Channel(name) : void 0;
}
class LLMLogLease {
  instanceId;
  store;
  clock;
  heartbeatMs;
  leaseMs;
  channel;
  setIntervalFn;
  clearIntervalFn;
  timer;
  closed = false;
  pendingAliveChecks = /* @__PURE__ */ new Map();
  constructor(options) {
    this.store = options.store;
    this.instanceId = options.instanceId || createInstanceId();
    this.clock = options.clock || Date.now;
    this.heartbeatMs = options.heartbeatMs || HEARTBEAT_MS;
    this.leaseMs = options.leaseMs || LEASE_MS;
    this.setIntervalFn = options.setInterval || globalThis.setInterval;
    this.clearIntervalFn = options.clearInterval || globalThis.clearInterval;
    this.channel = (options.broadcastChannelFactory || defaultBroadcastChannel)(`llm_log_lease_${options.prefix}`);
    if (this.channel) this.channel.onmessage = (event) => this.onMessage(event.data);
  }
  async start() {
    await this.keepAlive();
    if (!this.timer) this.timer = this.setIntervalFn(() => void this.keepAlive(), this.heartbeatMs);
  }
  async keepAlive() {
    if (this.closed) return;
    const updatedAt = this.clock();
    try {
      await this.store.putLease({ instanceId: this.instanceId, updatedAt, expiresAt: updatedAt + this.leaseMs });
      await this.store.clearExpiredLeases?.(updatedAt);
    } catch (_error) {
    }
  }
  /** Returns owners that replied within timeoutMs; an unavailable channel returns an empty set. */
  confirmAlive(ownerIds, timeoutMs = 300) {
    const requested = Array.from(new Set(ownerIds));
    if (!requested.length || !this.channel || this.closed) return Promise.resolve(/* @__PURE__ */ new Set());
    const requestId = `${this.instanceId}_${this.clock()}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      const replies = /* @__PURE__ */ new Set();
      const finish = () => {
        const pending = this.pendingAliveChecks.get(requestId);
        if (!pending) return;
        this.pendingAliveChecks.delete(requestId);
        clearTimeout(pending.timer);
        resolve(replies);
      };
      const timer = setTimeout(finish, timeoutMs);
      this.pendingAliveChecks.set(requestId, { requested: new Set(requested), replies, resolve, timer });
      try {
        this.channel.postMessage({ type: "llm_log_alive_query", requestId, ownerIds: requested });
      } catch (_error) {
        finish();
      }
    });
  }
  async close(release = true) {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) this.clearIntervalFn(this.timer);
    for (const pending of this.pendingAliveChecks.values()) {
      clearTimeout(pending.timer);
      pending.resolve(pending.replies);
    }
    this.pendingAliveChecks.clear();
    this.channel?.close();
    if (!release) return;
    try {
      await this.store.deleteLease(this.instanceId);
    } catch (_error) {
    }
  }
  onMessage(message) {
    if (message.type === "llm_log_alive_reply") {
      const pending = this.pendingAliveChecks.get(message.requestId);
      if (pending?.requested.has(message.ownerId)) pending.replies.add(message.ownerId);
      return;
    }
    if (message.ownerIds.includes(this.instanceId)) {
      try {
        this.channel?.postMessage({ type: "llm_log_alive_reply", requestId: message.requestId, ownerId: this.instanceId });
      } catch (_error) {
      }
    }
  }
}
export {
  LLMLogLease
};
