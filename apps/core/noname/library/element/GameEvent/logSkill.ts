import type { Player } from "../player.js";

/**
 * The value accepted by selection events before they forward to Player#logSkill.
 * A tuple deliberately keeps the invocation arity, so consumers can forward it
 * without rebuilding omitted optional arguments.
 */
export type LogSkillInvocation = [
	name: string,
	targets?: false | Player | Player[] | null,
	nature?: string | boolean | { color: number[] } | null,
	logv?: boolean | null,
	args?: Video["content"],
];

export type EventLogSkill = false | string | LogSkillInvocation;

export type LogSkillReceiver = {
	logSkill(...args: LogSkillInvocation): void;
};

/**
 * Forward an event logging request without rebuilding its optional arguments.
 * Calling the method through the receiver preserves Player#logSkill's this.
 */
export function forwardEventLogSkill(receiver: LogSkillReceiver, logSkill: EventLogSkill): void {
	if (typeof logSkill === "string") {
		receiver.logSkill(logSkill);
	} else if (logSkill) {
		receiver.logSkill(...logSkill);
	}
}

function resultSkillName(result: GameEventResult | undefined): string | undefined {
	if (typeof result !== "object" || result === null || !("skill" in result)) {
		return;
	}
	const skill = result.skill;
	return typeof skill === "string" && skill ? skill : undefined;
}

/**
 * Prefer a selected skill, then fall back to a valid event log invocation.
 * Non-selection results and disabled logging intentionally produce no name.
 */
export function getLogSkillName(result: GameEventResult | undefined, logSkill: EventLogSkill | undefined): string | undefined {
	return resultSkillName(result) ?? (typeof logSkill === "string" && logSkill ? logSkill : Array.isArray(logSkill) && typeof logSkill[0] === "string" && logSkill[0] ? logSkill[0] : undefined);
}
