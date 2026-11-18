import "../../noname.js";
import { LLMLogLease } from "./logger-lease.js";
import { LLMLogPersistenceQueue, retryLLMLogPersistence, shouldRetryPendingLogWrites, retryPendingActiveCheckpoints } from "./logger-queue.js";
import { LLMLogStore } from "./logger-store.js";
import { plainLogValue } from "./protocol.js";
import { LLMLogMemoryCache, matchesGameAndPlayerEntry, mergeSessionsWithPending, recoverInterruptedLogs } from "./logger-cache.js";
import { createRequestTiming, finishRequestTiming, markRequestTiming } from "./logger-timing.js";
import { lib } from "../library/index.js";
import { _status } from "../status/index.js";
const RECOVERY_INTERVAL = 6e4;
const RECOVERY_GRACE = 6e4;
const LEGACY_ACTIVE_TIMEOUT = 12e4;
function cloneEntry(entry) {
  return plainLogValue(entry);
}
function monotonicNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}
function attemptKey(turnIndex, attemptIndex) {
  return `${turnIndex}:${attemptIndex}`;
}
class LLMLogger {
  store = new LLMLogStore({ getDatabase: () => lib?.db });
  persistence = new LLMLogPersistenceQueue({ reclaimQuota: () => this.store.reclaimQuota(), report: (operation, error) => this.announcePersistenceError(operation, error) });
  lease;
  activeLogs = /* @__PURE__ */ new Map();
  pendingActives = /* @__PURE__ */ new Map();
  pendingFinals = /* @__PURE__ */ new Map();
  pendingRetryScheduled = false;
  clearGeneration = 0;
  initialized;
  migrationComplete = false;
  migrationRetryQueued = false;
  recoveryTimer;
  pagehideInstalled = false;
  cache = new LLMLogMemoryCache();
  /** Initializes migration, the tab lease and interrupted-decision recovery. Idempotent. */
  init() {
    if (!this.initialized) {
      this.initialized = this.initialize().catch((error) => {
        this.announcePersistenceError("initialize", error);
      });
    } else if (!this.migrationComplete && !this.migrationRetryQueued) {
      this.migrationRetryQueued = true;
      this.enqueue("migrate_retry", async () => {
        try {
          await this.store.migrateLegacy();
          this.migrationComplete = true;
        } finally {
          this.migrationRetryQueued = false;
        }
      });
    }
    return this.initialized;
  }
  async initialize() {
    this.lease = new LLMLogLease({ store: this.store, prefix: String(lib.configprefix || "noname") });
    try {
      await this.runWithRetry("migrate", () => this.store.migrateLegacy());
      this.migrationComplete = true;
    } catch (error) {
      this.announcePersistenceError("migrate", error);
    }
    await this.lease.start();
    this.installPagehideHandler();
    void this.recoverInterrupted();
    if (!this.recoveryTimer) this.recoveryTimer = setInterval(() => void this.recoverInterrupted(), RECOVERY_INTERVAL);
  }
  start(decisionPoint, playerName, meta, seatNum, deadlineAt = Date.now() + 12e4) {
    const startedAt = Date.now();
    const id = `log_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    const gameId = _status.llmGameId || "game_unknown";
    const entry = cloneEntry({ id, gameId, timestamp: startedAt, decisionPoint, playerName, playerSeatNum: seatNum, durationMs: 0, status: "success", meta });
    const active = { entry, partialArgs: "", startedAt, deadlineAt, ownerId: this.lease?.instanceId || "llm_uninitialized", revision: 1, startedAtMonotonic: monotonicNow(), attemptStartedAt: /* @__PURE__ */ new Map() };
    this.activeLogs.set(id, active);
    this.enqueueActive(this.snapshotActive(active));
    this.publish("llm_log_start", entry);
    return id;
  }
  snapshotActive(active) {
    return {
      id: active.entry.id,
      ownerId: active.ownerId,
      revision: active.revision,
      gameId: active.entry.gameId,
      status: "active",
      timestamp: active.entry.timestamp,
      updatedAt: Date.now(),
      deadlineAt: active.deadlineAt,
      turns: active.entry.turns,
      entry: cloneEntry(active.entry)
    };
  }
  enqueueActive(active) {
    if (this.initialized && !this.migrationComplete) void this.init();
    this.retryPendingFinals();
    this.pendingActives.set(active.id, active);
    this.enqueue("checkpoint", async () => {
      await this.store.putActive(active);
      if (this.pendingActives.get(active.id) === active) this.pendingActives.delete(active.id);
    });
  }
  enqueue(name, operation) {
    this.persistence.enqueue(name, operation);
  }
  enqueueCritical(name, operation) {
    return this.persistence.enqueueCritical(name, operation);
  }
  async runWithRetry(name, operation) {
    await retryLLMLogPersistence(name, operation, () => this.store.reclaimQuota());
  }
  publish(name, value) {
    try {
      if (typeof lib !== "undefined" && lib.announce) lib.announce.publish(name, value);
    } catch (_error) {
    }
  }
  announcePersistenceError(operation, error) {
    this.publish("llm_log_persistence_error", { operation, error: error instanceof Error ? error.message : String(error), timestamp: Date.now() });
    if (lib.config?.dev) {
      console.warn(`[LLM] ${operation} persistence failed:`, error);
    }
  }
  getActive(id) {
    return this.activeLogs.get(id)?.entry;
  }
  checkpoint(id) {
    const active = this.activeLogs.get(id);
    if (!active) return;
    active.revision++;
    this.enqueueActive(this.snapshotActive(active));
  }
  matchesGameAndPlayer(entry, gameId, playerName, seatNum) {
    return matchesGameAndPlayerEntry(entry, gameId, playerName, seatNum);
  }
  getActiveLogByGameAndPlayer(gameId, playerName, seatNum) {
    let latest;
    for (const active of this.activeLogs.values()) {
      if (this.matchesGameAndPlayer(active.entry, gameId, playerName, seatNum) && (!latest || active.startedAt > latest.startedAt)) latest = active;
    }
    return latest && { entry: cloneEntry(latest.entry), partialArgs: latest.partialArgs, startedAt: latest.startedAt, ...latest.stream ? { stream: plainLogValue(latest.stream) } : {} };
  }
  logSessionMeta(id, session) {
    const active = this.activeLogs.get(id);
    if (!active) return;
    active.entry.session = plainLogValue(session);
    this.publishTiming(active);
  }
  logRefLabels(id, refLabels) {
    const entry = this.getActive(id);
    if (entry) entry.refLabels = plainLogValue(refLabels);
  }
  logRequest(id, messages, tools) {
    const entry = this.getActive(id);
    if (entry) entry.request = plainLogValue({ messages, tools });
  }
  logResponse(id, toolCall, translatedResult) {
    const entry = this.getActive(id);
    if (entry) entry.response = plainLogValue({ toolCall, translatedResult });
  }
  logAutomaticResponse(id, translatedResult) {
    const entry = this.getActive(id);
    if (entry) entry.response = plainLogValue({ execution: "automatic", translatedResult });
  }
  logError(id, stage, message, httpStatus) {
    const entry = this.getActive(id);
    if (entry) entry.error = { stage, message, httpStatus };
  }
  /** 开始一次独立的 provider 请求；SDK 内部重试仍归入同一个 attempt。 */
  startRequestAttempt(id, turnIndex, attemptIndex, transport) {
    const active = this.activeLogs.get(id);
    if (!active) return;
    const key = attemptKey(turnIndex, attemptIndex);
    if (active.attemptStartedAt.has(key)) return;
    const now = monotonicNow();
    (active.entry.requestTimings ||= []).push(createRequestTiming(turnIndex, attemptIndex, transport, now - active.startedAtMonotonic));
    active.attemptStartedAt.set(key, now);
    this.checkpoint(id);
    this.publishTiming(active);
  }
  markRequestFirstChunk(id, turnIndex, attemptIndex) {
    this.markRequestTiming(id, turnIndex, attemptIndex, "firstChunkMs");
  }
  /** 首个有效文本或工具参数到达时只增加一次检查点，供中断恢复与实时 UI 使用。 */
  markRequestTTFT(id, turnIndex, attemptIndex) {
    const marked = this.markRequestTiming(id, turnIndex, attemptIndex, "ttftMs");
    if (marked) this.checkpoint(id);
  }
  finishRequestAttempt(id, turnIndex, attemptIndex, outcome, errorStage) {
    const active = this.activeLogs.get(id);
    if (!active) return;
    const timing = this.findRequestTiming(active.entry, turnIndex, attemptIndex);
    const startedAt = active.attemptStartedAt.get(attemptKey(turnIndex, attemptIndex));
    if (!timing || startedAt === void 0) return;
    finishRequestTiming(timing, outcome, monotonicNow() - startedAt, errorStage);
    this.publishTiming(active);
  }
  markRequestTiming(id, turnIndex, attemptIndex, field) {
    const active = this.activeLogs.get(id);
    if (!active) return false;
    const timing = this.findRequestTiming(active.entry, turnIndex, attemptIndex);
    const startedAt = active.attemptStartedAt.get(attemptKey(turnIndex, attemptIndex));
    if (!timing || startedAt === void 0) return false;
    const marked = markRequestTiming(timing, field, monotonicNow() - startedAt);
    if (!marked) return false;
    this.publishTiming(active);
    return true;
  }
  findRequestTiming(entry, turnIndex, attemptIndex) {
    return entry.requestTimings?.find((timing) => timing.turnIndex === turnIndex && timing.attemptIndex === attemptIndex);
  }
  publishTiming(active) {
    this.publish("llm_log_timing", { logId: active.entry.id, entry: cloneEntry(active.entry) });
  }
  end(id, status) {
    const active = this.activeLogs.get(id);
    if (!active) return;
    active.entry.durationMs = Date.now() - active.startedAt;
    active.entry.status = status;
    const entry = cloneEntry(active.entry);
    this.activeLogs.delete(id);
    this.pendingActives.delete(id);
    this.cache.recordCompleted(entry);
    this.retryPendingFinals();
    const generation = this.clearGeneration;
    const persistedActive = this.snapshotActive(active);
    const pending = { entry, generation, active: persistedActive };
    this.pendingFinals.set(id, pending);
    this.enqueue("finalize", async () => {
      await this.persistFinal(pending);
      if (this.pendingFinals.get(id) === pending) this.pendingFinals.delete(id);
    });
    if (lib.config?.dev) {
      console.log(`[LLM] ${entry.decisionPoint} ${entry.status} ${entry.durationMs}ms`, entry);
    }
    this.publish("llm_log_end", entry);
  }
  async persistFinal(pending) {
    const checkpoint = { id: pending.active.id, ownerId: pending.active.ownerId, revision: pending.active.revision, updatedAt: pending.active.updatedAt };
    if (await this.store.finalize(checkpoint, pending.entry)) return true;
    if (!await this.store.putActive(pending.active)) return false;
    return this.store.finalize(checkpoint, pending.entry);
  }
  endFallback(id, reason) {
    const entry = this.getActive(id);
    if (entry) entry.fallbackReason = reason;
    this.end(id, "fallback");
  }
  /** 流式内容仅用于实时 UI，不会产生 IndexedDB 写入。 */
  logStreamChunk(logId, partialArgs) {
    const active = this.activeLogs.get(logId);
    if (active) active.partialArgs = partialArgs;
    this.publish("llm_log_chunk", { logId, partialArgs, ts: Date.now() });
  }
  /** 结构化流式进度（思考文本、输出文本、阶段与用量），同步兼容旧版 llm_log_chunk。 */
  logStreamProgress(logId, progress) {
    const now = Date.now();
    const preview = progress.text || "";
    const payload = { logId, ...progress, ts: now };
    const active = this.activeLogs.get(logId);
    if (active) {
      active.partialArgs = preview;
      active.stream = payload;
    }
    this.publish("llm_log_stream", payload);
    this.publish("llm_log_chunk", { logId, partialArgs: preview, ts: now });
  }
  logTurn(id, turn) {
    const entry = this.getActive(id);
    if (!entry) return;
    (entry.turns ||= []).push(plainLogValue(turn));
    this.checkpoint(id);
  }
  retryPendingFinals() {
    if (this.pendingRetryScheduled || !shouldRetryPendingLogWrites(this.pendingActives.size, this.pendingFinals.size)) return;
    this.pendingRetryScheduled = true;
    this.enqueue(
      "checkpoint_pending",
      () => retryPendingActiveCheckpoints(
        this.pendingActives,
        (id) => this.activeLogs.has(id),
        (active) => this.store.putActive(active)
      )
    );
    this.enqueue("finalize_pending", async () => {
      try {
        for (const [id, pending] of Array.from(this.pendingFinals)) {
          if (pending.generation !== this.clearGeneration) continue;
          await this.persistFinal(pending);
          if (this.pendingFinals.get(id) === pending) this.pendingFinals.delete(id);
        }
      } finally {
        this.pendingRetryScheduled = false;
      }
    });
  }
  async flush() {
    this.retryPendingFinals();
    await this.persistence.drain();
  }
  mergePending(entries) {
    const merged = /* @__PURE__ */ new Map();
    for (const entry of entries) merged.set(entry.id, entry);
    for (const pending of this.pendingFinals.values()) {
      if (pending.generation === this.clearGeneration) merged.set(pending.entry.id, pending.entry);
    }
    return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
  async getLogs() {
    try {
      return this.mergePending(await this.store.listEntries());
    } catch (error) {
      this.announcePersistenceError("read", error);
      return this.mergePending([]);
    }
  }
  async clearLogs() {
    this.clearGeneration++;
    this.cache.clear();
    const abandoned = Array.from(this.pendingFinals.values()).filter((pending) => pending.generation < this.clearGeneration).map((pending) => ({ id: pending.active.id, ownerId: pending.active.ownerId, revision: pending.active.revision, updatedAt: pending.active.updatedAt }));
    for (const [id, pending] of this.pendingFinals) if (pending.generation < this.clearGeneration) this.pendingFinals.delete(id);
    const clearTask = this.enqueueCritical("clear", async () => {
      await this.store.discardActives(abandoned);
      await this.store.clearEntries();
    });
    await clearTask;
  }
  async getGameSessions() {
    try {
      return mergeSessionsWithPending(await this.store.listSessions(), this.pendingFinals.values(), this.clearGeneration);
    } catch (error) {
      this.announcePersistenceError("read", error);
      return mergeSessionsWithPending([], this.pendingFinals.values(), this.clearGeneration);
    }
  }
  async getLogSummariesByGame(gameId) {
    return this.cache.readGameSummaries(
      gameId,
      () => this.store.listSummariesByGame(gameId),
      this.pendingFinals.values(),
      this.clearGeneration,
      (error) => this.announcePersistenceError("read", error)
    );
  }
  async getLogSummariesByGameAndPlayer(gameId, playerName, seatNum) {
    const gameSummaries = await this.getLogSummariesByGame(gameId);
    return gameSummaries.filter((entry) => matchesGameAndPlayerEntry(entry, gameId, playerName, seatNum));
  }
  async getLogDetail(id) {
    const active = this.activeLogs.get(id);
    if (active) return { ...cloneEntry(active.entry), detailLoaded: true };
    const pending = this.pendingFinals.get(id);
    if (pending && pending.generation === this.clearGeneration) return { ...cloneEntry(pending.entry), detailLoaded: true };
    const detail = await this.cache.readDetail(
      id,
      () => this.store.getEntryDetail(id),
      (error) => this.announcePersistenceError("read", error)
    );
    return detail ? cloneEntry(detail) : void 0;
  }
  async getLogsByGame(gameId) {
    return this.getLogSummariesByGame(gameId);
  }
  async getLogsByGameAndPlayer(gameId, playerName, seatNum) {
    return this.getLogSummariesByGameAndPlayer(gameId, playerName, seatNum);
  }
  /** Compatibility entry point retained for callers from the previous logger. */
  async migrateIfNeeded() {
    await this.init();
  }
  async recoverInterrupted() {
    if (!this.lease) return;
    await recoverInterruptedLogs({
      store: this.store,
      lease: this.lease,
      graceMs: RECOVERY_GRACE,
      legacyTimeoutMs: LEGACY_ACTIVE_TIMEOUT,
      cloneEntry,
      onError: (stage, error) => this.announcePersistenceError(stage, error),
      enqueueRecover: (task) => this.enqueue("recover", task)
    });
  }
  installPagehideHandler() {
    if (this.pagehideInstalled || typeof window === "undefined") return;
    this.pagehideInstalled = true;
    window.addEventListener("pagehide", (event) => {
      if (event.persisted) return;
      for (const active of Array.from(this.activeLogs.values())) {
        active.entry.fallbackReason = "page_reload_or_crash";
        this.end(active.entry.id, "interrupted");
      }
      void this.flush();
      void this.lease?.close();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void this.flush();
    });
  }
}
const llmLogger = new LLMLogger();
export {
  LLMLogger,
  llmLogger
};
