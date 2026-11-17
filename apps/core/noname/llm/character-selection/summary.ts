export interface OpeningSummary {
	characters: string[];
	group?: string;
	reason: string;
}

let summaries = new WeakMap<object, OpeningSummary>();

export function resetOpeningSummaries(): void {
	summaries = new WeakMap();
}

export function setOpeningSummary(player: object, summary: OpeningSummary): void {
	summaries.set(player, { characters: summary.characters.slice(), group: summary.group, reason: [...summary.reason].slice(0, 200).join("") });
}

/** 只按观察者对象读取，绝不把其他座位的选将理由带入正式上下文。 */
export function getOpeningSummary(player: object): string {
	const summary = summaries.get(player);
	return summary ? `## 你自己的开局选将记录\n${JSON.stringify(summary)}` : "";
}
