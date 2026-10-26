import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const getClass = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Get");
assert.ok(getClass);

function method(name, dependencies = {}) {
	const node = getClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(source) === name);
	assert.ok(node, name);
	const parameters = node.parameters.map(parameter => parameter.getText(source)).join(",");
	return new Function(...Object.keys(dependencies), `return function${node.asteriskToken ? "*" : ""}(${parameters}) ${node.body.getText(source)}`)(...Object.values(dependencies));
}

test("network enumeration retains VMware/internal filtering and missing-list failure", () => {
	const interfaces = {
		VMware: [{ family: "IPv4", address: "192.0.2.1", internal: false }],
		loopback: [{ family: "IPv4", address: "127.0.0.1", internal: true }],
		ethernet: [{ family: "IPv4", address: "192.0.2.2", internal: false }],
	};
	const ip = method("ip", {
		require: name => {
			assert.equal(name, "os");
			return { networkInterfaces: () => interfaces };
		},
	});
	assert.equal(ip(), "192.0.2.2");
	interfaces.loopback = undefined;
	assert.throws(() => ip(), TypeError);
	assert.equal(method("ip", { require: undefined })(), "");
});

test("numeric display parsing retains known values, NaN and explicit missing results", () => {
	const numString = method("numString", {
		lib: {
			numstrList: {
				entries: () => [
					[1, "A"],
					[11, "J"],
				],
			},
		},
	});
	assert.equal(numString("A"), 1);
	assert.equal(numString("J", false), 11);
	assert.equal(numString("12"), 12);
	assert.equal(numString("12", false), undefined);
	assert.equal(numString(undefined), undefined);
	assert.equal(Number.isNaN(numString("missing")), true);
});

test("rank true selects numeric results while zero and NaN retain textual grades", () => {
	const rank = method("rank", {
		_status: { lord: "lord" },
		lib: { rank: { s: ["strong"], d: ["weak"] }, character: { boss: { isBoss: true } } },
	});
	assert.equal(rank("lord", true), 8);
	assert.equal(rank({ name: "strong" }, true), 9);
	assert.equal(rank("weak", true), 1);
	assert.equal(rank("boss", true), 10);
	assert.equal(rank("strong", 0), "s");
	assert.equal(rank("strong", NaN), "s");
	assert.equal(rank("strong"), "s");
	assert.equal(rank("weak", 5), 1);
});

test("card value keeps static array indexing and dynamic numeric results without normalization", () => {
	let configuredValue;
	let index = 1;
	const card = { name: "sha" };
	const player = { getCardIndex: () => index };
	const get = { info: () => ({ ai: { basic: { value: configuredValue } } }), itemtype: () => "player" };
	const game = { checkMod: (owner, item, value) => value };
	const value = method("value", { get, game, _status: { event: { player } } });
	get.value = value;
	configuredValue = [9, 4, 1];
	assert.equal(value(card, player), 4);
	index = 20;
	assert.equal(value(card, player), 1);
	configuredValue = (item, owner, cardIndex, mode) => {
		assert.equal(item, card);
		assert.equal(owner, player);
		assert.equal(cardIndex, 20);
		assert.equal(mode, "raw");
		return NaN;
	};
	assert.equal(Number.isNaN(value(card, player, "raw")), true);
	configuredValue = () => -2;
	assert.equal(value(card, player), -2);
	configuredValue = [];
	assert.equal(value(card, player), undefined);
});

test("child iterator preserves every child identity and order without assuming HTML nodes", () => {
	const html = { namespaceURI: "http://www.w3.org/1999/xhtml" };
	const svg = { namespaceURI: "http://www.w3.org/2000/svg" };
	const iterator = method("iterableChildNodes");
	assert.deepEqual([...iterator({ children: [html, svg] }, { children: [svg] })], [html, svg, svg]);
});

test("skin file enumeration preserves game receiver and fails only when the API is needed", () => {
	let declaration;
	const visit = node => {
		if (ts.isVariableDeclaration(node) && node.name.getText(source) === "createButtons" && node.initializer && ts.isFunctionExpression(node.initializer)) declaration = node.initializer;
		ts.forEachChild(node, visit);
	};
	const nodeintro = getClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(source) === "nodeintro");
	assert.ok(nodeintro);
	visit(nodeintro);
	assert.ok(declaration);
	let calls = 0;
	const game = {
		getFileList(path, callback) {
			assert.equal(this, game);
			assert.equal(path, "skins/");
			assert.equal(typeof callback, "function");
			calls++;
		},
	};
	const get = { skinPath: () => "skins/" };
	const createButtons = new Function("game", "get", `let created = false; const uiintro = {}; return (${declaration.getText(source)});`)(game, get);
	createButtons("character");
	assert.equal(calls, 1);
	delete game.getFileList;
	assert.throws(() => createButtons("character"), TypeError);
	get.skinPath = () => undefined;
	assert.doesNotThrow(() => createButtons("character"));
});
