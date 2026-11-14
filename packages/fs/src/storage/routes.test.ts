import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import createApp from "../index";
import { databasePath } from "./routes";

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
