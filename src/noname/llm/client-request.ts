import { APIConnectionTimeoutError, APIError } from "openai";

/** Only downgrade when the provider explicitly rejects this particular parameter. */
export function isUnsupportedParallelToolCalls(error: unknown): boolean {
	if (!(error instanceof APIError) || ![400, 422].includes(error.status ?? 0)) return false;
	const details = error.error as { param?: unknown; code?: unknown; message?: unknown } | undefined;
	const param = typeof details?.param === "string" ? details.param : "";
	const code = typeof details?.code === "string" ? details.code : "";
	const message = typeof details?.message === "string" ? details.message : error.message;
	const namesParameter = param === "parallel_tool_calls" || /\bparallel_tool_calls\b/i.test(message);
	const rejectsParameter = /unsupported|not supported|does not support|unknown|unrecognized|unrecognised|unexpected|not allowed|not permitted|invalid parameter|extra inputs? (?:are |is )?not permitted/i;
	return namesParameter && (rejectsParameter.test(code.replace(/_/g, " ")) || rejectsParameter.test(message));
}

/**
 * Try the explicit single-tool setting first; retry once without it only for
 * providers that reject the parameter. Both attempts share a timeout budget.
 */
export async function requestWithParallelToolFallback<T>(
	request: (includeParameter: boolean, timeout: number) => Promise<T>,
	timeout: number,
	signal?: AbortSignal
): Promise<T> {
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
