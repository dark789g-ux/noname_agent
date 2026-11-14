import { contentTestSource } from "../../../llm/testing/content-runtime.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { playerTestSource } from "../Player/testSource.js";

const realContentSource = await contentTestSource();

const source = playerTestSource();
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Player");
const methods = ["draw", "chooseUseTarget"].map(name => {
	const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === name);
	assert.ok(method, name);
	return method.getText(source);
});

function harness() {
	const events = [];
	const game = {
		players: [{ id: "target" }],
		createEvent(name) {
			const event = {
				name,
				setContent(content) {
					this.content = content;
				},
			};
			events.push(event);
			return event;
		},
	};
	const get = {
		itemtype: () => undefined,
		is: { object: value => value !== null && typeof value === "object" && !Array.isArray(value) },
	};
	const player = new (new Function("game", "get", "lib", "_status", `return class Player { ${methods.join("\n")} }`)(game, get, { config: {}, card: {} }, { event: {} }))();
	return { player, game, events };
}

test("draw copies configuration before rereading and deleting nodelay", () => {
	const { player } = harness();
	let reads = 0;
	const params = {
		get nodelay() {
			reads++;
			return reads === 1 ? false : true;
		},
	};
	const event = player.draw(params);
	assert.equal(reads, 2);
	assert.equal(Object.hasOwn(event, "nodelay"), false);
	assert.equal(event.animate, false);
	assert.equal(event.$draw, true);
	assert.equal(event.content, "draw");
	assert.equal(Object.hasOwn(params, "nodelay"), true);
});

test("draw preserves explicit false and leaves an absent nodelay absent", () => {
	const { player } = harness();
	const explicit = player.draw({ nodelay: false });
	assert.equal(Object.hasOwn(explicit, "nodelay"), true);
	assert.equal(explicit.nodelay, false);
	assert.equal(Object.hasOwn(explicit, "animate"), false);
	assert.equal(Object.hasOwn(player.draw(2), "nodelay"), false);
});

test("chooseUseTarget writes nodelayx only for the actual legacy option", () => {
	const { player, game } = harness();
	const absent = player.chooseUseTarget();
	assert.equal(Object.hasOwn(absent, "nodelayx"), false);
	const event = player.chooseUseTarget("nodelayx");
	assert.equal(event.nodelayx, true);
	assert.equal(event.content, "chooseUseTarget");
	assert.deepEqual(event._args, ["nodelayx"]);
	assert.deepEqual(event.targets, game.players);
	assert.notEqual(event.targets, game.players);
});

const contentSource = realContentSource;
const contentDeclaration = contentSource.statements.flatMap(node => (ts.isVariableStatement(node) ? Array.from(node.declarationList.declarations) : [])).find(node => node.name.getText(contentSource) === "Content");
function contentSteps(name) {
	const property = contentDeclaration.initializer.properties.find(node => node.name.getText(contentSource) === name);
	assert.ok(ts.isArrayLiteralExpression(property.initializer), name);
	return property.initializer.elements;
}
function callback(node, sourceFile, globals) {
	const javascript = ts.transpileModule(`const callback = ${node.getText(sourceFile)};`, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
	return new Function(...Object.keys(globals), `${javascript}; return callback;`)(...Object.values(globals));
}

test("chooseUseTarget content propagates nodelayx to the awaited useCard child", async () => {
	const step = contentSteps("chooseUseTarget").find(node => node.getText(contentSource).includes("next.delayx = false"));
	const calls = [];
	const child = {
		then(resolve) {
			calls.push(["await", this.delayx]);
			resolve();
		},
	};
	const player = { useCard: (...args) => (calls.push(["useCard", ...args]), child) };
	const run = callback(step, contentSource, {});
	const { player: producer } = harness();
	const event = producer.chooseUseTarget("nodelayx", "nopopup", "nothrow", "noTargetDelay");
	event.card = { name: "sha" };
	const targets = event.targets;
	await run(event, undefined, player, { bool: true, targets });
	assert.equal(child.delayx, false);
	assert.equal(child.nopopup, true);
	assert.equal(child.throw, false);
	assert.equal(child.targetDelay, false);
	assert.equal(calls[0][1], event.card);
	assert.equal(calls[0][2], targets);
	assert.deepEqual(calls[1], ["await", false]);
});

test("useCard rereads delayx after the actual shan child changes its parent across await", async () => {
	const cardSource = ts.createSourceFile("standard.js", readFileSync(new URL("../../../../card/standard.js", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	let shan;
	function find(node) {
		if (ts.isPropertyAssignment(node) && node.name.getText(cardSource) === "shan" && ts.isObjectLiteralExpression(node.initializer)) shan = node.initializer.properties.find(property => property.name.getText(cardSource) === "content");
		ts.forEachChild(node, find);
	}
	find(cardSource);
	assert.ok(shan);
	const sequence = [];
	let finalDelays = 0;
	const game = {
		delay: async () => {
			sequence.push("shan-await");
			await Promise.resolve();
		},
		delayx: () => finalDelays++,
	};
	const shanRun = new Function("game", `return ({ ${shan.getText(cardSource)} }).content;`)(game);
	const info = { notarget: true, content: shanRun };
	const globals = { game, get: { info: () => info }, document: { getElementsByClassName: () => [{}] } };
	const steps = contentSteps("useCard");
	const execute = callback(
		steps.find(node => node.getText(contentSource).includes("event._result = await next.forResult()")),
		contentSource,
		globals
	);
	const final = callback(
		steps.find(node => node.getText(contentSource).includes("event.effectedCount < event.effectCount") && node.getText(contentSource).includes("event.delayx")),
		contentSource,
		globals
	);
	let value = true,
		reads = 0;
	const event = {
		card: { name: "shan" },
		cards: [],
		num: 0,
		customArgs: { default: {} },
		effectedCount: 0,
		effectCount: 1,
		getTargets: () => [],
		goto: () => sequence.push("goto"),
		get delayx() {
			reads++;
			return value;
		},
		set delayx(next) {
			value = next;
			sequence.push(["write", next]);
		},
	};
	game.createEvent = () => ({
		setContent(content) {
			this.content = content;
		},
		getParent: () => event,
		async forResult() {
			await Promise.resolve();
			await this.content(this);
			return this.result;
		},
	});
	await execute(event, undefined, {});
	assert.equal(event._result, "shaned");
	assert.equal(reads, 0);
	await final(event, undefined, {});
	assert.equal(reads, 1);
	assert.equal(finalDelays, 0);
	assert.deepEqual(sequence, [["write", false], "shan-await", "goto"]);
	value = undefined;
	await final(event, undefined, {});
	assert.equal(finalDelays, 1);
});

test("useCard evaluates the card's postAi callback once and stores only its deferred boolean flag", async () => {
	const method = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === "useCard");
	const producer = method.body.statements.find(node => ts.isIfStatement(node) && node.getText(source).includes("postAi = get.info(next.card).postAi"));
	assert.ok(producer);
	let callbacks = 0,
		reads = 0;
	const targets = [],
		card = { name: "sha" };
	const logs = [];
	const player = {
		hasSkillTag: () => false,
		logAi(...args) {
			logs.push([this, ...args]);
		},
	};
	const get = {
		info() {
			reads++;
			return {
				postAi(received) {
					callbacks++;
					assert.equal(this, undefined);
					assert.equal(received, targets);
					return true;
				},
			};
		},
	};
	const produce = new Function("get", "next", `"use strict"; ${producer.getText(source)}`);
	const event = { card, targets };
	produce.call(player, get, event);
	assert.equal(event.postAi, true);
	assert.equal(callbacks, 1);
	assert.equal(reads, 2);
	assert.equal(logs.length, 0);
	const noai = { card, targets, noai: true };
	produce.call(player, get, noai);
	assert.equal(Object.hasOwn(noai, "postAi"), false);
	assert.equal(callbacks, 1);
	const finalStep = contentSteps("useCard").find(node => node.getText(contentSource).includes("if (event.postAi)"));
	const final = callback(finalStep, contentSource, { document: { getElementsByClassName: () => [] } });
	event.getTargets = () => targets;
	event.getPlayer = () => player;
	event.finish = () => {};
	await Promise.resolve();
	player.logAi = function (...args) {
		logs.push(["replacement", this, ...args]);
	};
	await final(event, undefined, player);
	assert.deepEqual(logs, [["replacement", player, targets, card]]);
});
