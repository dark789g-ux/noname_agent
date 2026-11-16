import { compareKeys, decode, decodeKey, encode, encodeKey } from "./codec.js";
import { StorageConflict, StorageTransport, showStorageFailure } from "./transport.js";
import { SnapshotStore, type PendingChange } from "./transactionStore.js";

export type PersistenceDatabase = IDBDatabase | SqliteDatabase;
type Entry = { key: string; value: string };
type Change = { action: "put" | "delete" | "clear"; store: string; key?: string; value?: string };
export interface PersistenceStore {
	get(key: IDBValidKey): Promise<any>;
	getAll(query?: IDBValidKey): Promise<any[]>;
	put(value: any, key?: IDBValidKey): Promise<any>;
	delete(key: IDBValidKey): Promise<void>;
	clear(): Promise<void>;
	count(): Promise<number>;
	index(name: string): { getAll(query?: IDBValidKey): Promise<any[]> };
}
export interface PersistenceTransaction {
	objectStore(name: string): PersistenceStore;
}

const mainStores = ["config", "data", "video", "image", "audio", "llm_logs", "llm_log_active", "llm_log_instances"];
const logStores = ["llm_logs", "llm_log_active", "llm_log_instances"];

export function request<T>(operation: IDBRequest<T> | Promise<T>): Promise<T> {
	if (operation instanceof Promise) return operation;
	return new Promise((resolve, reject) => {
		operation.onsuccess = () => resolve(operation.result);
		operation.onerror = () => reject(operation.error || new Error("数据库请求失败"));
	});
}

function recordKey(store: string, value: any, key?: IDBValidKey): IDBValidKey {
	return key ?? value?.[store === "video" ? "time" : store === "llm_log_instances" ? "instanceId" : "id"];
}

export class SqliteDatabase {
	private queue: Promise<void> = Promise.resolve();
	readonly backend = "sqlite";
	readonly name: string;
	readonly objectStoreNames: string[] & { contains(name: string): boolean };
	constructor(
		readonly transport: StorageTransport,
		readonly namespace: "main" | "logs"
	) {
		this.name = namespace === "main" ? "noname.sqlite" : "noname.sqlite/logs";
		const names = [...(namespace === "main" ? mainStores : logStores)];
		this.objectStoreNames = Object.assign(names, { contains: (name: string) => names.includes(name) });
	}

	async get(store: string, key: IDBValidKey): Promise<any> {
		await this.queue;
		const result = await this.transport.request<{ value: string | null }>({ action: "get", namespace: this.namespace, store, key: encodeKey(key) });
		return result.value === null ? undefined : decode(result.value);
	}

	async entries(store: string): Promise<{ key: IDBValidKey; value: any }[]> {
		await this.queue;
		const rows = await this.transport.request<Entry[]>({ action: "entries", namespace: this.namespace, store });
		return rows.map(row => ({ key: decodeKey(row.key), value: decode(row.value) })).sort((a, b) => compareKeys(a.key, b.key));
	}

	async put(store: string, value: any, key?: IDBValidKey): Promise<IDBValidKey> {
		const clone = structuredClone(value);
		const resolvedKey = recordKey(store, clone, key);
		const encodedKey = encodeKey(resolvedKey);
		return this.enqueue(async () => {
			await this.transport.request({ action: "put", namespace: this.namespace, store, key: encodedKey, value: await encode(clone) });
			return resolvedKey;
		});
	}

	async delete(store: string, key?: IDBValidKey): Promise<void> {
		await this.enqueue(() => this.transport.request({ action: key === undefined ? "clear" : "delete", namespace: this.namespace, store, ...(key === undefined ? {} : { key: encodeKey(key) }) }));
	}

	private enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.queue.then(operation);
		this.queue = result.then(
			() => {},
			() => {}
		);
		return result;
	}

	run<T>(stores: string[], mode: IDBTransactionMode, operation: (transaction: PersistenceTransaction) => Promise<T>): Promise<T> {
		return this.enqueue(() => this.runTransaction(stores, mode, operation));
	}

	/** Optimistic transactions rerun their isolated callback when another page changes a read dependency. */
	private async runTransaction<T>(stores: string[], mode: IDBTransactionMode, operation: (transaction: PersistenceTransaction) => Promise<T>): Promise<T> {
		for (let attempt = 0; ; attempt++) {
			try {
				const snapshot = await this.transport.request<Record<string, { revision: number }>>({ action: "snapshot", namespace: this.namespace, stores, includeEntries: false });
				const pending: PendingChange[] = [];
				const opened = new Map<string, SnapshotStore>();
				const objectStore = (store: string): PersistenceStore => {
					if (!stores.includes(store)) throw new Error(`数据表不在事务范围内：${store}`);
					if (!opened.has(store)) opened.set(store, new SnapshotStore(store, mode, (action, key) => this.transport.request({ action, namespace: this.namespace, store, key, revision: snapshot[store].revision }), pending));
					return opened.get(store)!;
				};
				const result = await operation({ objectStore });
				if (mode === "readonly" || !pending.length) return result;
				const changes: Change[] = [];
				for (const change of pending) changes.push({ ...change, ...(change.action === "put" ? { value: await encode(change.value) } : {}) });
				await this.transport.request({ action: "commit", namespace: this.namespace, revisions: Object.fromEntries(stores.map(name => [name, snapshot[name].revision])), changes });
				return result;
			} catch (error) {
				if (!(error instanceof StorageConflict)) throw error;
				if (attempt && attempt % 8 === 0) {
					if (this.namespace === "logs") throw error;
					await showStorageFailure(error);
				}
			}
		}
	}
}

export function transaction<T>(database: PersistenceDatabase, stores: string[], mode: IDBTransactionMode, operation: (transaction: PersistenceTransaction) => Promise<T>): Promise<T> {
	if (database instanceof SqliteDatabase) return database.run(stores, mode, operation);
	return new Promise((resolve, reject) => {
		const native = database.transaction(stores, mode);
		let result: T;
		let failure: unknown;
		native.oncomplete = () => resolve(result);
		native.onerror = native.onabort = () => reject(failure || native.error || new Error("数据库事务失败"));
		const objectStore = (name: string): PersistenceStore => {
			const store = native.objectStore(name);
			return {
				get: key => request(store.get(key)),
				getAll: query => request(store.getAll(query)),
				put: (value, key) => request(store.put(value, key)),
				delete: key => request(store.delete(key)),
				clear: () => request(store.clear()),
				count: () => request(store.count()),
				index: field => ({ getAll: query => request(store.index(field).getAll(query)) }),
			};
		};
		operation({ objectStore })
			.then(value => {
				result = value;
			})
			.catch(error => {
				failure = error;
				try {
					native.abort();
				} catch {
					reject(error);
				}
			});
	});
}
