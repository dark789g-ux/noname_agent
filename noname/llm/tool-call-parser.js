function parseToolCallResult(id, name, rawArgs, reasoningContent) {
  let parsed;
  try {
    parsed = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
  } catch {
    throwParseError(`Bad tool_call arguments JSON: ${rawArgs}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throwParseError("tool_call arguments must be a non-null object");
  }
  try {
    const values = parsed;
    if (!Object.hasOwn(values, "reason") || typeof values.reason !== "string") {
      throwParseError("tool_call arguments.reason must be a string");
    }
    const reason = values.reason.trim();
    const reasonLength = [...reason].length;
    if (reasonLength < 1 || reasonLength > 200) {
      throwParseError("tool_call arguments.reason must contain 1 to 200 characters");
    }
    const argumentsWithoutReason = Object.fromEntries(Object.entries(values).filter(([key]) => key !== "reason"));
    const result = { id, name, reason, arguments: argumentsWithoutReason };
    if (typeof reasoningContent === "string" && reasoningContent.length > 0) {
      result.reasoningContent = reasoningContent;
    }
    return result;
  } catch (error) {
    if (error?.stage === "parse") throw error;
    throwParseError("Unable to read tool_call arguments");
  }
}
function throwParseError(message) {
  const error = new Error(message);
  error.stage = "parse";
  throw error;
}
export {
  parseToolCallResult
};
