import { transaction, request } from "../storage/database.js";
import { stripLogEntrySummary, matchesGameAndPlayerEntry } from "./logger-cache.js";
import { buildGameSessions } from "./logger-sessions.js";
function isSqliteStorage(database) {
  return "llmLogsQuery" in database && typeof database.llmLogsQuery === "function";
}
const LLM_LOG_STORE = "llm_logs";
const LLM_LOG_ACTIVE_STORE = "llm_log_active";
const LLM_LOG_INSTANCE_STORE = "llm_log_instances";
const LEGACY_STORE = "data";
const LEGACY_KEY = "llm_logs";
const MIGRATION_KEY = "llm_logs_external_v1_migrated";
const MAX_LOG_ENTRIES = 500;
const logDatabaseResolvers = /* @__PURE__ */ new WeakMap();
function registerLLMLogDatabase(mainDatabase, resolveLogDatabase) {
  logDatabaseResolvers.set(mainDatabase, resolveLogDatabase);
}
function isLegacyEntry(value) {
  return !!value && typeof value === "object" && typeof value.id === "string" && typeof value.timestamp === "number";
}
function isActiveEntry(value) {
  if (!value || typeof value !== "object") return false;
  const active = value;
  return typeof active.id === "string" && typeof active.ownerId === "string" && typeof active.updatedAt === "number" && isLegacyEntry(active.entry);
}
function isLease(value) {
  if (!value || typeof value !== "object") return false;
  const lease = value;
  return typeof lease.instanceId === "string" && typeof lease.updatedAt === "number" && typeof lease.expiresAt === "number";
}
function migrationSourceMatches(expected, current) {
  return JSON.stringify(expected) === JSON.stringify(current);
}
function shouldMigrateSource(migrated, source) {
  return !migrated || source.legacy.length > 0 || source.formerCompleted.length > 0 || source.formerActive.length > 0 || source.formerLeases.length > 0;
}
function selectLegacyEntries(records) {
  const entries = [];
  let discardedLegacy = 0;
  let malformed = 0;
  for (const record of records) {
    if (!isLegacyEntry(record)) {
      malformed++;
      continue;
    }
    if (typeof record.gameId !== "string") {
      discardedLegacy++;
      continue;
    }
    entries.push(record);
  }
  return { entries: discardedLegacy ? [] : entries.sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_LOG_ENTRIES), discardedLegacy, malformed };
}
function canRecoverActive(expected, current, completedExists) {
  return !completedExists && !!current && current.id === expected.id && current.ownerId === expected.ownerId && activeCheckpointMatches(expected, current);
}
function isRecoveryEntryForActive(active, entry) {
  return active.id === entry.id;
}
function activeCheckpointMatches(expected, current) {
  if (expected.revision !== void 0 && current.revision !== void 0) return expected.revision === current.revision;
  return expected.updatedAt === current.updatedAt;
}
function canPutActive(incoming, current, completedExists) {
  if (completedExists) return false;
  if (!current) return true;
  if (incoming.id !== current.id || incoming.ownerId !== current.ownerId) return false;
  if (incoming.revision !== void 0 && current.revision !== void 0) return incoming.revision > current.revision;
  return incoming.updatedAt > current.updatedAt;
}
function canFinalizeActive(expected, current, completedExists) {
  return !completedExists && !!current && expected.id === current.id && expected.ownerId === current.ownerId && activeCheckpointMatches(expected, current);
}
class LLMLogStore {
  getDatabase;
  clock;
  constructor(options) {
    this.getDatabase = options.getDatabase;
    this.clock = options.clock || Date.now;
  }
  mainDatabase() {
    const mainDatabase = this.getDatabase();
    if (!mainDatabase) throw new Error("Main persistence database is unavailable");
    return mainDatabase;
  }
  async database() {
    const mainDatabase = this.mainDatabase();
    const resolver = logDatabaseResolvers.get(mainDatabase);
    if (!resolver) throw new Error("LLM log persistence database is unavailable");
    return resolver();
  }
  /**
   * Cross-database migration is deliberately two-phase: target puts are
   * idempotent, and the legacy key is deleted only after target commit.
   */
  async migrateLegacy() {
    const mainDatabase = this.mainDatabase();
    if (!mainDatabase.objectStoreNames.contains(LEGACY_STORE)) return;
    const sourceStores = [LEGACY_STORE];
    if (mainDatabase.objectStoreNames.contains(LLM_LOG_STORE)) sourceStores.push(LLM_LOG_STORE);
    if (mainDatabase.objectStoreNames.contains(LLM_LOG_ACTIVE_STORE)) sourceStores.push(LLM_LOG_ACTIVE_STORE);
    if (mainDatabase.objectStoreNames.contains(LLM_LOG_INSTANCE_STORE)) sourceStores.push(LLM_LOG_INSTANCE_STORE);
    const source = await transaction(mainDatabase, sourceStores, "readonly", async (idbTransaction) => {
      const legacyStore = idbTransaction.objectStore(LEGACY_STORE);
      const migrated = !!await request(legacyStore.get(MIGRATION_KEY));
      const legacy = await request(legacyStore.get(LEGACY_KEY));
      const snapshot = {
        legacy: Array.isArray(legacy) ? legacy : [],
        formerCompleted: sourceStores.includes(LLM_LOG_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_STORE).getAll()) : [],
        formerActive: sourceStores.includes(LLM_LOG_ACTIVE_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).getAll()) : [],
        formerLeases: sourceStores.includes(LLM_LOG_INSTANCE_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).getAll()) : []
      };
      return { migrated, snapshot };
    });
    if (!shouldMigrateSource(source.migrated, source.snapshot)) return;
    const database = await this.database();
    const entries = /* @__PURE__ */ new Map();
    for (const entry of source.snapshot.formerCompleted) {
      if (isLegacyEntry(entry) && typeof entry.gameId === "string") entries.set(entry.id, entry);
    }
    for (const entry of selectLegacyEntries(source.snapshot.legacy).entries) entries.set(entry.id, entry);
    const activeEntries = source.snapshot.formerActive.filter(isActiveEntry);
    const leases = source.snapshot.formerLeases.filter(isLease);
    await transaction(database, [LLM_LOG_STORE, LLM_LOG_ACTIVE_STORE, LLM_LOG_INSTANCE_STORE], "readwrite", async (idbTransaction) => {
      const logStore = idbTransaction.objectStore(LLM_LOG_STORE);
      for (const entry of entries.values()) {
        if (!await request(logStore.get(entry.id))) await request(logStore.put(entry));
      }
      const activeStore = idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE);
      for (const active of activeEntries) {
        const completedExists = !!await request(logStore.get(active.id));
        const current = await request(activeStore.get(active.id));
        if (canPutActive(active, current, completedExists)) await request(activeStore.put(active));
      }
      const leaseStore = idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE);
      for (const lease of leases) {
        const current = await request(leaseStore.get(lease.instanceId));
        if (!current || lease.updatedAt > current.updatedAt) await request(leaseStore.put(lease));
      }
      await this.pruneCompleted(logStore);
    });
    await transaction(mainDatabase, sourceStores, "readwrite", async (idbTransaction) => {
      const legacyStore = idbTransaction.objectStore(LEGACY_STORE);
      const currentLegacy = await request(legacyStore.get(LEGACY_KEY));
      const current = {
        legacy: Array.isArray(currentLegacy) ? currentLegacy : [],
        formerCompleted: sourceStores.includes(LLM_LOG_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_STORE).getAll()) : [],
        formerActive: sourceStores.includes(LLM_LOG_ACTIVE_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).getAll()) : [],
        formerLeases: sourceStores.includes(LLM_LOG_INSTANCE_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).getAll()) : []
      };
      if (!migrationSourceMatches(source.snapshot, current)) throw new Error("LLM migration source changed during copy");
      await request(legacyStore.delete(LEGACY_KEY));
      if (sourceStores.includes(LLM_LOG_STORE)) await request(idbTransaction.objectStore(LLM_LOG_STORE).clear());
      if (sourceStores.includes(LLM_LOG_ACTIVE_STORE)) await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).clear());
      if (sourceStores.includes(LLM_LOG_INSTANCE_STORE)) await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).clear());
      await request(legacyStore.put({ migratedAt: this.clock() }, MIGRATION_KEY));
    });
  }
  async putActive(active) {
    return transaction(await this.database(), [LLM_LOG_STORE, LLM_LOG_ACTIVE_STORE], "readwrite", async (idbTransaction) => {
      const completedExists = !!await request(idbTransaction.objectStore(LLM_LOG_STORE).get(active.id));
      const current = await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).get(active.id));
      if (!canPutActive(active, current, completedExists)) return false;
      await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).put(active));
      return true;
    });
  }
  async listActive() {
    return transaction(await this.database(), [LLM_LOG_ACTIVE_STORE], "readonly", async (idbTransaction) => {
      return await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).getAll());
    });
  }
  async finalize(active, entry) {
    if (!isRecoveryEntryForActive(active, entry)) throw new Error("Completed LLM log id does not match its active checkpoint");
    const db = await this.database();
    if (isSqliteStorage(db)) return db.llmLogsFinalize(active, entry, "finalize");
    return transaction(db, [LLM_LOG_STORE, LLM_LOG_ACTIVE_STORE], "readwrite", async (idbTransaction) => {
      const logStore = idbTransaction.objectStore(LLM_LOG_STORE);
      const completedExists = !!await request(logStore.get(entry.id));
      const current = await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).get(active.id));
      if (!canFinalizeActive(active, current, completedExists)) return false;
      await request(logStore.put(entry));
      await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).delete(active.id));
      await this.pruneCompleted(logStore);
      return true;
    });
  }
  async recover(active, interruptedEntry) {
    if (!isRecoveryEntryForActive(active, interruptedEntry)) throw new Error("Interrupted LLM log id does not match its active checkpoint");
    const db = await this.database();
    if (isSqliteStorage(db)) return db.llmLogsFinalize(active, interruptedEntry, "recover");
    return transaction(db, [LLM_LOG_STORE, LLM_LOG_ACTIVE_STORE], "readwrite", async (idbTransaction) => {
      const current = await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).get(active.id));
      const completedExists = !!await request(idbTransaction.objectStore(LLM_LOG_STORE).get(interruptedEntry.id));
      if (!canRecoverActive(active, current, completedExists)) return false;
      const logStore = idbTransaction.objectStore(LLM_LOG_STORE);
      await request(logStore.put(interruptedEntry));
      await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).delete(active.id));
      await this.pruneCompleted(logStore);
      return true;
    });
  }
  /** CAS-deletes only checkpoints explicitly abandoned by the current logger. */
  async discardActives(activeSnapshots) {
    if (!activeSnapshots.length) return 0;
    return transaction(await this.database(), [LLM_LOG_ACTIVE_STORE], "readwrite", async (idbTransaction) => {
      const store = idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE);
      let removed = 0;
      for (const active of activeSnapshots) {
        const current = await request(store.get(active.id));
        if (!canFinalizeActive(active, current, false)) continue;
        await request(store.delete(active.id));
        removed++;
      }
      return removed;
    });
  }
  async pruneCompleted(logStore, keep = MAX_LOG_ENTRIES) {
    if (await logStore.count() <= keep) return 0;
    const entries = (await logStore.getAll()).sort((a, b) => a.timestamp - b.timestamp);
    const expired = entries.slice(0, Math.max(0, entries.length - keep));
    for (const entry of expired) await logStore.delete(entry.id);
    return expired.length;
  }
  async listEntries() {
    const db = await this.database();
    if (isSqliteStorage(db)) return await db.llmLogsQuery({});
    return transaction(db, [LLM_LOG_STORE], "readonly", async (idbTransaction) => {
      const entries = await request(idbTransaction.objectStore(LLM_LOG_STORE).getAll());
      return entries.sort((a, b) => b.timestamp - a.timestamp);
    });
  }
  async listEntriesByGame(gameId) {
    const db = await this.database();
    if (isSqliteStorage(db)) return await db.llmLogsQuery({ gameId });
    return transaction(db, [LLM_LOG_STORE], "readonly", async (idbTransaction) => {
      const entries = await request(idbTransaction.objectStore(LLM_LOG_STORE).index("gameId").getAll(gameId));
      return entries.sort((a, b) => b.timestamp - a.timestamp);
    });
  }
  async listSessions() {
    const db = await this.database();
    if (isSqliteStorage(db)) return db.llmLogsSessions();
    const entries = await this.listEntries();
    return buildGameSessions(entries);
  }
  async listSummariesByGame(gameId) {
    const db = await this.database();
    if (isSqliteStorage(db)) return (await db.llmLogsQuery({ gameId })).map((entry) => ({ ...entry, detailLoaded: false }));
    const entries = await this.listEntriesByGame(gameId);
    return entries.map(stripLogEntrySummary);
  }
  async listSummariesByGameAndPlayer(gameId, playerName, seatNum) {
    const db = await this.database();
    if (isSqliteStorage(db)) {
      return (await db.llmLogsQuery({ gameId, playerName, ...seatNum !== void 0 ? { playerSeatNum: seatNum } : {} })).map((entry) => ({
        ...entry,
        detailLoaded: false
      }));
    }
    const entries = await this.listEntriesByGame(gameId);
    return entries.filter((entry) => matchesGameAndPlayerEntry(entry, gameId, playerName, seatNum)).map(stripLogEntrySummary);
  }
  async getEntryDetail(id) {
    const db = await this.database();
    if (isSqliteStorage(db)) {
      const entry = await db.llmLogsGetDetail(id);
      return entry ? { ...entry, detailLoaded: true } : void 0;
    }
    return transaction(db, [LLM_LOG_STORE], "readonly", async (idbTransaction) => {
      const entry = await request(idbTransaction.objectStore(LLM_LOG_STORE).get(id));
      return entry ? { ...entry, detailLoaded: true } : void 0;
    });
  }
  async clearEntries() {
    const db = await this.database();
    if (isSqliteStorage(db)) {
      await db.llmLogsClear();
      return;
    }
    await transaction(db, [LLM_LOG_STORE], "readwrite", async (idbTransaction) => {
      await request(idbTransaction.objectStore(LLM_LOG_STORE).clear());
    });
  }
  /** Prunes completed logs to `keep` records and returns the number removed. */
  async pruneOldest(keep = MAX_LOG_ENTRIES) {
    const db = await this.database();
    if (isSqliteStorage(db)) return db.llmLogsPrune(Math.max(0, keep));
    return transaction(db, [LLM_LOG_STORE], "readwrite", async (idbTransaction) => this.pruneCompleted(idbTransaction.objectStore(LLM_LOG_STORE), Math.max(0, keep)));
  }
  /** Frees space for a retry after QuotaExceededError without clearing recent diagnostics. */
  async reclaimQuota(count = 50) {
    return transaction(await this.database(), [LLM_LOG_STORE], "readwrite", async (idbTransaction) => {
      const current = await request(idbTransaction.objectStore(LLM_LOG_STORE).count());
      return this.pruneCompleted(idbTransaction.objectStore(LLM_LOG_STORE), Math.max(0, current - Math.max(1, count)));
    });
  }
  async putLease(lease) {
    await transaction(await this.database(), [LLM_LOG_INSTANCE_STORE], "readwrite", async (idbTransaction) => {
      await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).put(lease));
    });
  }
  async getLease(instanceId) {
    return transaction(await this.database(), [LLM_LOG_INSTANCE_STORE], "readonly", async (idbTransaction) => {
      return await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).get(instanceId));
    });
  }
  async deleteLease(instanceId) {
    await transaction(await this.database(), [LLM_LOG_INSTANCE_STORE], "readwrite", async (idbTransaction) => {
      await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).delete(instanceId));
    });
  }
  async isLeaseExpired(instanceId, now = this.clock()) {
    const lease = await this.getLease(instanceId);
    return !lease || lease.expiresAt <= now;
  }
  async clearExpiredLeases(now = this.clock()) {
    return transaction(await this.database(), [LLM_LOG_INSTANCE_STORE], "readwrite", async (operation) => {
      const store = operation.objectStore(LLM_LOG_INSTANCE_STORE);
      const expired = (await store.getAll()).filter((lease) => lease.expiresAt <= now);
      for (const lease of expired) await store.delete(lease.instanceId);
      return expired.length;
    });
  }
}
export {
  LLMLogStore,
  LLM_LOG_ACTIVE_STORE,
  LLM_LOG_INSTANCE_STORE,
  LLM_LOG_STORE,
  activeCheckpointMatches,
  canFinalizeActive,
  canPutActive,
  canRecoverActive,
  isRecoveryEntryForActive,
  migrationSourceMatches,
  registerLLMLogDatabase,
  selectLegacyEntries,
  shouldMigrateSource
};
