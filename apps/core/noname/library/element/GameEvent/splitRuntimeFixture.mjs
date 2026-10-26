import assert from "node:assert/strict";
import console from "node:console";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout, clearTimeout } from "node:timers";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const directory = dirname(fileURLToPath(import.meta.url));
const context = createContext({ console, Promise, setTimeout, clearTimeout });
const modules = new Map();
const registrations = [],
	history = [],
	announcements = [];
const lib = {
	config: {},
	phaseName: [],
	hookmap: {},
	announce: {
		publish(...args) {
			announcements.push(args);
		},
	},
};
const game = {
	online: false,
	players: [],
	globalEventHandlers: {
		addHandlerToEvent(event) {
			registrations.push(event);
		},
	},
	getGlobalHistory: () => history,
};
const _status = { pauseManager: { async waitPause() {} } };
const get = { paramToCacheKey: (...args) => JSON.stringify(args) };
class Player {}
class Card {}
class Button {}
class ContentCompiler {
	static compile(content) {
		if (content.compiled) return content;
		const callbacks = Array.isArray(content) ? content : [content];
		return Object.assign(
			async event => {
				for (const callback of callbacks) await callback(event, event._trigger, event.player, event._result);
			},
			{ compiled: true, type: "fixture", original: content }
		);
	}
}
function synthetic(identifier, exports) {
	const module = new SyntheticModule(
		Object.keys(exports),
		function () {
			for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
		},
		{ context, identifier }
	);
	modules.set(identifier, module);
	return module;
}
synthetic("noname", { lib, game, get, _status, ui: {} });
synthetic(resolve(directory, "../index.js"), { Player, Card, Button });
synthetic(resolve(directory, "compilers/ContentCompiler.ts"), { default: ContentCompiler });
function sourceModule(path) {
	if (modules.has(path)) return modules.get(path);
	const code = ts.transpileModule(readFileSync(path, "utf8"), {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
	}).outputText;
	const module = new SourceTextModule(code, { context, identifier: path });
	modules.set(path, module);
	return module;
}
const entry = sourceModule(resolve(directory, "../gameEvent.ts"));
await entry.link((specifier, parent) => {
	if (specifier === "noname") return modules.get(specifier);
	let path = resolve(dirname(parent.identifier), specifier);
	if (path.endsWith(".js") && !modules.has(path)) path = path.slice(0, -3) + ".ts";
	return sourceModule(path);
});
await entry.evaluate();
const { GameEvent, GameEventManager, initializeEvent } = entry.namespace;
_status.eventManager = new GameEventManager();

const defaultEvent = new GameEvent();
assert.equal(GameEvent.name, "GameEvent");
assert.equal(defaultEvent instanceof GameEvent, true);
assert.equal(Object.getPrototypeOf(defaultEvent), GameEvent.prototype);
assert.equal(GameEvent.prototype.constructor, GameEvent);
assert.equal(Object.getPrototypeOf(GameEvent.prototype).constructor.name, "Object");
assert.equal(Object.prototype.toString.call(defaultEvent), "[object GameEvent]");
assert.equal(registrations[0], defaultEvent);
const prototypeNames = ["constructor", "set", "setRaw", "setContent", "then", "catch", "finally", "forResult", "getParent", "insert", "insertAfter", "getTrigger", "resolve", "start", "loop", "checkSkipped", "waitNext", "addTrigger", "removeTrigger", "trigger", "untrigger", "finish", "cancel", "neutralize", "unneutralize", "step", "updateStep", "goto", "redo", "backup", "restore", "getPlayer", "getPlayers", "getTarget", "getTargets", "changeToZero", "setHiddenSkill", "getLogv", "send", "sendAsync", "getRand", "isMine", "isOnline", "notLink", "isPhaseUsing", "callHandler", "getDefaultHandlerType", "getDefaultNextHandlerType", "getHandler", "hasHandler", "pushHandler", "pushHandlersFrom", "putStepCache", "getStepCache", "clearStepCache", "callFuncUseStepCache", "putTempCache", "getTempCache", "resume"];
assert.deepEqual(Object.getOwnPropertyNames(GameEvent.prototype), prototypeNames);
assert.deepEqual(Object.getOwnPropertySymbols(GameEvent.prototype), [Symbol.toStringTag]);
for (const key of prototypeNames) {
	const descriptor = Object.getOwnPropertyDescriptor(GameEvent.prototype, key);
	assert.equal(descriptor.enumerable, false, key);
	assert.equal(descriptor.configurable, true, key);
	if (key !== "step") assert.equal(descriptor.writable, true, key);
}
for (const name of ["addCount", "direct", "visible", "nojudge", "updatePile", "waitingForTransition", "discardTransition", "cardChooseAll", "forceDirect", "_direct", "nodistance", "noai", "nowuxie", "prompt2", "centerprompt2", "chooseonly", "nouse", "norestore", "filterCard", "_backup", "ai1"]) {
	assert.equal(Object.hasOwn(defaultEvent, name), false, name);
}
for (const name of ["forceDie", "includeOut"]) {
	assert.equal(Object.hasOwn(defaultEvent, name), true, name);
	assert.equal(defaultEvent[name], undefined, name);
}
assert.throws(() => Reflect.construct(defaultEvent.finish, []), /not a constructor/);
assert.equal(defaultEvent.putTempCache.length, 3);
assert.equal(defaultEvent.getPlayer.length, 0);
assert.equal(defaultEvent.untrigger.length, 0);
assert.equal(defaultEvent.callHandler.length, 3);

const player = new Player(),
	cards = [new Card()],
	targets = [player];
assert.equal(initializeEvent(defaultEvent, { player, cards, targets }), defaultEvent);
assert.equal(defaultEvent.getPlayer(), player);
assert.equal(defaultEvent.cards, cards);
assert.equal(defaultEvent.getTargets(), targets);
defaultEvent.forceDie = true;
defaultEvent.direct = true;
for (const key of ["delay", "targetRequired", "nodelay", "nodelayx", "delayx", "isDelay", "nopopup", "throw", "noTargetDelay", "targetDelay", "postAi", "all_excluded", "insert_card", "washCard", "_triggeronly", "popup", "compareMeanwhile", "compareMultiple"]) {
	assert.equal(Object.hasOwn(defaultEvent, key), false);
	assert.equal(defaultEvent[key], undefined);
	assert.equal(defaultEvent.set(key, false), defaultEvent);
	assert.equal(defaultEvent[key], false);
	assert.deepEqual(Array.from(defaultEvent._set.at(-1)), [key, false]);
	defaultEvent.set(key, true);
	assert.equal(defaultEvent[key], true);
	const businessCopy = new GameEvent(defaultEvent);
	assert.equal(Object.hasOwn(businessCopy, key), false);
	assert.equal(businessCopy[key], undefined);
	delete defaultEvent[key];
	await Promise.resolve();
	assert.equal(defaultEvent[key], undefined);
	defaultEvent.set(key, undefined);
	assert.equal(Object.hasOwn(defaultEvent, key), true);
	assert.equal(defaultEvent[key], undefined);
	delete defaultEvent[key];
}
const copy = new GameEvent(defaultEvent);
assert.equal(Object.hasOwn(defaultEvent, "animate"), false);
for (const value of [false, true, "extension-animation", event => event.name.length, async () => {}, undefined]) {
	assert.equal(defaultEvent.set("animate", value), defaultEvent);
	assert.equal(defaultEvent.animate, value);
	assert.deepEqual(Array.from(defaultEvent._set.at(-1)), ["animate", value]);
	assert.equal(Object.hasOwn(new GameEvent(defaultEvent), "animate"), false);
	delete defaultEvent.animate;
	await Promise.resolve();
	assert.equal(defaultEvent.animate, undefined);
}
for (const key of ["videoId", "dialogid", "discardid"]) {
	assert.equal(Object.hasOwn(defaultEvent, key), false);
	assert.equal(defaultEvent.set(key, 12), defaultEvent);
	assert.equal(defaultEvent[key], 12);
	assert.deepEqual(Array.from(defaultEvent._set.at(-1)), [key, 12]);
	assert.equal(Object.hasOwn(new GameEvent(defaultEvent), key), false);
	delete defaultEvent[key];
	await Promise.resolve();
	assert.equal(defaultEvent[key], undefined);
	defaultEvent.set(key, undefined);
	assert.equal(Object.hasOwn(defaultEvent, key), true);
	delete defaultEvent[key];
}
assert.equal(copy.manager, defaultEvent.manager);
assert.equal(copy.player, undefined);
assert.equal(copy.cards, undefined);
assert.equal(copy.forceDie, undefined);
assert.equal(Object.hasOwn(copy, "direct"), false);
assert.notEqual(copy.childEvents, defaultEvent.childEvents);
assert.notEqual(copy.custom, defaultEvent.custom);
defaultEvent.goto(3);
assert.equal(defaultEvent.step, 0);
defaultEvent.updateStep();
assert.equal(defaultEvent.step, 3);
defaultEvent.redo();
defaultEvent.updateStep();
assert.equal(defaultEvent.step, 3);

let calls = 0;
const cached = () => ++calls;
assert.equal(defaultEvent.callFuncUseStepCache("value", cached, [1]), 1);
assert.equal(defaultEvent.callFuncUseStepCache("value", cached, [1]), 1);
assert.equal(calls, 1);
let handlerCalls = 0;
defaultEvent.pushHandler("custom", () => handlerCalls++);
assert.equal(defaultEvent.callHandler("custom", defaultEvent, {}), defaultEvent);
assert.equal(handlerCalls, 1);

const sequence = [];
const parent = new GameEvent("parent", false);
const child = new GameEvent("child", false);
const after = new GameEvent("after", false);
for (const [event, label] of [
	[child, "child"],
	[after, "after"],
]) {
	event.setContent(async current => {
		sequence.push(label);
		current.finish();
	});
}
parent.next.push(child);
parent.after.push(after);
parent.setContent(async current => {
	sequence.push("parent");
	assert.throws(() => current.setContent(async () => {}), /content is running/);
	current.finish();
	const suppressed = new GameEvent("suppressed", false);
	current.next.push(suppressed);
	assert.equal(suppressed.finished, false);
	assert.equal(suppressed.start(), suppressed.start());
});
const started = parent.start();
assert.equal(parent.start(), started);
await started;
assert.deepEqual(sequence, ["child", "parent", "after"]);
assert.equal(child.parent, parent);
assert.equal(after.parent, parent);
assert.deepEqual(
	Array.from(parent.childEvents, event => event.name),
	["child", "after"]
);
assert.equal(_status.eventManager.eventStack.length, 0);
assert.ok(announcements.length > 0);
parent.setContent(async () => {});
console.log("real GameEvent modules: identity, descriptors, constructors, fields, private state and queue verified");
