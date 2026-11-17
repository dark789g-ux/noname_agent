import { evalFilterTargetValue } from "./generic-skill-plan.js";
import { matchesSelectionFilter } from "./selection-filter.js";

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
	move?: "guanxing" | "xunxun" | "gongxin" | "swap";
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
		normalizeFilter?: (filter: any) => Function;
		hasLegalDirectTarget?: (value: any, kind: "card" | "button") => boolean;
	}
): { kind: string; steps: any[]; filterOk?: () => boolean } | undefined {
	if (event?.selectionSpec === false) return undefined;
	const player = event.player;
	const cardMode = event.complexSelect || event.complexCard ? "sequential" : undefined;
	const targetMode = event.complexSelect || event.complexTarget ? "sequential" : undefined;
	const isSingleSelect = (select: any) => {
		if (typeof select === "function") return false;
		const range = normalizeRange(select);
		return range[0] === 1 && range[1] === 1;
	};
	const card: any = {
		type: "card",
		selectionMode: cardMode,
		select: event.selectCard,
		required: event.cardRequired ? true : undefined,
		filter: (value: any) => callbacks.isCardOwned(value) && matchesSelectionFilter(event.filterCard, value, player, event, callbacks.normalizeFilter, event),
	};
	const target: any = {
		type: "target",
		selectionMode: targetMode,
		select: event.selectTarget,
		required: event.targetRequired ? true : undefined,
		filter: (value: any) => callbacks.isTargetCurrent(value) && evalFilterTargetValue(event.filterTarget, callbacks.selectedCard(), player, value),
	};
	let steps = eventSpec?.steps?.slice();
	if (!steps?.length)
		switch (event.name) {
			case "chooseCard":
				steps = [card];
				break;
			case "chooseTarget":
				steps = [target];
				break;
			case "chooseCardTarget": {
				const precheckCard = !cardMode && isSingleSelect(event.selectCard) && callbacks.hasLegalDirectTarget;
				steps = [precheckCard ? { ...card, filter: (value: any) => card.filter(value) && callbacks.hasLegalDirectTarget!(value, "card") } : card, target];
				break;
			}
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
			case "chooseButtonTarget": {
				const precheckButton = !event.complexSelect && isSingleSelect(event.selectButton) && callbacks.hasLegalDirectTarget;
				steps = [
					{
						type: "button",
						selectionMode: event.complexSelect ? "sequential" : undefined,
						select: event.selectButton,
						items: dialogButtons(event),
						filter: (button: any) => event.filterButton?.(button, player) !== false && (!precheckButton || callbacks.hasLegalDirectTarget!(button, "button")),
					},
					target,
				];
				break;
			}
			case "chooseControl":
				steps = [{ type: "control", select: 1, items: Array.isArray(event.controls) ? event.controls : [] }];
				break;
			case "chooseNumbers":
				return { kind: event.name, steps: numberStepDefinitions(event, callbacks.selectedNumbers), filterOk: () => event.filterOk?.({ ...event, numbers: callbacks.selectedNumbers() }) !== false };
			default:
				return undefined;
		}
	steps = (steps || []).map((step, index) => ({
		...step,
		id: step.id || `direct:${event.name}:${step.type}:${index}`,
	}));
	return { kind: event.name, steps };
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

export function formatSelectionFailure(outcome: any, fallbackInspection?: any): string {
	const reason = outcome?.reason || outcome?.status || "invalid";
	if (reason === "unavailable" || reason === "duplicate") {
		const value = outcome?.value !== undefined ? String(outcome.value) : "unknown";
		if (reason === "duplicate") return `selection: duplicate (${value} 重复选择)`;
		const entries = Array.isArray(fallbackInspection?.entries)
			? fallbackInspection.entries
			: Array.isArray(outcome?.inspection?.entries)
				? outcome.inspection.entries
				: [];
		const availableRefs = entries.filter((entry: any) => entry.available).map((entry: any) => entry.item);
		return `selection: unavailable (${value} 不可选；当前可选: ${availableRefs.length ? availableRefs.join(", ") : "无"})`;
	}
	if ((reason === "too_few" || reason === "too_many") && Array.isArray(outcome?.inspection?.range)) {
		const [min, max] = outcome.inspection.range;
		const actual = Array.isArray(outcome.inspection.selected) ? outcome.inspection.selected.length : Array.isArray(outcome.value) ? outcome.value.length : 0;
		return `selection: ${reason} (需选 ${min}..${max < 0 ? "不限" : String(max)} 项，实际 ${actual} 项)`;
	}
	return `selection: ${reason}`;
}
