import type { GameEvent } from "@/library/element/gameEvent.js";
import type { Dialog } from "@/library/element/dialog.js";
import type { CharacterOpeningController, SelectedOpening } from "@/llm/character-selection/controller.js";
import type { SelectionRound } from "./choose/round.js";

/** State owned by one chooseCharacter event, not by the mode module. */
export interface IdentitySelectionEvent extends GameEvent {
	showConfig: boolean;
	addPlayer: (player: Player) => void;
	removePlayer: () => Player;
	ai: (player: Player, list: string[], monarchs?: string[] | null, back?: string[]) => void;
	chosen: string[];
	choosed: string[];
	list: string[];
	identity?: string;
	fixedseat?: number;
	zhongmode?: boolean;
	stratagemMode?: boolean;
	special_identity?: string[];
	modchosen?: string[];
	group?: string;
	llmOpening?: CharacterOpeningController;
	llmChoice?: SelectedOpening;
	addSetting: (dialog: Dialog) => void;
	removeSetting: () => void;
	swapnodialog?: (dialog: Dialog, list: string[]) => void;
	swapnochoose?: boolean;
	dialogxx?: Dialog;
	selectionRound?: SelectionRound;
}

export interface SelectionContext {
	event: IdentitySelectionEvent;
	chosen: string[];
	stratagemMode: boolean | undefined;
	identityList: string[];
	list2: string[];
	list3: string[];
	list4: string[];
	getZhuList: () => string[];
	/** Shared by retained settings controls and their original reselect closure. */
	num?: number;
	choice?: GameEvent;
}

export type IdentitySelectionResult = Result & {
	buttons: (Button & { link: string })[];
};
