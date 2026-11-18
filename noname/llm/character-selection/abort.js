function assertNotAborted(signal) {
  if (signal?.aborted) throw new DOMException("选将请求已取消", "AbortError");
}
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("选将请求已取消", "AbortError"));
    if (signal.aborted) {
      promise.catch(() => {
      });
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
export {
  abortable,
  assertNotAborted
};
