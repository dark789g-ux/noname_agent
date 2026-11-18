import type { GameEvent, GameEventNumberValue } from "@/library/element/gameEvent.js";
import type { Dialog } from "@/library/element/dialog.js";
import type { Control } from "@/library/element/control.js";

/** Identity's AI state is initialized by the mode, not by Player's constructor. */
export type IdentityPlayerAI = Player["ai"] & {
	shown: number;
	identity_mark?: string;
	sizhong?: boolean;
	stratagemCamouflage?: boolean;
};

declare module "@/game/index.js" {
	interface Game {
		zhu2?: Player;
		zhong?: Player;
		rZhu?: Player;
		bZhu?: Player;
		identityVideoName?: string;
	}
}

declare module "@/get/Get.js" {
	interface Get {
		realAttitude?: (from: Player, to: Player) => number | undefined;
		situation?: (absolute?: boolean) => number;
		insightResult?: (from: Player, to: Player) => string;
	}
}

declare module "@/library/element/player.js" {
	interface Player {
		special_identity?: string;
		nonCamouflageFlashing?: boolean;
	}
}

declare module "@/status/index.js" {
	interface status {
		yeconfirm?: boolean;
		cheat_seat?: HTMLDivElement & { link: number };
		winner?: Player[];
		loser?: Player[];
		firstAct?: Player;
		firstAct2?: Player;
	}
}

declare module "@/library/element/control.js" {
	interface Control {
		dialog?: Dialog;
		backup?: Dialog;
	}
}

declare module "@/library/element/gameEvent.js" {
	interface GameEvent<N extends GameEventNumberValue = never> {
		zhongmode?: boolean;
		stratagemMode?: boolean;
		choice?: string[];
		goon?: number | false;
		control?: string;
		_info_map?: { target?: Player; player?: Player };
	}
}

declare module "@/library/element/GameEvent/eventContracts.js" {
	interface GameEventSetFields<N extends GameEventNumberValue = GameEventNumberValue> {
		ai?: GameEvent<N>["ai"];
		choice?: string[];
		switchToAuto?: (...args: any[]) => void;
		processAI?: (...args: any[]) => unknown;
		onfree?: boolean;
		createDialog?: unknown[];
		selectButton?: GameEvent<N>["selectButton"];
		dialog?: Dialog;
	}
}
