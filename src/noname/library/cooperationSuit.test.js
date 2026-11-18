import { builtinSkillTestSource } from "./builtinSkills/testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = builtinSkillTestSource();
let cooperation;
const visit = node => {
	if (ts.isPropertyAssignment(node) && node.name.getText(source) === "cooperation") cooperation = node.initializer;
	ts.forEachChild(node, visit);
};
visit(source);
assert.ok(cooperation && ts.isObjectLiteralExpression(cooperation));

function loadSubskill(name, get, lib) {
	const subskills = cooperation.properties.find(node => node.name?.getText(source) === "subSkill").initializer;
	const subskill = subskills.properties.find(node => node.name?.getText(source) === name).initializer;
	return new Function("get", "lib", `return (${subskill.getText(source)});`)(get, lib);
}

test("cooperation discard records only registered suits and keeps card order", async () => {
	const lib = { suit: ["club", "spade", "diamond", "heart"] };
	const cards = ["heart", null, undefined, "none", "spade"].map(suit => ({ suit }));
	const discard = [];
	Object.defineProperty(discard, "add", {
		value(suit) {
			if (!this.includes(suit)) this.push(suit);
		},
	});
	const info = { type: "discard", discard };
	const marks = [];
	const player = { getStorage: () => [info], markSkill: name => marks.push(name) };
	const subskill = loadSubskill("discard", { suit: card => card.suit }, lib);
	await subskill.content({}, { player, cards2: cards }, player);
	assert.deepEqual(discard, ["heart", "spade"]);
	assert.deepEqual(marks, ["cooperation_discard"]);
});

test("cooperation use rejects missing or unregistered suits without reading storage", () => {
	const lib = { suit: ["club", "spade", "diamond", "heart"] };
	let reads = 0;
	const player = {
		getStorage() {
			reads++;
			return [{ type: "use", used: ["spade"] }];
		},
	};
	const subskill = loadSubskill("use", { suit: card => card.suit }, lib);
	for (const suit of [null, undefined, "none"]) assert.equal(subskill.filter({ card: { suit }, player }, player), false);
	assert.equal(reads, 0);
	assert.equal(subskill.filter({ card: { suit: "heart" }, player }, player), true);
	assert.equal(subskill.filter({ card: { suit: "spade" }, player }, player), false);
});
