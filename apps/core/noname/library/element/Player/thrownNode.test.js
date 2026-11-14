import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "./testSource.js";

const sourceFile = playerTestSource();

function getFunctionText(name) {
	const declaration = sourceFile.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
	assert.ok(declaration, `${name} should exist`);
	return declaration.getText(sourceFile);
}

function loadThrownNodeHelpers() {
	const functions = ["isThrownNodeMap", "isRemovableThrownCardsetion", "replaceThrownCardsetion"].map(getFunctionText).join("\n");
	const javascript = ts.transpileModule(functions, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(`${javascript}; return replaceThrownCardsetion;`)();
}

function methodUsesReplacement(methodName) {
	for (const statement of sourceFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Player") {
			continue;
		}
		const method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === methodName);
		return method?.getText(sourceFile).includes("replaceThrownCardsetion(node, next);") || false;
	}
	return false;
}

test("thrown node replacement keeps remove, delete, and assignment order", () => {
	const replaceThrownCardsetion = loadThrownNodeHelpers();
	const events = [];
	const previous = {
		remove() {
			assert.equal(this, previous);
			events.push("remove");
		},
	};
	const map = new Proxy(
		{ cardsetion: previous },
		{
			deleteProperty(target, property) {
				events.push(`delete:${String(property)}`);
				return Reflect.deleteProperty(target, property);
			},
			set(target, property, value) {
				events.push(`set:${String(property)}`);
				return Reflect.set(target, property, value);
			},
		}
	);
	const next = {};
	replaceThrownCardsetion({ node: map }, next);

	assert.deepEqual(events, ["remove", "delete:cardsetion", "set:cardsetion"]);
	assert.equal(map.cardsetion, next);
	assert.equal(methodUsesReplacement("$draw"), true);
	assert.equal(methodUsesReplacement("$give"), true);
});

test("thrown node replacement preserves falsy-map skips and invalid-value failures", () => {
	const replaceThrownCardsetion = loadThrownNodeHelpers();
	const next = {};
	const node = { node: null };
	replaceThrownCardsetion(node, next);
	assert.equal(node.node, null);

	assert.throws(() => replaceThrownCardsetion({ node: true }, next), TypeError);
	const map = { cardsetion: {} };
	assert.throws(() => replaceThrownCardsetion({ node: map }, next), TypeError);
	assert.deepEqual(map.cardsetion, {});
});
