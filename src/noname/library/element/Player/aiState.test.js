import { contentTestSource } from "../../../llm/testing/content-runtime.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "./testSource.js";

const realContentSource = await contentTestSource();

const sourceFile = playerTestSource();

function getTempIgnoreLoop(methodName) {
	let method;
	for (const statement of sourceFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Player") {
			continue;
		}
		method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === methodName);
	}
	assert.ok(method, `Player.${methodName} should exist`);
	let loop;
	const visit = node => {
		if (!loop && ts.isForStatement(node) && node.getText(sourceFile).includes("this.ai.tempIgnore")) {
			loop = node;
		}
		ts.forEachChild(node, visit);
	};
	visit(method);
	assert.ok(loop, `Player.${methodName} tempIgnore loop should exist`);
	const javascript = ts.transpileModule(`function tempIgnoreLoop(next, get) { ${loop.getText(sourceFile)} }`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(`${javascript}; return tempIgnoreLoop;`)();
}

function getPhaseTempIgnoreReset() {
	const contentFile = realContentSource;
	let reset;
	const visit = node => {
		if (!reset && ts.isExpressionStatement(node) && node.getText(contentFile) === "player.ai.tempIgnore = [];") {
			reset = node;
		}
		ts.forEachChild(node, visit);
	};
	visit(contentFile);
	assert.ok(reset, "phase cleanup should unconditionally reset tempIgnore");
	const javascript = ts.transpileModule(`function resetTempIgnore(player) { ${reset.getText(contentFile)} }`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(`${javascript}; return resetTempIgnore;`)();
}

function withArrayAdd(callback) {
	const originalAdd = Array.prototype.add;
	Array.prototype.add = function (value) {
		if (!this.includes(value)) {
			this.push(value);
		}
		return this;
	};
	try {
		callback();
	} finally {
		if (originalAdd === undefined) {
			delete Array.prototype.add;
		} else {
			Array.prototype.add = originalAdd;
		}
	}
}

test("useCard and useSkill preserve Player identity, receiver, and tempIgnore array identity", () => {
	withArrayAdd(() => {
		for (const methodName of ["useCard", "useSkill"]) {
			const loop = getTempIgnoreLoop(methodName);
			const target = { id: methodName };
			const tempIgnore = [];
			const player = { ai: { tempIgnore } };
			let receiver;
			loop.call(
				player,
				{ targets: [target] },
				{
					attitude(owner, candidate) {
						receiver = owner;
						assert.equal(candidate, target);
						return -0.5;
					},
				}
			);
			assert.equal(receiver, player);
			assert.equal(player.ai.tempIgnore, tempIgnore);
			assert.deepEqual(tempIgnore, [target]);
		}
	});
});

test("phase cleanup creates missing tempIgnore and replaces the previous array", () => {
	const resetTempIgnore = getPhaseTempIgnoreReset();
	const missing = { ai: {} };
	resetTempIgnore(missing);
	assert.deepEqual(missing.ai.tempIgnore, []);

	const previous = [{ id: "target" }];
	const existing = { ai: { tempIgnore: previous } };
	resetTempIgnore(existing);
	assert.deepEqual(existing.ai.tempIgnore, []);
	assert.notEqual(existing.ai.tempIgnore, previous);
});
