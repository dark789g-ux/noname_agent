const traces = /* @__PURE__ */ new WeakMap();
let sequence = 0;
function decisionTrace(event) {
  const chain = [];
  let current = event;
  let skill = event?.skill;
  let traceId;
  while (current && typeof current === "object" && chain.length < 64 && !chain.includes(current)) {
    chain.push(current);
    traceId ||= traces.get(current);
    skill ||= current.skill || current.sourceSkill;
    if (skill) break;
    try {
      current = current.getParent?.(void 0, true);
    } catch {
      break;
    }
  }
  traceId ||= `decision_${++sequence}`;
  for (const item of skill ? chain : chain.slice(0, 1)) traces.set(item, traceId);
  return { traceId, ...typeof skill === "string" ? { skill } : {} };
}
export {
  decisionTrace
};
