import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureLLMLogsSchema, LLMLogStorage } from "./llm-logs";
import { migrateLegacyLLMLogs } from "./migrate-llm-logs";

const READ_ONLY_ACTIONS = new Set([
	"status",
	"get",
	"entries",
	"count",
	"snapshot",
	"llm_logs_sessions",
	"llm_logs_query",
	"llm_logs_get_detail",
]);

export type Namespace = "main" | "logs";
export interface RecordData {
	namespace: Namespace;
	store: string;
	key: string;
	value: string;
}
export interface Change {
	store: string;
	key?: string;
	value?: string;
	action: "put" | "delete" | "clear";
}

export class StorageConflict extends Error {}

function validateStore(namespace: string, store: string) {
	if (!["main", "logs"].includes(namespace) || typeof store !== "string" || !/^[\w.-]{1,128}$/.test(store)) throw new Error("无效的数据表");
}

export class SqliteStorage {
	readonly db: Database.Database;
	private readonly llmLogs: LLMLogStorage;

	constructor(filename: string) {
		mkdirSync(path.dirname(filename), { recursive: true });
		this.db = new Database(filename, { timeout: 5000 });
		try {
			this.db.pragma("journal_mode = WAL");
			this.db.pragma("synchronous = FULL");
			this.db.exec(`
			CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
			CREATE TABLE IF NOT EXISTS records (
				namespace TEXT NOT NULL, store TEXT NOT NULL, key TEXT NOT NULL, value BLOB NOT NULL,
				PRIMARY KEY (namespace, store, key)
			);
			CREATE TABLE IF NOT EXISTS revisions (namespace TEXT, store TEXT, revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(namespace, store));
			CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
			CREATE TABLE IF NOT EXISTS staged_records (
				migration TEXT, namespace TEXT, store TEXT, key TEXT, value BLOB NOT NULL,
				PRIMARY KEY(migration, namespace, store, key)
			);
			CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, result TEXT NOT NULL);
		`);
			ensureLLMLogsSchema(this.db);
			this.llmLogs = new LLMLogStorage(this.db, (ns, st) => this.touch(ns, st));
			if (this.initialized()) migrateLegacyLLMLogs(this.db);
		} catch (error) {
			this.db.close();
			throw error;
		}
	}

	initialized() {
		return !!this.db.prepare("SELECT 1 FROM metadata WHERE key = 'initialized'").get();
	}

	private revision(namespace: Namespace, store: string): number {
		return (this.db.prepare("SELECT revision FROM revisions WHERE namespace = ? AND store = ?").get(namespace, store) as { revision: number } | undefined)?.revision || 0;
	}

	private touch(namespace: Namespace, store: string) {
		this.db.prepare("INSERT INTO revisions VALUES (?, ?, 1) ON CONFLICT(namespace, store) DO UPDATE SET revision = revision + 1").run(namespace, store);
	}

	private entries(namespace: Namespace, store: string) {
		validateStore(namespace, store);
		return (this.db.prepare("SELECT key, value FROM records WHERE namespace = ? AND store = ?").all(namespace, store) as { key: string; value: Buffer }[]).map(row => ({ key: row.key, value: row.value.toString("utf8") }));
	}

	private apply(namespace: Namespace, change: Change) {
		validateStore(namespace, change.store);
		if (change.action === "clear") {
			this.db.prepare("DELETE FROM records WHERE namespace = ? AND store = ?").run(namespace, change.store);
		} else {
			if (typeof change.key !== "string") throw new Error("缺少记录键");
			if (change.action === "put") {
				if (typeof change.value !== "string") throw new Error("缺少记录内容");
				this.db.prepare("INSERT INTO records VALUES (?, ?, ?, ?) ON CONFLICT(namespace, store, key) DO UPDATE SET value = excluded.value").run(namespace, change.store, change.key, Buffer.from(change.value));
			} else if (change.action === "delete") {
				this.db.prepare("DELETE FROM records WHERE namespace = ? AND store = ? AND key = ?").run(namespace, change.store, change.key);
			} else throw new Error("无效的存储操作");
		}
		this.touch(namespace, change.store);
	}

	/** Includes the response in the write transaction, so retrying a lost response cannot repeat a commit. */
	execute(id: string, input: any): any {
		if (typeof id !== "string" || !/^[\w-]{16,80}$/.test(id)) throw new Error("无效的请求标识");
		if (READ_ONLY_ACTIONS.has(input?.action)) {
			return this.dispatch(input);
		}
		return this.db
			.transaction(() => {
				const previous = this.db.prepare("SELECT result FROM requests WHERE id = ?").get(id) as { result: string } | undefined;
				if (previous) return JSON.parse(previous.result);
				const result = this.dispatch(input);
				this.db.prepare("INSERT INTO requests VALUES (?, ?)").run(id, JSON.stringify(result));
				return result;
			})
			.immediate();
	}

	private dispatch(input: any): any {
		const { action, namespace, store } = input;
		if (action === "status") return { initialized: this.initialized(), format: 1 };
		if (action === "migration-start") {
			const expired = Date.now() - 24 * 60 * 60 * 1000;
			this.db.prepare("DELETE FROM staged_records WHERE migration IN (SELECT id FROM migrations WHERE created_at < ?)").run(expired);
			this.db.prepare("DELETE FROM migrations WHERE created_at < ?").run(expired);
			const token = randomUUID();
			this.db.prepare("INSERT INTO migrations VALUES (?, ?)").run(token, Date.now());
			return { token };
		}
		if (action === "migration-stage" || action === "migration-finish") {
			if (!this.db.prepare("SELECT 1 FROM migrations WHERE id = ?").get(input.token)) throw new Error("迁移会话不存在，请刷新页面重试");
			if (action === "migration-stage") {
				if (!Array.isArray(input.records)) throw new Error("无效的迁移记录");
				for (const row of input.records as RecordData[]) {
					validateStore(row.namespace, row.store);
					if (typeof row.key !== "string" || typeof row.value !== "string") throw new Error("无效的迁移内容");
					this.db.prepare("INSERT INTO staged_records VALUES (?, ?, ?, ?, ?)").run(input.token, row.namespace, row.store, row.key, Buffer.from(row.value));
				}
				return { staged: input.records.length };
			}
			const imported = !this.initialized();
			if (imported) {
				this.db.prepare("INSERT INTO records SELECT namespace, store, key, value FROM staged_records WHERE migration = ?").run(input.token);
				this.db.prepare("INSERT INTO metadata VALUES ('initialized', ?)").run(JSON.stringify({ at: Date.now(), source: String(input.source || "") }));
				migrateLegacyLLMLogs(this.db);
			}
			this.db.prepare("DELETE FROM staged_records WHERE migration = ?").run(input.token);
			this.db.prepare("DELETE FROM migrations WHERE id = ?").run(input.token);
			return { imported };
		}
		if (!this.initialized()) throw new Error("SQLite 尚未完成首次迁移");
		if (action === "snapshot") {
			if (!Array.isArray(input.stores) || !input.stores.length) throw new Error("缺少事务数据表");
			return Object.fromEntries(
				input.stores.map((name: string) => {
					validateStore(namespace, name);
					return [name, { revision: this.revision(namespace, name), ...(input.includeEntries === false ? {} : { entries: this.entries(namespace, name) }) }];
				})
			);
		}
		if (action === "commit") {
			if (!input.revisions || !Array.isArray(input.changes)) throw new Error("无效的事务");
			for (const [name, revision] of Object.entries(input.revisions)) {
				validateStore(namespace, name);
				if (this.revision(namespace, name) !== revision) throw new StorageConflict("其他页面已修改数据，请重试事务");
			}
			for (const change of input.changes as Change[]) {
				if (!Object.hasOwn(input.revisions, change.store)) throw new Error("事务不能修改范围外的数据表");
				this.apply(namespace, change);
			}
			return { committed: true };
		}
		if (action === "llm_logs_sessions") return this.llmLogs.sessions();
		if (action === "llm_logs_query") return this.llmLogs.query(input);
		if (action === "llm_logs_get_detail") return { entry: this.llmLogs.getDetail(input.logId) };
		if (action === "llm_logs_put") return this.llmLogs.put(input.entry);
		if (action === "llm_logs_finalize") return this.llmLogs.finalize(input);
		if (action === "llm_logs_prune") return this.llmLogs.pruneEntries(input.keep);
		if (action === "llm_logs_clear") return this.llmLogs.clear();
		validateStore(namespace, store);
		if (input.revision !== undefined && input.revision !== this.revision(namespace, store)) throw new StorageConflict("事务读取的数据已变化");
		if (action === "count") return (this.db.prepare("SELECT COUNT(*) AS count FROM records WHERE namespace = ? AND store = ?").get(namespace, store) as { count: number }).count;
		if (action === "get") {
			if (typeof input.key !== "string") throw new Error("缺少记录键");
			const row = this.db.prepare("SELECT value FROM records WHERE namespace = ? AND store = ? AND key = ?").get(namespace, store, input.key) as { value: Buffer } | undefined;
			return { value: row?.value.toString("utf8") ?? null };
		}
		if (action === "entries") return this.entries(namespace, store);
		this.apply(namespace, { ...input, action });
		return { committed: true };
	}

	close() {
		this.db.close();
	}
}
