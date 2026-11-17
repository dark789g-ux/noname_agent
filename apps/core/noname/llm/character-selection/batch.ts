/**
 * 只并发模型请求，不并发游戏事件或状态应用。
 * prepare 依次从池中锁定候选；所有结果就绪后依次提交，最后统一释放。
 */
export async function runSelectionBatches<P, J, R>(
	players: readonly P[],
	runtime: {
		eligible(player: P): boolean;
		local(player: P): void;
		canBatch(batch: readonly P[], next: P): boolean;
		prepare(player: P): J;
		decide(job: J): Promise<R>;
		commit(job: J, result: R): void;
		release(job: J): void;
	}
): Promise<void> {
	const queue = [...players];
	while (queue.length > 0) {
		const first = queue.shift()!;
		if (!runtime.eligible(first)) {
			runtime.local(first);
			continue;
		}
		const batch = [first];
		for (let i = 0; i < queue.length; ) {
			const next = queue[i];
			if (!runtime.eligible(next)) {
				i++;
				continue;
			}
			if (!runtime.canBatch(batch, next)) break;
			batch.push(next);
			queue.splice(i, 1);
		}
		const jobs = batch.map(player => runtime.prepare(player));
		const results = await Promise.all(jobs.map(job => runtime.decide(job)));
		jobs.forEach((job, i) => runtime.commit(job, results[i]));
		jobs.forEach(job => runtime.release(job));
	}
}
