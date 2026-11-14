const traces = new WeakMap<object, string>();
let sequence = 0;

/** Correlate child choices without writing private fields to engine events. */
export function decisionTrace(event: any): { traceId: string; skill?: string } {
	const chain: any[] = [];
	let current = event;
	let skill = event?.skill;
	let traceId: string | undefined;
	while (current && typeof current === "object" && chain.length < 64 && !chain.includes(current)) {
		chain.push(current);
		traceId ||= traces.get(current);
		skill ||= current.skill || current.sourceSkill;
		if (skill) break;
		// Only traverse a concrete parent; never use the engine's root fallback.
		try {
			current = current.getParent?.(undefined, true);
		} catch {
			break;
		}
	}
	traceId ||= `decision_${++sequence}`;
	for (const item of skill ? chain : chain.slice(0, 1)) traces.set(item, traceId);
	return { traceId, ...(typeof skill === "string" ? { skill } : {}) };
}
