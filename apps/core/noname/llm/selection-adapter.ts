export type HeadlessSelectionType = "button" | "card" | "target" | "control" | "number";

export interface HeadlessSelectionStep {
	id?: string;
	type: HeadlessSelectionType;
	select?: any;
	items?: any[] | ((context: any) => any[]);
	filter?: Function;
	required?: boolean;
	selectionMode?: "set" | "sequential";
	deferredFromCards?: boolean;
	instruction?: string;
}

export interface HeadlessSelectionSpec {
	steps?: HeadlessSelectionStep[];
	viewAs?: any;
	finalPredicate?: (context: any, event: any, player: any) => boolean;
	/** Audited replacement of legacy selection flags, never inferred. */
	orderedTargets?: boolean;
	move?: "guanxing" | "xunxun" | "gongxin";
}

export function resolveSelectionSpec(selectionSpec: any, event: any, player: any): HeadlessSelectionSpec | undefined {
	const value = typeof selectionSpec === "function" ? selectionSpec(event, player) : selectionSpec;
	if (value === true) return {};
	if (value && typeof value === "object") return value;
	return undefined;
}

export function deriveSimpleSteps(info: any): NonNullable<HeadlessSelectionSpec["steps"]> {
	const steps: NonNullable<HeadlessSelectionSpec["steps"]> = [];
	if (info.selectCard !== undefined || info.filterCard || info.viewAs) steps.push({ type: "card" });
	if (info.selectTarget !== undefined || info.filterTarget) steps.push({ type: "target" });
	return steps;
}

export function normalizeRange(select: any): [number, number] {
	if (typeof select === "number") return [select, select];
	if (Array.isArray(select) && typeof select[0] === "number" && typeof select[1] === "number") return [select[0], select[1]];
	return [1, 1];
}

export function numberOptions(item: any): number[] {
	if (Array.isArray(item)) {
		if (["asc", "sort"].includes(item[0])) return item.slice(1).sort((left, right) => left - right);
		if (item[0] === "desc") return item.slice(1).sort((left, right) => right - left);
		return item.filter(value => typeof value === "number");
	}
	if (!item || typeof item !== "object") return [];
	const min = Number(item.min || 0);
	const max = Number(item.max ?? 9);
	const base = Number(item.base || 1);
	const values: number[] = [];
	for (let value = min; value <= max; value += base) values.push(value);
	return values;
}

export function dialogButtons(event: any): any[] {
	const buttons = event.dialog?.buttons;
	if (!Array.isArray(buttons) || !buttons.length || buttons.some((button: any) => !("link" in button))) fail("unsupported chooseButton: dialog buttons are unavailable");
	return buttons;
}

export function numberStepDefinitions(event: any, selectedNumbers: () => number[]): any[] {
	if (!Array.isArray(event.list) || !event.list.length) return [];
	return event.list.map((item: any, index: number) => ({
		id: `number:${index}`,
		type: "number",
		select: 1,
		items: numberOptions(item),
		filter: (value: number) => event.filterSelect?.(value, index, { ...event, numbers: selectedNumbers() }) !== false,
	}));
}

export function directSelectionDefinition(
	event: any,
	eventSpec: HeadlessSelectionSpec | undefined,
	callbacks: {
		isCardOwned: (card: any) => boolean;
		isTargetCurrent: (target: any) => boolean;
		selectedCard: () => any;
		selectedNumbers: () => number[];
	}
): { kind: string; steps: any[]; filterOk?: () => boolean } | undefined {
	if (event?.selectionSpec === false) return undefined;
	const player = event.player;
	const cardMode = event.complexSelect || event.complexCard ? "sequential" : undefined;
	const targetMode = event.complexSelect || event.complexTarget ? "sequential" : undefined;
	const card: any = { type: "card", selectionMode: cardMode, select: event.selectCard, required: event.cardRequired ? true : undefined, filter: (value: any) => callbacks.isCardOwned(value) && event.filterCard?.(value, player) !== false };
	const target: any = { type: "target", selectionMode: targetMode, select: event.selectTarget, required: event.targetRequired ? true : undefined, filter: (value: any) => callbacks.isTargetCurrent(value) && event.filterTarget?.(callbacks.selectedCard(), player, value) !== false };
	let steps = eventSpec?.steps?.slice();
	if (!steps?.length)
		switch (event.name) {
			case "chooseCard":
				steps = [card];
				break;
			case "chooseTarget":
				steps = [target];
				break;
			case "chooseCardTarget":
				steps = [card, target];
				break;
			case "chooseToGive":
				steps = [card];
				break;
			case "chooseButton":
				steps = [{ type: "button", selectionMode: event.complexSelect ? "sequential" : undefined, select: event.selectButton, items: dialogButtons(event), filter: (button: any) => event.filterButton?.(button, player) !== false }];
				break;
			case "choosePlayerCard":
			case "gainPlayerCard":
			case "discardPlayerCard":
				steps = [
					{
						type: "button",
						selectionMode: event.complexSelect ? "sequential" : undefined,
						select: event.selectButton,
						items: dialogButtons(event),
						filter: (button: any) => {
							const target = event.getTarget();
							const cards = event.name === "gainPlayerCard" ? target.getGainableCards(player, event.position) : event.name === "discardPlayerCard" ? target.getDiscardableCards(player, event.position) : target.getCards(event.position);
							return callbacks.isTargetCurrent(target) && cards.includes(button.link) && event.dialog.buttons.includes(button) && event.filterButton?.(button, player) !== false;
						},
					},
				];
				break;
			case "chooseButtonTarget":
				steps = [{ type: "button", selectionMode: event.complexSelect ? "sequential" : undefined, select: event.selectButton, items: dialogButtons(event), filter: (button: any) => event.filterButton?.(button, player) !== false }, target];
				break;
			case "chooseControl":
				steps = [{ type: "control", select: 1, items: Array.isArray(event.controls) ? event.controls : [] }];
				break;
			case "chooseNumbers":
				return { kind: event.name, steps: numberStepDefinitions(event, callbacks.selectedNumbers), filterOk: () => event.filterOk?.({ ...event, numbers: callbacks.selectedNumbers() }) !== false };
			default:
				return undefined;
		}
	return { kind: event.name, steps: steps || [] };
}

export function labelFor(value: any, translate?: (value: any) => string): string {
	if (value?.classList?.contains("blank")) return "未知牌（匿名引用）";
	if (value && typeof value === "object" && "link" in value) return labelFor(value.link, translate);
	try {
		const label = translate?.(value) || value?.name || String(value);
		return value && typeof value === "object" && typeof value.suit === "string" ? `${label} ${value.suit} ${value.number ?? ""}`.trim() : label;
	} catch {
		return String(value);
	}
}

export function shortRefPrefix(type: HeadlessSelectionType): string {
	return { button: "b", card: "c", target: "p", control: "o", number: "n" }[type];
}

export function fail(message: string): never {
	const error: any = new Error(message);
	error.stage = "translate";
	throw error;
}

export function actionResolution(message: string): never {
	const error: any = new Error(message);
	error.stage = "translate/action-resolution";
	throw error;
}
