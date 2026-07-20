export interface ToolCallLike {
	id: string;
	name: string;
	arguments: Record<string, any>;
}

export interface ActionProposal {
	kind: "card" | "skill" | "respond" | "discard" | "pass" | "bool";
	cardRefs?: string[];
	targetRefs?: string[];
	skillName?: string;
	bool?: boolean;
}

/** 将新旧 tool 参数统一为短引用 proposal。 */
export function parseActionProposal(toolCall: ToolCallLike): ActionProposal {
	const args = toolCall.arguments || {};
	const refs = (plural: string, legacy: string, prefix: string) => {
		const values = Array.isArray(args[plural]) ? args[plural] : Array.isArray(args[legacy]) ? args[legacy] : [];
		return values.map((value: any) => typeof value === "number" ? `${prefix}${value}` : String(value));
	};
	const cardRefs = Array.isArray(args.card_refs) ? args.card_refs.map(String) : args.card_ref ? [String(args.card_ref)] : Array.isArray(args.card_ids) ? args.card_ids.map(String) : args.card_id ? [String(args.card_id)] : [];
	const targetRefs = refs("target_refs", "target_ids", "p");
	switch (toolCall.name) {
		case "use_card": return { kind: "card", cardRefs, targetRefs };
		case "respond_card": return { kind: "respond", cardRefs };
		case "discard_cards": return { kind: "discard", cardRefs };
		case "use_skill": return { kind: "skill", skillName: args.skill_name, cardRefs, targetRefs };
		case "pass": return { kind: "pass" };
		case "yes": return { kind: "bool", bool: true };
		case "no": return { kind: "bool", bool: false };
		default: throw protocolError(`Unknown tool name: ${toolCall.name}`);
	}
}

export function assertActionAllowed(proposal: ActionProposal, forced: boolean): void {
	if (forced && proposal.kind === "pass") throw protocolError("pass is not legal for a forced event");
}

export function uniqueLegacyMatch<T>(values: T[], id: string, getId: (value: T) => string): T | undefined {
	const matches = values.filter(value => getId(value) === id);
	if (matches.length > 1) throw protocolError(`legacy card_id "${id}" is ambiguous`);
	return matches[0];
}

export function selectionRequired(range: [number, number], explicit?: boolean): boolean {
	return explicit ?? range[0] > 0;
}

export function isExplicitMultiTurnRejection(error: any): boolean {
	if (![400, 422].includes(Number(error?.httpStatus))) return false;
	return /(tool[_ -]?call|tool role|role.?tool|messages?.*tool|json schema|function.?call)/i.test(String(error?.message || ""));
}

export function remainingTimeoutSec(timeoutSec: number, deadline: number, now = Date.now()): number {
	const remaining = deadline - now;
	if (remaining <= 0) throw protocolError("LLM decision timed out", "fetch");
	return Math.max(1, Math.min(timeoutSec, Math.ceil(remaining / 1000)));
}

export function assistantToolMessage(call: ToolCallLike): Record<string, any> {
	return { role: "assistant", content: null, tool_calls: [{ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } }] };
}

export function materializeDirectShape(kind: string, values: { cards?: any[]; targets?: any[]; buttons?: any[]; control?: any; controls?: any[]; numbers?: number[] }): any {
	const cards = values.cards || [];
	const targets = values.targets || [];
	const buttons = values.buttons || [];
	switch (kind) {
		case "chooseCard": return { bool: true, cards };
		case "chooseTarget": return { bool: true, targets };
		case "chooseCardTarget": return { bool: true, cards, targets };
		case "chooseToGive": return { bool: true, cards };
		case "chooseButton": return { bool: true, buttons, links: buttons.map(button => button.link) };
		case "chooseButtonTarget": return { bool: true, buttons, links: buttons.map(button => button.link), targets };
		case "chooseControl": return { bool: true, control: values.control, index: (values.controls || []).indexOf(values.control) };
		case "chooseNumbers": return { bool: true, numbers: values.numbers || [] };
		default: throw protocolError(`unsupported direct result: ${kind}`);
	}
}

/** 日志边界只保留普通 JSON，阻止 Card/Player/DOM/circular 对象进入 IndexedDB。 */
export function plainLogValue<T>(value: T): T {
	const seen = new WeakSet<object>();
	const visit = (current: any): any => {
		if (current === null || typeof current !== "object") return current;
		if (seen.has(current)) return "[circular]";
		seen.add(current);
		if (Array.isArray(current)) return current.map(visit);
		const prototype = Object.getPrototypeOf(current);
		if (prototype !== Object.prototype && prototype !== null) return undefined;
		return Object.fromEntries(Object.entries(current).map(([key, item]) => [key, visit(item)]).filter(([, item]) => item !== undefined));
	};
	return visit(value);
}

function protocolError(message: string, stage = "translate"): Error {
	const error: any = new Error(message);
	error.stage = stage;
	return error;
}
