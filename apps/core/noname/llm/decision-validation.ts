import type { CandidateAction, DecisionCandidateSnapshot } from "./action-candidates.js";
import type { CandidateCard, CandidateTarget } from "./candidates.js";
import { uniqueLegacyMatch } from "./protocol.js";
import { fail } from "./selection-adapter.js";

export interface ValidationRuntime {
	getOwner(card: any): any;
	alivePlayers(): any[];
	deadPlayers(): any[];
}

export function resolveCandidateCards(cards: Map<string, CandidateCard>, candidates: CandidateCard[], refs: string[] | undefined, action: string, min: number, max = Infinity): any[] {
	if (!Array.isArray(refs) || refs.length < min || refs.length > max) fail(`${action}: invalid card count`);
	const values = refs.map(ref => cards.get(ref)?.card || uniqueLegacyMatch(candidates, ref, candidate => candidate.id)?.card);
	if (values.some(card => !card) || new Set(values).size !== values.length) fail(`${action}: unknown or duplicate card reference`);
	return values;
}

export function resolveCandidateTargets(targets: Map<string, CandidateTarget>, refs: string[] | undefined, action: string): any[] {
	const values = refs || [];
	const result = values.map(ref => targets.get(ref)?.player);
	if (result.some(target => !target) || new Set(result).size !== result.length) fail(`${action}: unknown or duplicate target reference`);
	return result;
}

export function isCardOwned(event: any, card: any, runtime: ValidationRuntime): boolean {
	try {
		return runtime.getOwner(card) === event.player || event.player.getCards("hejxs").includes(card);
	} catch {
		return false;
	}
}

export function isTargetCurrent(event: any, target: any, runtime: ValidationRuntime): boolean {
	if (runtime.alivePlayers().includes(target)) return typeof target.isIn !== "function" || target.isIn();
	return !!event.deadTarget && runtime.deadPlayers().includes(target);
}

export function assertCardLegal(event: any, card: any, runtime: ValidationRuntime): void {
	try {
		if (!isCardOwned(event, card, runtime)) fail("card is no longer owned by the player");
		if (typeof event.filterCard === "function" && !event.filterCard(card, event.player)) fail("card is no longer legal");
	} catch (error) {
		if ((error as any)?.stage) throw error;
		fail("card legality could not be verified");
	}
}

export function assertTargetLegal(event: any, target: any, card: any, runtime: ValidationRuntime): void {
	try {
		if (!isTargetCurrent(event, target, runtime)) fail("target is no longer current");
		if (typeof event.filterTarget === "function" && !event.filterTarget(card, event.player, target)) fail("target is no longer legal");
	} catch (error) {
		if ((error as any)?.stage) throw error;
		fail("target legality could not be verified");
	}
}

export function requireAction(snapshot: DecisionCandidateSnapshot | undefined, tool: CandidateAction["tool"], id: string | undefined, skill?: string): CandidateAction | undefined {
	if (!snapshot) return undefined;
	const action = snapshot.actions.find(value => value.tool === tool && (skill ? value.skillName === skill : value.cardRef === id));
	if (!action) fail(`${tool}: action is not in the decision snapshot`);
	return action;
}

export function assertActionTargets(action: CandidateAction | undefined, refs: string[] | undefined, tool: string): string[] {
	const supplied = refs || [];
	if (!action) return supplied;
	const target = action.target;
	if (target.mode === "automatic") return target.targetRefs.slice();
	if (target.mode === "none") {
		if (supplied.length) fail(`${tool}: action has no selectable targets`);
		return [];
	}
	if (target.mode === "dynamic") return supplied;
	if (supplied.some(ref => !target.targetRefs.includes(ref))) fail(`${tool}: target is not allowed by this action`);
	const [min, max] = target.range || [0, 0];
	if (supplied.length < min || supplied.length > max) fail(`${tool}: target count is outside action range`);
	return supplied;
}

export function buildDecisionLogResult(result: any, selected: (type: any) => string[]): Record<string, any> {
	const plain: Record<string, any> = { bool: result?.bool };
	if (typeof result?.skill === "string") plain.skill = result.skill;
	for (const type of ["button", "card", "target", "control", "number"]) {
		const refs = selected(type);
		if (refs.length) plain[`${type}_refs`] = refs;
	}
	if (Array.isArray(result?.numbers)) plain.numbers = result.numbers.slice();
	if (typeof result?.control === "string") plain.control = result.control;
	if (typeof result?.index === "number") plain.index = result.index;
	return plain;
}

export function materializeResponseResult(card: any, targets: any[]): any {
	return targets.length ? { bool: true, card, cards: [card], targets } : { bool: true, card, cards: [card] };
}

export function resolveCurrentAction(snapshot: DecisionCandidateSnapshot | undefined, skill: string | undefined, active?: CandidateAction): CandidateAction | undefined {
	return active || (skill ? snapshot?.actions.find(action => action.kind === "skill" && action.skillName === skill) : undefined);
}

export function resolveActionCardRefs(action: CandidateAction | undefined, cards: CandidateCard[]): string[] {
	return action?.cardRef ? [action.cardRef] : action?.materialCardRefs || cards.map(card => card.ref);
}
