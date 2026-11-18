import { contentTestSource } from "../../../llm/testing/content-runtime.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "./testSource.js";

const realContentSource = await contentTestSource();

const source = playerTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");
function method(name, dependencies = {}) {
	const node = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === name);
	assert.ok(node);
	return new Function(...Object.keys(dependencies), `return ({ ${node.getText(source)} })[${JSON.stringify(name)}];`)(...Object.values(dependencies));
}

test("HP fields preserve own undefined initialization and native cleanup", () => {
	const fields = declaration.members.filter(node => ts.isPropertyDeclaration(node) && ["hp", "maxHp"].includes(node.name.getText(source)));
	assert.equal(fields.length, 2);
	const Fixture = new Function(`return class { ${fields.map(node => node.getText(source)).join("\n")} };`)();
	const player = new Fixture();
	for (const key of ["hp", "maxHp"]) {
		assert.equal(Object.hasOwn(player, key), true);
		assert.equal(player[key], undefined);
		const cleanup = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "uninit").body.statements.find(node => node.getText(source) === `delete this.${key};`);
		assert.ok(cleanup);
		new Function(cleanup.getText(source)).call(player);
		assert.equal(Object.hasOwn(player, key), false);
	}
});

test("getHp and damaged HP preserve raw undefined, NaN, negative and infinite values", () => {
	const getHp = method("getHp"),
		getDamagedHp = method("getDamagedHp");
	for (const hp of [undefined, NaN, -2, 0, 3, Infinity]) {
		for (const maxHp of [undefined, NaN, 0, 4, Infinity]) {
			const player = { hp, maxHp, getHp };
			assert.equal(getHp.call(player, true), hp);
			assert.equal(getHp.call(player), Math.max(0, hp));
			for (const raw of [true, false, undefined]) {
				const value = raw ? hp : Math.max(0, hp);
				assert.equal(getDamagedHp.call(player, raw), value === Infinity ? 0 : maxHp - value);
			}
		}
	}
});

test("HP comparisons keep undefined non-orderable rather than assuming zero", () => {
	const isDamaged = method("isDamaged"),
		isHealthy = method("isHealthy");
	for (const hp of [undefined, NaN, 0, 3, Infinity]) {
		for (const maxHp of [undefined, NaN, 0, 4, Infinity]) {
			const player = { hp, maxHp, storage: { nohp: false } };
			assert.equal(isDamaged.call(player), hp < maxHp);
			assert.equal(isHealthy.call(player), hp >= maxHp);
		}
	}
});

test("update broadcasts raw HP and rereads after extension hooks", () => {
	let broadcast, observed;
	const run = method("update", {
		_status: {},
		game: {
			broadcast(fn, player, ...values) {
				broadcast = values;
			},
			callHook(name, [player]) {
				assert.equal(name, "checkUpdate");
				delete player.hp;
				delete player.maxHp;
			},
		},
	});
	const player = {
		hp: 5,
		maxHp: 4,
		hujia: undefined,
		$update() {
			observed = [this.hp, this.maxHp];
		},
	};
	run.call(player);
	assert.deepEqual(broadcast, [4, 4, undefined]);
	assert.deepEqual(observed, [undefined, undefined]);
});

test("HP DOM display retains undefined text and raw equality condition", () => {
	const run = method("$update", { _status: { video: true }, game: { callHook() {} }, get: { is: { newLayout: () => false } }, ui: {}, setTimeout() {} });
	for (const maxHp of [undefined, 6, Infinity]) {
		const hp = { style: {}, dataset: {}, children: [], classList: { contains: () => false, add() {}, remove() {} } };
		const player = { hp: undefined, maxHp, storage: {}, node: { hp, count: { dataset: {} } }, classList: { contains: () => false }, countCards: () => 0, updateMarks() {} };
		run.call(player, 0);
		assert.equal(player.hp, undefined);
		assert.equal(hp.innerHTML, maxHp === undefined ? "" : `undefined<br>/<br>${maxHp === Infinity ? "∞" : maxHp}<div></div>`);
		assert.equal(hp.dataset.condition, maxHp === undefined ? "high" : "low");
	}
});

test("changeHp preserves existing NaN normalization and post-update HP rereads", async () => {
	const content = realContentSource;
	let node;
	function visit(current) {
		if (ts.isMethodDeclaration(current) && current.name.getText(content) === "changeHp") node = current;
		ts.forEachChild(current, visit);
	}
	visit(content);
	assert.ok(node);
	const text = ts.transpileModule(`const methods = { ${node.getText(content)} };`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	const history = [];
	const run = new Function("game", "_status", `${text}; return methods.changeHp;`)({ getGlobalHistory: () => ({ changeHp: history }) }, { dying: [] });
	for (const hp of [undefined, NaN, -2, 3]) {
		let atUpdate,
			triggered = 0;
		const player = {
			hp,
			maxHp: 4,
			getHp: method("getHp"),
			update() {
				atUpdate = this.hp;
				delete this.hp;
			},
		};
		const event = {
			num: 2,
			originalHp: hp,
			popup: false,
			async trigger(name) {
				assert.equal(name, "changeHp");
				triggered++;
			},
		};
		await run(event, {}, player);
		const sum = hp + 2;
		assert.equal(atUpdate, isNaN(sum) ? 0 : Math.min(4, sum));
		assert.equal(Number.isNaN(event.changedHp), true);
		assert.equal(player.hp, undefined);
		assert.equal(triggered, 1);
	}
	assert.equal(history.length, 4);
	const parent = { name: "damage" };
	const event = { num: -3, originalHp: 4, popup: false, getParent: () => parent, async trigger() {} };
	const player = {
		hp: 4,
		maxHp: 4,
		hujia: 2,
		getHp: method("getHp"),
		hasSkillTag() {
			event.num = -8;
			return false;
		},
		changeHujia: () => ({}),
		update() {},
	};
	await run(event, {}, player);
	assert.equal(event.num, -6);
	assert.equal(player.hp, -2);
});

test("recoverTo forwards the numeric difference without replacing undefined by a default", () => {
	const run = method("recoverTo");
	let seen;
	const player = {
		getHp: () => undefined,
		recover(...args) {
			seen = args;
			return args;
		},
	};
	run.call(player, undefined);
	assert.equal(Number.isNaN(seen[0].num), true);
});
