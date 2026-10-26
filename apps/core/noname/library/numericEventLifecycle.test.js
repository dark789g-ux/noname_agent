import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { zhanfaTestSource } from "./zhanfaEffects/testSource.js";

const zhanfa = zhanfaTestSource();
const declaration = zhanfa.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(zhanfa) === "_zhanfa"));
const entries = declaration.declarationList.declarations.find(item => item.name.getText(zhanfa) === "_zhanfa").initializer;
function zhanfaMethod(name, methodName, dependencies = {}) {
	const entry = entries.properties.find(item => item.name.getText(zhanfa) === name).initializer;
	const skill = entry.properties.find(item => item.name.getText(zhanfa) === "skill").initializer;
	const method = skill.properties.find(item => item.name.getText(zhanfa) === methodName);
	return new Function(...Object.keys(dependencies), `return ({${method.getText(zhanfa)}})[${JSON.stringify(methodName)}];`)(...Object.values(dependencies));
}

test("ordinary numeric adjustments preserve NaN and undefined arithmetic at the use point", async () => {
	for (const [name, initial, expected] of [
		["zf_ershengsan", 2, 3],
		["zf_houshi", 2, 1],
		["zf_jiemeng", 2, 4],
		["zf_ershengsan", undefined, NaN],
		["zf_houshi", undefined, NaN],
		["zf_jiemeng", undefined, NaN],
		["zf_ershengsan", NaN, NaN],
		["zf_houshi", NaN, NaN],
		["zf_jiemeng", NaN, NaN],
	]) {
		let value = initial;
		const calls = [];
		const trigger = {
			get num() {
				calls.push("read");
				return value;
			},
			set num(next) {
				calls.push("write");
				value = next;
			},
		};
		await zhanfaMethod(name, "content")({}, trigger, {});
		assert.equal(value, expected, name);
		assert.deepEqual(calls, ["read", "write"], name);
	}
});

test("the phase branch does not read a draw count and keeps its existing draw request", async () => {
	const calls = [];
	const trigger = {
		name: "phase",
		get num() {
			throw new Error("phase must not read num");
		},
	};
	await zhanfaMethod("zf_houfaxianzhi", "content")({}, trigger, { draw: options => calls.push(options) });
	assert.deepEqual(calls, [{ num: 3 }]);
});

test("damage history filters exclude missing and NaN counts without substituting zero", () => {
	const events = [{ num: undefined }, { num: NaN }, { num: 0 }, { num: 2 }];
	const player = { getRoundHistory: (type, filter) => events.filter(filter) };
	assert.equal(zhanfaMethod("zf_badaoshu", "filter", { game: { roundNumber: 2 } })({}, player), false);
	assert.equal(zhanfaMethod("zf_badaoshu2", "filter", { game: { roundNumber: 2 } })({}, player), true);
});

test("indexed draw callbacks return the original count, including undefined", () => {
	let checked = 0;
	for (const entry of entries.properties) {
		const skill = entry.initializer?.properties?.find(item => item.name?.getText(zhanfa) === "skill")?.initializer;
		const method = skill?.properties?.find(item => item.name?.getText(zhanfa) === "getIndex" && item.getText(zhanfa).includes("return event.num;"));
		if (!method) continue;
		const run = new Function(`return ({${method.getText(zhanfa)}}).getIndex;`)();
		assert.equal(run({ num: undefined }, {}), undefined);
		assert.equal(run({ num: NaN }, {}), NaN);
		assert.equal(run({ num: 2 }, {}), 2);
		checked++;
	}
	assert.equal(checked, 2);
});

test("damage filterStop rereads a changed count for comparison, history and zero cancellation", () => {
	const source = ts.createSourceFile("player.js", readFileSync(new URL("./element/player.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
	let damage;
	function visit(node) {
		if (ts.isMethodDeclaration(node) && node.name.getText(source) === "damage") damage = node;
		ts.forEachChild(node, visit);
	}
	visit(source);
	const assignment = damage.body.statements.find(node => ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression) && node.expression.left.getText(source) === "next.filterStop");
	const run = new Function(`return ${assignment.expression.right.getText(source)};`)();
	const values = [3, 5, -1];
	const calls = [];
	const event = {
		original_num: 1,
		change_history: [1],
		get num() {
			calls.push("num");
			return values.shift();
		},
		trigger: name => calls.push(name),
		finish: () => calls.push("finish"),
	};
	assert.equal(run.call(event), true);
	assert.deepEqual(event.change_history, [1, 3]);
	assert.deepEqual(calls, ["num", "num", "num", "damageZero", "finish"]);
	assert.equal(event._triggered, null);
});
