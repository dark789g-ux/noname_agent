import { ref } from "vue";
import type { LogEntry } from "@/llm/logger-types.js";

export interface LLMLogStatusPresentation {
	className: string;
	icon: string;
	text: string;
}

const statusPresentations: Record<string, LLMLogStatusPresentation> = {
	success: { className: "llm-log-status-success", icon: "✓", text: "成功" },
	fallback: { className: "llm-log-status-fallback", icon: "↩", text: "回退" },
	error: { className: "llm-log-status-error", icon: "✗", text: "错误" },
	timeout: { className: "llm-log-status-timeout", icon: "⏱", text: "超时" },
	interrupted: { className: "llm-log-status-interrupted", icon: "⚠", text: "中断" },
};

const defaultPresentation: LLMLogStatusPresentation = {
	className: "llm-log-status-unknown",
	icon: "?",
	text: "未知",
};

export function getLLMLogStatusPresentation(status: string): LLMLogStatusPresentation {
	return statusPresentations[status] || { ...defaultPresentation, text: status || defaultPresentation.text };
}

export function getLLMLogStatusDetail(status: string, fallbackReason?: string): string | undefined {
	if (status === "interrupted") {
		return "页面已关闭、崩溃，或记录所属页面实例已失活；无法据此判断该对局是否已回退本地 AI。";
	}
	return fallbackReason;
}

/** 剥离单独展示的 reasoningContent，避免 tool_call JSON 块重复显示长思考文本。 */
export function stripToolCallReasoning<T extends Record<string, any>>(toolCall: T): Omit<T, "reasoningContent"> {
	const { reasoningContent: _reasoningContent, ...rest } = toolCall;
	return rest;
}

/** 摘要条目按需加载完整请求上下文，并在并发切换时通过 isCurrent 丢弃过期回调。 */
export async function loadLogDetailEntry(
	entry: LogEntry,
	fetchDetail: (id: string) => Promise<LogEntry | undefined>,
	setLoading: (loading: boolean) => void,
	isCurrent: () => boolean,
	onLoaded: (full: LogEntry) => void
): Promise<void> {
	if (entry.detailLoaded === true || entry.request !== undefined) {
		setLoading(false);
		return;
	}
	setLoading(true);
	try {
		const full = await fetchDetail(entry.id);
		if (full && isCurrent()) onLoaded(full);
	} finally {
		if (isCurrent()) setLoading(false);
	}
}

/** 管理单条日志详情的选中态、异步拉取及并发切换竞态保护。 */
export function useLogDetailLoader(fetchDetail: (id: string) => Promise<LogEntry | undefined>) {
	const selectedDetail = ref<LogEntry | null>(null);
	const detailLoading = ref(false);
	let detailGeneration = 0;

	function closeDetail(): void {
		detailGeneration++;
		detailLoading.value = false;
		selectedDetail.value = null;
	}

	async function openDetail(entry: LogEntry): Promise<void> {
		const generation = ++detailGeneration;
		selectedDetail.value = entry;
		await loadLogDetailEntry(
			entry,
			fetchDetail,
			value => {
				detailLoading.value = value;
			},
			() => generation === detailGeneration && selectedDetail.value?.id === entry.id,
			full => {
				selectedDetail.value = full;
			}
		);
	}

	return {
		selectedDetail,
		detailLoading,
		openDetail,
		closeDetail,
	};
}
