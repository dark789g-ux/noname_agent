import "../../node_modules/.pnpm/openai@6.48.0_ws@8.19.0/node_modules/openai/index.js";
import { APIError, APIConnectionTimeoutError } from "../../node_modules/.pnpm/openai@6.48.0_ws@8.19.0/node_modules/openai/core/error.js";
function isUnsupportedParallelToolCalls(error) {
  if (!(error instanceof APIError) || ![400, 422].includes(error.status ?? 0)) return false;
  const details = error.error;
  const param = typeof details?.param === "string" ? details.param : "";
  const code = typeof details?.code === "string" ? details.code : "";
  const message = typeof details?.message === "string" ? details.message : error.message;
  const namesParameter = param === "parallel_tool_calls" || /\bparallel_tool_calls\b/i.test(message);
  const rejectsParameter = /unsupported|not supported|does not support|unknown|unrecognized|unrecognised|unexpected|not allowed|not permitted|invalid parameter|extra inputs? (?:are |is )?not permitted/i;
  return namesParameter && (rejectsParameter.test(code.replace(/_/g, " ")) || rejectsParameter.test(message));
}
async function requestWithParallelToolFallback(request, timeout, signal) {
  const deadline = Date.now() + timeout;
  try {
    return await request(true, timeout);
  } catch (error) {
    if (!isUnsupportedParallelToolCalls(error)) throw error;
    if (signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new APIConnectionTimeoutError();
    return request(false, remaining);
  }
}
export {
  isUnsupportedParallelToolCalls,
  requestWithParallelToolFallback
};
