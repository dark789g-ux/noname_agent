import { ui } from "noname";
import type { IdentitySelectionEvent, IdentitySelectionResult } from "../contracts.js";
import { prepareSelection } from "./prepare.js";
import { applySelection, finishSelection } from "./results.js";
import { SelectionRound } from "./round.js";

function closeControls(): void {
	for (const key of ["cheat", "cheat2"] as const) {
		ui[key]?.close();
		delete ui[key];
	}
}

/** No public step numbers: all child choices are explicitly awaited. */
export async function normalSelectionContent(event: IdentitySelectionEvent): Promise<void> {
	let completed = false;
	try {
		while (!event.finished) {
			const round = new SelectionRound(event);
			event.selectionRound = round;
			const context = await prepareSelection(event);
			round.choice = context.choice;
			if (event.finished) return;
			// Retain the old phase boundary: drain all queued children, not just
			// the choice itself, and publish the same intermediate event result.
			const [queuedResult, choiceResult] = await Promise.all([event.waitNext(), context.choice?.forResult()]);
			event._result = queuedResult ?? (choiceResult as Partial<Result> | undefined) ?? event._result;
			const result = event._result as IdentitySelectionResult;
			if (event.finished || round.outcome === "cancel") return;
			if (round.outcome === "restart") {
				// Rebuild controls as well as candidates. Old DOM callbacks are stale
				// and cannot restart a later round or apply a previous result.
				closeControls();
				ui.dialog?.close();
				event.dialogxx?.close();
				delete event.swapnodialog;
				event.llmOpening?.close(true);
				continue;
			}
			await applySelection(event, result);
			event._result = (await event.waitNext()) ?? event._result;
			if (event.finished) return;
			await finishSelection(event);
			completed = true;
			return;
		}
	} finally {
		if (!completed) {
			event.selectionRound?.cancel();
			event.llmOpening?.close(true);
			ui.dialog?.close();
			event.dialogxx?.close();
		}
		delete event.selectionRound;
		closeControls();
	}
}
