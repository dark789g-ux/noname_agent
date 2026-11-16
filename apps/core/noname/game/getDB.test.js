import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { SqliteDatabase } from "../storage/database.js";
import { gameTestSource } from "./testSource.js";

const source = gameTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
assert.ok(declaration);
const initSource = ts.createSourceFile("library-init.js", readFileSync(new URL("../library/init/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const initDeclaration = initSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "LibInit");
assert.ok(initDeclaration);

function loadMethod(name, lib, status, game) {
	const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === name);
	assert.ok(method);
	const parameters = method.parameters.map(node => node.getText(source)).join(",");
	return new Function("lib", "_status", "game", "SqliteDatabase", `return function(${parameters}) ${method.body.getText(source)}`)(lib, status, game, SqliteDatabase);
}

function loadInitMethod(name, lib, game, get, status, document) {
	const method = initDeclaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(initSource) === name);
	assert.ok(method);
	const parameters = method.parameters.map(node => node.getText(initSource)).join(",");
	return new Function("lib", "game", "get", "_status", "document", `return function(${parameters}) ${method.body.getText(initSource)}`)(lib, game, get, status, document);
}

function createDirectDatabase() {
	let request;
	let getCalls = 0;
	let cursorCalls = 0;
	return {
		database: {
			transaction() {
				return {
					objectStore() {
						return {
							get() {
								getCalls++;
								return (request = {});
							},
							openCursor() {
								cursorCalls++;
								return (request = {});
							},
						};
					},
				};
			},
		},
		get request() {
			return request;
		},
		get getCalls() {
			return getCalls;
		},
		get cursorCalls() {
			return cursorCalls;
		},
	};
}

function createHarness(database, reload = 0) {
	const lib = { db: database, status: { reload }, ondb: [], ondb2: [] };
	const status = {};
	const game = {
		reloads: 0,
		reload2() {
			this.reloads++;
			lib.status.reload--;
		},
	};
	game.getDB = loadMethod("getDB", lib, status, game);
	return { game, lib, status };
}

test("getDB 在无数据库时同步回调 null 并兑现 null", async () => {
	const { game } = createHarness(null);
	const order = [];
	let errorCalled = false;
	const result = game.getDB(
		"image",
		"cover",
		value => {
			order.push(value);
		},
		() => {
			errorCalled = true;
		}
	);
	order.push("after call");
	assert.deepEqual(order, [null, "after call"]);
	assert.equal(await result, null);
	assert.equal(errorCalled, false);
});

test("getDB 队列分支保留成功值、错误兑现和拒绝协议", async () => {
	const { game, lib } = createHarness({}, 1);
	const order = [];
	const success = game.getDB("image", "cover", value => order.push(value));
	const [, argumentsList] = lib.ondb[0];
	argumentsList[2]("stored");
	assert.equal(await success, "stored");
	assert.deepEqual(order, ["stored"]);

	const event = new Error("queued failure");
	const handled = game.getDB(
		"image",
		"cover",
		() => {},
		received => {
			assert.equal(received, event);
			throw new Error("callback failure");
		}
	);
	const error = console.error;
	console.error = () => {};
	try {
		lib.ondb[1][1][3](event);
	} finally {
		console.error = error;
	}
	assert.equal(await handled, undefined);

	const rejected = game.getDB("image", "cover");
	lib.ondb[2][1][3](event);
	await assert.rejects(rejected, value => value === event);
});

test("getDB 直接读取在回调期间标记 dburgent，并在错误后重载", async () => {
	const direct = createDirectDatabase();
	const { game, status } = createHarness(direct.database);
	let callbackUrgent = false;
	const success = game.getDB("image", "cover", value => {
		callbackUrgent = status.dburgent === true && value === "stored";
	});
	direct.request.result = "stored";
	direct.request.onsuccess();
	assert.equal(await success, "stored");
	assert.equal(callbackUrgent, true);
	assert.equal("dburgent" in status, false);
	assert.equal(game.reloads, 1);

	const event = new Error("direct failure");
	let errorUrgent = true;
	const handled = game.getDB("image", "cover", undefined, received => {
		errorUrgent = "dburgent" in status;
		assert.equal(received, event);
	});
	direct.request.onerror(event);
	assert.equal(await handled, undefined);
	assert.equal(errorUrgent, false);
	assert.equal(game.reloads, 2);

	const rejected = game.getDB("image", "cover");
	direct.request.onerror(event);
	await assert.rejects(rejected, value => value === event);
	assert.equal(game.reloads, 3);
});

test("getDB 空查询使用 cursor，结束时只回调一次", async () => {
	const direct = createDirectDatabase();
	const { game, status: cursorStatus } = createHarness(direct.database);
	let callbacks = 0;
	const result = game.getDB("data", "", value => {
		callbacks++;
		assert.equal(cursorStatus.dburgent, true);
		assert.deepEqual(value, { first: 1 });
	});
	assert.equal(direct.getCalls, 0);
	assert.equal(direct.cursorCalls, 1);
	let continued = 0;
	direct.request.result = {
		key: "first",
		value: 1,
		continue() {
			continued++;
		},
	};
	direct.request.onsuccess();
	direct.request.result = null;
	direct.request.onsuccess();
	assert.deepEqual(await result, { first: 1 });
	assert.equal(continued, 1);
	assert.equal(callbacks, 1);
	assert.equal("dburgent" in cursorStatus, false);

	for (const query of [null, undefined]) {
		const next = createDirectDatabase();
		const { game: nextGame } = createHarness(next.database);
		const pending = query === undefined ? nextGame.getDB("data") : nextGame.getDB("data", query);
		assert.equal(next.getCalls, 0);
		assert.equal(next.cursorCalls, 1);
		next.request.result = null;
		next.request.onsuccess();
		assert.deepEqual(await pending, {});
	}

	const failure = createDirectDatabase();
	const { game: failedGame, status } = createHarness(failure.database);
	const event = new Error("cursor failure");
	const handled = failedGame.getDB("data", "", undefined, received => {
		assert.equal(received, event);
		assert.equal("dburgent" in status, false);
	});
	failure.request.onerror(event);
	assert.equal(await handled, undefined);
	assert.equal(failedGame.reloads, 1);
});

test("背景音乐的 src 保留 Web IDL 字符串化", async () => {
	const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "playBackgroundMusic");
	assert.ok(method);
	for (const value of [null, undefined, 12]) {
		const lib = { config: { background_music: "db:custom", mode_config: { guozhan: { aozhan_bgm: "disabled" } }, all: { background_music: [] } }, assetURL: "/" };
		const ui = { backgroundMusic: { src: "" } };
		const status = {};
		const game = { getDB: () => Promise.resolve(value) };
		const play = new Function("lib", "ui", "_status", "game", `return function() ${method.body.getText(source)}`)(lib, ui, status, game);
		play();
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(ui.backgroundMusic.src, String(value));
	}
});

test("db CSS 与脚本加载在请求后捕获未绑定 objectURL", async () => {
	for (const [name, args, property] of [
		["css", ["db:theme"], "href"],
		["js", ["db:script"], "src"],
	]) {
		let resolve;
		const pending = new Promise(value => {
			resolve = value;
		});
		let receiver = null;
		const captured = function (value) {
			"use strict";
			receiver = this;
			return `captured:${value}`;
		};
		const get = { objectURL: () => "too-early" };
		const game = {
			getDB() {
				get.objectURL = captured;
				return pending;
			},
		};
		const nodes = [];
		const document = {
			createElement() {
				return {
					addEventListener() {},
					remove() {},
				};
			},
			head: {
				appendChild(node) {
					nodes.push(node);
				},
				insertBefore(node) {
					nodes.push(node);
				},
			},
		};
		const lib = { assetURL: "", config: { all: { stockmode: [] }, fuck_sojson: false }, init: {} };
		const method = loadInitMethod(name, lib, game, get, {}, document);
		const node = method(...args);
		get.objectURL = () => "too-late";
		resolve("encoded");
		await new Promise(done => setImmediate(done));
		assert.equal(node[property], "captured:encoded");
		assert.equal(receiver, undefined);
		assert.equal(nodes[0], node);
	}
});
