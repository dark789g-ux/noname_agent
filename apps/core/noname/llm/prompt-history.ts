import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions.js";

export const MAX_ROUND_LOG_ENTRIES = 80;
export const SUBMIT_ROUND_SUMMARY_TOOL = "submit_round_summary";

const MAX_SUMMARY_CHARS = 300;
const MAX_SUMMARY_SOURCE_ENTRIES = 160;

export interface RoundLogEntry {
	turnHeader: string;
	text: string;
}

export interface SequencedRoundLogEntry extends RoundLogEntry {
	seq: number;
	roundNumber: number;
}

export interface EventWindow {
	entries: SequencedRoundLogEntry[];
	earliestAvailableSeq: number;
	latestSeq: number;
	truncated: boolean;
}

/** 纯函数事件窗口切片，供 round-history 与 Harness 单测共用。 */
export function sliceEventsSince(seqLog: readonly SequencedRoundLogEntry[], latestSeq: number, sinceSeq: number): EventWindow {
	const firstKept = seqLog[0]?.seq ?? latestSeq + 1;
	const truncated = sinceSeq < firstKept - 1 && latestSeq >= firstKept;
	const entries = truncated ? seqLog.slice() : seqLog.filter(item => item.seq > sinceSeq);
	return {
		entries,
		earliestAvailableSeq: firstKept,
		latestSeq,
		truncated,
	};
}

export interface PileOverviewInput {
	roundNumber: number;
	drawPileCount: number;
	discardPileCount: number;
	shuffleNumber?: number;
	canInspectDiscard?: boolean;
}

export interface RoundHistoryInput {
	rollingSummary?: string;
	summarizedThroughRound?: number;
	currentRound: number;
	entries: RoundLogEntry[];
	maxEntries?: number;
}

export interface DiscardCardInput {
	name: string;
	rawName?: string;
	nature?: string;
	suit?: string;
	number?: number | string;
}

export interface DiscardPileReport {
	total: number;
	order: "oldest_to_newest";
	bySuit: Record<string, number>;
	byName: Record<string, number>;
	cards: string[];
}

export interface BattleLogAdapter {
	getItemType(value: unknown): string;
	translate(value: unknown): string;
	isHistoryBarNode?(value: unknown): boolean;
	cnNumber?(count: number): string;
}

const SUIT_LABELS: Record<string, string> = {
	spade: "黑桃",
	heart: "红桃",
	club: "梅花",
	diamond: "方片",
	none: "无色",
	"♠": "黑桃",
	"♠︎": "黑桃",
	"♥": "红桃",
	"♥︎": "红桃",
	"♣": "梅花",
	"♣︎": "梅花",
	"♦": "方片",
	"♦︎": "方片",
	黑桃: "黑桃",
	红桃: "红桃",
	梅花: "梅花",
	方片: "方片",
	无色: "无色",
};

const NATURE_LABELS: Record<string, string> = {
	fire: "火",
	thunder: "雷",
	ice: "冰",
	kami: "神",
	stab: "刺",
};

const CN_NUMBERS = ["零", "一", "两", "三", "四", "五", "六", "七", "八", "九", "十"];
const KEY_EVENT_RE = /(受到|造成|伤害|回复|体力|阵亡|死亡|濒死|救回|翻面|连环|重置|发动了|限定|觉醒|装备了|判定|顺手牵羊|过河拆桥|无中生有|南蛮入侵|万箭齐发|决斗|借刀杀人|乐不思蜀|兵粮寸断|闪电|桃园结义|五谷丰登|火攻|铁索连环)/;

/** 剥离战报中的内联 HTML 与实体转义，保持紧凑中文语句。 */
export function cleanBattleLogText(raw: unknown): string {
	return String(raw ?? "")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/gi, " ")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&amp;/gi, "&")
		.replace(/\s+/g, " ")
		.trim();
}

/** 将 game.log 参数格式化为公开战报纯文本；在 $giveAuto 作用域内自动脱敏暗牌为张数。 */
export function formatBattleLogArgs(args: ArrayLike<unknown>, adapter: BattleLogAdapter, maskCardsAsCount = false): string {
	let output = "";
	for (const value of Array.from(args)) {
		const itemType = adapter.getItemType(value);
		if (itemType === "player" || itemType === "players") {
			output += adapter.translate(value);
		} else if (itemType === "cards" || itemType === "card" || (typeof value === "object" && value !== null && "name" in value && Boolean((value as { name?: unknown }).name))) {
			if (maskCardsAsCount) {
				const count = Array.isArray(value) ? value.length : 1;
				const cn = adapter.cnNumber ? adapter.cnNumber(count) : (CN_NUMBERS[count] ?? String(count));
				output += `${cn}张牌`;
			} else {
				output += adapter.translate(value);
			}
		} else if (typeof value === "object" && value !== null) {
			if (!adapter.isHistoryBarNode?.(value)) {
				output += adapter.translate(value);
			}
		} else if (typeof value === "string") {
			output += value.startsWith("#") && value.length >= 2 ? adapter.translate(value.slice(2)) : adapter.translate(value);
		} else if (value !== undefined && value !== null) {
			output += String(value);
		}
	}
	return cleanBattleLogText(output);
}

/** 判断是否为与回合分组标题完全重复的普通“XX的回合开始”行。 */
export function isRedundantTurnStartLog(text: string, currentPhaseName?: string): boolean {
	if (!text || !currentPhaseName) return false;
	return text === `${currentPhaseName}的回合开始`;
}

/** 格式化牌局轮次与摸牌堆、弃牌堆余量概览。 */
export function formatPileOverview(input: PileOverviewInput): string {
	const roundText = input.roundNumber > 0 ? `第 ${input.roundNumber} 轮` : "开局阶段（第 0 轮）";
	const shuffleSuffix = input.shuffleNumber && input.shuffleNumber > 0 ? `（已洗牌 ${input.shuffleNumber} 次）` : "";
	const inspectHint = input.canInspectDiscard && input.discardPileCount > 0 ? "（如需核对已出卡牌，可调用 inspect_discard_pile 查看明细）" : "";
	return [
		"## 牌局进度与牌堆：",
		`- 当前轮次：${roundText}`,
		`- 牌堆剩余：${Math.max(0, input.drawPileCount)} 张${shuffleSuffix}`,
		`- 弃牌堆：${Math.max(0, input.discardPileCount)} 张${inspectHint}`,
	].join("\n");
}

/** 按回合标题连续归组格式化事件条目。 */
function appendGroupedTurnEntries(lines: string[], entries: RoundLogEntry[]): void {
	let lastHeader = "";
	for (const entry of entries) {
		const header = entry.turnHeader || "回合外";
		if (header !== lastHeader) {
			lines.push(`### ${header}`);
			lastHeader = header;
		}
		lines.push(`- ${entry.text}`);
	}
}

/** 格式化跨轮滚动前情摘要与当前轮次按回合归组的公开事件流水。 */
export function formatRoundHistory(input: RoundHistoryInput): string {
	const blocks: string[] = [];
	const summary = cleanBattleLogText(input.rollingSummary);
	if (summary) {
		const roundRange = input.summarizedThroughRound && input.summarizedThroughRound > 1 ? `（第 1～${input.summarizedThroughRound} 轮）` : input.summarizedThroughRound === 1 ? "（第 1 轮）" : "";
		blocks.push(`## 历史轮次摘要${roundRange}：\n${summary}`);
	}
	const currentTitle = input.currentRound > 0 ? `## 当前轮次事件流水（第 ${input.currentRound} 轮）：` : "## 当前轮次事件流水（开局阶段）：";
	const lines: string[] = [currentTitle];
	const maxEntries = input.maxEntries ?? MAX_ROUND_LOG_ENTRIES;
	if (!input.entries.length) {
		lines.push("- 暂无记录");
	} else {
		const omitted = Math.max(0, input.entries.length - maxEntries);
		const visible = omitted > 0 ? input.entries.slice(-maxEntries) : input.entries;
		if (omitted > 0) {
			lines.push(`（本轮较早的 ${omitted} 条记录已省略，以下为最近 ${maxEntries} 条）`);
		}
		appendGroupedTurnEntries(lines, visible);
	}
	blocks.push(lines.join("\n"));
	return blocks.join("\n\n");
}

/** 格式化常驻会话增量事件段落（保留轮次切换标记与回合分组）。 */
export function formatIncrementalEvents(entries: SequencedRoundLogEntry[]): string {
	if (!entries.length) {
		return "## 新增事件（自上次决策）：\n- 无新增公开事件";
	}
	const lines: string[] = ["## 新增事件（自上次决策）："];
	let lastRound: number | undefined;
	let lastHeader = "";
	for (const entry of entries) {
		if (lastRound !== undefined && entry.roundNumber !== lastRound && entry.roundNumber > 0) {
			lines.push(`（进入第 ${entry.roundNumber} 轮）`);
			lastHeader = "";
		}
		lastRound = entry.roundNumber;
		const header = entry.turnHeader || "回合外";
		if (header !== lastHeader) {
			lines.push(`### ${header}`);
			lastHeader = header;
		}
		lines.push(`- ${entry.text}`);
	}
	return lines.join("\n");
}

/** 生成当前弃牌堆全部卡牌的明细与按花色、按牌名统计报告。 */
export function buildDiscardPileReport(cards: DiscardCardInput[]): DiscardPileReport {
	const bySuit: Record<string, number> = { 黑桃: 0, 红桃: 0, 梅花: 0, 方片: 0 };
	const nameCounts = new Map<string, number>();
	const formattedCards: string[] = [];

	for (const card of cards) {
		const cardName = formatDiscardCardName(card);
		const suitLabel = normalizeSuitLabel(card.suit);
		const rankLabel = formatCardRank(card.number);
		bySuit[suitLabel] = (bySuit[suitLabel] ?? 0) + 1;
		nameCounts.set(cardName, (nameCounts.get(cardName) ?? 0) + 1);
		formattedCards.push(rankLabel ? `${cardName}【${suitLabel}${rankLabel}】` : `${cardName}【${suitLabel}】`);
	}

	const byName = Object.fromEntries([...nameCounts.entries()].sort((a, b) => b[1] - a[1]));
	return {
		total: formattedCards.length,
		order: "oldest_to_newest",
		bySuit,
		byName,
		cards: formattedCards,
	};
}

/** 构造后台滚动合并轮次总结使用的工具定义。 */
export function submitRoundSummaryTool(): ChatCompletionTool {
	return {
		type: "function",
		function: {
			name: SUBMIT_ROUND_SUMMARY_TOOL,
			description: "提交合并前情与刚结束一轮战报后的全局公开局势摘要（不超过300字）。",
			parameters: {
				type: "object",
				properties: {
					reason: { type: "string", description: "简要说明选择原因。", minLength: 1, maxLength: 200 },
					summary: { type: "string", description: "合并后的公开局势摘要（不超过300字，不臆测暗牌）。", minLength: 1, maxLength: 500 },
				},
				required: ["reason", "summary"],
				additionalProperties: false,
			},
		},
	};
}

/** 构造跨轮滚动压缩的上下文消息。 */
export function buildRoundSummaryMessages(prevSummary: string, roundNumber: number, entries: RoundLogEntry[]): ChatCompletionMessageParam[] {
	const roundLogText = formatRoundHistory({
		currentRound: roundNumber,
		entries,
		maxEntries: MAX_SUMMARY_SOURCE_ENTRIES,
	});
	const prevSection = cleanBattleLogText(prevSummary) ? `## 已有历史前情摘要（第 1～${Math.max(1, roundNumber - 1)} 轮）：\n${cleanBattleLogText(prevSummary)}\n\n` : "";
	return [
		{
			role: "system",
			content: "你是三国杀对局战报记录员。请将「已有历史前情摘要」与「刚结束一轮的公开事件流水」合并压缩为一份不超过 300 字的客观公开局势摘要，并调用 submit_round_summary 提交。\n重点保留：各座次身份/阵营倾向暴露、限定技/觉醒技/大招消耗、关键牌（桃/酒/无懈可击/诸葛连弩等）消耗印象、重要伤害与濒死救援、阵亡归属。剔除常规摸牌弃牌细节，严禁臆测任何未公开手牌。\n重要要求：你的整个内部思考过程（reasoning_content）与工具参数必须全程使用简体中文。",
		},
		{
			role: "user",
			content: `${prevSection}${roundLogText}\n\n请务必全程使用简体中文进行内部思考（reasoning_content）并生成中文局势摘要。`,
		},
	];
}

/** 截断规范化模型输出的摘要文本，防止跨多轮无限膨胀。 */
export function clampSummaryText(text: string, maxChars = 350): string {
	const cleaned = cleanBattleLogText(text);
	const codePoints = [...cleaned];
	if (codePoints.length <= maxChars) return cleaned;
	return `${codePoints.slice(0, maxChars - 1).join("")}…`;
}

/** 当后台 LLM 总结失败或等待超时时，使用确定性规则生成定长降级摘要。 */
export function buildFallbackRoundSummary(prevSummary: string, roundNumber: number, entries: RoundLogEntry[], maxChars = MAX_SUMMARY_CHARS): string {
	const keyTexts = entries.filter(item => KEY_EVENT_RE.test(item.text)).map(item => item.text);
	const source = keyTexts.length >= 2 ? keyTexts.slice(-6) : entries.slice(-6).map(item => item.text);
	const roundDigest = source.length ? `第${roundNumber}轮：${source.join("；")}。` : "";
	const base = cleanBattleLogText(prevSummary);
	const merged = [base, roundDigest].filter(Boolean).join(" ");
	const codePoints = [...merged];
	if (codePoints.length <= maxChars) return merged;
	return `…${codePoints.slice(-(maxChars - 1)).join("")}`;
}

function formatDiscardCardName(card: DiscardCardInput): string {
	const rawBase = cleanBattleLogText(card.name || card.rawName || "未知卡牌");
	if ((rawBase === "杀" || rawBase === "sha") && card.nature) {
		const prefix = card.nature
			.split("|")
			.filter(Boolean)
			.map(item => NATURE_LABELS[item] || cleanBattleLogText(item))
			.join("");
		return `${prefix}杀`;
	}
	return rawBase === "sha" ? "杀" : rawBase;
}

function normalizeSuitLabel(suit?: string): string {
	if (!suit) return "无色";
	const cleaned = cleanBattleLogText(suit);
	return SUIT_LABELS[cleaned] || "无色";
}

function formatCardRank(num?: number | string): string {
	if (num === undefined || num === null || num === "" || num === 0) return "";
	if (typeof num === "number") {
		if (num === 1) return "A";
		if (num === 11) return "J";
		if (num === 12) return "Q";
		if (num === 13) return "K";
		return num > 0 ? String(num) : "";
	}
	const trimmed = String(num).trim();
	const parsed = Number(trimmed);
	if (Number.isInteger(parsed) && parsed > 0) return formatCardRank(parsed);
	return trimmed;
}
