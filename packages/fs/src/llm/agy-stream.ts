export interface AgyEventUpdate {
	reasoning: string;
	reasoningIsDelta: boolean;
	text: string;
	textIsDelta: boolean;
	hasStructured: boolean;
	structured: unknown;
	error: string;
}

function emptyAgyUpdate(): AgyEventUpdate {
	return {
		reasoning: "",
		reasoningIsDelta: false,
		text: "",
		textIsDelta: false,
		hasStructured: false,
		structured: undefined,
		error: "",
	};
}

/** 解析 agy JSON / stream-json 单条事件或最终输出对象。 */
export function extractAgyEventUpdate(event: any): AgyEventUpdate {
	if (!event || typeof event !== "object") return emptyAgyUpdate();

	// agy stream-json: {"event":"step_update","step_update":{...}}
	if (event.event === "step_update" || (event.step_update && typeof event.step_update === "object")) {
		const step = event.step_update && typeof event.step_update === "object" ? event.step_update : event;
		let reasoning = "";
		let reasoningIsDelta = false;
		if (typeof step.thinking_delta === "string" && step.thinking_delta) {
			reasoning = step.thinking_delta;
			reasoningIsDelta = true;
		} else if (typeof step.thinking === "string" && step.thinking) {
			reasoning = step.thinking;
		}

		let text = "";
		let textIsDelta = false;
		const stepType = typeof step.step_type === "string" ? step.step_type : "";
		if (!stepType || stepType === "agent_response") {
			if (typeof step.text_delta === "string" && step.text_delta) {
				text = step.text_delta;
				textIsDelta = true;
			} else if (typeof step.text === "string" && step.text) {
				text = step.text;
			}
		}
		return { reasoning, reasoningIsDelta, text, textIsDelta, hasStructured: false, structured: undefined, error: "" };
	}

	// agy stream-json {"event":"result","result":{...}} 与 --output-format json 顶层结构
	const resultNode =
		(event.event === "result" || event.type === "result") && event.result && typeof event.result === "object"
			? event.result
			: event;

	let reasoning = "";
	let reasoningIsDelta = false;
	if (typeof resultNode.thinking === "string") reasoning = resultNode.thinking;
	else if (typeof resultNode.reasoning_content === "string") reasoning = resultNode.reasoning_content;
	else if (typeof resultNode.reasoning === "string") reasoning = resultNode.reasoning;
	else if (typeof resultNode.step?.thinking === "string") reasoning = resultNode.step.thinking;
	else if (resultNode.item?.type === "reasoning" && typeof resultNode.item?.text === "string") reasoning = resultNode.item.text;
	else if (typeof resultNode.delta?.thinking === "string") {
		reasoning = resultNode.delta.thinking;
		reasoningIsDelta = true;
	} else if (typeof resultNode.delta?.reasoning_content === "string") {
		reasoning = resultNode.delta.reasoning_content;
		reasoningIsDelta = true;
	}

	const errorText = resultNode.status === "ERROR" && typeof resultNode.error === "string" && resultNode.error.trim()
		? resultNode.error.trim()
		: "";
	if (errorText) {
		return { reasoning, reasoningIsDelta, text: "", textIsDelta: false, hasStructured: false, structured: undefined, error: errorText };
	}

	if (resultNode.structured_output !== undefined) {
		return { reasoning, reasoningIsDelta, text: "", textIsDelta: false, hasStructured: true, structured: resultNode.structured_output, error: "" };
	}
	if (event.type === "result" && typeof event.result !== "object" && event.result !== undefined) {
		return { reasoning, reasoningIsDelta, text: "", textIsDelta: false, hasStructured: true, structured: event.result, error: "" };
	}

	let text = "";
	let textIsDelta = false;
	if (typeof resultNode.response === "string") text = resultNode.response;
	else if (typeof resultNode.result === "string") text = resultNode.result;
	else if (typeof resultNode.content === "string") text = resultNode.content;
	else if (typeof resultNode.message?.content === "string") text = resultNode.message.content;
	else if (typeof resultNode.delta?.text === "string") {
		text = resultNode.delta.text;
		textIsDelta = true;
	} else if (typeof resultNode.delta?.content === "string") {
		text = resultNode.delta.content;
		textIsDelta = true;
	}
	return { reasoning, reasoningIsDelta, text, textIsDelta, hasStructured: false, structured: undefined, error: "" };
}

/** 当流式过程中未直接命中终帧时，从完整 NDJSON 输出末尾逆序恢复 agy 结果。 */
export function recoverAgyNdjsonResult(
	ndjsonText: string,
	reasoningBuffer: string
): { rawOutput: unknown; reasoningContent?: string } | null {
	const lines = ndjsonText.split(/\r?\n/).reverse();
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const parsed = JSON.parse(trimmed);
			const update = extractAgyEventUpdate(parsed);
			if (update.error) {
				throw Object.assign(new Error(`agy CLI 返回错误: ${update.error}`), { stage: "fetch" });
			}
			if (update.hasStructured) {
				const reasoning = update.reasoning || reasoningBuffer;
				return { rawOutput: update.structured, ...(reasoning ? { reasoningContent: reasoning } : {}) };
			}
			if (update.text) {
				const reasoning = update.reasoning || reasoningBuffer;
				return { rawOutput: update.text, ...(reasoning ? { reasoningContent: reasoning } : {}) };
			}
		} catch (err: any) {
			if (err?.stage) throw err;
		}
	}
	return null;
}
