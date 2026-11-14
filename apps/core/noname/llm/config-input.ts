import { isLLMTextKey, llmURLProblem, normalizeLLMText, type LLMTextKey } from "./config.js";

function showMessage(input: HTMLElement, message: string, invalid: boolean): void {
	input.setAttribute("aria-invalid", String(invalid));
	input.title = message;
	let status = input.parentElement?.querySelector<HTMLElement>(".llm-config-message");
	if (!status) {
		status = input.ownerDocument.createElement("span");
		status.className = "llm-config-message";
		status.setAttribute("role", "status");
		// 使用独立一行，避免错误提示挤压地址输入框。
		Object.assign(status.style, { position: "relative", display: "block", clear: "both", fontSize: "12px", paddingTop: "4px", whiteSpace: "normal" });
		input.parentElement?.append(status);
	}
	status.style.color = invalid ? "#ff8c8c" : "";
	status.textContent = message;
}

export function saveLLMTextInput(input: HTMLElement, key: LLMTextKey, save: (key: string, value: string) => unknown): void {
	const value = (input.textContent ?? "").trim();
	input.textContent = value;
	const problem = key === "llm_url" && value ? llmURLProblem(value) : undefined;
	showMessage(input, problem ? `未保存：${problem}` : "已保存，下局生效", !!problem);
	if (!problem) save(key, value);
}

export function initLLMTextInput(input: HTMLElement, config: { _name?: string; init?: unknown }): boolean {
	if (!isLLMTextKey(config._name)) return false;
	input.textContent = normalizeLLMText(config.init, input.ownerDocument);
	const problem = config._name === "llm_url" && input.textContent ? llmURLProblem(input.textContent) : undefined;
	if (problem) showMessage(input, `未保存：${problem}`, true);
	input.onpaste = event => {
		event.preventDefault();
		const text = event.clipboardData?.getData("text/plain") ?? "";
		const selection = input.ownerDocument.getSelection();
		if (selection?.rangeCount && input.contains(selection.getRangeAt(0).commonAncestorContainer)) {
			const range = selection.getRangeAt(0);
			range.deleteContents();
			const node = input.ownerDocument.createTextNode(text);
			range.insertNode(node);
			range.setStartAfter(node);
			range.collapse(true);
			selection.removeAllRanges();
			selection.addRange(range);
		} else {
			input.append(input.ownerDocument.createTextNode(text));
		}
	};
	return true;
}
