import type { LogEntry, StreamUsage } from "../../../../../llm/logger-types.js";

export type TimelineMarkerKind = "session_start" | "session_rebuild" | "incremental" | "degraded";

export interface TimelineMarker {
	kind: TimelineMarkerKind;
	icon: string;
	label: string;
}

export interface SessionStatusInfo {
	playerName: string;
	playerSeatNum: number;
	backendLabel: string;
	model: string;
	modeText: string;
	contextUsed?: number;
	contextSize?: number;
	contextPercent?: number;
}

export function formatClockTime(ts: number): string {
	const d = new Date(ts);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	const ss = String(d.getSeconds()).padStart(2, "0");
	return `${hh}:${mm}:${ss}`;
}

export function formatDurationSec(ms: number | undefined): string {
	if (ms === undefined || !Number.isFinite(ms)) return "0s";
	if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
	const sec = ms / 1000;
	return sec >= 10 ? `${Math.round(sec)}s` : `${sec.toFixed(1).replace(/\.0$/, "")}s`;
}

export function formatCompactTokens(tokens: number | undefined): string {
	if (tokens === undefined || !Number.isFinite(tokens)) return "--";
	if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
	if (tokens >= 1000) return `${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return String(Math.round(tokens));
}

export function formatUsageSummary(usage: StreamUsage | undefined): string {
	if (!usage) return "";
	const parts: string[] = [];
	if (usage.inputTokens != null) parts.push(`↑${formatCompactTokens(usage.inputTokens)}`);
	if (usage.outputTokens != null) parts.push(`↓${formatCompactTokens(usage.outputTokens)}`);
	if (usage.thoughtTokens != null) parts.push(`∴${formatCompactTokens(usage.thoughtTokens)}`);
	return parts.join(" · ");
}

export function buildTimelineMarkers(entry: LogEntry, index: number): TimelineMarker[] {
	const markers: TimelineMarker[] = [];
	const session = entry.session;
	if (!session) return markers;

	if (session.rebuilt) {
		markers.push({
			kind: "session_rebuild",
			icon: "↻",
			label: `会话重建${session.rebuildReason ? `（${session.rebuildReason}）` : ""}`,
		});
	} else if (index === 0 && session.mode === "full") {
		markers.push({
			kind: "session_start",
			icon: "↻",
			label: "会话建立（首次全量上下文）",
		});
	} else if (session.mode === "incremental") {
		const count = session.addedEventsCount ?? 0;
		markers.push({
			kind: "incremental",
			icon: "⇡",
			label: count > 0 ? `增量上下文：新增 ${count} 条牌局事件` : "增量上下文：续接常驻会话",
		});
	}

	if (session.degraded) {
		markers.push({
			kind: "degraded",
			icon: "⚠",
			label: `已降级为无状态请求${session.degradeReason ? `（${session.degradeReason}）` : ""}`,
		});
	}

	return markers;
}

function resolveRef(value: unknown, refLabels?: Record<string, string>): string {
	if (typeof value !== "string") return JSON.stringify(value);
	return refLabels?.[value] || value;
}

export function formatToolCallSummary(
	name: string,
	args: unknown,
	refLabels?: Record<string, string>
): string {
	if (!args || typeof args !== "object") return name;
	const record = args as Record<string, unknown>;
	const detailParts: string[] = [];

	if (typeof record.skill === "string") detailParts.push(record.skill);
	if (typeof record.cardRef === "string") {
		detailParts.push(resolveRef(record.cardRef, refLabels));
	} else if (Array.isArray(record.cardRefs) && record.cardRefs.length > 0) {
		detailParts.push(record.cardRefs.map(r => resolveRef(r, refLabels)).join(", "));
	}
	if (Array.isArray(record.targetRefs) && record.targetRefs.length > 0) {
		detailParts.push(`→ ${record.targetRefs.map(r => resolveRef(r, refLabels)).join(", ")}`);
	} else if (typeof record.targetRef === "string") {
		detailParts.push(`→ ${resolveRef(record.targetRef, refLabels)}`);
	}
	if (typeof record.option === "string") detailParts.push(`选项: ${record.option}`);
	if (Array.isArray(record.buttonRefs) && record.buttonRefs.length > 0) {
		detailParts.push(`按钮: ${record.buttonRefs.map(r => resolveRef(r, refLabels)).join(", ")}`);
	}
	if (typeof record.choice === "boolean") detailParts.push(record.choice ? "确认" : "取消");

	if (detailParts.length === 0) {
		const fallbackKeys = Object.keys(record).filter(k => k !== "reason");
		if (fallbackKeys.length > 0) {
			return `${name}(${fallbackKeys.map(k => `${k}: ${resolveRef(record[k], refLabels)}`).join(", ")})`;
		}
		return name;
	}
	return `${name}(${detailParts.join(" ")})`;
}

export function deriveSessionStatusInfo(
	playerName: string,
	playerSeatNum: number,
	currentCall: LogEntry | null,
	history: LogEntry[]
): SessionStatusInfo {
	const latest = currentCall || history[history.length - 1] || null;
	const backendLabel = latest?.meta.providerLabel || latest?.meta.backend || "LLM";
	const model = latest?.meta.model || "(未设置模型)";
	const session = latest?.session;
	let modeText = "未连接";
	if (session) {
		if (session.degraded) modeText = "已降级无状态";
		else if (session.mode === "incremental" || session.sessionKey) modeText = "常驻会话";
		else modeText = "全量/无状态";
	} else if (latest) {
		modeText = "无状态";
	}
	const contextUsed = session?.contextUsed;
	const contextSize = session?.contextSize;
	const contextPercent =
		contextUsed != null && contextSize && contextSize > 0
			? Math.min(100, Math.round((contextUsed / contextSize) * 100))
			: undefined;

	return {
		playerName,
		playerSeatNum,
		backendLabel,
		model,
		modeText,
		contextUsed,
		contextSize,
		contextPercent,
	};
}
