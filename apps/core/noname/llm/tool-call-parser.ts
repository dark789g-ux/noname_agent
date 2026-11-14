export interface ToolCallResult {
	id: string;
	name: string;
	reason: string;
	reasoningContent?: string;
	arguments: Record<string, any>;
}

/** 解析并校验 function arguments，供 OpenAI SDK 与 CLI 桥接共用。 */
export function parseToolCallResult(id: string, name: string, rawArgs: unknown, reasoningContent?: string): ToolCallResult {
	let parsed: unknown;
	try {
		parsed = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
	} catch {
		throwParseError(`Bad tool_call arguments JSON: ${rawArgs}`);
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		throwParseError("tool_call arguments must be a non-null object");
	}
	try {
		const values = parsed as Record<string, any>;
		if (!Object.hasOwn(values, "reason") || typeof values.reason !== "string") {
			throwParseError("tool_call arguments.reason must be a string");
		}
		const reason = values.reason.trim();
		const reasonLength = [...reason].length;
		if (reasonLength < 1 || reasonLength > 200) {
			throwParseError("tool_call arguments.reason must contain 1 to 200 characters");
		}
		const argumentsWithoutReason = Object.fromEntries(Object.entries(values).filter(([key]) => key !== "reason"));
		const result: ToolCallResult = { id, name, reason, arguments: argumentsWithoutReason };
		if (typeof reasoningContent === "string" && reasoningContent.length > 0) {
			result.reasoningContent = reasoningContent;
		}
		return result;
	} catch (error: any) {
		if (error?.stage === "parse") throw error;
		throwParseError("Unable to read tool_call arguments");
	}
}

function throwParseError(message: string): never {
	const error: any = new Error(message);
	error.stage = "parse";
	throw error;
}
