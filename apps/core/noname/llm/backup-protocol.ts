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
	deferTarget?: boolean;
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
	const cardMode = event.complexCard || event.complexSelect || info?.complexCard || info?.complexSelect ? "sequential" : undefined;
	const targetMode = event.complexTarget || event.complexSelect || info?.complexTarget || info?.complexSelect ? "sequential" : undefined;
	const initialTargetSelect = callbacks.deferTarget ? undefined : callbacks.targetSelect();
	const targetSelect = () => callbacks.targetSelect();
	const steps =
		spec.steps?.map(step => {
			if (step.type === "card") return { ...step, select: step.select ?? cardSelect, filter: step.filter ?? callbacks.cardFilter };
			if (step.type === "target") return { ...step, select: step.select ?? targetSelect, filter: step.filter ?? callbacks.targetFilter };
			return { ...step };
		}) ?? [];
	const hasCardRule = cardSelect !== undefined || typeof event.filterCard === "function" || event.filterCard === true || info?.filterCard === true || !!viewAs;
	if (!steps.some(step => step.type === "card") && hasCardRule) {
		steps.push({ id: `backup:${event.skill}:card`, type: "card", selectionMode: cardMode, select: cardSelect ?? 1, required: event.cardRequired ? true : undefined, filter: callbacks.cardFilter });
	}
	const hasTargetRule = typeof event.filterTarget === "function" || event.filterTarget === true || typeof info?.filterTarget === "function" || info?.filterTarget === true || event.selectTarget !== undefined || info?.selectTarget !== undefined || event.targetRequired;
	if (event.name === "chooseToUse" && !steps.some(step => step.type === "target") && targetRangeAllowsSelection(initialTargetSelect) && hasTargetRule) {
		steps.push({ id: `backup:${event.skill}:target`, type: "target", selectionMode: targetMode, select: targetSelect, required: event.targetRequired ? true : undefined, filter: callbacks.targetFilter, deferredFromCards: !!(viewAs || targetMode) });
	}
	return steps;
}

/** chooseToUse 与 chooseToRespond 共用同一种 viewAs 结果形状；非 viewAs 的 backup 技能不伪造 card 字段。 */
export function materializeViewAsResult(skill: string, definition: any, cards: any[], targets: any[], createCard: (definition: any, cards: any[]) => any): any {
	if (!definition) return { bool: true, skill, cards, targets };
	const card = createCard(definition, cards);
	if (!card) throw new Error(`backup ${skill} did not materialize a card`);
	return { bool: true, skill, card, cards, targets };
}

export function describeDecisionStage(stage: { id: string; type: string; range: [number, number]; items: { ref: string; label: string }[]; piles?: { index: number; title: string }[]; instruction?: string }): string {
	return `## 当前选择步骤\n- step_id: ${stage.id}\n- 类型: ${stage.type}\n- 数量: ${stage.range[0]}..${stage.range[1]}\n${stage.instruction || ""}\n${stage.piles?.map(pile => `堆 ${pile.index}: ${pile.title}`).join("\n") || ""}\n- 候选:\n${stage.items.map(item => `  - ${item.ref}: ${item.label}`).join("\n")}`;
}

export function appendPendingHistory(history: any[], toolCall: any, pending: { id: string; type: string; range: [number, number]; items: { ref: string; label: string }[] }): void {
	history.push(assistantToolMessage(toolCall), { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ accepted: true, next_step: pending }) }, { role: "user", content: describeDecisionStage(pending) });
}

export function appendRejectedHistory(history: any[], toolCall: any, error: string, currentStage?: { id: string; type: string; range: [number, number]; items: { ref: string; label: string }[]; piles?: { index: number; title: string }[]; instruction?: string }): void {
	history.push(
		assistantToolMessage(toolCall),
		{ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ accepted: false, error, retry_stage: currentStage ?? null }) },
		{
			role: "user",
			content: currentStage
				? `上一步选择未通过规则校验（${error}）。请重新提交：\n${describeDecisionStage(currentStage)}`
				: `上一步选择未通过规则校验（${error}）。请重新选择合法动作或 pass。`,
		}
	);
}

export function appendInspectDiscardHistory(
	history: any[],
	toolCall: any,
	report: unknown,
	currentStage?: { id: string; type: string; range: [number, number]; items: { ref: string; label: string }[]; piles?: { index: number; title: string }[]; instruction?: string }
): void {
	history.push(
		assistantToolMessage(toolCall),
		{ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ accepted: true, discard_pile: report }) },
		{
			role: "user",
			content: currentStage
				? `已返回当前弃牌堆明细。请继续完成当前选择步骤：\n${describeDecisionStage(currentStage)}`
				: "已返回当前弃牌堆明细。请结合牌面与弃牌信息继续选择当前最优动作。",
		}
	);
}
import { assistantToolMessage } from "./protocol.js";
