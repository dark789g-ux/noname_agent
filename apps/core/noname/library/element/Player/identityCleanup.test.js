import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const playerSource = ts.createSourceFile("player.js", readFileSync(new URL("../player.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const gameSource = ts.createSourceFile("game.js", readFileSync(new URL("../../../game/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

class Names extends Array {
	remove(value) {
		const index = this.indexOf(value);
		if (index !== -1) this.splice(index, 1);
		return this;
	}
	add(value) {
		if (!this.includes(value)) this.push(value);
		return this;
	}
}

function loadSkinPrefixes() {
	const callbacks = [];
	function visit(node) {
		if (ts.isArrowFunction(node) && ts.isBlock(node.body) && node.parameters.length === 5 && node.parameters[0].name.getText(playerSource) === "player" && node.body.statements.some(statement => statement.getText(playerSource) === "skin[name] = character;")) {
			const boundary = node.body.statements.findIndex(statement => statement.getText(playerSource) === "skin[name] = character;");
			const text = node.body.statements.slice(0, boundary + 1).map(statement => statement.getText(playerSource)).join("\n");
			callbacks.push(new Function("player", "name", "character", "list", "origin", text));
		}
		ts.forEachChild(node, visit);
	}
	visit(playerSource);
	return callbacks;
}

test("skin broadcast prefixes preserve temporary-name identity and existing missing-state behavior", () => {
	const callbacks = loadSkinPrefixes();
	assert.equal(callbacks.length, 2);
	for (const run of callbacks) {
		const names = new Names("old", "retained");
		const player = { skin: { name: "old" }, tempname: names };
		run(player, "name", "new", [], "old");
		assert.equal(player.tempname, names);
		assert.deepEqual([...names], ["retained", "new"]);
		assert.equal(player.skin.name, "new");
		assert.doesNotThrow(() => run({}, "name", "new", [], "old"));
		const missing = { skin: { name: "old" } };
		assert.throws(() => run(missing, "name", "new", [], "old"), TypeError);
		assert.equal(missing.skin.name, "old");
	}
});

test("recorded skin changes preserve nullish guards and reject cleaned-up names before mutation", () => {
	let callback;
	function visit(node) {
		if (ts.isPropertyAssignment(node) && node.name.getText(gameSource) === "changeSkin" && ts.isFunctionExpression(node.initializer)) callback = node.initializer;
		ts.forEachChild(node, visit);
	}
	visit(gameSource);
	assert.ok(callback);
	const boundary = callback.body.statements.findIndex(statement => statement.getText(gameSource) === "player.skin[map.name] = map.to;");
	assert.notEqual(boundary, -1);
	const run = new Function("player", "map", callback.body.statements.slice(0, boundary + 1).map(statement => statement.getText(gameSource)).join("\n"));
	const map = { from: "old", to: "new", name: "name" };
	assert.doesNotThrow(() => run(undefined, map));
	assert.doesNotThrow(() => run({}, undefined));
	const missing = { skin: { name: "old" } };
	assert.throws(() => run(missing, map), TypeError);
	assert.equal(missing.skin.name, "old");
	const names = new Names("old");
	const player = { skin: { name: "old" }, tempname: names };
	run(player, map);
	assert.equal(player.tempname, names);
	assert.deepEqual([...names], ["new"]);
});

test("countGroup skips cleaned-up and unregistered groups without counting duplicates", () => {
	const gameClass = gameSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Game");
	const method = gameClass.members.find(node => node.name?.getText(gameSource) === "countGroup");
	const groups = new Names("wei", "shu");
	const players = [{}, { group: "wei" }, { group: "wei" }, { group: "shu" }, { group: "unknown" }];
	const game = { countPlayer: predicate => players.filter(predicate).length };
	const count = new Function("game", "lib", `return function() ${method.body.getText(gameSource)}`)(game, { group: groups });
	assert.equal(count(), 2);
	assert.deepEqual([...groups], ["wei", "shu"]);
});
