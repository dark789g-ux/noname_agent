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
