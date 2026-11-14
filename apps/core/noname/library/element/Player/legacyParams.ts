import type { Button, Card, Dialog, GameEvent, Player, VCard } from "../index.js";
import type { BroadSelect } from "./type.js";
import type { EventChooseButtonParams, EventChooseControlParams, EventChooseTargetParams, EventDiscardParams, EventGainParams, EventLoseParams, EventLoseToDiscardpileParams } from "./eventParams.js";

export type LegacyVCardItem = [string, string, string, (string | null)?];
export type LegacyButtonLinkAtom = string | number | boolean | Card | VCard | CardBaseUIData | Player;
export type LegacyButtonLink = LegacyButtonLinkAtom | LegacyButtonLink[];
export type LegacyTDNodeItem = string | number | [LegacyButtonLink, string];
export type LegacyTextButtonItem = string | [LegacyButtonLink, string];
export type LegacyCharacterSubstituteItem = [string, string[]?];
export type LegacySkillItem = string | [string, string];
export type LegacyCharacterItem = string | LegacyCharacterSubstituteItem;

export type LegacyCreateButtonFactory = (item: LegacyCharacterSubstituteItem, type: LegacyCreateButtonFactory, position?: HTMLDivElement | DocumentFragment, noClick?: true, button?: Button) => Button;
export type LegacyDialogHandle = (dialog: Dialog) => void;

export type LegacyButtonGroup = [(string | LegacyVCardItem)[], "vcard"] | [LegacyTDNodeItem[], "tdnodes"] | [LegacyTextButtonItem[], "textbutton"] | [LegacySkillItem[], "skill"] | [LegacyCharacterItem[], "character" | "characterx"] | [LegacyCharacterSubstituteItem[], LegacyCreateButtonFactory] | [LegacyDialogHandle, "handle"] | [RowItem[], "addNewRow"];

export type LegacyDialogAtom = string | HTMLDivElement | DocumentFragment | Card[] | Player[] | LegacyButtonGroup;
export type LegacyDialogAddItem = LegacyDialogAtom | LegacyDialogAddItem[];
export type LegacyChooseButtonCreateDialog = Array<LegacyDialogAddItem | boolean>;

export type LegacyChooseButtonAI = (button: Button) => number;
export type LegacyChooseButtonFilter = (button: Button, player: Player) => boolean;
export type LegacyChooseButtonToken = boolean | Dialog | BroadSelect | LegacyChooseButtonAI | LegacyChooseButtonFilter | "complexSelect" | "allowChooseAll" | "direct" | LegacyChooseButtonCreateDialog;

export type LegacyChooseTargetFilter = (card: Card, player: Player, target: Player) => boolean;
export type LegacyChooseTargetAI = (target: Player) => number;
export type LegacyChooseTargetToken = string | boolean | Dialog | BroadSelect | LegacyChooseTargetFilter | LegacyChooseTargetAI;

export type LegacyChooseControlAI = (event: GameEvent, player: Player) => string | number;
export type LegacyChooseControlToken = string | string[] | LegacyChooseControlAI | number | Dialog;

export type LegacyDiscardToken = Player | Card | Card[] | HTMLDivElement | DocumentFragment | "notBySelf";
export type LegacyGainToken = Player | Card | Card[] | string | boolean;
export type LegacyLoseToken = Player | Card | Card[] | HTMLDivElement | DocumentFragment | string;
export type LegacyLoseToDiscardpileToken = Player | Card | Card[] | HTMLDivElement | DocumentFragment | string | boolean;

declare module "../player.js" {
	interface Player {
		chooseButton(params: EventChooseButtonParams): GameEvent;
		chooseButton(...tokens: LegacyChooseButtonToken[]): GameEvent;
		chooseTarget(params: EventChooseTargetParams): GameEvent;
		chooseTarget(...tokens: LegacyChooseTargetToken[]): GameEvent;
		chooseControl(params: EventChooseControlParams): GameEvent;
		chooseControl(...tokens: LegacyChooseControlToken[]): GameEvent;
		discard(params: EventDiscardParams): GameEvent;
		discard(...tokens: LegacyDiscardToken[]): GameEvent;
		gain(params: EventGainParams): GameEvent;
		gain(...tokens: LegacyGainToken[]): GameEvent;
		lose(params: EventLoseParams): GameEvent;
		lose(...tokens: LegacyLoseToken[]): GameEvent;
		loseToDiscardpile(params: EventLoseToDiscardpileParams): GameEvent;
		loseToDiscardpile(...tokens: LegacyLoseToDiscardpileToken[]): GameEvent;
		unwait(result: GameEventResult, ignoredPlayer?: Player): void;
		hideTimer(ignoredTime?: number): void;
	}
}
