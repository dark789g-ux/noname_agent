const RETRY_DELAYS = [100, 500, 2000];

export interface LLMLogPersistenceQueueOptions {
	reclaimQuota: () => Promise<unknown>;
	report: (operation: string, error: unknown) => void;
	sleep?: (milliseconds: number) => Promise<void>;
}

function isQuotaError(error: unknown): boolean {
	return (error as DOMException | undefined)?.name === "QuotaExceededError";
}

function defaultSleep(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** A failed start/turn checkpoint must be retried even before a decision ends. */
export function shouldRetryPendingLogWrites(pendingActives: number, pendingFinals: number): boolean {
	return pendingActives > 0 || pendingFinals > 0;
}

/** Retries checkpoints left in memory after a prior persistence failure. */
export async function retryPendingActiveCheckpoints<T>(pending: Map<string, T>, isStillActive: (id: string) => boolean, putActive: (active: T) => Promise<boolean>): Promise<void> {
	for (const [id, active] of Array.from(pending)) {
		if (!isStillActive(id)) {
			pending.delete(id);
			continue;
		}
		const persisted = await putActive(active);
		if (persisted && pending.get(id) === active) pending.delete(id);
	}
}

/** Serializes persistence work and keeps failed operations out of the unhandled-rejection path. */
export class LLMLogPersistenceQueue {
	private readonly reclaimQuota: () => Promise<unknown>;
	private readonly report: (operation: string, error: unknown) => void;
	private readonly sleep: (milliseconds: number) => Promise<void>;
	private pending: Promise<void> = Promise.resolve();

	constructor(options: LLMLogPersistenceQueueOptions) {
		this.reclaimQuota = options.reclaimQuota;
		this.report = options.report;
		this.sleep = options.sleep || defaultSleep;
	}

	enqueue(operation: string, task: () => Promise<void>): void {
		void this.enqueueCritical(operation, task).catch(() => {});
	}

	/** Queues an explicit management operation while preserving its final error for the caller. */
	enqueueCritical(operation: string, task: () => Promise<void>): Promise<void> {
		const result = this.pending.then(() => retryLLMLogPersistence(operation, task, this.reclaimQuota, this.sleep));
		this.pending = result.catch(error => this.report(operation, error));
		return result;
	}

	async drain(): Promise<void> {
		await this.pending;
	}

}

export async function retryLLMLogPersistence(operation: string, task: () => Promise<void>, reclaimQuota: () => Promise<unknown>, sleep = defaultSleep): Promise<void> {
	let quotaRetried = false;
	let error: unknown;
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
