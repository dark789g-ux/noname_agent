import type { Control, Dialog, Player } from "../../library/element/index.js";
import type {
	RuntimeAudioSettingAdapter,
	RuntimeChessContainer,
	RuntimeConnectClients,
	RuntimeConnectEvents,
	RuntimeConnectRoom,
	RuntimeConnecting,
	RuntimeEmotionButton,
	RuntimeFavouriteModeList,
	RuntimeLandNode,
	RuntimePoppedTarget,
	RuntimeRoundMenu,
	RuntimeShortcut,
	RuntimeTime3,
	RuntimeUIHandcardsContainer,
} from "./domNodesContract.js";

export type * from "./domNodesContract.js";

export interface SpreadOffsetResult {
	spreadIndex: number;
	spreadLeft: number;
	spreadRight: number;
}

declare module "../index.js" {
	interface UI {
		// 动态挂载在 ui 实例上的运行期节点与配置适配器
		background_music_setting?: RuntimeAudioSettingAdapter;
		aozhan_bgm?: RuntimeAudioSettingAdapter;
		roundmenu: RuntimeRoundMenu;
		cheat?: Control;
		cheat2?: Control;
		revive?: Control;
		restart?: Control;
		continue_game?: Control;
		exit?: Control;
		swap?: Control;
		single_swap?: HTMLDivElement;
		cardPileButton: HTMLDivElement;
		handcards1Container: RuntimeUIHandcardsContainer;
		handcards2Container: RuntimeUIHandcardsContainer;
		historybar: HTMLDivElement;
		me: HTMLDivElement;
		land?: RuntimeLandNode | null;
		throwEmotion?: RuntimeEmotionButton[];
		handcards1?: HTMLDivElement;
		handcards2?: HTMLDivElement;
		shortcut: RuntimeShortcut;
		arenalog: HTMLDivElement;
		connecting?: RuntimeConnecting;
		sidebar: HTMLDivElement;
		system2: HTMLDivElement;
		intro?: Dialog;
		roombase?: Dialog;
		canvas: HTMLCanvasElement;
		ctx: CanvasRenderingContext2D;
		rooms?: RuntimeConnectRoom[];
		giveup?: HTMLDivElement;
		autonode: HTMLDivElement;
		startServer?: HTMLDivElement;
		connectEvents?: RuntimeConnectEvents;
		currentpopped?: RuntimePoppedTarget;
		ipnode?: HTMLDivElement;
		iptext?: HTMLDivElement;
		ipbutton?: HTMLDivElement;
		recentIP?: HTMLDivElement;
		hall_button?: HTMLDivElement;
		connectMenuContainer?: HTMLDivElement;
		exitroom?: HTMLDivElement;
		removeObserve?: HTMLDivElement;
		commonCardPileButton: HTMLDivElement;
		connectEventsCount?: HTMLDivElement;
		connectClientsCount?: HTMLDivElement;
		createRoomButton?: HTMLDivElement;
		connectStartBar?: HTMLDivElement;
		connectShareButton?: HTMLDivElement;
		roomInfo?: HTMLDivElement;
		connectStartButton?: HTMLDivElement & { clicked?: boolean };
		connectClients?: RuntimeConnectClients;
		background: HTMLDivElement;
		gameinfo: HTMLDivElement;
		cardPileNumber: HTMLDivElement;
		aiModeIndicator: HTMLDivElement;
		sidebar3: HTMLDivElement;
		system1: HTMLDivElement;
		replay: HTMLDivElement;
		config2: HTMLDivElement;
		volumn: HTMLDivElement;
		sortCard: HTMLDivElement;
		deckMonitor: HTMLDivElement;
		playerids: HTMLDivElement;
		time: HTMLDivElement;
		favmode: HTMLDivElement;
		favmodelist: RuntimeFavouriteModeList;
		chatButton?: RuntimePoppedTarget;
		ladder?: HTMLDivElement;
		friendBar?: HTMLDivElement;
		enemyBar?: HTMLDivElement;
		toastStyle?: Promise<void>;
		_updatexr?: ReturnType<typeof setTimeout>;
		time3?: RuntimeTime3;
		phasequeue: Array<HTMLDivElement & { link: Player }>;
		style: Record<string, HTMLStyleElement>;
		chessContainer: RuntimeChessContainer;
		placeChess?: (player: HTMLDivElement, position: string | number) => void;

		// methods/controlAndJudgeLayout.ts
		updatec(): void;
		updatex(): void;
		updatexr(): void;
		updatejm(player: Player, nodes: HTMLElement, start?: number, inv?: boolean): void;
		updatem(player?: Player): void;
		updatej(player?: Player): void;
		updated(): void;
		updatez(): void;

		// methods/handcardsLayout.ts
		getSpreadOffset(cards: HTMLElement[], options?: { cardWidth?: number; currentMargin?: number }): SpreadOffsetResult;
		updatehl(): void;
		updateh(compute?: boolean): void;
		updatehx(node: HTMLElement): void;

		// methods/arenaAndPlayerState.ts
		refresh(node: Element): void;
		clear(): void;
		update(): void;
		recycle(node: string): HTMLElement | undefined;
		recycle(node: HTMLElement, key: string): void;
		updateConnectPlayerPositions(numberOfPlayers?: number): void;
		updatePlayerPositions(numberOfPlayers?: number): void;
		updateRoundNumber(roundNumber: number, cardPileNumber: number): void;
		updateAIModeIndicator(): void;
		updateLLMLogButtons(): void;
		updateLLMLogButton(player: any): void;
	}
}
