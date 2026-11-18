import { llmURLProblem, isLLMTextKey, normalizeLLMText } from "./config.js";
function showMessage(input, message, invalid) {
  input.setAttribute("aria-invalid", String(invalid));
  input.title = message;
  let status = input.parentElement?.querySelector(".llm-config-message");
  if (!status) {
    status = input.ownerDocument.createElement("span");
    status.className = "llm-config-message";
    status.setAttribute("role", "status");
    Object.assign(status.style, { position: "relative", display: "block", clear: "both", fontSize: "12px", paddingTop: "4px", whiteSpace: "normal" });
    input.parentElement?.append(status);
  }
  status.style.color = invalid ? "#ff8c8c" : "";
  status.textContent = message;
}
function saveLLMTextInput(input, key, save) {
  const value = (input.textContent ?? "").trim();
  input.textContent = value;
  const problem = key === "llm_url" && value ? llmURLProblem(value) : void 0;
  showMessage(input, problem ? `未保存：${problem}` : "已保存，下局生效", !!problem);
  if (!problem) save(key, value);
}
function initLLMTextInput(input, config) {
  if (!isLLMTextKey(config._name)) return false;
  input.textContent = normalizeLLMText(config.init, input.ownerDocument);
  const problem = config._name === "llm_url" && input.textContent ? llmURLProblem(input.textContent) : void 0;
  if (problem) showMessage(input, `未保存：${problem}`, true);
  input.onpaste = (event) => {
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
export {
  initLLMTextInput,
  saveLLMTextInput
};
