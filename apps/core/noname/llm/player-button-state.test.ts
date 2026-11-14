import assert from "node:assert/strict";
import test from "node:test";
import { derive, end, isActive, reset, resolvePlayerButtonState, start } from "./player-button-state.js";

function entry(id: string, gameId: string, playerName: string, playerSeatNum?: number) {
	return { id, gameId, playerName, playerSeatNum };
}

test.afterEach(reset);

test("优先按 gameId 与座位匹配，旧日志回退到名称", () => {
	start(entry("seat", "game_1", "张角", 2));
	start(entry("legacy", "game_1", "华佗"));

	assert.equal(isActive({ gameId: "game_1", playerName: "张角", playerSeatNum: 1 }), false);
	assert.equal(isActive({ gameId: "game_1", playerName: "张角", playerSeatNum: 2 }), true);
	assert.equal(isActive({ gameId: "game_1", playerName: "华佗", playerSeatNum: 1 }), true);
});

test("跨局日志不会点亮当前对局的按钮", () => {
	start(entry("other-game", "game_1", "张角", 1));
	assert.equal(isActive({ gameId: "game_2", playerName: "张角", playerSeatNum: 1 }), false);
});

test("同一武将的多个日志结束前保持活动", () => {
	const target = { gameId: "game_1", playerName: "张角", playerSeatNum: 1 };
	start(entry("first", "game_1", "张角", 1));
	start(entry("second", "game_1", "张角", 1));
	end("first");
	assert.equal(isActive(target), true);
	end("second");
	assert.equal(isActive(target), false);
});

test("多个武将可同时保持活动", () => {
	start(entry("zhangjiao", "game_1", "张角", 1));
	start(entry("huatuo", "game_1", "华佗", 2));
	assert.equal(isActive({ gameId: "game_1", playerName: "张角", playerSeatNum: 1 }), true);
	assert.equal(isActive({ gameId: "game_1", playerName: "华佗", playerSeatNum: 2 }), true);
});

test("reset 清空全部活动日志", () => {
	start(entry("log", "game_1", "张角", 1));
	reset();
	assert.equal(isActive({ gameId: "game_1", playerName: "张角", playerSeatNum: 1 }), false);
});

test("活动日志在关闭配置或受控时仍然可见且高亮", () => {
	const target = { gameId: "game_1", playerName: "张角", playerSeatNum: 1 };
	start(entry("log", "game_1", "张角", 1));
	assert.deepEqual(derive(target, { enabled: false, isUnderControl: true }), { active: true, visible: true, highlighted: true });
	assert.deepEqual(derive({ gameId: "game_1", playerName: "华佗", playerSeatNum: 2 }, { enabled: false, isUnderControl: true }), { active: false, visible: false, highlighted: false });
});

test("未知 end 不影响活动日志", () => {
	const target = { gameId: "game_1", playerName: "张角", playerSeatNum: 1 };
	start(entry("known", "game_1", "张角", 1));
	end("unknown");
	assert.equal(isActive(target), true);
});

test("玩家角色接入 LLM 时自身与受控角色也显示日志按钮，否则仅 AI 显示", () => {
	const me = {
		getName: () => "刘备",
		getSeatNum: () => 1,
		isUnderControl: (self?: boolean) => !!self,
	};
	const aiPlayer = {
		getName: () => "张角",
		getSeatNum: () => 2,
		isUnderControl: () => false,
	};

	assert.equal(resolvePlayerButtonState(me, {}, { llm_enabled: true, llm_control_self: false }).visible, false);
	assert.equal(resolvePlayerButtonState(aiPlayer, {}, { llm_enabled: true, llm_control_self: false }).visible, true);

	assert.equal(resolvePlayerButtonState(me, {}, { llm_enabled: true, llm_control_self: true }).visible, true);
	assert.equal(resolvePlayerButtonState(aiPlayer, {}, { llm_enabled: true, llm_control_self: true }).visible, true);

	assert.equal(resolvePlayerButtonState(me, {}, { llm_enabled: false, llm_control_self: true }).visible, false);
	assert.equal(
		resolvePlayerButtonState(
			me,
			{ llmGameId: "game_1", llmEnabledAtGameStart: true, llmSelfControlledAtGameStart: true },
			{ llm_enabled: true, llm_control_self: false }
		).visible,
		true
	);
	assert.equal(
		resolvePlayerButtonState(
			me,
			{ llmGameId: "game_1", llmEnabledAtGameStart: true, llmSelfControlledAtGameStart: false },
			{ llm_enabled: true, llm_control_self: true }
		).visible,
		false
	);
});

test("按行动顺位解析 AI 短名称（deepseek / agy / codex）与本地 AI 隐藏规则", () => {
	const cfg = {
		llm_enabled: true,
		llm_control_self: false,
		llm_url: "https://api.deepseek.com",
		llm_model: "deepseek-flash",
		llm_default_backend: "openai",
		llm_seat_backends: {
			1: "default",
			2: "agy",
			3: "codex",
			4: "local",
		},
	};
	const aiSeat2 = { getName: () => "张角", getSeatNum: () => 2, isUnderControl: () => false, dataset: { position: "1" } };
	const aiSeat3 = { getName: () => "华佗", getSeatNum: () => 0, isUnderControl: () => false, dataset: { position: "2" } };
	const aiSeat4 = { getName: () => "吕布", getSeatNum: () => 4, isUnderControl: () => false, dataset: { position: "3" } };
	const aiSeat5 = { getName: () => "曹操", getSeatNum: () => 5, isUnderControl: () => false, dataset: { position: "4" } };

	const s2 = resolvePlayerButtonState(aiSeat2, {}, cfg);
	assert.equal(s2.visible, true);
	assert.equal(s2.label, "agy");
	assert.equal(s2.backend, "agy");

	const s3 = resolvePlayerButtonState(aiSeat3, {}, cfg);
	assert.equal(s3.visible, true);
	assert.equal(s3.label, "codex");
	assert.equal(s3.backend, "codex");

	const s4 = resolvePlayerButtonState(aiSeat4, {}, cfg);
	assert.equal(s4.visible, false);
	assert.equal(s4.label, "");

	const s5 = resolvePlayerButtonState(aiSeat5, {}, cfg);
	assert.equal(s5.visible, true);
	assert.equal(s5.label, "deepseek");
	assert.equal(s5.backend, "openai");
});
