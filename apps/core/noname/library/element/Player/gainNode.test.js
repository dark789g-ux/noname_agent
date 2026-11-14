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

function getPlayerMethodText(name) {
	for (const statement of sourceFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Player") {
			continue;
		}
		const method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === name);
		assert.ok(method, `Player.${name} should exist`);
		return method.getText(sourceFile);
	}
	assert.fail("Player should exist");
}

function loadGainNodeFactory(ui, lib) {
	const javascript = ts.transpileModule(getFunctionText("createGainAnimationNode"), {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function("ui", "lib", `${javascript}; return createGainAnimationNode;`)(ui, lib);
}

test("gain animation node keeps the Card movement methods and their receiver", () => {
	const node = { className: ".card.thrown" };
	const receivers = [];
	const moveTo = function (player) {
		receivers.push(["moveTo", this, player]);
		return this;
	};
	const moveDelete = function (player) {
		receivers.push(["moveDelete", this, player]);
		return this.moveTo(player);
	};
	const createGainAnimationNode = loadGainNodeFactory(
		{
			create: {
				div: className => {
					assert.equal(className, ".card.thrown");
					return node;
				},
			},
		},
		{ element: { Card: { prototype: { moveTo, moveDelete } } } }
	);

	const animatedNode = createGainAnimationNode();
	const player = {};
	assert.equal(animatedNode, node);
	assert.equal(animatedNode.moveTo, moveTo);
	assert.equal(animatedNode.moveDelete, moveDelete);
	animatedNode.moveDelete(player);
	assert.deepEqual(receivers, [
		["moveDelete", node, player],
		["moveTo", node, player],
	]);
});

test("$gain uses the local animation-node factory only for its non-Card branch", () => {
	const gain = getPlayerMethodText("$gain");
	assert.match(gain, /else \{\s*node = createGainAnimationNode\(\);\s*\}/);
	assert.match(gain, /if \(get\.itemtype\(card\) == "card"\) \{\s*node = card\.copy\("thrown", false\);/);
});
