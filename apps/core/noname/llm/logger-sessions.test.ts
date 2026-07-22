import assert from "node:assert/strict";
import test from "node:test";
import { buildGameSessions } from "./logger-sessions.js";
import type { LogEntry } from "./logger-types.js";

function log(id: string, gameId: string, timestamp: number, playerName: string, status: LogEntry["status"] = "success"): LogEntry {
	return { id, gameId, timestamp, playerName, status, decisionPoint: "chooseBool", durationMs: 1, meta: { enabled: true, configured: true } };
}

test("game sessions keep the earliest creation time and newest player for descending logs", () => {
	const sessions = buildGameSessions([
		log("newest", "game_1", 30, "张飞"),
		log("other", "game_2", 25, "刘备", "fallback"),
		log("middle", "game_1", 20, "关羽", "fallback"),
		log("oldest", "game_1", 10, "赵云"),
	]);
	assert.deepEqual(sessions, [
		{ gameId: "game_2", createdAt: 25, logCount: 1, successCount: 0, lastPlayerName: "刘备" },
		{ gameId: "game_1", createdAt: 10, logCount: 3, successCount: 2, lastPlayerName: "张飞" },
	]);
});
