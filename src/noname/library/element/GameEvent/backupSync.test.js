import { contentTestSource } from "../../../llm/testing/content-runtime.mjs";
import { gameEventTestSource } from "./testSource.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const realContentSource = await contentTestSource();

const source = realContentSource;
const gameEventSource = gameEventTestSource();
const callbacks = [];
function collect(node) {
	if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "broadcast") {
		const callback = node.arguments[0];
		if (callback && ts.isArrowFunction(callback) && callback.getText(source).includes("A backup skill must not be an array")) {
			callbacks.push(callback.getText(source));
		}
	}
	ts.forEachChild(node, collect);
}
collect(source);

test("both backup broadcasts execute without module closures and preserve registration order", () => {
	assert.equal(callbacks.length, 2);
	for (const text of callbacks) {
		const target = {};
		const skill = new Proxy(target, {
			set(target, key, value) {
				if (typeof key === "string" && typeof value === "object") value.skill_id ??= key;
				return Reflect.set(target, key, value);
			},
		});
		// Simulate the remote side, where only engine globals and parameters exist.
		const callback = new Function("lib", `return (${text});`)({ skill });
		callback("example_backup", "audio-path");
		assert.deepEqual(Object.keys(target.example_backup), ["skill_id", "audio"]);
		const original = target.example_backup;
		callback("example_backup", false);
		assert.equal(target.example_backup, original);
		assert.equal(original.audio, false);
		target.invalid_backup = [];
		assert.throws(() => callback("invalid_backup", true), TypeError);
	}
});

function getGameEventMethod(name) {
	let method;
	const visit = node => {
		if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
			method = node;
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(gameEventSource);
	if (method === undefined) {
		throw new Error(`Missing GameEvent.${name}`);
	}
	return method;
}

function transpile(source) {
	return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
}

function createTriggerBuilder() {
	const trigger = getGameEventMethod("trigger");
	const loop = trigger.body.statements.find(ts.isDoStatement);
	if (loop === undefined || !ts.isBlock(loop.statement)) {
		throw new Error("Missing trigger player todo builder");
	}
	const start = loop.statement.statements.findIndex(statement => statement.getText(gameEventSource).startsWith("const doing"));
	const end = loop.statement.statements.findIndex(statement => statement.getText(gameEventSource).includes("doingList.push(doing)"));
	if (start < 0 || end < start) {
		throw new Error("Missing trigger player todo builder bounds");
	}
	const body = loop.statement.statements
		.slice(start, end + 1)
		.map(statement => statement.getText(gameEventSource))
		.join("\n");
	return new Function("player", "firstDo", "lastDo", "playerMap", "event", "name", "roles", "lib", "requireRegisteredSkill", "get", `let allbool = false; const doingList = []; ${transpile(body)} return { allbool, doingList };`);
}

test("trigger todo builder keeps recursive deduplication and does not expose temporary state", () => {
	const player = {
		playerid: "player",
		skills: [],
		additionalSkills: {},
		tempSkills: {},
		removeSkill() {},
	};
	const firstDo = { player: "firstDo", todoList: [], doneList: [] };
	const lastDo = { player: "lastDo", todoList: [], doneList: [] };
	const alpha = {
		getIndex() {
			assert.equal(this, alpha);
			return ["first", "second"];
		},
	};
	const skills = new Map([
		["alpha", alpha],
		["beta", {}],
	]);
	const builder = createTriggerBuilder();
	const result = builder(player, firstDo, lastDo, [player], {}, "test", ["player", "global"], { hook: { globalskill: { player_test: ["alpha", ["alpha", "beta"]] } } }, (_registry, skill) => skills.get(skill), { priority: skill => (skill === "beta" ? 2 : 1) });

	assert.equal(result.allbool, true);
	assert.equal(result.doingList.length, 1);
	assert.deepEqual(
		result.doingList[0].todoList.map(item => [item.skill, item.indexedData]),
		[
			["beta", undefined],
			["alpha", "first"],
			["alpha", "second"],
		]
	);
	assert.deepEqual(Object.keys(result.doingList[0]), ["player", "todoList", "doneList"]);
});

test("GameEvent skill is initially present, restored from backup, then removed", () => {
	const classNode = gameEventSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GameEvent");
	if (classNode === undefined) {
		throw new Error("Missing GameEvent class");
	}
	const classText = classNode.getText(gameEventSource).replace("export class", "class");
	const GameEvent = new Function("get", "_status", "game", `${transpile(classText)}; return GameEvent;`)({ info: () => ({}) }, { eventManager: {} }, { online: true, globalEventHandlers: { addHandlerToEvent() {} } });
	const event = new GameEvent("choose", false, {});

	assert.equal(Object.hasOwn(event, "skill"), true);
	assert.equal(event.skill, undefined);
	event.backup("backup_skill");
	assert.equal(event.skill, "backup_skill");
	event.restore();
	assert.equal(Object.hasOwn(event, "skill"), false);
});

test("backup restores selection state identities and removes only fields that were absent", () => {
	const classNode = gameEventSource.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "GameEvent");
	if (classNode === undefined) {
		throw new Error("Missing GameEvent class");
	}
	const classText = classNode.getText(gameEventSource).replace("export class", "class");
	const GameEvent = new Function("get", "_status", "game", `${transpile(classText)}; return GameEvent;`)({ info: () => ({}) }, { eventManager: {} }, { online: true, globalEventHandlers: { addHandlerToEvent() {} } });
	const event = new GameEvent("choose", false, {});
	const filterButton = () => true;
	const filterCard = () => true;
	const filterOk = () => true;
	const buttonChoice = { source: "extension" };
	const cardChoice = ["card"];
	const targetChoice = { target: 1 };
	const skillChoice = ["skill"];
	const excluded = ["skill"];
	event.filterButton = filterButton;
	event.filterCard = filterCard;
	event.filterOk = filterOk;
	event.selectButton = [1, 2];
	event.selectCard = [0, 1];
	event.forced = true;
	event._aiexclude = excluded;
	event._buttonChoice = buttonChoice;
	event._cardChoice = cardChoice;
	event._targetChoice = targetChoice;
	event._skillChoice = skillChoice;
	event.backup();
	event.filterButton = () => false;
	event.filterCard = () => false;
	event.filterOk = () => false;
	event.selectButton = 0;
	event.selectCard = 0;
	event.forced = false;
	event._aiexclude = [];
	event._buttonChoice = { source: "replacement" };
	event._cardChoice = [];
	event._targetChoice = { target: 2 };
	event._skillChoice = ["replacement"];
	event.selectionSpec = true;
	event.restore();
	assert.equal(event.filterButton, filterButton);
	assert.equal(event.filterCard, filterCard);
	assert.equal(event.filterOk, filterOk);
	assert.deepEqual(event.selectButton, [1, 2]);
	assert.deepEqual(event.selectCard, [0, 1]);
	assert.equal(event.forced, true);
	assert.equal(event._aiexclude, excluded);
	assert.equal(event._buttonChoice, buttonChoice);
	assert.equal(event._cardChoice, cardChoice);
	assert.equal(event._targetChoice, targetChoice);
	assert.equal(event._skillChoice, skillChoice);
	assert.equal(Object.hasOwn(event, "selectionSpec"), false);
});

function getContentMethod(name) {
	let method;
	const visit = node => {
		if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
			method = node;
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	if (method === undefined) {
		throw new Error(`Missing Content.${name}`);
	}
	return method;
}

function createTriggerRunner() {
	const method = getContentMethod("createTrigger");
	const functionText = method.getText(source).replace("async createTrigger", "async function createTrigger");
	return new Function("game", "get", "lib", "requireRegisteredSkill", "normalizeSelectionResult", `return ${transpile(functionText)}`);
}

function createTriggerFixture(nextSkill) {
	const created = [];
	const logged = [];
	const removed = [];
	const broadcasts = [];
	let costCalls = 0;
	let contentCalls = 0;
	const event = {
		skill: "skill_a",
		triggername: "useCard",
		uncheckHasSkill: true,
		isMine() {
			return false;
		},
	};
	const player = {
		hiddenSkills: [],
		invisibleSkills: [],
		additionalSkills: {},
		getSkills() {
			return [];
		},
		hasSkillTag() {
			return false;
		},
		isUnderControl() {
			return false;
		},
		logSkill(skill) {
			logged.push(skill);
		},
		removeSkill(skill) {
			removed.push(skill);
		},
	};
	const skillA = {
		popup: true,
		async cost(costEvent) {
			costCalls++;
			costEvent.parent.skill = nextSkill;
		},
		async content() {
			contentCalls++;
		},
	};
	const skills = new Map([
		["skill_a", skillA],
		["player_when_b", {}],
	]);
	const lib = { skill: { global: [], player_when_b: {} }, dynamicTranslate: {}, translate: {} };
	const game = {
		expandSkills(skills) {
			return skills;
		},
		createEvent(name) {
			const next = {
				name,
				parent: event,
				set() {},
				setContent(content) {
					this.content = content;
				},
				async forResult() {
					await this.content(this, {}, player);
					return { bool: true };
				},
				then(resolve, reject) {
					Promise.resolve(this.content(this, {}, player)).then(resolve, reject);
				},
			};
			created.push(next);
			return next;
		},
		broadcastAll(callback, skill) {
			broadcasts.push(skill);
			callback(skill);
		},
	};
	const get = {
		info(skill) {
			return skills.get(skill);
		},
		is: {
			locked() {
				return false;
			},
		},
		prompt() {
			return "";
		},
	};
	return { event, player, game, get, lib, created, logged, removed, broadcasts, getCostCalls: () => costCalls, getContentCalls: () => contentCalls };
}

test("createTrigger rereads a changed skill after awaited cost while retaining the original skill callbacks", async () => {
	const fixture = createTriggerFixture("player_when_b");
	const createTrigger = createTriggerRunner()(
		fixture.game,
		fixture.get,
		fixture.lib,
		(_registry, skill) => fixture.get.info(skill),
		value => value
	);

	await createTrigger(fixture.event, {}, fixture.player);

	assert.equal(fixture.getCostCalls(), 1);
	assert.equal(fixture.getContentCalls(), 1);
	assert.deepEqual(
		fixture.created.map(event => event.name),
		["skill_a_cost", "player_when_b"]
	);
	assert.equal(fixture.logged[0], "player_when_b");
	assert.deepEqual(fixture.removed, ["player_when_b"]);
	assert.deepEqual(fixture.broadcasts, ["player_when_b"]);
});

test("createTrigger rejects a missing skill when it is reread after awaited cost", async () => {
	const fixture = createTriggerFixture(undefined);
	const createTrigger = createTriggerRunner()(
		fixture.game,
		fixture.get,
		fixture.lib,
		(_registry, skill) => fixture.get.info(skill),
		value => value
	);

	await assert.rejects(createTrigger(fixture.event, {}, fixture.player), /createTrigger requires an event skill/);
	assert.equal(fixture.getCostCalls(), 1);
	assert.equal(fixture.logged.length, 0);
	assert.deepEqual(
		fixture.created.map(event => event.name),
		["skill_a_cost"]
	);
});
