import assert from "node:assert/strict";
import test from "node:test";
import type { PromptFacts } from "../prompt-facts.js";
import { sliceEventsSince } from "../prompt-history.js";
import { SeatSession, computeRebuildThreshold, estimateTextTokens } from "./seat-session.js";

function makeFacts(decisionPoint = "chooseToUse"): PromptFacts {
	return {
		decisionPoint,
		profiles: [{ seat: 1, name: "曹操", identity: "主公", group: "魏", sex: "男", skills: [{ name: "奸雄", description: "受到伤害后可获得伤害牌" }] }],
		states: [{ seat: 1, name: "曹操", isCurrent: true, hp: 4, maxHp: 4, hujia: 0, handCount: 4, knownHandCards: [], equips: [], linked: false, turnedOver: false, judgments: [] }],
		pileOverview: { roundNumber: 1, drawPileCount: 100, discardPileCount: 0 },
		roundHistory: { currentRound: 1, entries: [] },
		decisionHeaderText: `## 决策类型：${decisionPoint}`,
		decisionChoicesText: "\n## 可执行动作：\n- pass",
		refLabels: {},
	};
}

test("SeatSession 收口剥离历史 reasoning_content 并追加 tool 结果闭合协议", () => {
	const session = new SeatSession("g1:seat_1", "openai|gpt|url|medium");
	const w1 = sliceEventsSince([], 0, 0);
	const d1 = session.beginDecision(makeFacts(), w1, { allowedToolNames: ["use_card", "pass"] });
	assert.equal(d1.plan.mode, "full");
	assert.equal(session.transcript.length, 2);
	assert.match(String(session.transcript[1].content), /## 本步允许工具：use_card, pass/);

	session.commitDecision(
		{ id: "call_1", name: "pass", reason: "保留手牌", reasoningContent: "内部推理文本", arguments: {} },
		{ usage: { inputTokens: 800, outputTokens: 50, contextUsed: 850, contextSize: 128_000 } }
	);
	assert.equal(session.initialized, true);
	assert.equal(session.transcript.length, 4);
	const assistantMsg = session.transcript[2] as any;
	assert.equal(assistantMsg.role, "assistant");
	assert.equal("reasoning_content" in assistantMsg, false);
	assert.equal((session.transcript[3] as any).role, "tool");

	const w2 = sliceEventsSince([{ seq: 1, roundNumber: 1, turnHeader: "[1号位] 曹操的回合", text: "曹操摸了两张牌" }], 1, session.lastEventSeq);
	const d2 = session.beginDecision(makeFacts("chooseToRespond"), w2, { allowedToolNames: ["respond_card", "pass"] });
	assert.equal(d2.plan.mode, "incremental");
	assert.equal(session.transcript.length, 5);
	assert.match(String(session.transcript[4].content), /## 本步允许工具：respond_card, pass/);
});

test("SeatSession 决策失败回滚不污染 transcript，连续两次解析失败触发重建", () => {
	const session = new SeatSession("g1:seat_1", "agy|gemini");
	const w1 = sliceEventsSince([], 0, 0);
	session.beginDecision(makeFacts(), w1);
	session.markRemoteSynced();
	session.commitDecision({ id: "call_1", name: "pass", arguments: {} }, { syncedRemote: true });
	const snapshotLen = session.transcript.length;

	// 第一次决策失败（parse）
	const w2 = sliceEventsSince([{ seq: 1, roundNumber: 1, turnHeader: "回合外", text: "事件1" }], 1, 0);
	session.beginDecision(makeFacts(), w2);
	session.appendTurnMessages([{ role: "assistant", content: "bad" } as any]);
	session.rollbackDecision("parse", false);
	assert.equal(session.transcript.length, snapshotLen);
	assert.equal(session.lastEventSeq, 0);
	assert.equal(session.evaluateRebuildReason(), undefined);

	// 第二次连续 parse 失败 -> 下次决策触发 rebuild
	session.beginDecision(makeFacts(), w2);
	session.rollbackDecision("parse", false);
	assert.equal(session.evaluateRebuildReason(), "consecutive_parse_failures");
});

test("SeatSession 上下文预算超过阈值时自动触发重建", () => {
	const session = new SeatSession("g1:seat_1", "agy|gemini");
	assert.equal(computeRebuildThreshold(128_000), 64_000);
	assert.equal(computeRebuildThreshold(1_000_000), 120_000);

	session.beginDecision(makeFacts(), sliceEventsSince([], 0, 0));
	session.commitDecision(
		{ id: "call_1", name: "pass", arguments: {} },
		{ usage: { contextUsed: 70_000, contextSize: 128_000 } }
	);
	assert.equal(session.evaluateRebuildReason(), "context_budget_exceeded");

	const next = session.beginDecision(makeFacts(), sliceEventsSince([], 0, 0));
	assert.equal(next.plan.mode, "full");
	assert.equal(next.plan.rebuilt, true);
	assert.equal(next.plan.rebuildReason, "context_budget_exceeded");
});

test("SeatSession 使用 configuredContextSize 计算重建阈值，estimateTextTokens 正确估算", () => {
	assert.equal(estimateTextTokens(""), 0);
	assert.equal(estimateTextTokens("abcd"), 2);

	const session = new SeatSession("g1:seat_2", "openai|deepseek");
	session.configuredContextSize = 16_000;
	assert.equal(computeRebuildThreshold(session.configuredContextSize), 8_000);

	session.beginDecision(makeFacts(), sliceEventsSince([], 0, 0));
	session.commitDecision(
		{ id: "call_1", name: "pass", arguments: {} },
		{ usage: { contextUsed: 8_500 } }
	);
	assert.equal(session.evaluateRebuildReason(), "context_budget_exceeded");
});
