import type { GameEvent } from "@/library/element/gameEvent.js";
import type { IdentitySelectionEvent } from "../contracts.js";

export type SelectionOutcome = "complete" | "restart" | "cancel";

/** A settings callback may only mutate the round that created its controls. */
export class SelectionRound {
	outcome: SelectionOutcome = "complete";
	choice?: GameEvent;

	constructor(readonly event: IdentitySelectionEvent) {}

	current(): boolean {
		return this.event.selectionRound === this && !this.event.finished && this.outcome === "complete";
	}

	restart(): void {
		if (!this.current()) return;
		this.outcome = "restart";
		this.choice?.cancel(true, undefined, "notrigger");
	}

	cancel(): void {
		if (this.outcome === "cancel") return;
		this.outcome = "cancel";
		this.choice?.cancel(true, undefined, "notrigger");
	}
}
