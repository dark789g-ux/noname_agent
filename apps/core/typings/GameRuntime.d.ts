import type { Sandbox } from "@/util/sandbox/sandbox.js";

export {};

declare module "@/game/index.js" {
	interface Game {
		forceOver(bool: boolean | "noover", callback?: () => void): void;
		deviceZoom: number;
		connectPlayers?: Player[];
		roomId?: string | number | null;
		additionaldead?: Player[];
		ws?: WebSocket | null;
		onlinezhu?: string | boolean | null;
		servermode?: boolean;
		onlineroom?: boolean;
		ip?: string;
		sandbox?: Sandbox | null;
		observe?: boolean;
		notMe?: boolean;
		no_continue_game?: boolean;
		singleHandcard?: boolean;
		menuZoom?: number | null;
		syncMenu?: boolean;
		onlinehall?: boolean;
		wsid?: string;
		minskin?: boolean;
		bannedcards?: string[];
		friendZhu?: Player;
		enemyZhu?: Player;
		roomIdServer?: boolean;
		reserveDead?: boolean;
		importedPack?: importExtensionConfig;
		boss: Player;
		onover?: () => void;
		onwash?: () => void;
		onpause?: () => void;
		onresume?: () => void;
		onSwapControl(): void;
		modeSwapPlayer?: (player: Player) => void;
		editExtension?: (name?: string) => void;
		getRoomInfo?: (uiintro: Dialog) => void;
		getVideoName?: () => string[];
		getLadderName?(score: number): string;
		addRecord?(bool: boolean | null): void | Promise<void>;
		draw2?: (func: (time: number, context: CanvasRenderingContext2D) => false | void) => void;
		zsOriginLineXy?: Game["linexy"];
		checkOnlineResult(player: Player): boolean;
		chooseCharacterOL(): void;
		getState?: () => Record<string, { identity: string }>;
		updateState?: (state: Record<string, { identity: string }>) => void;
		controlOver?: () => void;
		addOverDialog?: (dialog: Dialog, result?: string) => void;
		changeCoin?: (delta: number) => void;
		showIdentity?: (me?: boolean) => void;
				/** 摸牌阶段额外摸牌修正 */
		modPhaseDraw?(player: Player, num: number | undefined): EventResult | Promise<EventResult>;
// chess/tafang 回放启用前会先将以下方法注入 Game 原型。
		addChessPlayer(name: string, enemy: boolean | string, num?: number, pos?: number | string, enter?: boolean): Player;
		setChessInfo(player?: Player): void;
		addObstacle(x: number | string, y?: number | boolean): HTMLDivElement | null;
		removeObstacle(pos: number | string | HTMLDivElement): void;
		moveObstacle(pos: number | string | HTMLDivElement, x: number, y: number): boolean;
		colorObstacle(pos: number | string | HTMLDivElement, color: string): void;
		getIdentityList?(player: Player): Record<string, string> | undefined;
		getIdentityList2?(list: Record<string, string>): void;
	}
}
