import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { SqliteStorage, StorageConflict as ServerConflict } from "../../../../packages/fs/src/storage/database.js";
import { SqliteDatabase, transaction } from "./database.js";
import { StorageTransport } from "./transport.js";
import { encode, encodeKey } from "./codec.js";
import { migrateIndexedDB } from "./migration.js";
import { openMainDatabase, openLLMLogDatabase } from "../init/database-schema.js";
import { LLMLogStore, registerLLMLogDatabase } from "../llm/logger-store.js";
import { persistVideo } from "./videos.js";
import { sqliteGameOperation } from "./gameStorage.js";

function fixture(t: any) {
	const directory = mkdtempSync(path.join(tmpdir(), "noname-sqlite-"));
	let storage = new SqliteStorage(path.join(directory, "noname.sqlite"));
	t.after(() => {
		storage.close();
		rmSync(directory, { recursive: true, force: true });
	});
	const fetcher: typeof fetch = async (_url, options) => {
		const input = JSON.parse(String(options?.body));
		try {
			return Response.json({ result: storage.execute(input.id, input) });
		} catch (error) {
			return Response.json({ error: String(error) }, { status: error instanceof ServerConflict ? 409 : 503 });
		}
	};
	const transport = new StorageTransport(fetcher, async error => {
		throw error;
	});
	return {
		transport,
		storage,
		directory,
		main: new SqliteDatabase(transport, "main"),
		logs: new SqliteDatabase(transport, "logs"),
		reopen() {
			storage.close();
			storage = new SqliteStorage(path.join(directory, "noname.sqlite"));
		},
	};
}

async function nativePut(database: IDBDatabase, store: string, value: unknown, key?: IDBValidKey) {
	await transaction(database, [store], "readwrite", async operation => {
		await operation.objectStore(store).put(value, key);
	});
}

test("migrates every store and both databases, preserves assets and numeric keys, retains old IndexedDB", async t => {
	const context = fixture(t);
	const factory = new IDBFactory();
	const main = await openMainDatabase(factory, "noname_0.9_data");
	const logs = await openLLMLogDatabase(factory, "noname_0.9_data_llm_logs");
	await nativePut(main, "config", "woodden", "theme");
	await nativePut(main, "data", { wins: 7 }, "identity");
	await nativePut(main, "video", { time: 123, video: [{ type: "draw" }] });
	await nativePut(main, "image", new Blob(["image"], { type: "image/png" }), "custom_bg");
	await nativePut(main, "audio", new Blob(["audio"], { type: "audio/ogg" }), "custom_music");
	await nativePut(logs, "llm_logs", { id: "log1", gameId: "game1", timestamp: 1 });
	await nativePut(logs, "llm_log_active", { id: "active1", ownerId: "old", updatedAt: 1 });
	await nativePut(logs, "llm_log_instances", { instanceId: "old", expiresAt: 99 });
	await migrateIndexedDB(context.transport, factory, "noname_0.9_", "http://localhost:8080");
	assert.equal(await context.main.get("config", "theme"), "woodden");
	assert.deepEqual(await context.main.get("data", "identity"), { wins: 7 });
	assert.equal((await context.main.get("video", 123)).time, 123);
	assert.equal(await context.main.get("video", "123"), undefined);
	assert.equal(await (await context.main.get("image", "custom_bg")).text(), "image");
	assert.equal(await (await context.main.get("audio", "custom_music")).text(), "audio");
	assert.equal((await context.logs.get("llm_logs", "log1")).id, "log1");
	assert.equal((await context.logs.get("llm_log_active", "active1")).ownerId, "old");
	assert.equal((await context.logs.get("llm_log_instances", "old")).expiresAt, 99);
	assert.equal(await transaction(main, ["config"], "readonly", operation => operation.objectStore("config").get("theme")), "woodden");
	main.close();
	logs.close();
	context.reopen();
	assert.equal(await context.main.get("config", "theme"), "woodden");
});

test("first completed migration wins, later browsers do not overwrite SQLite", async t => {
	const { transport, main } = fixture(t);
	await migrateIndexedDB(transport, undefined, "noname_0.9_", "first");
	await main.put("config", "music", "theme");
	const factory = new IDBFactory();
	const legacy = await openMainDatabase(factory, "noname_0.9_data");
	await nativePut(legacy, "config", "old", "theme");
	await migrateIndexedDB(transport, factory, "noname_0.9_", "second");
	assert.equal(await main.get("config", "theme"), "music");
	legacy.close();
});

test("simultaneous first migrations commit only the first finished source", async t => {
	const { transport, main } = fixture(t);
	const first = await transport.request({ action: "migration-start" });
	const second = await transport.request({ action: "migration-start" });
	for (const [session, theme] of [[first, "first-source"], [second, "second-source"]] as const) {
		await transport.request({ action: "migration-stage", token: session.token, records: [{ namespace: "main", store: "config", key: encodeKey("theme"), value: await encode(theme) }] });
	}
	assert.equal((await transport.request({ action: "migration-finish", token: second.token })).imported, true);
	assert.equal((await transport.request({ action: "migration-finish", token: first.token })).imported, false);
	assert.equal(await main.get("config", "theme"), "second-source");
});

test("interrupted staging stays invisible and retry can finish without a partial migration", async t => {
	const { transport, main, storage } = fixture(t);
	const { token } = await transport.request({ action: "migration-start" });
	await transport.request({ action: "migration-stage", token, records: [{ namespace: "main", store: "config", key: encodeKey("theme"), value: await encode("incomplete") }] });
	assert.equal(storage.initialized(), false);
	await assert.rejects(main.get("config", "theme"), /尚未完成/);
	await migrateIndexedDB(transport, undefined, "noname_0.9_", "retry");
	assert.equal(storage.initialized(), true);
	assert.equal(await main.get("config", "theme"), undefined);
});

test("concurrent read-modify-write transactions retry without losing either update", async t => {
	const { transport, main } = fixture(t);
	await migrateIndexedDB(transport, undefined, "noname_0.9_", "first");
	await main.put("data", 0, "count");
	await Promise.all(
		Array.from({ length: 4 }, () =>
			transaction(new SqliteDatabase(transport, "main"), ["data"], "readwrite", async operation => {
				const store = operation.objectStore("data");
				await store.put((await store.get("count")) + 1, "count");
			})
		)
	);
	assert.equal(await main.get("data", "count"), 4);
	await assert.rejects(
		transaction(main, ["data"], "readwrite", async operation => {
			await operation.objectStore("data").put(999, "count");
			throw new Error("abort");
		}),
		/abort/
	);
	assert.equal(await main.get("data", "count"), 4);
});

test("lost write response retries the same request without duplicating a commit", async t => {
	const { storage, transport, main } = fixture(t);
	await migrateIndexedDB(transport, undefined, "noname_0.9_", "first");
	let attempts = 0;
	let retries = 0;
	const recovering = new StorageTransport(
		async (_url, options) => {
			const input = JSON.parse(String(options?.body));
			const result = storage.execute(input.id, input);
			if (!attempts++) throw new Error("lost response");
			return Response.json({ result });
		},
		async () => {
			retries++;
		}
	);
	await new SqliteDatabase(recovering, "main").put("config", "saved", "theme");
	assert.equal(retries, 1);
	assert.equal(await main.get("config", "theme"), "saved");
	const snapshot = await transport.request({ action: "snapshot", namespace: "main", stores: ["config"] });
	assert.equal(snapshot.config.revision, 1);
});

test("LLM checkpoint CAS, finalization, queries, pruning and leases work through SQLite", async t => {
	const { transport, main, logs } = fixture(t);
	await migrateIndexedDB(transport, undefined, "noname_0.9_", "first");
	registerLLMLogDatabase(main, async () => logs);
	const store = new LLMLogStore({ getDatabase: () => main, clock: () => 100 });
	await store.migrateLegacy();
	const entry = { id: "log1", gameId: "game1", timestamp: 1 };
	const active = { id: "log1", gameId: "game1", timestamp: 1, status: "active" as const, ownerId: "tab1", revision: 1, updatedAt: 1, deadlineAt: 2, entry };
	assert.equal(await store.putActive(active), true);
	assert.equal(await store.putActive({ ...active, ownerId: "tab2", revision: 2 }), false);
	assert.equal(await store.finalize(active, entry), true);
	assert.equal(await store.finalize(active, entry), false);
	assert.deepEqual(await store.listActive(), []);
	assert.deepEqual(await store.listEntriesByGame("game1"), [entry]);
	await store.putLease({ instanceId: "old", updatedAt: 1, expiresAt: 99 });
	await store.putLease({ instanceId: "alive", updatedAt: 100, expiresAt: 200 });
	assert.equal(await store.clearExpiredLeases(), 1);
	assert.equal(await store.getLease("old"), undefined);
	assert.equal((await store.getLease("alive"))?.expiresAt, 200);
	assert.equal(await store.pruneOldest(0), 1);
	assert.deepEqual(await store.listEntries(), []);
});

test("recording import/pruning and starring persist atomically", async t => {
	const { transport, main } = fixture(t);
	await migrateIndexedDB(transport, undefined, "noname_0.9_", "first");
	await persistVideo(main, { time: 1 });
	await persistVideo(main, { time: 2 }, [1]);
	assert.equal(await main.get("video", 1), undefined);
	assert.equal((await main.get("video", 2)).time, 2);
	await persistVideo(main, { time: 2, starred: true });
	assert.equal((await main.get("video", 2)).starred, true);
});

test("game database callbacks fire after commit and keep reload barriers until writes complete", async t => {
	const { transport, main } = fixture(t);
	await migrateIndexedDB(transport, undefined, "noname_0.9_", "first");
	const lib = { status: { reload: 0 } };
	const status: { dburgent?: boolean } = {};
	const game = {
		reload2() {
			lib.status.reload--;
		},
	};
	let called = false;
	const saving = sqliteGameOperation(
		main,
		"put",
		"config",
		"theme",
		"music",
		() => {
			called = true;
			assert.equal(status.dburgent, true);
		},
		undefined,
		{ lib, status, game }
	);
	assert.equal(lib.status.reload, 1);
	assert.equal(called, false);
	await saving;
	assert.equal(called, true);
	assert.equal(lib.status.reload, 0);
	assert.equal(status.dburgent, undefined);
	assert.equal(await main.get("config", "theme"), "music");
	const first = main.put("config", { nested: new Array(100).fill({ data: "first" }) }, "theme");
	const second = main.put("config", "last", "theme");
	await Promise.all([first, second]);
	assert.equal(await main.get("config", "theme"), "last");
});

test("native IndexedDB LLM transactions retain finalization and indexed queries", async t => {
	const factory = new IDBFactory();
	const main = await openMainDatabase(factory, "native-main");
	const logs = await openLLMLogDatabase(factory, "native-logs");
	t.after(() => { main.close(); logs.close(); });
	registerLLMLogDatabase(main, async () => logs);
	const store = new LLMLogStore({ getDatabase: () => main });
	await store.migrateLegacy();
	const entry = { id: "native-log", gameId: "native-game", timestamp: 1 };
	const active = { ...entry, status: "active" as const, ownerId: "native-tab", revision: 1, updatedAt: 1, deadlineAt: 2, entry };
	assert.equal(await store.putActive(active), true);
	assert.equal(await store.finalize(active, entry), true);
	assert.deepEqual(await store.listEntriesByGame("native-game"), [entry]);
	assert.equal(await store.pruneOldest(0), 1);
	assert.deepEqual(await store.listEntries(), []);
});
