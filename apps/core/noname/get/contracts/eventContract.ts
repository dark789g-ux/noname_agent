import type JSZip from "jszip";

import type { GameEventParentFallback } from "./types.js";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		cardsetion(player: Player, sourceEvent?: false | undefined): string | undefined;

		cardsetion(player: Player | null, sourceEvent: true): import("@/library/element/gameEvent.js").GameEvent<import("@/library/element/gameEvent.js").GameEventNumberValue> | GameEventParentFallback | false | undefined;

		evtprompt(next: GameEvent, str: string): void;

		prompt(skill: string, target?: Player, player?: Player | null): string;

		prompt2(skill: string, target?: Player, player?: Player | null): string;

		mode(): any;

		config(item?: any, mode?: any): any;

		evtDistance(e1?: any, e2?: any): number;

		distance(from?: any, to?: any, method?: any): number;

		select(select?: number | Select | (() => number | Select)): Select;

		card(original?: any): any;

		event(): GameEvent;

		player(): import("@/library/element/player.js").Player | null | undefined;

		players(sort?: any, dead?: boolean, out?: boolean): Player[];
	}
}
