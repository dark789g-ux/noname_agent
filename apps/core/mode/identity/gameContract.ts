import "./runtimeTypes.js";

declare module "@/game/index.js" {
	interface Game {
		canReplaceViewpoint(): boolean;
		getRoomInfo(uiintro?: any): void;
		getIdentityList2(list: object): void;
		checkResult(): void;
		chooseCharacterPurpleOL(this: import("@/game/index.js").Game): void;
		chooseCharacterPurple(this: import("@/game/index.js").Game): void;
		chooseCharacterStratagemOL(this: import("@/game/index.js").Game): void;
		chooseCharacter(this: import("@/game/index.js").Game): void;
		stratagemCamouflage(): import("@/library/element/gameEvent.js").GameEvent<never>;
	}
}
