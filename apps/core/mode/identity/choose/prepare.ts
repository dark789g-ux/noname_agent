import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

import { createSettings } from "./settings.js";
import { assignIdentities } from "./identities.js";
import { freezeCandidates } from "./candidates.js";
import { presentChoices } from "./choices.js";
import type { IdentitySelectionEvent, SelectionContext } from "../contracts.js";
export async function prepareSelection(event: IdentitySelectionEvent): Promise<SelectionContext> {
	ui.arena.classList.add("choose-character");
	let identityList: string[];
	const list2: string[] = [];
	const list3: string[] = [];
	const list4: string[] = [];
	const chosen = lib.config.continue_name || [];
	game.saveConfig("continue_name");
	event.chosen = chosen;
	if (_status.mode === "zhong") {
		event.zhongmode = true;
		identityList = ["zhu", "zhong", "mingzhong", "nei", "fan", "fan", "fan", "fan"];
	} else {
		if (_status.mode === "stratagem") {
			event.stratagemMode = true;
		}
		identityList = get.identityList(game.players.length);
	}
	const stratagemMode = event.stratagemMode;
	const context: SelectionContext = { event, chosen, stratagemMode, identityList, list2, list3, list4, getZhuList: () => [] };
	const settings = createSettings(context);
	event.addSetting = settings.addSetting;
	event.removeSetting = settings.removeSetting;
	assignIdentities(context);
	freezeCandidates(context);
	await presentChoices(context);
	return context;
}
