import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const sourceText = readFileSync(new URL("../player.js", import.meta.url), "utf8");
const sourceFile = ts.createSourceFile("player.js", sourceText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);

function findPlayerClass() {
	const playerClass = sourceFile.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === "Player");
	assert.ok(playerClass, "Player class should exist");
	return playerClass;
}

function findMethod(name) {
	const method = findPlayerClass().members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === name);
	assert.ok(method, `Player.${name} should exist`);
	return method;
}

function compileFunction(name, parameters, blockText, bindings = {}) {
	const javascript = ts.transpileModule(`function ${name}(${parameters}) ${blockText}`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(...Object.keys(bindings), `${javascript}; return ${name};`)(...Object.values(bindings));
}

for (const name of ["name", "name1"]) {
	test(`Player ${name} field begins as an own undefined property`, () => {
		const property = findPlayerClass().members.find(member => ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === name);
		assert.ok(property, "Player.name1 field should exist");
		const javascript = ts.transpileModule(`class PlayerFixture { ${property.getText(sourceFile)} }`, {
			compilerOptions: { target: ts.ScriptTarget.ESNext },
		}).outputText;
		const PlayerFixture = Function(`${javascript}; return PlayerFixture;`)();
		const player = new PlayerFixture();

		assert.equal(Object.hasOwn(player, name), true);
		assert.equal(player[name], undefined);
	});

	test(`Player.uninit uses native delete for ${name}`, () => {
		const uninit = findMethod("uninit");
		let deleteStatement;
		const visit = node => {
			if (!deleteStatement && ts.isDeleteExpression(node) && node.expression.getText(sourceFile) === `this.${name}`) {
				deleteStatement = node.parent;
			}
			ts.forEachChild(node, visit);
		};
		visit(uninit);
		assert.ok(deleteStatement, "Player.uninit should delete this.name1");
		const deleteName1 = compileFunction("deleteName1", "", `{ ${deleteStatement.getText(sourceFile)} }`);
		const player = { [name]: "first" };

		deleteName1.call(player);
		assert.equal(Object.hasOwn(player, name), false);
	});
}

test("reinitCharacter retains the undefined entry and changeCharacter warns before cancellation", () => {
	const reinit = compileFunction("reinitCharacter", "from, to, log = true", findMethod("reinitCharacter").body.getText(sourceFile));
	const calls = [];
	const player = {
		name: undefined,
		name1: undefined,
		name2: "vice",
		changeCharacter(...args) {
			calls.push(args);
		},
	};
	reinit.call(player, "missing", "replacement", false);
	assert.deepEqual(calls, [[[undefined, "vice"], false]]);
	const registry = { vice: {} };
	const warnings = [];
	let created = 0;
	const child = { setContent() {} };
	const change = compileFunction("changeCharacter", "newPairs, log = true", findMethod("changeCharacter").body.getText(sourceFile), {
		lib: { character: registry },
		console: {
			warn(...args) {
				warnings.push(args);
			},
		},
		game: {
			createEvent() {
				created++;
				return child;
			},
		},
	});
	assert.equal(change.call(player, ...calls[0]), undefined);
	assert.equal(created, 0);
	assert.equal(warnings.length, 1);
	assert.equal(warnings[0][1], undefined);
	registry.undefined = {};
	assert.equal(change.call(player, ...calls[0]), child);
	assert.equal(created, 1);
	assert.equal(child.newPairs, calls[0][0]);
});

test("linkintro reads names only after isLinked and retains missing-name failure", () => {
	const getSource = ts.createSourceFile("get/index.js", readFileSync(new URL("../../../get/index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const getClass = getSource.statements.find(ts.isClassDeclaration);
	const method = getClass.members.find(node => node.name?.getText(getSource) === "linkintro");
	let reads = 0;
	let linked = false;
	const player = {
		isLinked: () => linked,
		get name() {
			reads++;
			return undefined;
		},
	};
	const run = compileFunction("linkintro", "dialog, content, player", method.body.getText(getSource), { game: { players: [player] } });
	const dialog = { content: { firstChild: { remove() {} } }, add() {} };
	run(dialog);
	assert.equal(reads, 0);
	linked = true;
	assert.throws(() => run(dialog), TypeError);
	assert.equal(reads, 1);
});

test("Player.getClans keeps undefined name1 as an object key", () => {
	const getClans = findMethod("getClans");
	const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, "addArray");
	Object.defineProperty(Array.prototype, "addArray", {
		configurable: true,
		value(values) {
			this.push(...values);
			return this;
		},
	});
	try {
		const method = compileFunction("getClans", "unseen", getClans.body.getText(sourceFile), { lib: { character: { undefined: { clans: ["fallback"] } } } });
		assert.deepEqual(method.call({ name1: undefined, isUnseen: () => false }, true), ["fallback"]);
	} finally {
		if (descriptor) Object.defineProperty(Array.prototype, "addArray", descriptor);
		else delete Array.prototype.addArray;
	}
});

test("showing a vice character keeps the missing-main TypeError after video and sex effects", () => {
	const calls = [];
	const show = compileFunction("show", "num, log", findMethod("$showCharacter").body.getText(sourceFile), {
		game: {
			addVideo(...args) {
				calls.push(args);
			},
		},
		lib: { character: { vice: ["female", "wei", 4, []] } },
	});
	const player = { name: undefined, name2: "vice", sex: "unknown", isUnseen: () => true };
	assert.throws(() => show.call(player, 1, false), TypeError);
	assert.equal(player.sex, "female");
	assert.deepEqual(calls, [["showCharacter", player, 1]]);
});

test("returning names to the character pool keeps missing-name failure after registry lookup", () => {
	const content = ts.createSourceFile("content.ts", readFileSync(new URL("../content.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
	let branch;
	function visit(node) {
		if (ts.isIfStatement(node) && node.expression.getText(content) === "_status.characterlist && !event.reserveOut") branch = node;
		ts.forEachChild(node, visit);
	}
	visit(content);
	assert.ok(branch);
	const list = [];
	list.add = value => list.push(value);
	const registry = {};
	const run = compileFunction("returnNames", "player, event", `{ ${branch.getText(content)} }`, { _status: { characterlist: list }, lib: { character: registry } });
	run({}, {});
	assert.deepEqual(Array.from(list), []);
	registry.undefined = {};
	assert.throws(() => run({}, {}), TypeError);
	assert.deepEqual(Array.from(list), []);
	registry.hero = {};
	run({ name: "hero", name1: "hero" }, {});
	assert.deepEqual(Array.from(list), ["hero", "hero"]);
});
