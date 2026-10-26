export {};

declare module "@/library/element/player.js" {
	type RuntimeForceCountChoose = {
		[eventName: string]: number | undefined;
		chooseToUse?: number;
		phaseUse?: number;
		default?: number;
	};

	type RuntimePlayerModeState = {
		mode: {
			unseen: boolean;
			unseen2: boolean;
		};
		name?: string;
		name1?: string;
		name2?: string;
		identity: string;
		identityShown: boolean | undefined;
	};

	interface Player {
		_args: [HTMLDivElement | DocumentFragment | null | undefined];
		logSkill(name: string | string[], targets?: Player | Player[] | null | false, nature?: boolean | string | { color: number[] } | null, logv?: boolean | null, args?: Video["content"]): void;
		side?: boolean | null;
		_chesstransform?: [number, number];
		_start_cards?: Card[];
		_hide_all_timer?: boolean;
		noclick?: boolean;
		_noVibrate?: boolean;
		noPhaseDelay?: boolean;
		equiping?: boolean;
		phaseSkipped?: boolean;
		_noSkill?: boolean;
		_trueMe?: Player;
		forcemin?: boolean;
		isAuto?: boolean;
		actused?: number;
		forceShown?: boolean;
		_groupChosen?: string;
		_tempTranslate?: string;
		nodying?: boolean;
		career?: string;
		fanfixed?: boolean;
		actcount?: number;
		forceCountChoose?: RuntimeForceCountChoose;
		_guozhanguess?: string[];
		_source?: Player | true;
		getTopCards?(num?: number): Card[];
		$givemod?(card: Card | Card[] | number | "", player: Player): void;
		$gainmod?(card?: Card | Card[] | number): void;
		$dieAfter?(): void;
		getModeState?(): { unseen: boolean; unseen2: boolean };
		setModeState?(info: RuntimePlayerModeState): void;
		dieAfter2?(source?: Player | null): void | Promise<void>;
		dieAfter?(source?: Player | null): void;
		logAi?(targets: Player[] | number, card?: Card | VCard | string): void;
		// 对应模式启用前会先将以下方法注入 Player 原型。
		getXY(): [number, number];
		chessFocus(): void;
		createRangeShadow(num: number, move?: boolean | ((this: HTMLDivElement, event?: Event) => void)): HTMLDivElement[];
		updateActCount(used?: "outphase" | false | null, countx?: number, current?: number): void;
		useCardAnimateBefore?(event: GameEvent, trigger: GameEvent, player: Player): void;
		respondAnimateBefore?(event: GameEvent, trigger: GameEvent, player: Player): void;
showIdentity(identity?: string): void;
		getEnemy(): Player;
		getDeckCards(num?: number): Card[];
		$removeCharacter(num: number | undefined): void;
	}
}
