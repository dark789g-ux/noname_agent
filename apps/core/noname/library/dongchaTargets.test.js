import { builtinSkillTestSource } from "./builtinSkills/testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = builtinSkillTestSource();
const declaration = source.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(source) === "builtinSkills"));
const builtinSkills = declaration?.declarationList.declarations.find(item => item.name.getText(source) === "builtinSkills")?.initializer;

function property(object, name) {
	assert.ok(object && ts.isObjectLiteralExpression(object));
	const member = object.properties.find(item => (ts.isPropertyAssignment(item) || ts.isMethodDeclaration(item)) && item.name?.getText(source) === name);
	assert.ok(member);
	return member;
}

function builtinSkillMethod(skillName, name, dependencies) {
	const skill = property(builtinSkills, skillName);
	assert.ok(ts.isPropertyAssignment(skill) && ts.isObjectLiteralExpression(skill.initializer));
	const method = property(skill.initializer, name);
	assert.ok(ts.isMethodDeclaration(method));
	return new Function(...Object.keys(dependencies), `"use strict"; return ({ ${method.getText(source)} }).${name};`)(...Object.values(dependencies));
}

test("dongcha cost requires its skill before it creates a choice and rereads the current player in each AI evaluation", async () => {
	let choices = 0;
	const cost = builtinSkillMethod("dongcha", "cost", {
		get: {
			prompt(skill) {
				return `prompt:${skill}`;
			},
			player() {
				return players.shift();
			},
			effect(...args) {
				effects.push(args);
				return 1;
			},
		},
	});
	const playerOne = { name: "first" };
	const playerTwo = { name: "second" };
	const players = [playerOne, playerTwo];
	const effects = [];
	let evaluate;
	const player = {
		chooseTarget(option) {
			choices++;
			assert.equal(option.prompt, "prompt:dongcha");
			return {
				set(name, callback) {
					assert.equal(name, "ai");
					evaluate = callback;
					return this;
				},
				async forResult() {
					return { bool: false };
				},
			};
		},
	};

	await assert.rejects(() => cost({}, undefined, player), TypeError);
	assert.equal(choices, 0);

	const event = { skill: "dongcha" };
	await cost(event, undefined, player);
	assert.equal(choices, 1);
	const target = { name: "target" };
	evaluate(target);
	evaluate(target);
	assert.deepEqual(
		effects.map(([effectTarget, card, source, viewer]) => [effectTarget, card.name, card.position, source, viewer]),
		[
			[target, "guohe_copy", "ej", playerOne, playerOne],
			[target, "guohe_copy", "ej", playerTwo, playerTwo],
		]
	);
});

test("dongcha content reads its target list once, retains that target across the delay, and fails before side effects without targets", async () => {
	const steps = [];
	const content = builtinSkillMethod("dongcha", "content", {
		game: {
			async delayx() {
				steps.push("delay");
			},
		},
	});
	const target = {
		addExpose(value) {
			steps.push(["expose", value]);
		},
	};
	const replacement = { addExpose() { throw new Error("content reread targets"); } };
	let targetReads = 0;
	const event = {
		get targets() {
			targetReads++;
			return targetReads === 1 ? [target] : [replacement];
		},
	};
	const player = {
		async discardPlayerCard(option) {
			steps.push(["discard", option]);
		},
	};

	await content(event, undefined, player);
	assert.equal(targetReads, 1);
	assert.deepEqual(steps, [["expose", 0.1], "delay", ["discard", { position: "ej", forced: true, target }]]);

	steps.length = 0;
	await assert.rejects(() => content({}, undefined, player), TypeError);
	assert.deepEqual(steps, []);
});

test("identity_mingcha content keeps its initially selected target through the delay and fails before side effects when absent", async () => {
	const steps = [];
	const content = builtinSkillMethod("identity_mingcha", "content", {
		game: {
			async delayx() {
				steps.push("delay");
			},
			broadcastAll() {
				throw new Error("identity reveal should not broadcast for a non-fan target");
			},
			log() {
				throw new Error("identity reveal should not log for a non-fan target");
			},
		},
		lib: { status: { videoId: 0 }, message: { client: { closeDialog() {} } } },
		get: { translation(value) { return String(value); } },
		ui: { create: { dialog() {}, spinningIdentityCard() {} } },
	});
	const target = {
		identity: "zhong",
		addExpose(value) {
			steps.push(["expose", value]);
		},
	};
	const replacement = { addExpose() { throw new Error("content reread targets"); } };
	let targetReads = 0;
	const event = {
		get targets() {
			targetReads++;
			return targetReads === 1 ? [target] : [replacement];
		},
	};

	await content(event, undefined, {});
	assert.equal(targetReads, 1);
	assert.deepEqual(steps, [["expose", 0.15], "delay"]);

	steps.length = 0;
	await assert.rejects(() => content({}, undefined, {}), TypeError);
	assert.deepEqual(steps, []);
});
