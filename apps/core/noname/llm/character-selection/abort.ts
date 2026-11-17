/** 不依赖 AbortSignal.throwIfAborted（浏览器最低支持 Chromium 91）。 */
export function assertNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw new DOMException("选将请求已取消", "AbortError");
}

/** 即使 provider 忽略取消信号，也立即结束等待并拒绝迟到结果。 */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(new DOMException("选将请求已取消", "AbortError"));
		if (signal.aborted) {
			promise.catch(() => {});
			abort();
			return;
		}
		signal.addEventListener("abort", abort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
	});
}
