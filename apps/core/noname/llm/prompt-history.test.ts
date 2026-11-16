import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionSnapshot } from "./prompt-format.js";
import {
	buildDiscardPileReport,
	buildFallbackRoundSummary,
	buildRoundSummaryMessages,
	formatBattleLogArgs,
	formatIncrementalEvents,
	formatPileOverview,
	formatRoundHistory,
	isRedundantTurnStartLog,
	sliceEventsSince,
	type BattleLogAdapter,
	type RoundLogEntry,
} from "./prompt-history.js";

test("formatPileOverview 正确展示轮次、摸牌堆、洗牌次数与弃牌堆工具提示", () => {
	const opening = formatPileOverview({
		roundNumber: 0,
		drawPileCount: 108,
		discardPileCount: 0,
		shuffleNumber: 0,
		canInspectDiscard: true,
	});
	assert.match(opening, /当前轮次：开局阶段（第 0 轮）/);
	assert.match(opening, /牌堆剩余：108 张$/m);
	assert.doesNotMatch(opening, /inspect_discard_pile/);

	const midGame = formatPileOverview({
		roundNumber: 3,
		drawPileCount: 42,
		discardPileCount: 19,
		shuffleNumber: 1,
		canInspectDiscard: true,
	});
	assert.match(midGame, /当前轮次：第 3 轮/);
	assert.match(midGame, /牌堆剩余：42 张（已洗牌 1 次）/);
	assert.match(midGame, /弃牌堆：19 张（如需核对已出卡牌，可调用 inspect_discard_pile 查看明细）/);
});

test("formatRoundHistory 支持跨轮摘要、按回合连续归组与超过 80 条截断", () => {
	const empty = formatRoundHistory({ currentRound: 1, entries: [] });
	assert.equal(empty, "## 当前轮次事件流水（第 1 轮）：\n- 暂无记录");

	const grouped = formatRoundHistory({
		rollingSummary: "第1轮张飞跳反集火主公刘备，刘备消耗1桃稳住血线。",
		summarizedThroughRound: 1,
		currentRound: 2,
		entries: [
			{ turnHeader: "[1号位] 刘备的回合", text: "刘备发动了【仁德】" },
			{ turnHeader: "[1号位] 刘备的回合", text: "诸葛亮从刘备获得了两张牌" },
			{ turnHeader: "[2号位] 诸葛亮的回合", text: "诸葛亮使用了【无中生有】" },
			{ turnHeader: "[1号位] 刘备的回合", text: "刘备的【放权】回合开始" },
		],
	});
	assert.match(grouped, /## 历史轮次摘要（第 1 轮）：\n第1轮张飞跳反集火主公刘备/);
	assert.ok(grouped.indexOf("### [1号位] 刘备的回合") < grouped.indexOf("### [2号位] 诸葛亮的回合"));
	assert.ok(grouped.lastIndexOf("### [1号位] 刘备的回合") > grouped.indexOf("### [2号位] 诸葛亮的回合"));

	const manyEntries: RoundLogEntry[] = Array.from({ length: 85 }, (_, index) => ({
		turnHeader: "[1号位] 陆逊的回合",
		text: `事件记录 #${index + 1}`,
	}));
	const truncated = formatRoundHistory({
		rollingSummary: "前两轮局势胶着。",
		summarizedThroughRound: 2,
		currentRound: 3,
		entries: manyEntries,
	});
	assert.match(truncated, /## 历史轮次摘要（第 1～2 轮）：/);
	assert.match(truncated, /（本轮较早的 5 条记录已省略，以下为最近 80 条）/);
	assert.doesNotMatch(truncated, /事件记录 #5\b/);
	assert.match(truncated, /事件记录 #6\b/);
	assert.match(truncated, /事件记录 #85\b/);
});

test("formatBattleLogArgs 对 $giveAuto 暗牌脱敏并清理 HTML 与颜色前缀", () => {
	const historyNode = { logvid: 1 };
	const adapter: BattleLogAdapter = {
		getItemType(value: any) {
			if (value?.kind === "player") return "player";
			if (Array.isArray(value)) return "cards";
			if (value?.kind === "card") return "card";
			return "";
		},
		translate(value: any) {
			if (value?.kind === "player") return value.label;
			if (Array.isArray(value)) return value.map(item => item.label).join("、");
			if (value?.kind === "card") return value.label;
			return String(value ?? "");
		},
		isHistoryBarNode: value => value === historyNode,
	};
	const liubei = { kind: "player", label: "刘备" };
	const caocao = { kind: "player", label: "曹操" };
	const secretCards = [
		{ kind: "card", name: "tao", label: "桃【红桃Q】" },
		{ kind: "card", name: "shan", label: "闪【方片2】" },
	];

	const masked = formatBattleLogArgs([liubei, "从", caocao, "获得了", secretCards, historyNode], adapter, true);
	assert.equal(masked, "刘备从曹操获得了两张牌");
	assert.doesNotMatch(masked, /桃|闪/);

	const publicLine = formatBattleLogArgs([liubei, "发动了", "#g【仁德】", '<span class="bluetext">回复了1点体力</span>'], adapter, false);
	assert.equal(publicLine, "刘备发动了【仁德】回复了1点体力");

	assert.equal(isRedundantTurnStartLog("刘备的回合开始", "刘备"), true);
	assert.equal(isRedundantTurnStartLog("刘备的【放权】回合开始", "刘备"), false);
});

test("buildDiscardPileReport 保留先后顺序并统计花色与属性杀牌名", () => {
	const report = buildDiscardPileReport([
		{ name: "杀", rawName: "sha", suit: "spade", number: 7 },
		{ name: "杀", rawName: "sha", nature: "fire", suit: "heart", number: 13 },
		{ name: "杀", rawName: "sha", nature: "thunder", suit: "♠︎", number: 1 },
		{ name: "闪", rawName: "shan", suit: "diamond", number: 11 },
		{ name: "杀", rawName: "sha", suit: "club", number: 12 },
	]);
	assert.equal(report.total, 5);
	assert.equal(report.order, "oldest_to_newest");
	assert.deepEqual(report.cards, ["杀【黑桃7】", "火杀【红桃K】", "雷杀【黑桃A】", "闪【方片J】", "杀【梅花Q】"]);
	assert.deepEqual(report.bySuit, { 黑桃: 2, 红桃: 1, 梅花: 1, 方片: 1 });
	assert.deepEqual(report.byName, { 杀: 2, 火杀: 1, 雷杀: 1, 闪: 1 });
});

test("buildDecisionSnapshot 按顺序注入牌堆概览与轮次历史段落", () => {
	const snapshot = buildDecisionSnapshot(
		"chooseToUse",
		{ prompt: "出牌阶段" },
		{
			cards: [{ ref: "c0", name: "杀", id: "sha_1", cardAction: true }],
			skills: [],
			actions: [{ kind: "card", cardRef: "c0", materialCardRefs: [], target: { mode: "explicit", range: [1, 1], targetRefs: ["p1"] } }],
		},
		[{ seat: 1, name: "刘备", isCurrent: true, hp: 4, maxHp: 4, hujia: 0, handCount: 2, knownHandCards: ["杀"], equips: [], linked: false, turnedOver: false, judgments: [] }],
		{
			decisionDescriptions: { chooseToUse: "出牌阶段" },
			getSkillName: s => s,
			getSkillDescription: () => "",
			pileOverviewText: "## 牌局进度与牌堆：\n- 当前轮次：第 1 轮",
			roundHistoryText: "## 当前轮次事件流水（第 1 轮）：\n- 暂无记录",
		}
	);
	const idxPile = snapshot.indexOf("## 牌局进度与牌堆：");
	const idxState = snapshot.indexOf("## 当前场面状态：");
	const idxHistory = snapshot.indexOf("## 当前轮次事件流水（第 1 轮）：");
	const idxActions = snapshot.indexOf("## 可执行动作：");
	assert.ok(idxPile > 0 && idxPile < idxState && idxState < idxHistory && idxHistory < idxActions);
});

test("buildFallbackRoundSummary 与 buildRoundSummaryMessages 保持有界摘要", () => {
	const entries: RoundLogEntry[] = [
		{ turnHeader: "[1号位] 刘备的回合", text: "刘备从牌堆获得了两张牌" },
		{ turnHeader: "[1号位] 刘备的回合", text: "刘备对曹操造成了1点伤害" },
		{ turnHeader: "[2号位] 曹操的回合", text: "曹操发动了【奸雄】" },
	];
	const messages = buildRoundSummaryMessages("旧摘要内容", 2, entries);
	assert.equal(messages.length, 2);
	assert.match(String(messages[0].content), /简体中文.*reasoning_content|reasoning_content.*简体中文/);
	assert.match(String(messages[1].content), /已有历史前情摘要/);
	assert.match(String(messages[1].content), /曹操发动了【奸雄】/);
	assert.match(String(messages[1].content), /简体中文.*reasoning_content|reasoning_content.*简体中文/);

	const longPrev = "前情记录".repeat(90);
	const fallback = buildFallbackRoundSummary(longPrev, 3, entries, 300);
	assert.ok([...fallback].length <= 300);
	assert.match(fallback, /第3轮：.*造成了1点伤害.*发动了【奸雄】/);
});

test("sliceEventsSince 与 formatIncrementalEvents 精确跟踪游标与截断", () => {
	const seqLog = [
		{ seq: 3, roundNumber: 1, turnHeader: "[1号位] 刘备的回合", text: "刘备使用了【桃】" },
		{ seq: 4, roundNumber: 2, turnHeader: "[2号位] 曹操的回合", text: "曹操摸了两张牌" },
		{ seq: 5, roundNumber: 2, turnHeader: "[2号位] 曹操的回合", text: "曹操使用了【杀】" },
	];
	// firstKept = 3, sinceSeq = 2 没有缺口
	const exactBoundary = sliceEventsSince(seqLog, 5, 2);
	assert.equal(exactBoundary.truncated, false);
	assert.equal(exactBoundary.entries.length, 3);
	assert.equal(exactBoundary.latestSeq, 5);

	// sinceSeq = 3 只返回 4, 5
	const partial = sliceEventsSince(seqLog, 5, 3);
	assert.equal(partial.truncated, false);
	assert.deepEqual(
		partial.entries.map(e => e.seq),
		[4, 5]
	);

	// sinceSeq = 1 时 seq=2 已丢失，标记 truncated
	const truncated = sliceEventsSince(seqLog, 5, 1);
	assert.equal(truncated.truncated, true);

	const formatted = formatIncrementalEvents(seqLog);
	assert.match(formatted, /## 新增事件（自上次决策）：/);
	assert.match(formatted, /（进入第 2 轮）/);
	assert.match(formatted, /### \[2号位\] 曹操的回合/);

	assert.match(formatIncrementalEvents([]), /无新增公开事件/);
});
