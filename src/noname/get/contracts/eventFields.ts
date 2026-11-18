import type { GameEventNumberValue } from "@/library/element/gameEvent.js";
import type { Dialog } from "@/library/element/dialog.js";

/** Fields already written by legacy choice and AI producers, read by Get. */
declare module "@/library/element/gameEvent.js" {
	interface GameEvent<N extends GameEventNumberValue = never> {
		skillRankPlayer?: Player;
		_get_card?: Card | VCard | CardBaseUIData;
		useCache?: boolean;
		dialog?: Dialog;
		prompt?: string;
	}
}

declare module "@/library/element/GameEvent/eventContracts.js" {
	interface GameEventSetFields<N extends GameEventNumberValue = GameEventNumberValue> {
		prompt?: string;
	}
}
