import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function readSource(path) {
	const text = readFileSync(new URL(path, import.meta.url), "utf8");
	const scriptKind = path.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
	return ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, scriptKind);
}

function findMethod(sourceFile, name) {
	let result;
	const visit = node => {
		if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
			result ??= node;
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	assert.ok(result, `${name} should exist`);
	return result;
}

function loadMethod(sourceFile, name, dependencies) {
	const method = findMethod(sourceFile, name);
	const parameters = method.parameters.map(parameter => parameter.getText(sourceFile)).join(", ");
	const isAsync = method.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword);
	const javascript = ts.transpileModule(`${isAsync ? "async " : ""}function ${name}(${parameters}) ${method.body.getText(sourceFile)}`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(...Object.keys(dependencies), `${javascript}; return ${name};`)(...Object.values(dependencies));
}

test("tryCardAnimate preserves boolean popname across the local and broadcast paths", () => {
	const source = readSource("../player.js");
	const broadcasts = [];
	const game = {
		broadcast(...args) {
			broadcasts.push(args);
		},
	};
	const lib = { animate: { card: {} }, config: { show_card_prompt: true } };
	const get = { type: () => "trick" };
	const tryCardAnimate = loadMethod(source, "tryCardAnimate", { game, lib, get });
	const popups = [];
	const player = {
		popup(...args) {
			popups.push(args);
		},
	};
	const card = { name: "sha", nature: "fire" };
	tryCardAnimate.call(player, card, "sha", "metal", true);
	assert.equal(broadcasts.length, 1);
	assert.deepEqual(broadcasts[0].slice(1), [player, card, "sha", "metal", true]);
	assert.deepEqual(popups, [[{ name: "sha", nature: "fire" }, "metal", false]]);
});

test("die preserves nosource as the event reason and assigns an own undefined source", () => {
	const source = readSource("../player.js");
	const game = {
		createEvent() {
			return { setContent() {} };
		},
	};
	const die = loadMethod(source, "die", { game });
	const event = die.call({}, "nosource");
	assert.equal(event.reason, "nosource");
	assert.ok(Object.hasOwn(event, "source"));
	assert.equal(event.source, undefined);

	const killer = {};
	const reason = { source: killer };
	assert.equal(die.call({}, reason).source, killer);
});

test("card usability and attack range retain undefined and unchanged initial mod values", () => {
	const source = readSource("../player.js");
	const card = { name: "sha" };
	const cardUsableCalls = [];
	const getCardUsable = loadMethod(source, "getCardUsable", {
		game: {
			checkMod(...args) {
				cardUsableCalls.push(args);
				return undefined;
			},
		},
		get: { autoViewAs: value => value, info: () => ({ usable: undefined }) },
		_status: {},
	});
	assert.equal(getCardUsable.call({}, card), Infinity);
	assert.equal(cardUsableCalls[0][2], undefined);

	const calculateAttackRange = checkMod => {
		const getAttackRange = loadMethod(source, "getAttackRange", { game: { checkMod }, get: {}, ui: {} });
		return getAttackRange.call({ getEquipRange: () => 4 }, false);
	};
	assert.equal(
		calculateAttackRange((player, value, name) => {
			if (name === "attackRangeBase") {
				return "unchanged";
			}
			return name === "attackRange" ? value + 2 : value * 2;
		}),
		12
	);
	assert.equal(
		calculateAttackRange((player, value, name) => {
			return name === "attackRangeBase" ? 7 : value;
		}),
		7
	);
	const nanCalls = [];
	const undefinedBase = calculateAttackRange((...args) => {
		nanCalls.push(args);
		const [, value, name] = args;
		if (name === "attackRangeBase") {
			return undefined;
		}
		return name === "attackRange" ? value + 1 : value;
	});
	assert.deepEqual(
		nanCalls.map(args => args[2]),
		["attackRangeBase", "attackRange", "attackRangeFinal"]
	);
	assert.ok(Number.isNaN(undefinedBase), `undefined base should become NaN, received ${undefinedBase}`);
});

test("chooseToEnable and chooseToDisable require source only for an actual choice", async () => {
	const source = readSource("../content.ts");
	const get = {
		cnNumber: value => String(value),
		is: { mountCombined: () => false },
		select: value => value,
		translation: value => String(value),
	};
	const dependencies = { get, isSelectionResultObject: value => typeof value === "object" && value !== null };
	const chooseToEnable = loadMethod(source, "chooseToEnable", dependencies);
	const chooseToDisable = loadMethod(source, "chooseToDisable", dependencies);
	const automaticPlayer = {
		enableEquip: async () => {},
		disableEquip: async () => {},
		hasDisabledSlot: () => false,
		hasEnabledSlot: () => false,
		name: "player",
	};
	await chooseToEnable({ selectButton: [0, 0] }, null, automaticPlayer);
	await chooseToDisable({ selectButton: [0, 0] }, null, automaticPlayer);

	const choicePlayer = {
		...automaticPlayer,
		hasDisabledSlot: () => true,
		hasEnabledSlot: () => true,
	};
	await assert.rejects(() => chooseToEnable({ selectButton: [1, 1] }, null, choicePlayer), TypeError);
	await assert.rejects(() => chooseToDisable({ selectButton: [1, 1] }, null, choicePlayer), TypeError);
	choicePlayer.hasDisabledSlot = slot => slot === 1 || slot === 2;
	choicePlayer.hasEnabledSlot = slot => slot === 1 || slot === 2;
	await assert.rejects(() => chooseToEnable({}, null, choicePlayer), TypeError);
	await assert.rejects(() => chooseToDisable({}, null, choicePlayer), TypeError);

	const receivers = [];
	const next = {
		forResult: async () => ({ links: [] }),
		set() {
			return this;
		},
	};
	const sourcePlayer = {
		chooseButton() {
			receivers.push(this);
			return next;
		},
	};
	await chooseToEnable({ selectButton: [1, 1], source: sourcePlayer }, null, { ...choicePlayer, hasDisabledSlot: () => true });
	await chooseToDisable({ selectButton: [1, 1], source: sourcePlayer }, null, { ...choicePlayer, hasEnabledSlot: () => true });
	assert.deepEqual(receivers, [sourcePlayer, sourcePlayer]);
});
