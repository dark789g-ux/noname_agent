/** Transactional persistence for completed and in-flight LLM decision logs. */
import { request, transaction, type PersistenceDatabase, type PersistenceStore } from "../storage/database.js";

export const LLM_LOG_STORE = "llm_logs";
export const LLM_LOG_ACTIVE_STORE = "llm_log_active";
export const LLM_LOG_INSTANCE_STORE = "llm_log_instances";
const LEGACY_STORE = "data";
const LEGACY_KEY = "llm_logs";
const MIGRATION_KEY = "llm_logs_external_v1_migrated";
const MAX_LOG_ENTRIES = 500;
const logDatabaseResolvers = new WeakMap<PersistenceDatabase, () => Promise<PersistenceDatabase>>();

export function registerLLMLogDatabase(mainDatabase: PersistenceDatabase, resolveLogDatabase: () => Promise<PersistenceDatabase>): void {
	logDatabaseResolvers.set(mainDatabase, resolveLogDatabase);
}

export interface LLMLogEntryRecord {
	id: string;
	gameId?: string;
	timestamp: number;
	status?: string;
	[key: string]: unknown;
}

export interface ActiveLogRecord<T extends LLMLogEntryRecord = LLMLogEntryRecord> {
	id: string;
	ownerId: string;
	/** Monotonically increasing checkpoint version; updatedAt remains the legacy fallback. */
	revision?: number;
	gameId: string;
	status: "active";
	timestamp: number;
	updatedAt: number;
	deadlineAt: number;
	turns?: unknown[];
	entry: T;
}

export interface LLMLogInstanceLease {
	instanceId: string;
	updatedAt: number;
	expiresAt: number;
}

export type ActiveCheckpointSnapshot = Pick<ActiveLogRecord, "id" | "ownerId" | "revision" | "updatedAt">;

export interface LLMLogStoreOptions {
	getDatabase: () => PersistenceDatabase | undefined;
	clock?: () => number;
}

export interface LegacyMigrationSourceSnapshot {
	legacy: unknown[];
	formerCompleted: unknown[];
	formerActive: unknown[];
	formerLeases: unknown[];
}

function isLegacyEntry(value: unknown): value is LLMLogEntryRecord {
	return !!value && typeof value === "object" && typeof (value as LLMLogEntryRecord).id === "string" && typeof (value as LLMLogEntryRecord).timestamp === "number";
}

function isActiveEntry(value: unknown): value is ActiveLogRecord {
	if (!value || typeof value !== "object") return false;
	const active = value as ActiveLogRecord;
	return typeof active.id === "string" && typeof active.ownerId === "string" && typeof active.updatedAt === "number" && isLegacyEntry(active.entry);
}

function isLease(value: unknown): value is LLMLogInstanceLease {
	if (!value || typeof value !== "object") return false;
	const lease = value as LLMLogInstanceLease;
	return typeof lease.instanceId === "string" && typeof lease.updatedAt === "number" && typeof lease.expiresAt === "number";
}

export function migrationSourceMatches(expected: LegacyMigrationSourceSnapshot, current: LegacyMigrationSourceSnapshot): boolean {
	return JSON.stringify(expected) === JSON.stringify(current);
}

export function shouldMigrateSource(migrated: boolean, source: LegacyMigrationSourceSnapshot): boolean {
	return !migrated || source.legacy.length > 0 || source.formerCompleted.length > 0 || source.formerActive.length > 0 || source.formerLeases.length > 0;
}

/** Keeps compatible legacy entries while separately identifying obsolete pre-gameId entries. */
export function selectLegacyEntries(records: unknown[]): { entries: LLMLogEntryRecord[]; discardedLegacy: number; malformed: number } {
	const entries: LLMLogEntryRecord[] = [];
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
	// The previous logger cleared an entire old-format array; retain that behavior
	// only for structurally valid pre-gameId records, not malformed neighbours.
	return { entries: discardedLegacy ? [] : entries.sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_LOG_ENTRIES), discardedLegacy, malformed };
}

/** A stale recovery must never replace a log completed by another owner. */
export function canRecoverActive(expected: ActiveCheckpointSnapshot, current: ActiveLogRecord | undefined, completedExists: boolean): boolean {
	return !completedExists && !!current && current.id === expected.id && current.ownerId === expected.ownerId && activeCheckpointMatches(expected, current);
}

export function isRecoveryEntryForActive(active: Pick<ActiveLogRecord, "id">, entry: Pick<LLMLogEntryRecord, "id">): boolean {
	return active.id === entry.id;
}

export function activeCheckpointMatches(expected: Pick<ActiveLogRecord, "revision" | "updatedAt">, current: Pick<ActiveLogRecord, "revision" | "updatedAt">): boolean {
	if (expected.revision !== undefined && current.revision !== undefined) return expected.revision === current.revision;
	return expected.updatedAt === current.updatedAt;
}

export function canPutActive(incoming: ActiveLogRecord, current: ActiveLogRecord | undefined, completedExists: boolean): boolean {
	if (completedExists) return false;
	if (!current) return true;
	if (incoming.id !== current.id || incoming.ownerId !== current.ownerId) return false;
	if (incoming.revision !== undefined && current.revision !== undefined) return incoming.revision > current.revision;
	return incoming.updatedAt > current.updatedAt;
}

export function canFinalizeActive(expected: ActiveCheckpointSnapshot, current: ActiveLogRecord | undefined, completedExists: boolean): boolean {
	return !completedExists && !!current && expected.id === current.id && expected.ownerId === current.ownerId && activeCheckpointMatches(expected, current);
}

export class LLMLogStore {
	private readonly getDatabase: () => PersistenceDatabase | undefined;
	private readonly clock: () => number;

	constructor(options: LLMLogStoreOptions) {
		this.getDatabase = options.getDatabase;
		this.clock = options.clock || Date.now;
	}

	private mainDatabase(): PersistenceDatabase {
		const mainDatabase = this.getDatabase();
		if (!mainDatabase) throw new Error("Main persistence database is unavailable");
		return mainDatabase;
	}

	private async database(): Promise<PersistenceDatabase> {
		const mainDatabase = this.mainDatabase();
		const resolver = logDatabaseResolvers.get(mainDatabase);
		if (!resolver) throw new Error("LLM log persistence database is unavailable");
		return resolver();
	}

	/**
	 * Cross-database migration is deliberately two-phase: target puts are
	 * idempotent, and the legacy key is deleted only after target commit.
	 */
	async migrateLegacy(): Promise<void> {
		const mainDatabase = this.mainDatabase();
		if (!mainDatabase.objectStoreNames.contains(LEGACY_STORE)) return;
		const sourceStores = [LEGACY_STORE];
		if (mainDatabase.objectStoreNames.contains(LLM_LOG_STORE)) sourceStores.push(LLM_LOG_STORE);
		if (mainDatabase.objectStoreNames.contains(LLM_LOG_ACTIVE_STORE)) sourceStores.push(LLM_LOG_ACTIVE_STORE);
		if (mainDatabase.objectStoreNames.contains(LLM_LOG_INSTANCE_STORE)) sourceStores.push(LLM_LOG_INSTANCE_STORE);
		const source = await transaction(mainDatabase, sourceStores, "readonly", async idbTransaction => {
			const legacyStore = idbTransaction.objectStore(LEGACY_STORE);
			const migrated = !!(await request(legacyStore.get(MIGRATION_KEY)));
			const legacy = await request(legacyStore.get(LEGACY_KEY));
			const snapshot: LegacyMigrationSourceSnapshot = {
				legacy: Array.isArray(legacy) ? legacy : [],
				formerCompleted: sourceStores.includes(LLM_LOG_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_STORE).getAll()) : [],
				formerActive: sourceStores.includes(LLM_LOG_ACTIVE_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).getAll()) : [],
				formerLeases: sourceStores.includes(LLM_LOG_INSTANCE_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).getAll()) : [],
			};
			return { migrated, snapshot };
		});
		if (!shouldMigrateSource(source.migrated, source.snapshot)) return;
		const database = await this.database();
		const entries = new Map<string, LLMLogEntryRecord>();
		for (const entry of source.snapshot.formerCompleted) {
			if (isLegacyEntry(entry) && typeof entry.gameId === "string") entries.set(entry.id, entry);
		}
		for (const entry of selectLegacyEntries(source.snapshot.legacy).entries) entries.set(entry.id, entry);
		const activeEntries = source.snapshot.formerActive.filter(isActiveEntry);
		const leases = source.snapshot.formerLeases.filter(isLease);
		await transaction(database, [LLM_LOG_STORE, LLM_LOG_ACTIVE_STORE, LLM_LOG_INSTANCE_STORE], "readwrite", async idbTransaction => {
			const logStore = idbTransaction.objectStore(LLM_LOG_STORE);
			for (const entry of entries.values()) {
				if (!(await request(logStore.get(entry.id)))) await request(logStore.put(entry));
			}
			const activeStore = idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE);
			for (const active of activeEntries) {
				const completedExists = !!(await request(logStore.get(active.id)));
				const current = (await request(activeStore.get(active.id))) as ActiveLogRecord | undefined;
				if (canPutActive(active, current, completedExists)) await request(activeStore.put(active));
			}
			const leaseStore = idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE);
			for (const lease of leases) {
				const current = (await request(leaseStore.get(lease.instanceId))) as LLMLogInstanceLease | undefined;
				if (!current || lease.updatedAt > current.updatedAt) await request(leaseStore.put(lease));
			}
			await this.pruneCompleted(logStore);
		});
		await transaction(mainDatabase, sourceStores, "readwrite", async idbTransaction => {
			const legacyStore = idbTransaction.objectStore(LEGACY_STORE);
			const currentLegacy = await request(legacyStore.get(LEGACY_KEY));
			const current: LegacyMigrationSourceSnapshot = {
				legacy: Array.isArray(currentLegacy) ? currentLegacy : [],
				formerCompleted: sourceStores.includes(LLM_LOG_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_STORE).getAll()) : [],
				formerActive: sourceStores.includes(LLM_LOG_ACTIVE_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).getAll()) : [],
				formerLeases: sourceStores.includes(LLM_LOG_INSTANCE_STORE) ? await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).getAll()) : [],
			};
			if (!migrationSourceMatches(source.snapshot, current)) throw new Error("LLM migration source changed during copy");
			await request(legacyStore.delete(LEGACY_KEY));
			if (sourceStores.includes(LLM_LOG_STORE)) await request(idbTransaction.objectStore(LLM_LOG_STORE).clear());
			if (sourceStores.includes(LLM_LOG_ACTIVE_STORE)) await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).clear());
			if (sourceStores.includes(LLM_LOG_INSTANCE_STORE)) await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).clear());
			await request(legacyStore.put({ migratedAt: this.clock() }, MIGRATION_KEY));
		});
	}

	async putActive<T extends LLMLogEntryRecord>(active: ActiveLogRecord<T>): Promise<boolean> {
		return transaction(await this.database(), [LLM_LOG_STORE, LLM_LOG_ACTIVE_STORE], "readwrite", async idbTransaction => {
			const completedExists = !!(await request(idbTransaction.objectStore(LLM_LOG_STORE).get(active.id)));
			const current = (await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).get(active.id))) as ActiveLogRecord | undefined;
			if (!canPutActive(active, current, completedExists)) return false;
			await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).put(active));
			return true;
		});
	}

	async listActive<T extends LLMLogEntryRecord = LLMLogEntryRecord>(): Promise<ActiveLogRecord<T>[]> {
		return transaction(await this.database(), [LLM_LOG_ACTIVE_STORE], "readonly", async idbTransaction => {
			return (await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).getAll())) as ActiveLogRecord<T>[];
		});
	}

	async finalize<T extends LLMLogEntryRecord>(active: ActiveCheckpointSnapshot, entry: T): Promise<boolean> {
		if (!isRecoveryEntryForActive(active, entry)) throw new Error("Completed LLM log id does not match its active checkpoint");
		return transaction(await this.database(), [LLM_LOG_STORE, LLM_LOG_ACTIVE_STORE], "readwrite", async idbTransaction => {
			const logStore = idbTransaction.objectStore(LLM_LOG_STORE);
			const completedExists = !!(await request(logStore.get(entry.id)));
			const current = (await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).get(active.id))) as ActiveLogRecord | undefined;
			if (!canFinalizeActive(active, current, completedExists)) return false;
			await request(logStore.put(entry));
			await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).delete(active.id));
			await this.pruneCompleted(logStore);
			return true;
		});
	}

	async recover<T extends LLMLogEntryRecord>(active: ActiveCheckpointSnapshot, interruptedEntry: T): Promise<boolean> {
		if (!isRecoveryEntryForActive(active, interruptedEntry)) throw new Error("Interrupted LLM log id does not match its active checkpoint");
		return transaction(await this.database(), [LLM_LOG_STORE, LLM_LOG_ACTIVE_STORE], "readwrite", async idbTransaction => {
			const current = (await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).get(active.id))) as ActiveLogRecord | undefined;
			const completedExists = !!(await request(idbTransaction.objectStore(LLM_LOG_STORE).get(interruptedEntry.id)));
			if (!canRecoverActive(active, current, completedExists)) return false;
			const logStore = idbTransaction.objectStore(LLM_LOG_STORE);
			await request(logStore.put(interruptedEntry));
			await request(idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE).delete(active.id));
			await this.pruneCompleted(logStore);
			return true;
		});
	}

	/** CAS-deletes only checkpoints explicitly abandoned by the current logger. */
	async discardActives(activeSnapshots: ActiveCheckpointSnapshot[]): Promise<number> {
		if (!activeSnapshots.length) return 0;
		return transaction(await this.database(), [LLM_LOG_ACTIVE_STORE], "readwrite", async idbTransaction => {
			const store = idbTransaction.objectStore(LLM_LOG_ACTIVE_STORE);
			let removed = 0;
			for (const active of activeSnapshots) {
				const current = (await request(store.get(active.id))) as ActiveLogRecord | undefined;
				if (!canFinalizeActive(active, current, false)) continue;
				await request(store.delete(active.id));
				removed++;
			}
			return removed;
		});
	}

	private async pruneCompleted(logStore: PersistenceStore, keep = MAX_LOG_ENTRIES): Promise<number> {
		if (await logStore.count() <= keep) return 0;
		const entries = (await logStore.getAll()).sort((a, b) => a.timestamp - b.timestamp);
		const expired = entries.slice(0, Math.max(0, entries.length - keep));
		for (const entry of expired) await logStore.delete(entry.id);
		return expired.length;
	}

	async listEntries<T extends LLMLogEntryRecord = LLMLogEntryRecord>(): Promise<T[]> {
		return transaction(await this.database(), [LLM_LOG_STORE], "readonly", async idbTransaction => {
			const entries = (await request(idbTransaction.objectStore(LLM_LOG_STORE).getAll())) as T[];
			return entries.sort((a, b) => b.timestamp - a.timestamp);
		});
	}

	async listEntriesByGame<T extends LLMLogEntryRecord = LLMLogEntryRecord>(gameId: string): Promise<T[]> {
		return transaction(await this.database(), [LLM_LOG_STORE], "readonly", async idbTransaction => {
			const entries = (await request(idbTransaction.objectStore(LLM_LOG_STORE).index("gameId").getAll(gameId))) as T[];
			return entries.sort((a, b) => b.timestamp - a.timestamp);
		});
	}

	async clearEntries(): Promise<void> {
		await transaction(await this.database(), [LLM_LOG_STORE], "readwrite", async idbTransaction => {
			await request(idbTransaction.objectStore(LLM_LOG_STORE).clear());
		});
	}

	/** Prunes completed logs to `keep` records and returns the number removed. */
	async pruneOldest(keep = MAX_LOG_ENTRIES): Promise<number> {
		return transaction(await this.database(), [LLM_LOG_STORE], "readwrite", async idbTransaction => this.pruneCompleted(idbTransaction.objectStore(LLM_LOG_STORE), Math.max(0, keep)));
	}

	/** Frees space for a retry after QuotaExceededError without clearing recent diagnostics. */
	async reclaimQuota(count = 50): Promise<number> {
		return transaction(await this.database(), [LLM_LOG_STORE], "readwrite", async idbTransaction => {
			const current = await request(idbTransaction.objectStore(LLM_LOG_STORE).count());
			return this.pruneCompleted(idbTransaction.objectStore(LLM_LOG_STORE), Math.max(0, current - Math.max(1, count)));
		});
	}

	async putLease(lease: LLMLogInstanceLease): Promise<void> {
		await transaction(await this.database(), [LLM_LOG_INSTANCE_STORE], "readwrite", async idbTransaction => {
			await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).put(lease));
		});
	}

	async getLease(instanceId: string): Promise<LLMLogInstanceLease | undefined> {
		return transaction(await this.database(), [LLM_LOG_INSTANCE_STORE], "readonly", async idbTransaction => {
			return (await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).get(instanceId))) as LLMLogInstanceLease | undefined;
		});
	}

	async deleteLease(instanceId: string): Promise<void> {
		await transaction(await this.database(), [LLM_LOG_INSTANCE_STORE], "readwrite", async idbTransaction => {
			await request(idbTransaction.objectStore(LLM_LOG_INSTANCE_STORE).delete(instanceId));
		});
	}

	async isLeaseExpired(instanceId: string, now = this.clock()): Promise<boolean> {
		const lease = await this.getLease(instanceId);
		return !lease || lease.expiresAt <= now;
	}

	async clearExpiredLeases(now = this.clock()): Promise<number> {
		return transaction(await this.database(), [LLM_LOG_INSTANCE_STORE], "readwrite", async operation => {
			const store = operation.objectStore(LLM_LOG_INSTANCE_STORE);
			const expired = (await store.getAll()).filter(lease => lease.expiresAt <= now);
			for (const lease of expired) await store.delete(lease.instanceId);
			return expired.length;
		});
	}
}
