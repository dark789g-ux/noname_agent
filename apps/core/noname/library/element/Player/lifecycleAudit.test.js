import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { gameEventTestSource } from "../GameEvent/testSource.js";

const playerText = readFileSync(new URL("../player.js", import.meta.url), "utf8");
const playerFile = ts.createSourceFile("player.js", playerText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
const gameEventFile = gameEventTestSource();
const gameEventText = gameEventFile.text;
const gameText = readFileSync(new URL("../../../game/index.js", import.meta.url), "utf8");
const gameFile = ts.createSourceFile("game/index.js", gameText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);

function findClassMethod(name) {
	for (const statement of playerFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Player") continue;
		const method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === name);
		assert.ok(method, `Player.${name} should exist`);
		return method;
	}
	assert.fail("Player should exist");
}

function findStatement(method, predicate) {
	let found;
	const visit = node => {
		if (!found && ts.isExpressionStatement(node) && predicate(node)) {
			found = node;
		}
		ts.forEachChild(node, visit);
	};
	visit(method);
	assert.ok(found, "expected lifecycle statement should exist");
	return found.getText(playerFile);
}

test("uninit lifecycle removes optional identity properties with native delete", () => {
	for (const [methodName, properties] of [["uninitOL", ["sex"]], ["uninit", ["skin", "sex", "group", "tempname"]]]) {
		const method = findClassMethod(methodName);
		const statements = properties.map(property => findStatement(method, node => ts.isDeleteExpression(node.expression) && node.expression.expression.getText(playerFile) === `this.${property}`));
		const clean = new Function(`"use strict"; ${statements.join("\n")}`);
		const player = { sex: "female", skin: { name: "sample" }, group: "wei", tempname: ["sample"], unrelated: true };
		clean.call(player);
		for (const property of properties) assert.equal(Object.hasOwn(player, property), false);
		assert.equal(player.unrelated, true);
		clean.call(player);
		player.sex = "male";
		clean.call(player);
		assert.equal(Object.hasOwn(player, "sex"), false);
	}
});

function compileFunction(name, parameters, body) {
	const javascript = ts.transpileModule(`function ${name}(${parameters}) { ${body} }`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(`${javascript}; return ${name};`)();
}

function findGameEventTriggeredProperty() {
	for (const statement of gameEventFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "GameEvent") continue;
		const property = statement.members.find(member => ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === "_triggered");
		assert.ok(property, "GameEvent._triggered should exist");
		return property;
	}
	assert.fail("GameEvent should exist");
}

function getLocalMarkCallbackText() {
	const method = findClassMethod("localMarkSkill");
	let declaration;
	const visit = node => {
		if (!declaration && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "func") {
			declaration = node.parent.parent;
		}
		ts.forEachChild(node, visit);
	};
	visit(method);
	assert.ok(declaration && ts.isVariableStatement(declaration), "localMarkSkill callback should exist");
	return declaration.getText(playerFile);
}

function findGameMethod(name) {
	for (const statement of gameFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Game") continue;
		const method = statement.members.find(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === name);
		assert.ok(method, `Game.${name} should exist`);
		return method;
	}
	assert.fail("Game should exist");
}

test("singleHp 和 avatar 按首次赋值创建，并由原生 delete 清理", () => {
	const init = findClassMethod("init");
	const uninit = findClassMethod("uninit");
	const initOL = findClassMethod("initOL");
	const uninitOL = findClassMethod("uninitOL");
	const setSingleHp = compileFunction("setSingleHp", "player, maxHp1, maxHp2", findStatement(init, statement => statement.getText(playerFile).includes("this.singleHp =")).replace("this.", "player."));
	const clearSingleHp = compileFunction(
		"clearSingleHp",
		"",
		findStatement(uninit, statement => statement.getText(playerFile) === "delete this.singleHp;")
	);
	const setAvatar = compileFunction("setAvatar", "player, character", findStatement(initOL, statement => statement.getText(playerFile) === "this.avatar = character;").replace("this.", "player."));
	const clearAvatar = compileFunction(
		"clearAvatar",
		"",
		findStatement(uninitOL, statement => statement.getText(playerFile) === "delete this.avatar;")
	);

	const player = {};
	setSingleHp(player, 4, 5);
	assert.equal(Object.hasOwn(player, "singleHp"), true);
	assert.equal(player.singleHp, true);
	clearSingleHp.call(player);
	assert.equal(Object.hasOwn(player, "singleHp"), false);

	setAvatar(player, "caocao");
	assert.equal(Object.hasOwn(player, "avatar"), true);
	assert.equal(player.avatar, "caocao");
	clearAvatar.call(player);
	assert.equal(Object.hasOwn(player, "avatar"), false);
});

test("伤害毒性分支删除 _triggered，而 GameEvent 保留构造期 null", () => {
	const damage = findClassMethod("damage");
	let poisonBranch;
	const visit = node => {
		if (!poisonBranch && ts.isIfStatement(node) && node.expression.getText(playerFile) === 'next.hasNature("poison")') {
			poisonBranch = node.thenStatement;
		}
		ts.forEachChild(node, visit);
	};
	visit(damage);
	assert.ok(poisonBranch, "damage poison branch should exist");
	const clearTriggered = compileFunction("clearTriggered", "next", poisonBranch.getText(playerFile));
	const damageEvent = { _triggered: 0 };
	clearTriggered(damageEvent);
	assert.equal(Object.hasOwn(damageEvent, "_triggered"), false);

	const property = findGameEventTriggeredProperty();
	assert.match(property.getText(gameEventFile), /number \| null \| undefined = null/);
	const javascript = ts.transpileModule(`class GameEventFixture { ${property.getText(gameEventFile)} }`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	const GameEventFixture = Function(`${javascript}; return GameEventFixture;`)();
	const event = new GameEventFixture();
	assert.equal(Object.hasOwn(event, "_triggered"), true);
	assert.equal(event._triggered, null);
});

test("Player 不为 singleHp 或 avatar 新增构造期 own 字段", () => {
	for (const statement of playerFile.statements) {
		if (!ts.isClassDeclaration(statement) || statement.name?.text !== "Player") continue;
		const fieldNames = statement.members.filter(ts.isPropertyDeclaration).map(field => (ts.isIdentifier(field.name) ? field.name.text : ""));
		assert.equal(fieldNames.includes("singleHp"), false);
		assert.equal(fieldNames.includes("avatar"), false);
	}
});

test("localMarkSkill 使用可序列化的 lib.getSkill 边界，并保留缺技能 return", () => {
	const callbackText = getLocalMarkCallbackText();
	assert.match(callbackText, /lib\.getSkill\(name\)/);
	assert.doesNotMatch(callbackText, /getRegisteredSkill/);
	const javascript = ts.transpileModule(callbackText, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	let receiver;
	const lib = {
		getSkill(name) {
			receiver = this;
			return name === "known" ? { intro: { content: "visible" } } : undefined;
		},
	};
	const callback = Function("lib", `${javascript}; return func;`)(lib);
	const player = {
		marks: {},
		mark(name, info) {
			return { name, info };
		},
		updateMarks() {},
	};
	callback("known", player);
	assert.equal(receiver, lib);
	assert.deepEqual(player.marks.known, { name: "known", info: { content: "visible" } });
	callback("missing", player);
	assert.equal(player.marks.missing, undefined);
});

test("updateWaiting 保留持有 playerid 的玩家的可缺省 avatar 传输", () => {
	const updateWaiting = findGameMethod("updateWaiting");
	let entryBranch;
	const visit = node => {
		if (!entryBranch && ts.isIfStatement(node) && node.expression.getText(gameFile) === 'typeof playerid === "string"') {
			entryBranch = node.thenStatement;
		}
		ts.forEachChild(node, visit);
	};
	visit(updateWaiting);
	assert.ok(entryBranch, "updateWaiting player branch should exist");
	const updateEntry = compileFunction("updateEntry", "player, playerid, game, _status, map, i", entryBranch.getText(gameFile));
	const sent = [];
	const game = {
		onlinezhu: null,
		send(...args) {
			sent.push(args);
		},
	};
	const status = {};
	const map = [];
	updateEntry({ nickname: "host", avatar: "caocao" }, "1", game, status, map, 0);
	assert.deepEqual(map[0], ["host", "caocao", "1", "zhu"]);
	assert.deepEqual(sent, [["server", "changeAvatar", "host", "caocao"]]);

	const uninitializedMap = [];
	updateEntry({ nickname: "uninitialized" }, "2", { ...game, onlinezhu: "1" }, status, uninitializedMap, 0);
	assert.deepEqual(uninitializedMap[0], ["uninitialized", undefined, "2"]);
	const wireMap = JSON.parse(JSON.stringify(uninitializedMap));
	assert.deepEqual(wireMap[0], ["uninitialized", null, "2"]);
	const initOL = findClassMethod("initOL");
	assert.ok(initOL.body, "Player.initOL should have a body");
	const runInitOL = compileFunction("runInitOL", "name, character, get, lib", initOL.body.getText(playerFile));
	let background;
	const remotePlayer = {
		node: {
			avatar: {
				setBackground(value) {
					background = value;
				},
				show() {},
			},
			name: {},
			nameol: {},
		},
	};
	runInitOL.call(remotePlayer, wireMap[0][0], wireMap[0][1], { verticalStr: value => value }, { character: {} });
	assert.equal(background, null);
	assert.equal(remotePlayer.avatar, null);

	const namelessMap = [];
	updateEntry({}, "3", { ...game, onlinezhu: "1" }, status, namelessMap, 0);
	const namelessWireMap = JSON.parse(JSON.stringify(namelessMap));
	assert.deepEqual(namelessWireMap[0], [null, null, "3"]);
	let verticalName;
	const namelessPlayer = {
		node: {
			avatar: { setBackground() {}, show() {} },
			name: {},
			nameol: {},
		},
	};
	runInitOL.call(namelessPlayer, namelessWireMap[0][0], namelessWireMap[0][1], { verticalStr: value => (verticalName = value) }, { character: {} });
	assert.equal(verticalName, null);
	assert.equal(namelessPlayer.nickname, null);
});
