import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { createModuleRuntime } from "../testing/module-runtime.mjs";

test("选将准备不提前接管，gameStart 保留本局 ID/配置/摘要，下一局重置", async () => {
	const hooks = new Map();
	const resets = [];
	const me = { dataset: { position: "0" }, getSeatNum: () => 0 };
	const status = {};
	let auto = 0;
	const runtime = await createModuleRuntime(
		{
			_status: status,
			game: { me, players: [me] },
			lib: { config: { llm_enabled: true, llm_control_self: true }, announce: { subscribe: (name, fn) => hooks.set(name, fn) } },
			ui: {
				click: {
					auto: () => {
						auto++;
					},
				},
				updateLLMLogButtons() {},
			},
		},
		{},
		{
			[fileURLToPath(new URL("../logger.js", import.meta.url))]: { llmLogger: {} },
			[fileURLToPath(new URL("../decide.js", import.meta.url))]: { tryLLMDecide() {} },
			[fileURLToPath(new URL("../harness/harness.js", import.meta.url))]: { resetAllHarnessSessions: id => resets.push(id) },
			[fileURLToPath(new URL("../round-history.js", import.meta.url))]: { initRoundHistoryHooks() {}, resetRoundHistory() {} },
		}
	);
	const api = await runtime.import("noname/llm/index.ts");
	const summary = await runtime.import("noname/llm/character-selection/summary.ts");
	api.initLLMGameHooks();
	api.prepareLLMGame();
	const gameId = status.llmGameId;
	assert.equal(auto, 0);
	assert.equal(status.llmSelfControlledAtGameStart, undefined);
	assert.equal(status.llmEnabledAtGameStart, undefined);
	assert.equal(status.llmInitialSeatIndices.get(me), 1);
	summary.setOpeningSummary(me, { characters: ["a"], reason: "选将理由" });
	runtime.engine.lib.config.llm_control_self = false;
	hooks.get("gameStart")();
	assert.equal(status.llmGameId, gameId);
	assert.equal(auto, 1);
	assert.equal(status.llmSelfControlledAtGameStart, true);
	assert.match(summary.getOpeningSummary(me), /选将理由/);
	assert.equal(resets.length, 1);
	hooks.get("gameStart")();
	assert.notEqual(status.llmGameId, gameId);
	assert.equal(status.llmSelfControlledAtGameStart, false);
	assert.equal(summary.getOpeningSummary(me), "");
	assert.equal(resets.length, 2);
});
