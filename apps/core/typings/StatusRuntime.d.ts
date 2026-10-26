export {};

declare module "@/ui/create/index.js" {
	interface Create {
		cards(ordered?: boolean): void;
	}
}

declare module "@/status/index.js" {
	type RuntimePrintableFunction = (...args: never[]) => void;
	type RuntimePrintablePrimitive = string | number | boolean | bigint | symbol | null | undefined;
	type RuntimePrintableObject = { [key: string]: RuntimePrintable };
	type RuntimePrintable = RuntimePrintablePrimitive | RuntimePrintable[] | RuntimePrintableObject | RuntimePrintableFunction | Error;
	type RuntimeIdentityGuessNode = HTMLDivElement;

	type RuntimeSwipeOrigin = {
		clientX: number;
		clientY: number;
		time: number;
		touches?: Touch;
	};

	type RuntimeTouchDialog = HTMLDivElement & {
		_dragorigin?: { clientX: number; clientY: number };
		_dragtransform?: [number, number];
		_dragtouches?: Touch;
	};

	type RuntimeLongPressTarget = HTMLDivElement & {
		_longpresstimeout?: ReturnType<typeof setTimeout>;
		_longpressevent?: TouchEvent;
		_longpresscallback?: (this: HTMLDivElement, event: TouchEvent) => void;
		_waitingfordrag?: { clientX: number; clientY: number };
	};

	type RuntimeDraggingDialog = Dialog & {
		_dragorigin?: { clientX: number; clientY: number };
		_dragtransform?: number[];
	};

	interface status {
		/** 由 chess/versus 模式初始化；其它模式可以缺省。 */
		first_less?: boolean;
		first_less_forced?: boolean;
		createControl?: Control;
		lord?: string;
		mousedragging?: { clientX: number; clientY: number } | null;
		draggingtouchdialog?: RuntimeTouchDialog;
		draggingdialog?: RuntimeDraggingDialog;
		longpressing?: RuntimeLongPressTarget;
		currentlogv?: HTMLDivElement;
		mouseleft?: boolean;
		waitingForTransition?: number;
		noclearcountdown?: boolean | "direct";
		mousedragorigin?: HTMLDivElement | null;
		choosing?: HTMLDivElement & {
			link: string | number;
			expand?: boolean;
			parentNode: HTMLElement;
			nextSibling: HTMLDivElement;
			previousSibling: HTMLDivElement;
		};
		_swipeorigin?: RuntimeSwipeOrigin;
		multitarget?: boolean;
		selectionfull?: boolean;
		ip?: string;
		coin?: number;
		_rest_return?: Record<string, { type: string; count: number }>;
		dburgent?: boolean;
		countDown?: ReturnType<typeof setInterval>;
		zhx_onAnimationPause?: boolean;
		lastVideoLog?: number;
		aozhanBGMToRemove?: string[];
		currentAozhan?: string;
		currentMusic?: string;
		toprint?: RuntimePrintable[][];
		waitingToReload?: boolean;
		reloading?: boolean;
		replayvideo?: boolean;
		videoInited?: boolean;
		ladder_tmp?: boolean;
		betWin?: boolean;
		ladder?: boolean;
		nopause?: boolean;
		_aozhan?: boolean;
		cardsFinished?: boolean;
		prepareArena?: boolean;
		nopopequip?: boolean;
		color?: boolean;
		maxShuffle?: number;
		maxShuffleCheck?: () => boolean | string;
		pileTop?: ChildNode | null;
		additionalReward?: () => number;
		friend?: string[];
		enemy?: string[];
		friendRage?: number;
		enemyRage?: number;
		friendBackup?: string[];
		enemyBackup?: string[];
		sourcemode?: string;
		tempAozhan?: string | string[];
		tempBackground?: string;
		tempMusic?: string | string[];
		onlinenickname?: string | null | undefined;
		onlineavatar?: string | null | undefined;
		connectCallback?: (connected: boolean) => void;
		dragstatuschanged?: Element | false | null;
		draggingroundmenu?: boolean;
		tempunpopup?: MouseEvent;
		touchnocheck?: boolean;
		longpressed?: boolean;
		mousedown?: boolean;
		force?: boolean;
		clicked2?: boolean;
		removinground?: boolean;
		dialogtouched?: boolean;
		justdragged?: boolean;
		tempunpop?: boolean;
		filterCharacter?: boolean;
		noright?: boolean;
		touchpopping?: boolean;
		_mouseentertimeout?: ReturnType<typeof setTimeout>;
		currentmouseenter?: (HTMLDivElement & { _mouseentercreated?: boolean; parentNode: HTMLDivElement | null }) | null;
		touchpoppingtimeout?: ReturnType<typeof setTimeout>;
		lastmouseutc?: number;
		gameStarted?: boolean;
		identityShown?: boolean;
		noupdatec?: boolean;
		waitingForPlayer?: boolean;
		music_importing?: boolean;
		pausing?: boolean;
		throwEmotionWait?: boolean;
		seatNumSettled?: boolean;
		mountCombined?: boolean;
		stratagemFuryMax?: number;
		cardPileNum?: number;
		enteringroom?: boolean;
		enteringroomserver?: boolean;
		config2?: boolean;
		gameDrawed?: boolean;
		roomtimeout?: boolean;
		creatingroom?: boolean;
		requestReadClipboard?: boolean;
		closeStepCache?: boolean;
		zhx_onAnimation?: number;
		ladder_mmr: number;
		timeout?: ReturnType<typeof setTimeout>;
		poptip?: [HTMLDivElement, HTMLDivElement];
		evaluatingExtension?: string | boolean;
		chatValue?: string;
		emotion_cache?: Record<string, string[]>;
		clickedplayer?: boolean;
		editing?: HTMLDivElement & { link: string };
		skintimeout?: ReturnType<typeof setTimeout>;
		timeInterval?: ReturnType<typeof setInterval>;
		noReplaceCharacter?: boolean;
		tempNoButton?: boolean;
		skillOwner: Record<string, string>;
		videoDuration: number;
		prebutton?: Array<HTMLDivElement & { link: Row_Item; activate?: () => void }>;
		removePop?: (node: object) => boolean;
		addChatEntry?: ((info: [string | null | undefined, string], clear?: boolean) => void) & { _origin: Dialog };
			logvtimeout?: ReturnType<typeof setTimeout>;
			extensionChangeLog?: { [extname: string]: Array<{ type: string; data: string | string[]; addText?: boolean }> };
			/** 上一个进入过阶段的玩家 */
	lastPhasedPlayer?: Player;
	isRoundFilter?: (event: GameEvent, player: Player) => boolean;
		read_clipboard_text?: string;
		connectEventsCallback?: () => void;
		connectClientsCallback?: () => void;
		connectDenied?: () => void;
		createNodeTimeout?: ReturnType<typeof setTimeout>;
		tempnofake?: boolean;
		noconfirm?: boolean;
		clickingidentity?: [Player, RuntimeIdentityGuessNode[]];
		bannedGroup?: string;
		waitingForCards?: [ordered?: boolean];
		videoToSave?: { name: [string, string] };
	}
}
