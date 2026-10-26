export {};

declare module "@/ui/index.js" {
	type RuntimeHandcardsContainer = HTMLDivElement & {
		onmousewheel?: (this: HTMLDivElement, event: WheelEvent & { readonly wheelDelta: number }) => void;
		_handcardsWidth?: number;
	};

	type RuntimeRoundMenu = HTMLDivElement & {
		_position: [number, number];
		_dragtransform?: [number, number];
		_dragorigin?: { clientX: number; clientY: number };
		_dragorigintransform?: [number, number];
		_dragtouches?: Touch;
		_resetTimeout?: ReturnType<typeof setTimeout>;
	};

	type RuntimeTime3 = HTMLDivElement & {
		starttime: number;
		interval: ReturnType<typeof setInterval>;
	};

	type RuntimeTimer = HTMLDivElement & {
		fillnode: HTMLDivElement;
		popnode: HTMLDivElement;
		position: number;
		set(text: string | number, percentage: number): void;
	};

	type RuntimeShortcut = HTMLDivElement & {
		autobutton: HTMLDivElement;
	};

	type RuntimeFavouriteModeList = HTMLDivElement & {
		update(): void;
		add(name: string, index: number): void;
	};

	type RuntimeChessContainer = HTMLDivElement & {
		chessLeft: number;
		chessTop: number;
		xmax: number;
		ymax: number;
		move: typeof ui.click.moveContainer;
		_scrolling?: boolean | ReturnType<typeof setTimeout> | null;
	};

	type RuntimePoppedTarget = HTMLDivElement & {
		_uiintro?: Dialog;
		_poppedfunc?: () => Dialog | undefined;
		_poppedwidth?: number;
		_poppedheight?: number;
		forceclick?: boolean;
		_paused2?: boolean;
	};

	type RuntimeEmotionButton = HTMLDivElement & {
		link?: string;
	};

	type RuntimeLandNode = HTMLDivElement & {
		destroy(): void;
		name?: string;
		skill?: string;
		player?: Player;
		system?: HTMLDivElement;
	};

	type RuntimeConnectClientInfo = [nickname: string, avatar: string, available: boolean, status: string | undefined, wsid: string, onlineKey: string | undefined];

	type RuntimeConnectClients = HTMLDivElement & {
		info?: RuntimeConnectClientInfo[];
	};

	type RuntimeConnectEventBase = {
		id: string;
		nickname: string;
		avatar: string;
		utc: number;
		day: number;
		hour: number;
		content: string;
		members: string[];
	};

	type RuntimeConnectEvent =
		| (RuntimeConnectEventBase & { creator: string; title?: string })
		| (RuntimeConnectEventBase & { creator?: undefined; title: string });

	type RuntimeConnectEvents = HTMLDivElement & {
		info?: RuntimeConnectEvent[];
	};

	type RuntimeConnectRoom = HTMLDivElement & {
		key?: string;
		roomfull?: boolean;
		roomgaming?: boolean;
		roomempty?: boolean;
		serving?: boolean;
		version?: number | string | null;
		config?: { observe?: boolean };
		roomindex: number;
		initRoom: Player["initRoom"];
	};

	type RuntimeConnecting = HTMLDivElement & {
		splashtimeout?: ReturnType<typeof setTimeout>;
	};

	interface UI {
		background_music_setting?: ReturnType<typeof import("@/ui/create/menu/vue/utils/configAdapter").makeConfigAdapter>;
		aozhan_bgm?: ReturnType<typeof import("@/ui/create/menu/vue/utils/configAdapter").makeConfigAdapter>;
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
		handcards1Container: RuntimeHandcardsContainer;
		handcards2Container: RuntimeHandcardsContainer;
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
		timer: RuntimeTimer;
		phasequeue: Array<HTMLDivElement & { link: Player }>;
		style: Record<string, HTMLStyleElement>;
		chessContainer: RuntimeChessContainer;
		placeChess?: (player: HTMLDivElement, position: string | number) => void;
	}
}

declare module "@/ui/create/index.js" {
	interface Create {
		cheat?: () => void;
		cheat2?: () => void;
		fakeme?: () => void;
	}
}

declare module "@/ui/click/index.js" {
	interface Click {
		card(this: Card, mode?: string): void;
		moveContainer(x: number, y?: number, scroll?: boolean): void;
		resetround?: (event?: Event) => boolean;
		connectMenu?: () => void;
		extensionTab(name: string): void;
		connectroom(this: HTMLDivElement & {
			key: string;
			roomfull: boolean;
			roomgaming: boolean;
			roomempty: boolean;
			version: number | string | null;
			serving: boolean;
			config?: { observe?: boolean };
		}, event?: Event): void;
	}
}
