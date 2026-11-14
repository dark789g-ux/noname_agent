import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { createModuleRuntime } from "./module-runtime.mjs";

test("enabling LLM allows multiple turns despite a saved legacy false and honors saved budgets", async () => {
	const config = { llm_enabled: true, llm_multi_turn: false, llm_max_turns: 2, llm_timeout: 12, llm_decision_timeout: 42 };
	const runtime = await createModuleRuntime(
		{ lib: { config } },
		{},
		{
			[fileURLToPath(new URL("../logger.js", import.meta.url))]: { llmLogger: {} },
			[fileURLToPath(new URL("../decide.js", import.meta.url))]: { tryLLMDecide: async () => ({ handled: false }) },
		}
	);
	const { getLLMConfig } = await runtime.import("noname/llm/index.ts");
	const current = getLLMConfig();
	assert.equal(current.multiTurn, true);
	assert.equal(current.controlSelf, false);
	assert.equal(current.maxTurns, 2);
	assert.equal(current.timeoutSec, 12);
	assert.equal(current.decisionTimeoutSec, 42);
	Reflect.deleteProperty(config, "llm_max_turns");
	assert.equal(getLLMConfig().maxTurns, 4);
	const { createConfigMenuLlm } = await runtime.import("noname/library/configuration/options/llm.ts");
	assert.equal(Object.hasOwn(createConfigMenuLlm().config, "llm_multi_turn"), false);
	assert.equal(Object.hasOwn(createConfigMenuLlm().config, "llm_control_self"), true);
});

test("llm_control_self depends on llm_enabled, activates at gameStart snapshot, and stays locked after gameStart", async () => {
	const listeners = new Map();
	const autoCalls = [];
	const createButton = () => {
		const classes = new Set();
		return {
			classList: {
				add: name => classes.add(name),
				remove: name => classes.delete(name),
				contains: name => classes.has(name),
			},
			hideCalls: 0,
			hide() {
				this.hideCalls++;
				classes.add("hidden");
			},
		};
	};
	const ui = {
		auto: createButton(),
		wuxie: createButton(),
		arena: createButton(),
		shortcut: { autobutton: createButton() },
		click: {
			auto(mode) {
				autoCalls.push(mode);
				engine._status.auto = true;
			},
		},
		logButtonUpdates: 0,
		updateLLMLogButtons() {
			this.logButtonUpdates++;
		},
	};
	const config = { llm_enabled: false, llm_control_self: true };
	const engine = {
		lib: {
			config,
			announce: {
				subscribe(event, fn) {
					listeners.set(event, fn);
				},
			},
		},
		ui,
		_status: { auto: false },
	};
	const runtime = await createModuleRuntime(
		engine,
		{},
		{
			[fileURLToPath(new URL("../logger.js", import.meta.url))]: { llmLogger: {} },
			[fileURLToPath(new URL("../decide.js", import.meta.url))]: { tryLLMDecide: async () => ({ handled: false }) },
			[fileURLToPath(new URL("../round-history.js", import.meta.url))]: { initRoundHistoryHooks() {}, resetRoundHistory() {} },
		}
	);
	const { getLLMConfig, llmSelfControlled, initLLMGameHooks } = await runtime.import("noname/llm/index.ts");
	assert.equal(getLLMConfig().controlSelf, false);
	assert.equal(llmSelfControlled(), false);

	config.llm_enabled = true;
	assert.equal(getLLMConfig().controlSelf, true);
	assert.equal(llmSelfControlled(), true);

	initLLMGameHooks();
	const onGameStart = listeners.get("gameStart");
	assert.equal(typeof onGameStart, "function");
	onGameStart();

	assert.equal(engine._status.llmEnabledAtGameStart, true);
	assert.equal(engine._status.llmSelfControlledAtGameStart, true);
	assert.deepEqual(autoCalls, ["forced"]);
	assert.equal(engine._status.auto, true);
	assert.equal(ui.auto.hideCalls, 1);
	assert.equal(ui.wuxie.hideCalls, 1);
	assert.equal(ui.auto.classList.contains("forcehide"), true);
	assert.equal(ui.wuxie.classList.contains("forcehide"), true);
	assert.equal(ui.shortcut.autobutton.classList.contains("forcehide"), true);

	// 局中关闭选项不影响当前局快照，下一局开局才解锁
	config.llm_control_self = false;
	assert.equal(llmSelfControlled(), true);
	assert.equal(engine._status.llmSelfControlledAtGameStart, true);

	onGameStart();
	assert.equal(llmSelfControlled(), false);
	assert.equal(engine._status.llmSelfControlledAtGameStart, false);
	assert.equal(ui.auto.classList.contains("forcehide"), false);
	assert.equal(ui.wuxie.classList.contains("forcehide"), false);
	assert.equal(ui.shortcut.autobutton.classList.contains("forcehide"), false);
});

test("Player.isMine returns false once llmSelfControlledAtGameStart is active", async () => {
	const me = { isMad: () => false };
	const engine = {
		game: { me, notMe: false },
		_status: { auto: false, llmSelfControlledAtGameStart: false },
	};
	const runtime = await createModuleRuntime(engine);
	const { stateAndPredicatesMethods } = await runtime.import("noname/library/element/Player/status/stateAndPredicates.ts");
	assert.equal(stateAndPredicatesMethods.isMine.call(me), true);
	engine._status.llmSelfControlledAtGameStart = true;
	assert.equal(stateAndPredicatesMethods.isMine.call(me), false);
});
