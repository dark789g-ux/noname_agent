import { builtinSkillTestSource } from "../../builtinSkills/testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function readSource(path) {
	const text = readFileSync(new URL(path, import.meta.url), "utf8");
	return ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
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
	const javascript = ts.transpileModule(`function ${name}(${parameters}) ${method.body.getText(sourceFile)}`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(...Object.keys(dependencies), `${javascript}; return ${name};`)(...Object.values(dependencies));
}

function loadArrow(sourceFile, marker, dependencies) {
	let result;
	const visit = node => {
		if (ts.isArrowFunction(node) && node.getText(sourceFile).includes(marker)) {
			result ??= node;
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	assert.ok(result, `${marker} callback should exist`);
	const javascript = ts.transpileModule(`const callback = ${result.getText(sourceFile)};`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(...Object.keys(dependencies), `${javascript}; return callback;`)(...Object.values(dependencies));
}

test("chess producers retain the declared placeChess and draw2 contracts", () => {
	const chess = readSource("../../../../mode/chess.js");
	const ui = { chesswidth: 8 };
	const placeChess = loadMethod(chess, "placeChess", { ui });
	const player = { dataset: {}, style: {} };
	placeChess(player, "9");
	assert.equal(player.dataset.position, "9");
	assert.deepEqual(player._chesstransform, [148, 148]);
	assert.equal(player.style.transform, "translate(148px,148px)");

	const updates = [];
	const game = {
		update(callback) {
			updates.push(callback);
		},
	};
	const lib = { canvasUpdates2: [], status: {} };
	const draw2 = loadMethod(chess, "draw2", { lib, game });
	const first = () => false;
	const second = () => false;
	draw2(first);
	draw2(second);
	assert.deepEqual(lib.canvasUpdates2, [first, second]);
	assert.equal(lib.status.canvas2, true);
	assert.equal(updates.length, 1);
});

test("queue and chess lines require capabilities in their existing chess branches", () => {
	const playerSource = readSource("../player.js");
	const calls = [];
	const ui = {
		placeChess(player, position) {
			calls.push([this, player, position]);
		},
		me: { removeAttribute() {} },
	};
	const game = { chess: true, me: null };
	const queue = loadMethod(playerSource, "queue", {
		ui,
		game,
		clearTimeout() {},
		setTimeout(callback) {
			callback();
			return 1;
		},
	});
	const player = { queueCount: 0, style: {}, node: { avatar: { style: {} }, avatar2: { style: {} } }, dataset: { position: "5" } };
	queue.call(player, 1);
	assert.deepEqual(calls, [[ui, player, "5"]]);
	assert.throws(
		() =>
			loadMethod(playerSource, "queue", {
				ui: { me: ui.me },
				game,
				clearTimeout() {},
				setTimeout(callback) {
					callback();
					return 1;
				},
			}).call(player, 1),
		TypeError
	);

	const gameSource = readSource("../../../game/index.js");
	const drawCalls = [];
	const lineGame = {
		chess: true,
		draw2(callback) {
			drawCalls.push([this, callback]);
		},
		draw() {},
	};
	const linexy = loadMethod(gameSource, "_linexy", { game: lineGame, lib: { config: { duration: 1 }, lineColor: new Map() }, ui: { arena: { offsetWidth: 1, offsetHeight: 1 } } });
	linexy([0, 0, 1, 1], 0, true);
	assert.equal(drawCalls.length, 1);
	assert.equal(drawCalls[0][0], lineGame);
	assert.throws(() => loadMethod(gameSource, "_linexy", { game: { chess: true, draw() {} }, lib: { config: { duration: 1 }, lineColor: new Map() }, ui: { arena: { offsetWidth: 1, offsetHeight: 1 } } })([0, 0, 1, 1], 0, true), TypeError);
});

test("attitude and stone recasting preserve capability receivers and failures", () => {
	const getSource = readSource("../../../get/index.js");
	const receiver = {};
	const seen = [];
	const rawAttitude = function (from, to, extraPlayer) {
		seen.push([this, from, to, extraPlayer, arguments.length]);
		return 4;
	};
	const attitude = loadMethod(getSource, "attitude", { CacheContext: { requireCacheContext: () => ({ get: { rawAttitude } }) }, _status: { tempnofake: true } });
	const actualFrom = { isMad: () => false };
	const from = { _trueMe: actualFrom, isMad: () => false };
	const to = { isMad: () => false };
	assert.equal(attitude.call(receiver, from, to), 4);
	assert.deepEqual(seen, [[receiver, actualFrom, to, undefined, 2]]);
	const extraPlayer = { isMad: () => false };
	assert.equal(attitude.call(receiver, from, to, extraPlayer), 4);
	assert.deepEqual(seen[1], [receiver, actualFrom, to, extraPlayer, 3]);
	const unavailableAttitude = loadMethod(getSource, "attitude", { CacheContext: { requireCacheContext: () => ({ get: {} }) }, _status: { tempnofake: true } });
	assert.throws(() => unavailableAttitude.call(receiver, from, to), TypeError);

	const skillSource = builtinSkillTestSource();
	const stoneCalls = [];
	const stoneGet = {
		type: () => "stonecard",
		stonecard(type, career) {
			stoneCalls.push([this, type, career]);
			return [];
		},
		subtype: () => "",
	};
	const callback = loadArrow(skillSource, "Stone deck mode requires get.stonecard", {
		lib: { config: { mode: "stone" } },
		_status: { mode: "deck" },
		get: stoneGet,
		game: {},
	});
	callback({ isMin: () => false, career: "mage", draw: () => ({}) }, [{}]);
	assert.deepEqual(stoneCalls, [[stoneGet, 1, "mage"]]);
	const missingStonecard = loadArrow(skillSource, "Stone deck mode requires get.stonecard", { lib: { config: { mode: "stone" } }, _status: { mode: "deck" }, get: { type: () => "stonecard" }, game: {} });
	assert.throws(() => missingStonecard({ isMin: () => false }, [{}]), TypeError);
});
