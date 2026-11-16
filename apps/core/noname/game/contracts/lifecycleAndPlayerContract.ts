import type { GameDrawEvent } from "../../library/element/gameEvent.js";
import type { CardMoveCandidate, ExperimentalCardInput } from "../../library/experimental/cardInput.js";

declare module "../index.js" {
	interface Game {
		// Runtime dynamic mode/network properties
		ws?: any;
		sandbox?: any;
		connectPlayers?: any[];
		onlinezhu?: string;
		roomId?: string;
		onlineroom?: boolean;
		servermode?: boolean;
		singleHandcard?: boolean;
		additionaldead?: Player[];
		importedPack?: any;
		ip?: string;
		notMe?: boolean;
		observe?: boolean;
		boss?: Player;
		friendZhu?: Player;
		enemyZhu?: Player;
		no_continue_game?: boolean;

		// Optional mode-injected hooks
		getVideoName?: () => string[];
		addOverDialog?: (dialog: Dialog, result: string) => void;
		checkOnlineResult?: (player: Player) => boolean | null;
		changeCoin?: (amount: number) => void;
		getLadderName?: (score: number) => string;
		controlOver?: () => void;
		getState?: () => any;
		updateState?: (state: any) => void;
		chooseCharacterOL?: () => any;
		getIdentityList?: (...args: any[]) => any;
		modeSwapPlayer?: (player: Player) => void;
		showIdentity?: (...args: any[]) => any;
		onwash?: () => void;
		onover?: (result: boolean | null) => void;
		draw2?: (func: Function) => void;
		addChessPlayer?: (...args: any[]) => any;
		setChessInfo?: (...args: any[]) => any;
		addObstacle?: (...args: any[]) => any;
		removeObstacle?: (...args: any[]) => any;
		moveObstacle?: (...args: any[]) => any;
		colorObstacle?: (...args: any[]) => any;
		editExtension?: (name: string) => void;
		addRecord?: (result: boolean | null) => void;

		// lifecycle/globalEventHandlers.ts
		getMe(): Player;
		createButtonCardsetion(innerHTML: string, button: HTMLElement): void;
		initCharacterList(filter?: boolean): string[];

		// lifecycle/loopAndTiming.ts
		forceOver(bool?: boolean | "noover", callback?: () => void): void;
		loop(event?: GameEvent): any;
		pause(): Promise<void>;
		pause2(): Promise<void>;
		resume(): void;
		resume2(): void;
		delaye(time?: number, time2?: number): GameEvent;
		delayex(time?: number, time2?: number): GameEvent;
		delay(time?: number, time2?: number): Promise<void>;
		delayx(time?: number, time2?: number): Promise<void>;

		// lifecycle/over.ts
		over(result?: boolean | string, bool?: boolean): void;

		// lifecycle/modeAndStart.ts
		loadModeAsync(name: string, callback?: (exports: importModeConfig) => any, onerror?: (error: unknown) => any): Promise<importModeConfig>;
		switchMode(name: string, configx?: any): void;
		loadMode(mode: string): void;
		loadPackage(...args: string[]): void;
		phaseLoop(player: Player): GameEvent;
		gameDraw(player?: Player | null, num?: number | ((player: Player) => number), targets?: Player[]): GameDrawEvent;
		updateRoundNumber(): void;
		asyncDraw(players: Player[], num?: number | number[] | ((player: Player) => number) | null, drawDeck?: { drawDeck: number } | null, bottom?: boolean): Promise<any>;
		asyncDrawAuto(players: Player[], num: number | number[] | ((player: Player) => number) | null, drawDeck?: { drawDeck: number } | null): void;

		// lifecycle/chooseCharacterDouble.ts
		chooseCharacterDouble(...args: any[]): void;

		// lifecycle/arenaFinish.ts
		finishSkill(skillId: string, sub?: boolean): void;
		finishCard(cardId: string): void;
		finishCards(): void;
		checkMod: CheckMod;
		prepareArena(num?: number): void;
		clearArena(): void;
		clearConnect(): void;

		// card/rulesAndNature.ts
		setStratagemBuffCost(cardName: string, cost: any): void;
		setStratagemBuffEffect(cardName: string, effect: any): void;
		setStratagemBuffPrompt(cardName: string, prompt: any): void;
		addTempTag(id: string, translation: string): string;
		addNature(nature: string, translation?: string, config?: any): string;
		hasNature(item: any, nature?: string, player?: Player | false): boolean;
		setNature(item: any, nature?: string | string[], addNature?: boolean): any;
		washCard(): any;
		addGroup(id: string, short?: string | object | null, name?: string | object | null, config?: any, type?: string): string;
		callHook<HookType extends NonameHookType, Name extends keyof NonameHookType>(name: Name, args: Parameters<HookType[Name]>): void;
		yingbianEffect(event: GameEvent, content: any, ...rest: any[]): GameEvent;
		setYingbianConditionColor(yingbianCondition: string, color: string): void;
		setComplexYingbianCondition(yingbianCondition: string, condition: any): void;
		setSimpleYingbianCondition(yingbianCondition: string, condition: any): void;
		setYingbianEffect(yingbianEffect: string, effect: any): void;
		setYingbianPrompt(yingbian: string, prompt: any): void;

		// card/pileAndZones.ts
		updateBackground(): void;
		updateConnectedCards(): void;
		addConnectedCards(cards: Card[] | Card): void;
		removeConnectedCards(cards: Card[] | Card): void;
		updateRenku(): void;
		addCardKnower(cards: Card[] | Card, players: Player | Player[] | string): void;
		clearCardKnowers(cards: Card[] | Card): void;
		loseAsync(arg?: Record<string, any>): GameEvent;
		callFuncUseStepCache(prefix: string, func: Function, params: any[]): any;
		getRarity(name: string): string | undefined;

		// card/cardMoveProducers.ts
		cardsDiscard(): void;
		cardsDiscard(cards: Card): GameEvent & { cards: Card[] };
		cardsDiscard(cards: Card[]): GameEvent & { cards: Card[] };
		cardsDiscard(cards: ExperimentalCardInput): (GameEvent & { cards: CardMoveCandidate[] }) | undefined;
		cardsGotoOrdering(cards: Card): GameEvent;
		cardsGotoOrdering(cards: [Card, ...Card[]]): GameEvent;
		cardsGotoOrdering(cards: Card[]): GameEvent | undefined;
		cardsGotoOrdering(cards: ExperimentalCardInput): GameEvent | undefined;
		cardsGotoSpecial(): void;
		cardsGotoSpecial(cards: Card, bool?: "toRenku" | false): GameEvent;
		cardsGotoSpecial(cards: Card[], bool?: "toRenku" | false): GameEvent;
		cardsGotoPile(...args: (Card[] | ChildNode[] | Card | ExperimentalCardInput | Function | "insert" | "washCard" | "triggeronly" | [string, any])[]): GameEvent;
		$cardsGotoPile(event: GameEvent): void;
		showHistory(pause?: false): void;
		createBackground(src: string, blur?: true): HTMLDivElement;
		changeLand(url: string, player?: Player): void;
		checkFileList(updates: string[], proceed: () => void | Promise<void>): Promise<void>;
		replaceHandcards(...args: any[]): void;
		removeCard(name: string): void;

		// player/checkAndConfirm.ts
		check(event?: GameEvent): boolean;
		uncheck(...args: string[]): void;

		// player/seatAndSwap.ts
		swapSeat(player1: Player, player2: Player, prompt?: boolean, behind?: boolean, noanimate?: boolean): void;
		swapPlayer(player: Player, player2?: Player | null, options?: { animate?: boolean; preserveIdentity?: boolean }): void;
		swapControl(player: Player): void;
		swapPlayerAuto(player: Player): void;
		findNext(player: Player): Player;

		// player/playerLifecycle.ts
		addPlayer(position: number, character?: string, character2?: string): Player;
		addFellow(position: number, character?: string, animation?: string): Player;
		triggerEnter(player: Player): GameEvent;
		restorePlayer(player: Player): Player | undefined;
		removePlayer(player: Player): Player;
		replacePlayer(player: Player, character?: string, character2?: string): Player;
		arrangePlayers(): void;

		// player/playerAndSkillQuery.ts
		filterSkills(skills: string[], player: Player, exclude?: string[]): string[];
		expandSkills(skills: string[], subSkill?: boolean): string[];
		css(style: { [key: string]: any }): void;
		hasPlayer(func: (player: Player) => boolean, includeOut?: boolean): boolean;
		hasPlayer2(func: (player: Player) => boolean, includeOut?: boolean): boolean;
		countPlayer(func?: (player: Player) => number | boolean, includeOut?: boolean): number;
		countPlayer2(func?: (player: Player) => number | boolean, includeOut?: boolean): number;
		filterPlayer(func?: (player: Player) => boolean, list?: Player[], includeOut?: boolean): Player[];
		filterPlayer2(func?: (player: Player) => boolean, list?: Player[], includeOut?: boolean): Player[];
		findPlayer(func: (player: Player) => boolean, includeOut?: boolean): Player | null;
		findPlayer2(func: (player: Player) => boolean, includeOut?: boolean): Player | null;
		findCards(func: (value: string, card: object) => boolean, all?: boolean): string[];
		countGroup(): number;
		testRunCost(func: Function): number;
		doAsyncInOrder<T, R>(targets: T[], asyncFunc: (target: T, i: number) => R | PromiseLike<R>, sort?: (a: T, b: T) => number): Promise<void>;
		chooseAnyOL(targets: Player[], func: Function, args: any[]): GameEvent;
		createFakeCards(cards: Card[] | Card, isBlank?: boolean, tempname?: string): Card[];
		deleteFakeCards(cards: Card[] | Card): Card[];
		closePoptipDialog(): void;
		findSkill(event: GameEvent, includeCharlotteSkill?: boolean, includeEquipSkill?: boolean, includeGlobalSkill?: boolean): string | null;
	}
}
