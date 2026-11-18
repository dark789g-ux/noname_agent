import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

import { prepareSelection } from "./prepare.js";
import { applySelection, finishSelection } from "./results.js";
export function legacySelectionContent() {
	return [
		async event => {
			await prepareSelection(event);
		},
		async (event, trigger, player, result) => {
			await applySelection(event, result);
		},
		async event => {
			await finishSelection(event);
		},
	];
}
