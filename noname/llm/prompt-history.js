const MAX_ROUND_LOG_ENTRIES = 80;
const SUBMIT_ROUND_SUMMARY_TOOL = "submit_round_summary";
const MAX_SUMMARY_CHARS = 300;
const MAX_SUMMARY_SOURCE_ENTRIES = 160;
function sliceEventsSince(seqLog, latestSeq, sinceSeq) {
  const firstKept = seqLog[0]?.seq ?? latestSeq + 1;
  const truncated = sinceSeq < firstKept - 1 && latestSeq >= firstKept;
  const entries = truncated ? seqLog.slice() : seqLog.filter((item) => item.seq > sinceSeq);
  return {
    entries,
    earliestAvailableSeq: firstKept,
    latestSeq,
    truncated
  };
}
const SUIT_LABELS = {
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
  无色: "无色"
};
const NATURE_LABELS = {
  fire: "火",
  thunder: "雷",
  ice: "冰",
  kami: "神",
  stab: "刺"
};
const CN_NUMBERS = ["零", "一", "两", "三", "四", "五", "六", "七", "八", "九", "十"];
const KEY_EVENT_RE = /(受到|造成|伤害|回复|体力|阵亡|死亡|濒死|救回|翻面|连环|重置|发动了|限定|觉醒|装备了|判定|顺手牵羊|过河拆桥|无中生有|南蛮入侵|万箭齐发|决斗|借刀杀人|乐不思蜀|兵粮寸断|闪电|桃园结义|五谷丰登|火攻|铁索连环)/;
function cleanBattleLogText(raw) {
  return String(raw ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}
function formatBattleLogArgs(args, adapter, maskCardsAsCount = false) {
  let output = "";
  for (const value of Array.from(args)) {
    const itemType = adapter.getItemType(value);
    if (itemType === "player" || itemType === "players") {
      output += adapter.translate(value);
    } else if (itemType === "cards" || itemType === "card" || typeof value === "object" && value !== null && "name" in value && Boolean(value.name)) {
      if (maskCardsAsCount) {
        const count = Array.isArray(value) ? value.length : 1;
        const cn = adapter.cnNumber ? adapter.cnNumber(count) : CN_NUMBERS[count] ?? String(count);
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
    } else if (value !== void 0 && value !== null) {
      output += String(value);
    }
  }
  return cleanBattleLogText(output);
}
function isRedundantTurnStartLog(text, currentPhaseName) {
  if (!text || !currentPhaseName) return false;
  return text === `${currentPhaseName}的回合开始`;
}
function formatPileOverview(input) {
  const roundText = input.roundNumber > 0 ? `第 ${input.roundNumber} 轮` : "开局阶段（第 0 轮）";
  const shuffleSuffix = input.shuffleNumber && input.shuffleNumber > 0 ? `（已洗牌 ${input.shuffleNumber} 次）` : "";
  const inspectHint = input.canInspectDiscard && input.discardPileCount > 0 ? "（如需核对已出卡牌，可调用 inspect_discard_pile 查看明细）" : "";
  return [
    "## 牌局进度与牌堆：",
    `- 当前轮次：${roundText}`,
    `- 牌堆剩余：${Math.max(0, input.drawPileCount)} 张${shuffleSuffix}`,
    `- 弃牌堆：${Math.max(0, input.discardPileCount)} 张${inspectHint}`
  ].join("\n");
}
function appendGroupedTurnEntries(lines, entries) {
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
function formatRoundHistory(input) {
  const blocks = [];
  const summary = cleanBattleLogText(input.rollingSummary);
  if (summary) {
    const roundRange = input.summarizedThroughRound && input.summarizedThroughRound > 1 ? `（第 1～${input.summarizedThroughRound} 轮）` : input.summarizedThroughRound === 1 ? "（第 1 轮）" : "";
    blocks.push(`## 历史轮次摘要${roundRange}：
${summary}`);
  }
  const currentTitle = input.currentRound > 0 ? `## 当前轮次事件流水（第 ${input.currentRound} 轮）：` : "## 当前轮次事件流水（开局阶段）：";
  const lines = [currentTitle];
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
function formatIncrementalEvents(entries) {
  if (!entries.length) {
    return "## 新增事件（自上次决策）：\n- 无新增公开事件";
  }
  const lines = ["## 新增事件（自上次决策）："];
  let lastRound;
  let lastHeader = "";
  for (const entry of entries) {
    if (lastRound !== void 0 && entry.roundNumber !== lastRound && entry.roundNumber > 0) {
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
function buildDiscardPileReport(cards) {
  const bySuit = { 黑桃: 0, 红桃: 0, 梅花: 0, 方片: 0 };
  const nameCounts = /* @__PURE__ */ new Map();
  const formattedCards = [];
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
    cards: formattedCards
  };
}
function submitRoundSummaryTool() {
  return {
    type: "function",
    function: {
      name: SUBMIT_ROUND_SUMMARY_TOOL,
      description: "提交合并前情与刚结束一轮战报后的全局公开局势摘要（不超过300字）。",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "简要说明选择原因。", minLength: 1, maxLength: 200 },
          summary: { type: "string", description: "合并后的公开局势摘要（不超过300字，不臆测暗牌）。", minLength: 1, maxLength: 500 }
        },
        required: ["reason", "summary"],
        additionalProperties: false
      }
    }
  };
}
function buildRoundSummaryMessages(prevSummary, roundNumber, entries) {
  const roundLogText = formatRoundHistory({
    currentRound: roundNumber,
    entries,
    maxEntries: MAX_SUMMARY_SOURCE_ENTRIES
  });
  const prevSection = cleanBattleLogText(prevSummary) ? `## 已有历史前情摘要（第 1～${Math.max(1, roundNumber - 1)} 轮）：
${cleanBattleLogText(prevSummary)}

` : "";
  return [
    {
      role: "system",
      content: "你是三国杀对局战报记录员。请将「已有历史前情摘要」与「刚结束一轮的公开事件流水」合并压缩为一份不超过 300 字的客观公开局势摘要，并调用 submit_round_summary 提交。\n重点保留：各座次身份/阵营倾向暴露、限定技/觉醒技/大招消耗、关键牌（桃/酒/无懈可击/诸葛连弩等）消耗印象、重要伤害与濒死救援、阵亡归属。剔除常规摸牌弃牌细节，严禁臆测任何未公开手牌。\n重要要求：你的整个内部思考过程（reasoning_content）与工具参数必须全程使用简体中文。"
    },
    {
      role: "user",
      content: `${prevSection}${roundLogText}

请务必全程使用简体中文进行内部思考（reasoning_content）并生成中文局势摘要。`
    }
  ];
}
function clampSummaryText(text, maxChars = 350) {
  const cleaned = cleanBattleLogText(text);
  const codePoints = [...cleaned];
  if (codePoints.length <= maxChars) return cleaned;
  return `${codePoints.slice(0, maxChars - 1).join("")}…`;
}
function buildFallbackRoundSummary(prevSummary, roundNumber, entries, maxChars = MAX_SUMMARY_CHARS) {
  const keyTexts = entries.filter((item) => KEY_EVENT_RE.test(item.text)).map((item) => item.text);
  const source = keyTexts.length >= 2 ? keyTexts.slice(-6) : entries.slice(-6).map((item) => item.text);
  const roundDigest = source.length ? `第${roundNumber}轮：${source.join("；")}。` : "";
  const base = cleanBattleLogText(prevSummary);
  const merged = [base, roundDigest].filter(Boolean).join(" ");
  const codePoints = [...merged];
  if (codePoints.length <= maxChars) return merged;
  return `…${codePoints.slice(-(maxChars - 1)).join("")}`;
}
function formatDiscardCardName(card) {
  const rawBase = cleanBattleLogText(card.name || card.rawName || "未知卡牌");
  if ((rawBase === "杀" || rawBase === "sha") && card.nature) {
    const prefix = card.nature.split("|").filter(Boolean).map((item) => NATURE_LABELS[item] || cleanBattleLogText(item)).join("");
    return `${prefix}杀`;
  }
  return rawBase === "sha" ? "杀" : rawBase;
}
function normalizeSuitLabel(suit) {
  if (!suit) return "无色";
  const cleaned = cleanBattleLogText(suit);
  return SUIT_LABELS[cleaned] || "无色";
}
function formatCardRank(num) {
  if (num === void 0 || num === null || num === "" || num === 0) return "";
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
export {
  MAX_ROUND_LOG_ENTRIES,
  SUBMIT_ROUND_SUMMARY_TOOL,
  buildDiscardPileReport,
  buildFallbackRoundSummary,
  buildRoundSummaryMessages,
  clampSummaryText,
  cleanBattleLogText,
  formatBattleLogArgs,
  formatIncrementalEvents,
  formatPileOverview,
  formatRoundHistory,
  isRedundantTurnStartLog,
  sliceEventsSince,
  submitRoundSummaryTool
};
