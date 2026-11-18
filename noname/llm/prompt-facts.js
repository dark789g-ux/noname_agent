import { formatPlayerStates, formatPlayerProfiles, buildDecisionSnapshotParts } from "./prompt-format.js";
import { formatPileOverview, formatRoundHistory } from "./prompt-history.js";
const LLM_SYSTEM_PROMPT_PREFIX = "你是三国杀的 AI 玩家。根据当前场面从可用工具中选择最优动作，只返回一个工具调用。重要要求：你的整个内部思考过程（reasoning_content）与工具参数中的原因说明（reason），除了必要的短引用代号与工具名外，必须全程使用简体中文。\n\n基础规则：花色分♠︎黑桃/♣︎梅花/♥︎红桃/♦︎方片，颜色分黑(♠︎♣︎)/红(♥︎♦︎)，同颜色≠同花色。火攻：对有手牌角色使用，目标展示1张牌后，可弃1张同花色手牌造成1点火伤，无则放弃。";
const LLM_USER_CHINESE_REMINDER = "请务必全程使用简体中文进行内部思考（reasoning_content）并填写中文原因（reason）。";
function buildRefLabels(candidates, states) {
  const labels = {};
  for (const card of candidates.cards || []) {
    if (card.ref && card.name) labels[card.ref] = card.name;
  }
  for (const target of candidates.targets || []) {
    if (target.ref && target.name) labels[target.ref] = target.name;
  }
  for (const state of states || []) {
    if (state.ref && state.name) {
      labels[state.ref] = state.seat > 0 ? `${state.name}[座位${state.seat}]` : state.name;
    }
  }
  return labels;
}
function renderStatelessContextMessages(facts) {
  const pileOverviewText = formatPileOverview(facts.pileOverview);
  const roundHistoryText = formatRoundHistory(facts.roundHistory);
  const lines = [facts.decisionHeaderText];
  if (pileOverviewText) lines.push("", pileOverviewText);
  lines.push("", formatPlayerStates(facts.states));
  if (roundHistoryText) lines.push("", roundHistoryText);
  if (facts.decisionChoicesText) lines.push(facts.decisionChoicesText);
  return [
    {
      role: "system",
      content: `${LLM_SYSTEM_PROMPT_PREFIX}

${formatPlayerProfiles(facts.profiles)}`
    },
    {
      role: "user",
      content: `${lines.join("\n")}

${LLM_USER_CHINESE_REMINDER}`
    }
  ];
}
function buildFactsSnapshotParts(decisionPoint, event, candidates, options) {
  return buildDecisionSnapshotParts(decisionPoint, event, candidates, options);
}
export {
  LLM_SYSTEM_PROMPT_PREFIX,
  LLM_USER_CHINESE_REMINDER,
  buildFactsSnapshotParts,
  buildRefLabels,
  renderStatelessContextMessages
};
