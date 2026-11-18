function parseActionProposal(toolCall) {
  const args = toolCall.arguments || {};
  const refs = (plural, legacy, prefix) => {
    const values = Array.isArray(args[plural]) ? args[plural] : Array.isArray(args[legacy]) ? args[legacy] : [];
    return values.map((value) => typeof value === "number" ? `${prefix}${value}` : String(value));
  };
  const cardRefs = Array.isArray(args.card_refs) ? args.card_refs.map(String) : args.card_ref ? [String(args.card_ref)] : Array.isArray(args.card_ids) ? args.card_ids.map(String) : args.card_id ? [String(args.card_id)] : [];
  const targetRefs = refs("target_refs", "target_ids", "p");
  switch (toolCall.name) {
    case "use_card":
      return { kind: "card", cardRefs, targetRefs };
    case "respond_card":
      return { kind: "respond", cardRefs };
    case "discard_cards":
      return { kind: "discard", cardRefs };
    case "use_skill":
      return { kind: "skill", skillName: args.skill_name, cardRefs, targetRefs };
    case "pass":
      return { kind: "pass" };
    case "yes":
      return { kind: "bool", bool: true };
    case "no":
      return { kind: "bool", bool: false };
    default:
      throw protocolError(`Unknown tool name: ${toolCall.name}`);
  }
}
function assertActionAllowed(proposal, forced) {
  if (forced && proposal.kind === "pass") throw protocolError("pass is not legal for a forced event");
}
function uniqueLegacyMatch(values, id, getId) {
  const matches = values.filter((value) => getId(value) === id);
  if (matches.length > 1) throw protocolError(`legacy card_id "${id}" is ambiguous`);
  return matches[0];
}
function selectionRequired(range, explicit) {
  return explicit ?? range[0] > 0;
}
function isExplicitMultiTurnRejection(error) {
  if (![400, 422].includes(Number(error?.httpStatus))) return false;
  return /(tool[_ -]?call|tool role|role.?tool|messages?.*tool|json schema|function.?call)/i.test(String(error?.message || ""));
}
function remainingTimeoutSec(timeoutSec, deadline, now = Date.now()) {
  const remaining = deadline - now;
  if (remaining <= 0) throw protocolError("LLM decision timed out", "fetch");
  return Math.max(1, Math.min(timeoutSec, Math.ceil(remaining / 1e3)));
}
function assistantToolMessage(call) {
  const argumentsWithReason = call.reason === void 0 ? call.arguments : { ...call.arguments, reason: call.reason };
  const message = { role: "assistant", content: null, tool_calls: [{ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(argumentsWithReason) } }] };
  if (call.reasoningContent !== void 0) message.reasoning_content = call.reasoningContent;
  return message;
}
function materializeDirectShape(kind, values) {
  const cards = values.cards || [];
  const targets = values.targets || [];
  const buttons = values.buttons || [];
  switch (kind) {
    case "chooseCard":
      return { bool: true, cards };
    case "chooseTarget":
      return { bool: true, targets };
    case "chooseCardTarget":
      return { bool: true, cards, targets };
    case "chooseToGive":
      return { bool: true, cards };
    case "chooseButton":
      return { bool: true, buttons, links: buttons.map((button) => button.link) };
    case "chooseButtonTarget":
      return { bool: true, buttons, links: buttons.map((button) => button.link), targets };
    case "chooseControl":
      return { bool: true, control: values.control, index: (values.controls || []).indexOf(values.control) };
    case "chooseNumbers":
      return { bool: true, numbers: values.numbers || [] };
    default:
      throw protocolError(`unsupported direct result: ${kind}`);
  }
}
const SENSITIVE_LOG_KEYS = /* @__PURE__ */ new Set(["authorization", "proxy-authorization", "api-key", "apikey", "api_key", "x-api-key", "access_token", "refresh_token", "token", "secret", "password"]);
function plainLogValue(value) {
  const seen = /* @__PURE__ */ new WeakSet();
  const visit = (current, inArray = false) => {
    if (current === null || typeof current === "string" || typeof current === "boolean") return current;
    if (typeof current === "number") return Number.isFinite(current) ? current : null;
    if (["undefined", "function", "symbol", "bigint"].includes(typeof current)) return inArray ? null : void 0;
    if (typeof current !== "object") return inArray ? null : void 0;
    if (seen.has(current)) return "[circular]";
    seen.add(current);
    try {
      if (Array.isArray(current)) return current.map((item) => visit(item, true));
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) return inArray ? null : void 0;
      const result = {};
      for (const key of Object.keys(current)) {
        let plain;
        if (SENSITIVE_LOG_KEYS.has(key.toLowerCase())) plain = "[REDACTED]";
        else {
          let item;
          try {
            item = current[key];
          } catch (_error) {
            continue;
          }
          plain = visit(item);
        }
        if (plain === void 0) continue;
        Object.defineProperty(result, key, { value: plain, enumerable: true, configurable: true, writable: true });
      }
      return result;
    } catch (_error) {
      return inArray ? null : void 0;
    } finally {
      seen.delete(current);
    }
  };
  return visit(value) ?? null;
}
function protocolError(message, stage = "translate") {
  const error = new Error(message);
  error.stage = stage;
  return error;
}
export {
  assertActionAllowed,
  assistantToolMessage,
  isExplicitMultiTurnRejection,
  materializeDirectShape,
  parseActionProposal,
  plainLogValue,
  remainingTimeoutSec,
  selectionRequired,
  uniqueLegacyMatch
};
