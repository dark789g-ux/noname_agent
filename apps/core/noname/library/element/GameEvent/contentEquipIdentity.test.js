import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("content.ts", readFileSync(new URL("../content.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
let equip;
function visit(node) {
	if (ts.isMethodDeclaration(node) && node.name.getText(source) === "equip") equip = node;
	ts.forEachChild(node, visit);
}
visit(source);
assert.ok(equip);

test("view-as equipment removes the wrapper identity instead of all material cards", () => {
	const branch = equip.body.statements.find(node => ts.isIfStatement(node) && node.expression.getText(source) === "event.card.isViewAsCard");
	assert.ok(branch);
	const run = new Function("event", "loseCards", branch.getText(source));
	const wrapper = { isViewAsCard: true };
	const materialA = { name: "material-a" };
	const materialB = { name: "material-b" };
	const removed = [];
	const loseCards = {
		add(card) {
			removed.push(card);
		},
		addArray(cards) {
			removed.push(...cards);
		},
	};
	run({ card: wrapper, cards: [materialA, materialB] }, loseCards);
	assert.deepEqual(removed, [wrapper]);
	assert.notEqual(removed[0], materialA);
	assert.notEqual(removed[0], materialB);
});
