import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const library = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Library");
assert.ok(library);
const gameSource = ts.createSourceFile("game/index.js", readFileSync(new URL("../game/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const gameClass = gameSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
assert.ok(gameClass);

function declaration(name) {
	const node = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
	assert.ok(node, name);
	return node.getText(source);
}

const guards = new Function(`${declaration("isNodePlatformRuntime")}; ${declaration("isNodeServerRuntime")}; return { isNodePlatformRuntime, isNodeServerRuntime };`)();

function method(name) {
	const node = library.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(source) === name);
	assert.ok(node, name);
	const parameters = node.parameters.map(parameter => parameter.getText(source)).join(",");
	return new Function("isNodePlatformRuntime", "isNodeServerRuntime", `return function(${parameters}) ${node.body.getText(source)}`)(guards.isNodePlatformRuntime, guards.isNodeServerRuntime);
}

function runtime(node) {
	const value = { node };
	value.requireNodePlatform = method("requireNodePlatform");
	value.getNodeServer = method("getNodeServer");
	value.requireNodeServer = method("requireNodeServer");
	value.startNodeServer = method("startNodeServer");
	return value;
}

function gameMethod(name, dependencies) {
	const node = gameClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(gameSource) === name);
	assert.ok(node, name);
	const parameters = node.parameters.map(parameter => parameter.getText(gameSource)).join(",");
	return new Function(...Object.keys(dependencies), `return function(${parameters}) ${node.body.getText(gameSource)}`)(...Object.values(dependencies));
}

function clientMessage(name, dependencies) {
	let property;
	const visit = node => {
		if (property || !ts.isPropertyAssignment(node) || node.name.getText(source) !== name || !ts.isFunctionExpression(node.initializer)) return;
		property = node;
	};
	ts.forEachChild(source, function walk(node) {
		visit(node);
		ts.forEachChild(node, walk);
	});
	assert.ok(property, name);
	const parameters = property.initializer.parameters.map(parameter => parameter.getText(source)).join(",");
	return new Function(...Object.keys(dependencies), `return function(${parameters}) ${property.initializer.body.getText(source)}`)(...Object.values(dependencies));
}

test("node runtime distinguishes absent platform, reset object and initialized platform", () => {
	const absent = runtime(undefined);
	assert.throws(() => absent.requireNodePlatform(), TypeError);
	assert.throws(() => absent.startNodeServer(), TypeError);
	const reset = runtime({});
	assert.equal(reset.getNodeServer(), undefined);
	assert.throws(() => reset.requireNodeServer(), TypeError);

	const platform = { fs: {}, path: {}, debug() {} };
	const initialized = runtime(platform);
	assert.equal(initialized.requireNodePlatform(), platform);
	assert.equal(initialized.getNodeServer(), undefined);
	for (const incompleteNode of [
		{ fs: undefined, path: {}, debug() {} },
		{ fs: {}, path: undefined, debug() {} },
		{ fs: null, path: {}, debug() {} },
		{ fs: {}, path: null, debug() {} },
		{ fs: null, path: null, debug() {} },
	]) {
		assert.throws(() => runtime(incompleteNode).requireNodePlatform(), TypeError);
	}
});

test("server initialization preserves the platform object and creates every server store", () => {
	const platform = { fs: {}, path: {}, debug() {} };
	const initialized = runtime(platform);
	const server = initialized.startNodeServer();
	assert.equal(server, platform);
	assert.deepEqual(server.clients, []);
	assert.deepEqual(server.banned, []);
	assert.deepEqual(server.observing, []);
	assert.deepEqual(server.torespond, {});
	assert.deepEqual(server.torespondtimeout, {});
	assert.deepEqual(server.waitForResult, {});
	assert.equal(initialized.getNodeServer(), server);
});

test("room creation resets node before browser-host createServer fills server stores", () => {
	const value = runtime({ fs: {}, path: {}, debug() {} });
	const game = {
		online: true,
		onlineroom: false,
		switchMode(mode) {
			this.mode = mode;
		},
	};
	const ui = { create: { connecting() {}, roomInfo() {}, chat() {} } };
	value.configOL = { mode: "identity" };
	const createRoom = clientMessage("createroom", { game, lib: value, ui });
	const createServer = gameMethod("createServer", { lib: value, game, ui, get: {}, require: () => assert.fail("browser room must not require ws") });
	createRoom("room", {}, "identity");
	assert.deepEqual(value.node, {});
	game.createServer = createServer;
	game.createServer();
	assert.deepEqual(value.node.clients, []);
	assert.equal(value.getNodeServer(), value.node);
});

test("incomplete server-shaped values cannot pass the lifecycle guard", () => {
	const value = runtime({ fs: {}, path: {}, debug() {}, clients: [], banned: [], observing: [] });
	assert.equal(value.getNodeServer(), undefined);
	assert.throws(() => value.requireNodeServer(), TypeError);
	const arrayStores = runtime({ fs: {}, path: {}, debug() {}, clients: [], banned: [], observing: [], torespond: [], torespondtimeout: {}, waitForResult: {} });
	assert.equal(arrayStores.getNodeServer(), undefined);
});
