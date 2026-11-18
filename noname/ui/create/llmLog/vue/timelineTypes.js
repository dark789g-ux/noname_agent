function formatClockTime(ts, includeMs = false) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  if (!includeMs) return `${hh}:${mm}:${ss}`;
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}
function formatFullTime(ts, includeMs = false) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day} ${formatClockTime(ts, includeMs)}`;
}
function formatDurationSec(ms) {
  if (ms === void 0 || !Number.isFinite(ms)) return "0s";
  if (ms < 1e3) return `${Math.max(0, Math.round(ms))}ms`;
  const sec = ms / 1e3;
  return sec >= 10 ? `${Math.round(sec)}s` : `${sec.toFixed(1).replace(/\.0$/, "")}s`;
}
function formatMs(value) {
  return value === void 0 ? "--" : `${Math.round(value)}ms`;
}
function formatJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
function formatCompactTokens(tokens) {
  if (tokens === void 0 || !Number.isFinite(tokens)) return "--";
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(tokens));
}
function formatUsageSummary(usage) {
  if (!usage) return "";
  const parts = [];
  if (usage.inputTokens != null) parts.push(`↑${formatCompactTokens(usage.inputTokens)}`);
  if (usage.outputTokens != null) parts.push(`↓${formatCompactTokens(usage.outputTokens)}`);
  if (usage.thoughtTokens != null) parts.push(`∴${formatCompactTokens(usage.thoughtTokens)}`);
  return parts.join(" · ");
}
function buildTimelineMarkers(entry, _index) {
  const markers = [];
  const session = entry.session;
  if (!session) return markers;
  if (session.rebuilt) {
    markers.push({
      kind: "session_rebuild",
      icon: "↻",
      label: `会话重建${session.rebuildReason ? `（${session.rebuildReason}）` : ""}`
    });
  } else if (session.mode === "full") {
    markers.push({
      kind: "session_start",
      icon: "↻",
      label: entry.decisionPoint === "chooseCharacter" ? "选将独立会话（结束后清理）" : "对局会话建立（全量上下文）"
    });
  } else if (session.mode === "incremental") {
    const count = session.addedEventsCount ?? 0;
    markers.push({
      kind: "incremental",
      icon: "⇡",
      label: count > 0 ? `增量上下文：新增 ${count} 条牌局事件` : "增量上下文：续接常驻会话"
    });
  }
  if (session.degraded) {
    markers.push({
      kind: "degraded",
      icon: "⚠",
      label: `已降级为无状态请求${session.degradeReason ? `（${session.degradeReason}）` : ""}`
    });
  }
  return markers;
}
function resolveRef(value, refLabels) {
  if (typeof value !== "string") return JSON.stringify(value);
  return refLabels?.[value] || value;
}
function formatToolCallSummary(name, args, refLabels) {
  if (!args || typeof args !== "object") return name;
  const record = args;
  const detailParts = [];
  if (name === "select_character" && Array.isArray(record.characters)) {
    detailParts.push(record.characters.map((choice) => resolveRef(choice.version, refLabels)).join(" / "));
    if (typeof record.group === "string") detailParts.push(`势力: ${record.group}`);
  }
  if (typeof record.skill === "string") detailParts.push(record.skill);
  if (typeof record.cardRef === "string") {
    detailParts.push(resolveRef(record.cardRef, refLabels));
  } else if (Array.isArray(record.cardRefs) && record.cardRefs.length > 0) {
    detailParts.push(record.cardRefs.map((r) => resolveRef(r, refLabels)).join(", "));
  }
  if (Array.isArray(record.targetRefs) && record.targetRefs.length > 0) {
    detailParts.push(`→ ${record.targetRefs.map((r) => resolveRef(r, refLabels)).join(", ")}`);
  } else if (typeof record.targetRef === "string") {
    detailParts.push(`→ ${resolveRef(record.targetRef, refLabels)}`);
  }
  if (typeof record.option === "string") detailParts.push(`选项: ${record.option}`);
  if (Array.isArray(record.buttonRefs) && record.buttonRefs.length > 0) {
    detailParts.push(`按钮: ${record.buttonRefs.map((r) => resolveRef(r, refLabels)).join(", ")}`);
  }
  if (typeof record.choice === "boolean") detailParts.push(record.choice ? "确认" : "取消");
  if (detailParts.length === 0) {
    const fallbackKeys = Object.keys(record).filter((k) => k !== "reason");
    if (fallbackKeys.length > 0) {
      return `${name}(${fallbackKeys.map((k) => `${k}: ${resolveRef(record[k], refLabels)}`).join(", ")})`;
    }
    return name;
  }
  return `${name}(${detailParts.join(" ")})`;
}
function formatCharacterSelectionResult(result, refLabels) {
  if (!Array.isArray(result?.characters)) return "";
  return result.characters.map((name) => resolveRef(name, refLabels)).join(" / ") + (result.group ? ` · 势力 ${result.group}` : "");
}
function deriveSessionStatusInfo(playerName, playerSeatNum, currentCall, history, fallback) {
  const latest = currentCall || history[history.length - 1] || null;
  const backendLabel = latest?.meta.providerLabel || latest?.meta.backend || fallback?.backendLabel || "LLM";
  const model = latest?.meta.model || fallback?.model || "(未设置模型)";
  const session = latest?.session;
  let modeText = fallback?.configured ? "已就绪" : "未连接";
  if (session) {
    if (latest?.decisionPoint === "chooseCharacter") modeText = currentCall ? "选将独立会话" : "选将会话已结束";
    else if (session.degraded) modeText = "已降级无状态";
    else if (session.mode === "incremental" || session.sessionKey) modeText = "常驻会话";
    else modeText = "全量/无状态";
  } else if (latest) {
    modeText = "无状态";
  }
  const contextUsed = session?.contextUsed;
  const contextSize = session?.contextSize;
  const contextPercent = contextUsed != null && contextSize && contextSize > 0 ? Math.min(100, Math.round(contextUsed / contextSize * 100)) : void 0;
  return {
    playerName,
    playerSeatNum,
    backendLabel,
    model,
    modeText,
    contextUsed,
    contextSize,
    contextPercent
  };
}
function formatShortLogId(id) {
  const trimmed = id.trim();
  if (!trimmed) return "";
  const lastUnderscore = trimmed.lastIndexOf("_");
  const suffix = lastUnderscore >= 0 && lastUnderscore < trimmed.length - 1 ? trimmed.slice(lastUnderscore + 1) : trimmed;
  return `#${suffix.slice(-6)}`;
}
async function copyToClipboard(text) {
  if (!text) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
    }
  }
  if (typeof document === "undefined" || !document.body) return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
export {
  buildTimelineMarkers,
  copyToClipboard,
  deriveSessionStatusInfo,
  formatCharacterSelectionResult,
  formatClockTime,
  formatCompactTokens,
  formatDurationSec,
  formatFullTime,
  formatJson,
  formatMs,
  formatShortLogId,
  formatToolCallSummary,
  formatUsageSummary
};
