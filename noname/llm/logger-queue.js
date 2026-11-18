const RETRY_DELAYS = [100, 500, 2e3];
function isQuotaError(error) {
  return error?.name === "QuotaExceededError";
}
function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function shouldRetryPendingLogWrites(pendingActives, pendingFinals) {
  return pendingActives > 0 || pendingFinals > 0;
}
async function retryPendingActiveCheckpoints(pending, isStillActive, putActive) {
  for (const [id, active] of Array.from(pending)) {
    if (!isStillActive(id)) {
      pending.delete(id);
      continue;
    }
    const persisted = await putActive(active);
    if (persisted && pending.get(id) === active) pending.delete(id);
  }
}
class LLMLogPersistenceQueue {
  reclaimQuota;
  report;
  sleep;
  pending = Promise.resolve();
  constructor(options) {
    this.reclaimQuota = options.reclaimQuota;
    this.report = options.report;
    this.sleep = options.sleep || defaultSleep;
  }
  enqueue(operation, task) {
    void this.enqueueCritical(operation, task).catch(() => {
    });
  }
  /** Queues an explicit management operation while preserving its final error for the caller. */
  enqueueCritical(operation, task) {
    const result = this.pending.then(() => retryLLMLogPersistence(operation, task, this.reclaimQuota, this.sleep));
    this.pending = result.catch((error) => this.report(operation, error));
    return result;
  }
  async drain() {
    await this.pending;
  }
}
async function retryLLMLogPersistence(operation, task, reclaimQuota, sleep = defaultSleep) {
  let quotaRetried = false;
  let error;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      await task();
      return;
    } catch (currentError) {
      error = currentError;
      if (isQuotaError(currentError) && !quotaRetried) {
        quotaRetried = true;
        try {
          await reclaimQuota();
          await task();
          return;
        } catch (quotaError) {
          error = quotaError;
        }
      }
      if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt]);
    }
  }
  throw error instanceof Error ? error : new Error(`${operation} persistence failed`);
}
export {
  LLMLogPersistenceQueue,
  retryLLMLogPersistence,
  retryPendingActiveCheckpoints,
  shouldRetryPendingLogWrites
};
