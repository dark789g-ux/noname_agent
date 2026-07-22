export type BackupDecisionKind = "chooseToUse" | "chooseToRespond";

export interface BackupSelectionSpec {
	steps?: any[];
	viewAs?: any;
	finalPredicate?: Function;
}

export interface BackupStepCallbacks {
	cardFilter: (card: any) => boolean;
	targetFilter: (target: any) => boolean;
	targetSelect: () => any;
}

/** 与实体牌、viewAs 牌共用的权威目标范围解析。 */
export function resolveCardTargetSelect(card: any, player: any, getCardInfo: (card: any) => any): any {
	const info = getCardInfo(card) || {};
	if (info.notarget === true) return [0, 0];
	return typeof info.selectTarget === "function" ? info.selectTarget(card, player) : (info.selectTarget ?? 1);
}

export function targetRangeAllowsSelection(select: any): boolean {
	if (typeof select === "number") return select !== 0;
	if (Array.isArray(select)) return select[1] !== 0;
	return true;
}

/** Event 侧的契约优先；未声明的字段继承动态 backup 技能的契约。 */
export function mergeBackupSelectionSpecs(infoSpec?: BackupSelectionSpec, eventSpec?: BackupSelectionSpec): BackupSelectionSpec {
	return {
		...infoSpec,
		...eventSpec,
		steps: eventSpec?.steps ?? infoSpec?.steps,
		viewAs: eventSpec?.viewAs ?? infoSpec?.viewAs,
		finalPredicate: eventSpec?.finalPredicate ?? infoSpec?.finalPredicate,
	};
}

/** selectionSpec.viewAs 与传统 info.viewAs 的唯一解析入口。 */
export function resolveViewAs(spec: BackupSelectionSpec | undefined, info: any, cards: any[], player: any): { source: any; definition: any } {
	const source = getViewAsSource(spec, info);
	return {
		source,
		definition: typeof source === "function" ? source(cards, player) : source,
	};
}

export function getViewAsSource(spec: BackupSelectionSpec | undefined, info: any): any {
	return spec?.viewAs ?? info?.viewAs;
}

/**
 * 将 GameEvent.backup 后的字段转换成 headless step。selectCard 原样保留，
 * 因而动态函数、多牌范围及 -1 自动全选都由 SelectionValidator 统一解释。
 */
export function buildBackupStepDefinitions(event: any, info: any, spec: BackupSelectionSpec, callbacks: BackupStepCallbacks): any[] {
	const viewAs = getViewAsSource(spec, info);
	const cardSelect = event.selectCard ?? info.selectCard ?? (viewAs ? 1 : undefined);
	const initialTargetSelect = callbacks.targetSelect();
	const targetSelect = () => callbacks.targetSelect();
	const steps = spec.steps?.map(step => {
		if (step.type === "card") return { ...step, select: step.select ?? cardSelect, filter: step.filter ?? callbacks.cardFilter };
		if (step.type === "target") return { ...step, select: step.select ?? targetSelect, filter: step.filter ?? callbacks.targetFilter };
		return { ...step };
	}) ?? [];
	if (!steps.some(step => step.type === "card") && (cardSelect !== undefined || typeof event.filterCard === "function" || viewAs)) {
		steps.push({ id: `backup:${event.skill}:card`, type: "card", select: cardSelect ?? 1, required: event.cardRequired ? true : undefined, filter: callbacks.cardFilter });
	}
	if (event.name === "chooseToUse" && !steps.some(step => step.type === "target") && targetRangeAllowsSelection(initialTargetSelect) && (typeof event.filterTarget === "function" || event.selectTarget !== undefined || event.targetRequired)) {
		steps.push({ id: `backup:${event.skill}:target`, type: "target", select: targetSelect, required: event.targetRequired ? true : undefined, filter: callbacks.targetFilter });
	}
	return steps;
}

/** chooseToUse 与 chooseToRespond 共用同一种 viewAs 结果形状。 */
export function materializeViewAsResult(skill: string, definition: any, cards: any[], targets: any[], createCard: (definition: any, cards: any[]) => any): any {
	const card = definition ? createCard(definition, cards) : cards[0];
	if (!card) throw new Error(`backup ${skill} did not materialize a card`);
	return { bool: true, skill, card, cards, targets };
}

export function describeDecisionStage(stage: { id: string; type: string; range: [number, number]; items: { ref: string; label: string }[] }): string {
	return `## 当前选择步骤\n- step_id: ${stage.id}\n- 类型: ${stage.type}\n- 数量: ${stage.range[0]}..${stage.range[1]}\n- 候选:\n${stage.items.map(item => `  - ${item.ref}: ${item.label}`).join("\n")}`;
}

export function appendPendingHistory(history: any[], toolCall: any, pending: { id: string; type: string; range: [number, number]; items: { ref: string; label: string }[] }): void {
	history.push(assistantToolMessage(toolCall), { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ accepted: true, next_step: pending }) }, { role: "user", content: describeDecisionStage(pending) });
}
import { assistantToolMessage } from "./protocol.js";
