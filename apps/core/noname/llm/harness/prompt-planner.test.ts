import assert from "node:assert/strict";
import test from "node:test";
import { LLM_SYSTEM_PROMPT_PREFIX, renderStatelessContextMessages, type PromptFacts } from "../prompt-facts.js";
import { sliceEventsSince } from "../prompt-history.js";
import { buildProfileHashes, planPrompt } from "./prompt-planner.js";

function sampleFacts(skillDesc = "摸牌阶段，你可以额外摸一张牌"): PromptFacts {
	return {
		decisionPoint: "chooseToUse",
		profiles: [
			{
				seat: 1,
				name: "刘备",
				identity: "主公",
				group: "蜀",
				sex: "男",
				skills: [{ name: "仁德", description: "出牌阶段，你可以将任意张手牌交给其他角色。" }],
			},
			{
				seat: 2,
				name: "周瑜",
				identity: "反贼",
				group: "吴",
				sex: "男",
				skills: [{ name: "英姿", description: skillDesc }],
			},
		],
		states: [
			{
				seat: 1,
				name: "刘备",
				isCurrent: false,
				hp: 4,
				maxHp: 4,
				hujia: 0,
				handCount: 4,
				knownHandCards: [],
				equips: [],
				linked: false,
				turnedOver: false,
				judgments: [],
			},
			{
				ref: "p1",
				seat: 2,
				name: "周瑜",
				isCurrent: true,
				hp: 3,
				maxHp: 3,
				hujia: 0,
				handCount: 3,
				knownHandCards: ["杀"],
				equips: [],
				linked: false,
				turnedOver: false,
				judgments: [],
			},
		],
		pileOverview: { roundNumber: 1, drawPileCount: 98, discardPileCount: 2, shuffleNumber: 0 },
		roundHistory: {
			currentRound: 1,
			entries: [{ turnHeader: "[1号位] 刘备的回合", text: "刘备结束了出牌阶段" }],
		},
		decisionHeaderText: "## 决策类型：出牌阶段/需要出牌\n## 取消：允许放弃尚未提交的选择",
		decisionChoicesText: "\n## 可执行动作：\n- 直接使用 c0【杀】｜目标=选择 1｜候选=[p0]",
		refLabels: { c0: "杀", p0: "刘备[座位1]" },
	};
}

test("首次规划输出与 renderStatelessContextMessages 一致并支持注入本步允许工具", () => {
	const facts = sampleFacts();
	const [expectedSys, expectedUser] = renderStatelessContextMessages(facts);
	const eventWindow = sliceEventsSince([{ seq: 1, roundNumber: 1, turnHeader: "[1号位] 刘备的回合", text: "刘备结束了出牌阶段" }], 1, 0);

	const initialPlan = planPrompt(facts, { initialized: false, profileHashes: {} }, { eventWindow });
	assert.equal(initialPlan.mode, "full");
	assert.equal(initialPlan.rebuilt, false);
	assert.equal(initialPlan.systemMessage, expectedSys.content);
	assert.equal(initialPlan.userMessage, expectedUser.content);

	const withTools = planPrompt(
		facts,
		{ initialized: false, profileHashes: {} },
		{ eventWindow, allowedToolNames: ["use_card", "pass"] }
	);
	assert.match(withTools.userMessage, /## 本步允许工具：use_card, pass/);
});

test("增量模式省略静态武将表与旧流水，仅发新增事件、当前状态与本步允许工具", () => {
	const facts = sampleFacts();
	const hashes = buildProfileHashes(facts.profiles);
	const seqLog = [
		{ seq: 1, roundNumber: 1, turnHeader: "[1号位] 刘备的回合", text: "刘备结束了出牌阶段" },
		{ seq: 2, roundNumber: 1, turnHeader: "[2号位] 周瑜的回合", text: "周瑜发动了【英姿】" },
	];
	const window = sliceEventsSince(seqLog, 2, 1);

	const inc = planPrompt(
		facts,
		{ initialized: true, profileHashes: hashes },
		{ eventWindow: window, allowedToolNames: ["use_card", "use_skill", "pass"] }
	);
	assert.equal(inc.mode, "incremental");
	assert.equal(inc.systemMessage, undefined);
	assert.equal(inc.addedEventsCount, 1);
	assert.equal(inc.nextEventSeq, 2);
	assert.equal(inc.changedProfileSeats.length, 0);
	assert.doesNotMatch(inc.userMessage, /## 场上武将信息：/);
	assert.doesNotMatch(inc.userMessage, /刘备结束了出牌阶段/);
	assert.match(inc.userMessage, /## 新增事件（自上次决策）：/);
	assert.match(inc.userMessage, /周瑜发动了【英姿】/);
	assert.match(inc.userMessage, /## 当前场面状态：/);
	assert.match(inc.userMessage, /## 可执行动作：/);
	assert.match(inc.userMessage, /## 本步允许工具：use_card, use_skill, pass/);
});

test("武将技能变化时增量补发，事件窗口截断时自动触发全量重建", () => {
	const baseFacts = sampleFacts();
	const oldHashes = buildProfileHashes(baseFacts.profiles);
	const mutatedFacts = sampleFacts("摸牌阶段，你可以额外摸两张牌（变身强化）");
	const window = sliceEventsSince([{ seq: 2, roundNumber: 1, turnHeader: "[2号位] 周瑜的回合", text: "周瑜觉醒了" }], 2, 1);

	const incWithProfile = planPrompt(mutatedFacts, { initialized: true, profileHashes: oldHashes }, { eventWindow: window });
	assert.equal(incWithProfile.mode, "incremental");
	assert.deepEqual(incWithProfile.changedProfileSeats, [2]);
	assert.match(incWithProfile.userMessage, /## 武将技能变更更新：/);
	assert.match(incWithProfile.userMessage, /变身强化/);

	// seq 2 已被淘汰，sinceSeq = 0 发生截断 -> 自动全量重建
	const truncatedWindow = sliceEventsSince([{ seq: 5, roundNumber: 2, turnHeader: "[2号位] 周瑜的回合", text: "事件5" }], 5, 0);
	assert.equal(truncatedWindow.truncated, true);
	const rebuilt = planPrompt(baseFacts, { initialized: true, profileHashes: oldHashes }, { eventWindow: truncatedWindow });
	assert.equal(rebuilt.mode, "full");
	assert.equal(rebuilt.rebuilt, true);
	assert.equal(rebuilt.rebuildReason, "event_window_truncated");
});

test("系统提示词前缀保留原约束并包含不超过 100 字的花色与火攻基础规则", () => {
	const originalPrefix =
		"你是三国杀的 AI 玩家。根据当前场面从可用工具中选择最优动作，只返回一个工具调用。重要要求：你的整个内部思考过程（reasoning_content）与工具参数中的原因说明（reason），除了必要的短引用代号与工具名外，必须全程使用简体中文。";
	assert.ok(LLM_SYSTEM_PROMPT_PREFIX.startsWith(originalPrefix));
	const addedRules = LLM_SYSTEM_PROMPT_PREFIX.slice(originalPrefix.length).trim();
	assert.ok(addedRules.length > 0 && addedRules.length <= 100, `added rules length=${addedRules.length}`);
	assert.match(addedRules, /花色/);
	assert.match(addedRules, /颜色/);
	assert.match(addedRules, /同颜色≠同花色/);
	assert.match(addedRules, /火攻/);

	const initialPlan = planPrompt(sampleFacts(), { initialized: false, profileHashes: {} }, { eventWindow: sliceEventsSince([], 0, 0) });
	assert.ok(initialPlan.systemMessage?.includes(addedRules));
});
