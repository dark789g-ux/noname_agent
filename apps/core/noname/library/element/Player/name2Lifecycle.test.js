import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const sourceText = readFileSync(new URL("../player.js", import.meta.url), "utf8");
const sourceFile = ts.createSourceFile("player.js", sourceText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);

function findPlayerClass() {
	let playerClass;
	for (const statement of sourceFile.statements) {
		if (ts.isClassDeclaration(statement) && statement.name?.text === "Player") {
			playerClass = statement;
			break;
		}
	}
	assert.ok(playerClass, "Player class should exist");
	return playerClass;
}

function findMethod(name) {
	const playerClass = findPlayerClass();
	for (const member of playerClass.members) {
		if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === name) {
			return member;
		}
	}
	assert.fail(`Player.${name} should exist`);
}

function findIfStatement(statement, predicate) {
	let match;
	const visit = node => {
		if (!match && ts.isIfStatement(node) && predicate(node)) {
			match = node;
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(statement);
	assert.ok(match, "expected lifecycle branch should exist");
	return match;
}

function compileFunction(name, parameters, blockText) {
	const javascript = ts.transpileModule(`function ${name}(${parameters}) ${blockText}`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(`${javascript}; return ${name};`)();
}

test("Player name2 field begins as an own undefined property", () => {
	const playerClass = findPlayerClass();
	const property = playerClass.members.find(member => ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === "name2");
	assert.ok(property, "Player.name2 field should exist");
	const fixtureSource = `class PlayerFixture { ${property.getText(sourceFile)} }`;
	const javascript = ts.transpileModule(fixtureSource, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	const PlayerFixture = Function(`${javascript}; return PlayerFixture;`)();
	const player = new PlayerFixture();

	assert.equal(Object.hasOwn(player, "name2"), true);
	assert.equal(player.name2, undefined);
});

test("Player.reinit2 deletes name2 when a double character becomes single", () => {
	const reinit2 = findMethod("reinit2");
	const branch = findIfStatement(reinit2, node => node.expression.getText(sourceFile) === "rawPairs.length == 2 && newPairs.length == 1");
	const player = {
		name1: "first",
		name2: "second",
		$reinit21(newPairs) {
			this.reinitPairs = newPairs;
		},
	};
	const newPairs = ["replacement"];

	const reinit2Branch = compileFunction("reinit2Branch", "rawPairs, player, newPairs", branch.thenStatement.getText(sourceFile));
	reinit2Branch(["first", "second"], player, newPairs);

	assert.equal(player.name1, "replacement");
	assert.equal(Object.hasOwn(player, "name2"), false);
	assert.equal(player.reinitPairs, newPairs);
});

test("Player.uninit deletes an assigned name2 without changing the singleHp cleanup", () => {
	const uninit = findMethod("uninit");
	const branch = findIfStatement(uninit, node => node.expression.getText(sourceFile) === "this.name2" && node.thenStatement.getText(sourceFile).includes("delete this.name2"));
	const player = { name2: "second", singleHp: 3 };

	const uninitBranch = compileFunction("uninitBranch", "", branch.thenStatement.getText(sourceFile));
	uninitBranch.call(player);

	assert.equal(Object.hasOwn(player, "name2"), false);
	assert.equal(Object.hasOwn(player, "singleHp"), false);
});
