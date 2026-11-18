/** 与引擎无关的轮次状态：跳过保留已完成结果；失效则禁止任何写回。 */
export class OpeningState {
	skipped = false;
	valid = true;
	completed = 0;
	fallbacks = 0;
	readonly active = new Map<number, AbortController>();

	skip(): void {
		this.skipped = true;
		for (const controller of this.active.values()) controller.abort();
	}

	invalidate(): void {
		this.valid = false;
		for (const controller of this.active.values()) controller.abort();
	}

	async request<T>(seat: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
		if (!this.valid || this.skipped) return;
		if (this.active.has(seat)) throw new Error("同座位不能并发选将");
		const controller = new AbortController();
		this.active.set(seat, controller);
		try {
			return await operation(controller.signal);
		} finally {
			this.active.delete(seat);
		}
	}
}
