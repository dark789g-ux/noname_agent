import assert from "node:assert/strict";
import test from "node:test";
import { derive, end, isActive, reset, start } from "./player-button-state.js";

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
