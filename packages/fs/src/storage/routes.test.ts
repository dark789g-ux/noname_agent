import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import createApp from "../index";
import { databasePath } from "./routes";
import { SqliteStorage } from "./database";
import { migrateLegacyLLMLogs } from "./migrate-llm-logs";
import { LLM_LOGS_MIGRATION_KEY } from "./llm-logs";

test("development and built assets resolve to the same project database", () => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-path-"));
	try {
		writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []");
		const expected = path.join(root, "data", "noname.sqlite");
		assert.equal(databasePath(path.join(root, "apps", "core")), expected);
		assert.equal(databasePath(path.join(root, "dist")), expected);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("HTTP storage, allowed local origins and database file isolation", async t => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-http-"));
	const directory = path.join(root, "data");
	mkdirSync(directory);
	writeFileSync(path.join(root, "index.html"), "game");
	const app = createApp({ dirname: root, database: path.join(directory, "noname.sqlite"), listen: false });
	t.after(async () => {
		await app.close();
		rmSync(root, { recursive: true, force: true });
	});
	const rpc = (action: string, extra = {}) => app.inject({ method: "POST", url: "/_storage/rpc", headers: { origin: "http://127.0.0.1:8080" }, payload: { id: randomUUID(), action, ...extra } });
	assert.equal((await rpc("status")).json().result.initialized, false);
	const token = (await rpc("migration-start")).json().result.token;
	assert.equal((await rpc("migration-finish", { token })).json().result.imported, true);
	assert.equal((await rpc("put", { namespace: "main", store: "config", key: "theme", value: "saved" })).statusCode, 200);
	assert.equal((await rpc("get", { namespace: "main", store: "config", key: "theme" })).json().result.value, "saved");
	assert.equal((await app.inject({ method: "POST", url: "/_storage/rpc", headers: { origin: "https://example.com" }, payload: { id: randomUUID(), action: "status" } })).statusCode, 403);
	assert.equal((await app.inject("/data/noname.sqlite")).statusCode, 403);
	assert.equal((await app.inject("/data/noname.sqlite-wal")).statusCode, 403);
	assert.equal((await app.inject("/readFile?fileName=data/noname.sqlite")).json().success, false);
	assert.equal((await app.inject("/readFileAsText?fileName=data/noname.sqlite")).json().success, false);
	assert.equal((await app.inject("/readFile?fileName=../noname-http-sibling/secret")).json().success, false);
	assert.equal((await app.inject({ method: "POST", url: "/writeFile", payload: { path: "data/noname.sqlite", data: [0] } })).json().success, false);
	assert.equal((await app.inject("/removeDir?dir=data")).json().success, false);
	assert.equal((await app.inject("/index.html")).body, "game");
	symlinkSync(directory, path.join(root, "public-storage"), process.platform === "win32" ? "junction" : "dir");
	assert.equal((await app.inject("/public-storage/noname.sqlite")).statusCode, 403);
	assert.equal((await app.inject("/readFile?fileName=public-storage/noname.sqlite")).json().success, false);
});

test("dedicated llm_logs RPCs split summary/detail, aggregate sessions, and prune old rows", async t => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-llmlogs-"));
	const directory = path.join(root, "data");
	mkdirSync(directory);
	const app = createApp({ dirname: root, database: path.join(directory, "noname.sqlite"), listen: false });
	t.after(async () => {
		await app.close();
		rmSync(root, { recursive: true, force: true });
	});
	const rpc = (action: string, extra = {}) =>
		app.inject({ method: "POST", url: "/_storage/rpc", headers: { origin: "http://127.0.0.1:8080" }, payload: { id: randomUUID(), action, ...extra } });
	const token = (await rpc("migration-start")).json().result.token;
	await rpc("migration-finish", { token });

	const entry1 = {
		id: "log_1",
		gameId: "game_a",
		playerName: "caocao",
		playerSeatNum: 1,
		timestamp: 1000,
		status: "success",
		request: { messages: [{ role: "user", content: "big prompt" }], tools: [{ name: "play" }] },
		turns: [{ index: 0, request: { round: 0 }, text: "ok" }],
	};
	const entry2 = {
		id: "log_2",
		gameId: "game_a",
		playerName: "liubei",
		timestamp: 2000,
		status: "error",
		request: { messages: [{ role: "user", content: "err prompt" }] },
	};
	assert.equal((await rpc("llm_logs_put", { entry: entry1 })).json().result.committed, true);
	assert.equal((await rpc("llm_logs_put", { entry: entry2 })).json().result.committed, true);

	const summaries = (await rpc("llm_logs_query", { gameId: "game_a", playerSeatNum: 1, playerName: "caocao" })).json().result;
	assert.equal(summaries.length, 1);
	assert.equal(summaries[0].id, "log_1");
	assert.equal("request" in summaries[0], false);
	assert.equal("request" in summaries[0].turns[0], false);

	const fallbackSeatQuery = (await rpc("llm_logs_query", { gameId: "game_a", playerSeatNum: 2, playerName: "liubei" })).json().result;
	assert.equal(fallbackSeatQuery.length, 1);
	assert.equal(fallbackSeatQuery[0].id, "log_2");

	const detail = (await rpc("llm_logs_get_detail", { logId: "log_1" })).json().result.entry;
	assert.deepEqual(detail.request, entry1.request);
	assert.deepEqual(detail.turns[0].request, entry1.turns[0].request);

	const sessions = (await rpc("llm_logs_sessions")).json().result;
	assert.equal(sessions.length, 1);
	assert.equal(sessions[0].gameId, "game_a");
	assert.equal(sessions[0].logCount, 2);
	assert.equal(sessions[0].successCount, 1);
	assert.equal(sessions[0].lastPlayerName, "liubei");

	assert.equal((await rpc("llm_logs_clear")).json().result.committed, true);
	assert.equal((await rpc("llm_logs_query", { gameId: "game_a" })).json().result.length, 0);
});

test("migrateLegacyLLMLogs decodes codec graph records into llm_logs and is idempotent", t => {
	const root = mkdtempSync(path.join(tmpdir(), "noname-migrate-"));
	const dbPath = path.join(root, "noname.sqlite");
	const storage = new SqliteStorage(dbPath);
	t.after(() => {
		storage.close();
		rmSync(root, { recursive: true, force: true });
	});
	storage.db.prepare("INSERT INTO metadata (key, value) VALUES ('initialized', '{\"at\":1}')").run();
	const codecPayload = JSON.stringify({
		format: 1,
		root: ["ref", 0],
		nodes: [
			{
				type: "object",
				value: [
					["id", "legacy_1"],
					["gameId", "game_legacy"],
					["playerName", "sunquan"],
					["playerSeatNum", 3],
					["timestamp", 12345],
					["status", "success"],
					["request", ["ref", 1]],
				],
			},
			{ type: "object", value: [["model", "deepseek-chat"]] },
		],
	});
	storage.db.prepare("INSERT INTO records (namespace, store, key, value) VALUES ('logs', 'llm_logs', 'legacy_1', ?)").run(Buffer.from(codecPayload));

	const first = migrateLegacyLLMLogs(storage.db, { vacuum: true });
	assert.equal(first.migrated, 1);
	assert.equal(first.skipped, false);
	const second = migrateLegacyLLMLogs(storage.db);
	assert.equal(second.migrated, 0);
	assert.equal(second.skipped, true);
	const legacyCount = (storage.db.prepare("SELECT COUNT(*) AS count FROM records WHERE namespace = 'logs' AND store = 'llm_logs'").get() as { count: number }).count;
	assert.equal(legacyCount, 0);
	const meta = storage.db.prepare("SELECT value FROM metadata WHERE key = ?").get(LLM_LOGS_MIGRATION_KEY) as { value: string } | undefined;
	assert.ok(meta);
});
