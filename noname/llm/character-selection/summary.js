let summaries = /* @__PURE__ */ new WeakMap();
function resetOpeningSummaries() {
  summaries = /* @__PURE__ */ new WeakMap();
}
function setOpeningSummary(player, summary) {
  summaries.set(player, { characters: summary.characters.slice(), group: summary.group, reason: [...summary.reason].slice(0, 200).join("") });
}
function getOpeningSummary(player) {
  const summary = summaries.get(player);
  return summary ? `## 你自己的开局选将记录
${JSON.stringify(summary)}` : "";
}
export {
  getOpeningSummary,
  resetOpeningSummaries,
  setOpeningSummary
};
