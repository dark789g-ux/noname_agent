import { compareKeys, decode, decodeKey, encodeKey } from "./codec.js";
import type { PersistenceStore } from "./database.js";

export interface PendingChange {
	action: "put" | "delete" | "clear";
	store: string;
	key?: string;
	value?: any;
}
type Reader = (action: "get" | "entries" | "count", key?: string) => Promise<any>;

/** Read only the requested records; a revision check makes every lazy read part of one snapshot. */
export class SnapshotStore implements PersistenceStore {
	private readonly values = new Map<string, any>();
	private readonly originalPresence = new Map<string, boolean>();
	private loaded = false;
	private cleared = false;
	constructor(
		private readonly name: string,
		private readonly mode: IDBTransactionMode,
		private readonly read: Reader,
		private readonly changes: PendingChange[]
	) {}

	private async load(key: string): Promise<void> {
		if (this.loaded || this.originalPresence.has(key)) return;
		const { value } = await this.read("get", key);
		this.originalPresence.set(key, value !== null);
		if (value !== null) this.values.set(key, decode(value));
	}

	private write(change: Omit<PendingChange, "store">) {
		if (this.mode === "readonly") throw new DOMException("只读事务不可修改数据", "ReadOnlyError");
		this.changes.push({ ...change, store: this.name });
	}

	async get(key: IDBValidKey): Promise<any> {
		const token = encodeKey(key);
		await this.load(token);
		return structuredClone(this.values.get(token));
	}

	async getAll(query?: IDBValidKey): Promise<any[]> {
		if (query !== undefined) {
			const token = encodeKey(query);
			await this.load(token);
			return this.values.has(token) ? [structuredClone(this.values.get(token))] : [];
		}
		if (!this.loaded) {
			const entries = (await this.read("entries")) as { key: string; value: string }[];
			for (const row of entries) {
				if (!this.originalPresence.has(row.key)) this.values.set(row.key, decode(row.value));
			}
			this.loaded = true;
		}
		return [...this.values].sort(([left], [right]) => compareKeys(decodeKey(left), decodeKey(right))).map(([, value]) => structuredClone(value));
	}

	async count(): Promise<number> {
		if (this.loaded || this.cleared) return this.values.size;
		let count = (await this.read("count")) as number;
		for (const [key, existed] of this.originalPresence) count += Number(this.values.has(key)) - Number(existed);
		return count;
	}

	async put(value: any, key?: IDBValidKey): Promise<IDBValidKey> {
		const clone = structuredClone(value);
		const resolvedKey = key ?? clone?.[this.name === "video" ? "time" : this.name === "llm_log_instances" ? "instanceId" : "id"];
		const token = encodeKey(resolvedKey);
		await this.load(token);
		this.write({ action: "put", key: token, value: clone });
		this.values.set(token, clone);
		return resolvedKey;
	}

	async delete(key: IDBValidKey): Promise<void> {
		const token = encodeKey(key);
		await this.load(token);
		this.write({ action: "delete", key: token });
		this.values.delete(token);
	}

	async clear(): Promise<void> {
		this.write({ action: "clear" });
		this.cleared = true;
		this.loaded = true;
		this.values.clear();
	}

	index(name: string) {
		return { getAll: async (query?: IDBValidKey) => (await this.getAll()).filter(value => value[name] !== undefined && (query === undefined || encodeKey(value[name]) === encodeKey(query))) };
	}
}
