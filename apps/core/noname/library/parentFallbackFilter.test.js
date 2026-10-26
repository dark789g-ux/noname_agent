import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile("index.js", readFileSync(new URL("./index.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const library = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Library");
const filterField = library?.members.find(node => ts.isPropertyDeclaration(node) && node.name.getText(source) === "filter");

function filterMethod(name, dependencies) {
	assert.ok(filterField && ts.isObjectLiteralExpression(filterField.initializer));
	const method = filterField.initializer.properties.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === name);
	assert.ok(method);
	return new Function(...Object.keys(dependencies), `"use strict"; return ({ ${method.getText(source)} }).${name};`)(...Object.values(dependencies));
}

test("cardEnabled forwards a parent fallback object unchanged to both Mod and card enable", () => {
	const fallback = {};
	const calls = [];
	const cardEnabled = filterMethod("cardEnabled", {
		get: {
			player() {
				throw new Error("explicit player should be retained");
			},
			itemtype() {
				return "vcard";
			},
			autoViewAs(card) {
				return card;
			},
			info() {
				return {
					enable(card, player, event) {
						calls.push(["enable", card, player, event]);
						return true;
					},
				};
			},
		},
		game: {
			checkMod(card, player, event) {
				calls.push(["mod", card, player, event]);
				return "unchanged";
			},
		},
	});
	const card = { name: "sha" };
	const player = {};
	assert.equal(cardEnabled(card, player, fallback), true);
	assert.deepEqual(calls, [["mod", card, player, fallback], ["enable", card, player, fallback]]);
});

test("cardRespondable keeps a parent fallback object instead of substituting the current event", () => {
	const fallback = {};
	const current = { name: "chooseToRespond" };
	const cardRespondable = filterMethod("cardRespondable", { _status: { event: current } });
	assert.equal(cardRespondable({ name: "shan" }, {}, fallback), true);
});

for (const name of ["cardUsable"]) {
	test(`${name} preserves the chooseToUse parent fallback property read`, () => {
		const fallback = {};
		let parentReads = 0;
		let addCountWrites = 0;
		Object.defineProperty(fallback, "addCount_extra", {
			set() {
				addCountWrites++;
			},
		});
		const method = filterMethod(name, {
			get: {
				autoViewAs(card) {
					return card;
				},
				info() {
					return { updateUsable: undefined };
				},
				player() {
					return {};
				},
			},
			_status: { event: {} },
			game: { checkMod() { return undefined; } },
		});
		const event = {
			type: "chooseToUse_button",
			getParent() {
				parentReads++;
				return fallback;
			},
		};
		assert.equal(method({ name: "sha" }, {}, event), true);
		assert.equal(parentReads, 1);
		assert.equal(addCountWrites, 0);
	});
}
