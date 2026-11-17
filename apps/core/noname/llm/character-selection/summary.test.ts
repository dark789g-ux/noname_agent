import assert from "node:assert/strict";
import test from "node:test";
import { getOpeningSummary, resetOpeningSummaries, setOpeningSummary } from "./summary.js";
import { planPrompt } from "../harness/prompt-planner.js";
import type { PromptFacts } from "../prompt-facts.js";
import { buildTimelineMarkers, formatToolCallSummary } from "../../ui/create/menu/vue/components/editors/llm-timeline/types.js";
import type { LogEntry } from "../logger-types.js";

test("正式会话首次及重建只带自己的最终结果与短理由，不串座、不保留旧局", () => {
	resetOpeningSummaries();
	const first = {},
		second = {};
	setOpeningSummary(first, { characters: ["a1"], group: "wei", reason: "自己的简短理由", reasoning_content: "私密长思考" } as any);
	setOpeningSummary(second, { characters: ["secret"], reason: "其他座位私密理由" });
	const facts: PromptFacts = {
		decisionPoint: "chooseBool",
		profiles: [],
		states: [],
		refLabels: {},
		pileOverview: { roundNumber: 1, drawPileCount: 100, discardPileCount: 0 },
		roundHistory: { currentRound: 1, entries: [] },
		decisionHeaderText: getOpeningSummary(first),
		decisionChoicesText: "",
	};
	for (const initialized of [false, true]) {
		const plan = planPrompt(
			facts,
			{ initialized, profileHashes: {} },
			{
				eventWindow: { entries: [], latestSeq: 0, truncated: false },
				rebuildReason: initialized ? "rebuild" : undefined,
			}
		);
		assert.match(plan.userMessage, /自己的简短理由/);
		assert.doesNotMatch(plan.userMessage, /其他座位|secret|冻结候选|私密长思考/);
	}
	resetOpeningSummaries();
	assert.equal(getOpeningSummary(first), "");
});

test("日志区别选将和对局全量会话，工具摘要显示具体版本和势力", () => {
	const entry = { decisionPoint: "chooseCharacter", session: { mode: "full" } } as LogEntry;
	assert.match(buildTimelineMarkers(entry, 0)[0].label, /选将独立/);
	assert.match(buildTimelineMarkers({ ...entry, decisionPoint: "chooseBool" }, 1)[0].label, /对局会话/);
	assert.equal(formatToolCallSummary("select_character", { characters: [{ ref: "c0", version: "re_caocao" }], group: "wei" }, { re_caocao: "界曹操" }), "select_character(界曹操 势力: wei)");
});
