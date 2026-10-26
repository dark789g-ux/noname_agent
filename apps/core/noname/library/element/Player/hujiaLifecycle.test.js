import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function read(path) {
	return ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
}
const playerSource = read("../player.js");
const contentSource = read("../content.ts");
const getSource = read("../../../get/index.js");
function method(source, name) {
	let found;
	function visit(node) {
		if (ts.isMethodDeclaration(node) && node.name.getText(source) === name) found = node;
		ts.forEachChild(node, visit);
	}
	visit(source);
	assert.ok(found);
	return found;
}
function compile(source, node, dependencies) {
	const text = ts.transpileModule(`const methods = { ${node.getText(source)} };`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	return new Function(...Object.keys(dependencies), `${text}; return methods;`)(...Object.values(dependencies))[node.name.getText(source)];
}

test("hujia remains an own undefined field and uninit deletes it natively", () => {
	const declaration = playerSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");
	const field = declaration.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(playerSource) === "hujia");
	const text = ts.transpileModule(`class Fixture { ${field.getText(playerSource)} }`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const Fixture = new Function(`${text}; return Fixture;`)();
	const player = new Fixture();
	assert.equal(Object.hasOwn(player, "hujia"), true);
	assert.equal(player.hujia, undefined);
	const cleanup = method(playerSource, "uninit").body.statements.find(node => node.getText(playerSource) === "delete this.hujia;");
	assert.ok(cleanup);
	new Function(cleanup.getText(playerSource)).call(player);
	assert.equal(Object.hasOwn(player, "hujia"), false);
});

test("changeHujia keeps the existing cap behavior including uninitialized armor", () => {
	const run = compile(playerSource, method(playerSource, "changeHujia"), { game: { createEvent: () => ({ setContent() {} }) } });
	for (const hujia of [undefined, 0, 3, NaN, Infinity]) {
		const player = { hujia };
		const expected = hujia + 4 > 5 ? Math.max(0, 5 - hujia) : 4;
		const event = run.call(player, 4, undefined, true);
		assert.equal(event.num, expected);
		assert.equal(event.player, player);
		assert.equal(player.hujia, hujia);
	}
});

test("armor changes preserve undefined-to-NaN, clamping, logs and updates", async () => {
	const logs = [];
	const run = compile(contentSource, method(contentSource, "changeHujia"), { game: { log(...args) { logs.push(args); } }, get: { cnNumber: String } });
	for (const hujia of [undefined, 0, 2, NaN]) {
		for (const requested of [-4, 3]) {
			let updates = 0;
			const player = { hujia, update() { updates++; } };
			const event = { num: requested, type: "lose" };
			const actual = requested < 0 && -requested > hujia ? -hujia : requested;
			await run(event, {}, player);
			assert.equal(player.hujia, hujia + actual);
			assert.equal(event.num, actual);
			assert.equal(updates, 1);
		}
	}
	assert.equal(logs.length, 8);
});

test("armor absorption rereads after skill callbacks instead of retaining stale armor", () => {
	const changeHp = method(contentSource, "changeHp");
	const branch = changeHp.body.statements.find(node => ts.isIfStatement(node) && node.expression.getText(contentSource).includes('hasSkillTag("nohujia")'));
	assert.ok(branch);
	const run = new Function("num", "player", "event", branch.getText(contentSource));
	const parent = { name: "damage" };
	const event = { num: -3, getParent: () => parent };
	let changed;
	const player = { hujia: 2, hasSkillTag() { delete this.hujia; return false; }, changeHujia(value) { changed = value; return {}; } };
	run(-3, player, event);
	assert.equal(Number.isNaN(event.hujia), true);
	assert.equal(Number.isNaN(event.num), true);
	assert.equal(Number.isNaN(changed), true);
});

test("armor absorption keeps the parent-chain reads around skill checks and writes to the third parent", () => {
	const changeHp = method(contentSource, "changeHp");
	const branch = changeHp.body.statements.find(node => ts.isIfStatement(node) && node.expression.getText(contentSource).includes('hasSkillTag("nohujia")'));
	assert.ok(branch);
	const run = new Function("num", "player", "event", branch.getText(contentSource));
	const firstParent = { name: "damage" };
	const secondParent = { name: "damage", nohujia: false };
	const writtenParent = { name: "damage" };
	const parents = [firstParent, secondParent, writtenParent];
	let reads = 0;
	const event = { num: -3, getParent() { return parents[reads++]; } };
	let changed;
	const player = { hujia: 2, hasSkillTag() { return false; }, changeHujia(value) { changed = value; return {}; } };
	run(-3, player, event);
	assert.equal(reads, 3);
	assert.equal(event.hujia, 2);
	assert.equal(event.num, -1);
	assert.equal(changed, -2);
	assert.equal(firstParent.hujia, undefined);
	assert.equal(secondParent.hujia, undefined);
	assert.equal(writtenParent.hujia, 2);
});

test("armor absorption does not consult skill tags when the first parent is not damage", () => {
	const changeHp = method(contentSource, "changeHp");
	const branch = changeHp.body.statements.find(node => ts.isIfStatement(node) && node.expression.getText(contentSource).includes('hasSkillTag("nohujia")'));
	assert.ok(branch);
	const run = new Function("num", "player", "event", branch.getText(contentSource));
	let skillTagChecks = 0;
	let parentReads = 0;
	const event = { num: -3, getParent() { parentReads++; return { name: "recover" }; } };
	const player = { hujia: 2, hasSkillTag() { skillTagChecks++; return false; }, changeHujia() { throw new Error("armor must not absorb"); } };
	run(-3, player, event);
	assert.equal(parentReads, 1);
	assert.equal(skillTagChecks, 0);
	assert.equal(event.hujia, undefined);
});

test("cnNumber retains the old empty representation for undefined armor", () => {
	const run = compile(getSource, method(getSource, "cnNumber"), {});
	assert.equal(run(undefined), "");
	assert.equal(run(NaN), "");
	assert.equal(run(0), "零");
	assert.equal(run(2), "两");
});
