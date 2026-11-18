import type { Game } from "../index.js";
import type { Library } from "../../library/index.js";
import type { AudioInfo, SkillAudioInfo } from "../audio/soundEffects.js";
import type { CardData, GameHistory, GameHistoryEventKey, HistoryLogNode, Videos } from "./gameContract.js";

declare module "../index.js" {
	interface Game {
		// network/broadcastAndSync.ts
		randomMapOL(type?: "hidden"): any;
		closeMenu(): void;
		closeConnectMenu(): void;
		closePopped(): void;
		broadcast<TParams extends any[]>(func: ((...args: TParams) => any) | keyof Library["message"]["client"], ...args: TParams): void;
		syncState(): void;
		updateWaiting(): void;
		waitForPlayer(func: Function): GameEvent;
		countDown(time: number, onEnd?: Function): void;
		countChoose(clear?: any): void;
		stopCountChoose(): void;
		requireSandboxOn(ip?: string): void;
		connect(ip: string, callback?: (result: boolean) => any): void;
		send(...args: any[]): void;

		// network/skillSync.ts
		syncSkillData(skill: string, sync: string, ...args: any[]): void;
		requestSkillData(skill: string, sync: string, timeout: number | null, ...args: any[]): Promise<[boolean, any]>;
		respondSkillData(id: string | null, player: Player, subject: { name: string; key: string; args: any[]; timeout: number }): Promise<[boolean, any] | undefined>;
		sendTo(id: string, message: any): any;
		createServer(): void;

		// network/onlinePlayers.ts
		syncHandcard(player: Player, id_list: string[]): void;
		addPlayerOL(target: Player, character?: string | null, character2?: string | null, isNext?: boolean, config?: { source?: Player; animate?: ((player: Player) => Promise<any>) | false }): Promise<Player | undefined>;
		removePlayerOL(player: Player, config?: { animate?: ((player: Player) => Promise<any>) | false }): Promise<Player | undefined>;

		// video/videoControl.ts
		playVideo(time: string | number, mode: string): void;
		playVideoContent(video: Videos): void;
		reload(): void;
		reload2(): void;
		reloadCurrent(): void;
		update(func: Function): Function;
		unupdate(func: Function): void;
		stop(): void;
		run(): void;
		addVideo(type: string, player?: Player | null, content?: object | string | number | boolean | null | undefined): void;

		// animation/elementSwap.ts
		$swapElement(e1: HTMLDivElement, e2: HTMLDivElement, duration?: number, timefun?: "linear" | "ease-in-out"): Promise<void>;
		$elementSwap(elementA: HTMLElement, elementB: HTMLElement, duration?: number, timefun?: "linear" | "ease-in-out"): Promise<void>;

		// animation/elementGoto.ts
		$elementGoto(element: HTMLElement, parent: HTMLElement, position?: number | "first" | "last" | Node, duration?: number, timefun?: "linear" | "ease-in-out"): Promise<void>;

		// animation/dialogAndAnimate.ts
		draw(func: Function): void;
		vibrate(time?: number): void;
		prompt(...args: any[]): void;
		alert(str: string): void;
		print(...args: any[]): void;

		// animation/lineAndTrajectory.ts
		linexy(path: [number, number, number, number], config: "drag", reusable?: HTMLDivElement): HTMLDivElement;
		linexy(path: [number, number, number, number], config?: { opacity?: number; color?: number[] | string; dashed?: boolean; duration?: number }, ignored?: boolean): HTMLDivElement;
		linexy(path: [number, number, number, number], config: number | string | HTMLDivElement | DocumentFragment): HTMLDivElement;
		_linexy(path: [number, number, number, number], option?: any, chessFlag?: any): void;

		// animation/zsLineAnimation.ts
		zsPlayLineAnimation(name: string, node: any, fake?: boolean, points?: [number[], number[]]): void;
		zsPlayLineAnimationByName(name: string, path: [number, number, number, number]): void;
		zsXiangongLineXy(path: [number, number, number, number]): void;
		zsZhuzhangLineXy(path: [number, number, number, number]): void;
		zsMohuaLineXy(path: [number, number, number, number]): void;
		zsShenjianLineXy(path: [number, number, number, number]): void;
		zsYujianLineXy(path: [number, number, number, number]): void;
		zsAnheiLineXy(path: [number, number, number, number]): void;
		zsMozhuaLineXy(path: [number, number, number, number]): void;
		zsJianfengLineXy(path: [number, number, number, number]): void;
		zsJinjianLineXy(path: [number, number, number, number]): void;
		zsJinlongLineXy(path: [number, number, number, number]): void;
		zsLuoyingLineXy(path: [number, number, number, number]): void;
		zsXingdieLineXy(path: [number, number, number, number]): void;
		zsYuexianLineXy(path: [number, number, number, number]): void;
		zsShezhangLineXy(path: [number, number, number, number]): void;

		// audio/soundEffects.ts
		playAudio(options: {
			path: string;
			addVideo?: boolean;
			video?: boolean;
			onCanPlay?: (evt: Event) => void;
			onPlay?: (evt: Event) => void;
			onEnded?: (evt: Event) => void;
			onError?: (evt: Event) => void;
		}): HTMLAudioElement | undefined;
		playAudio(...args: (string | number | undefined | ((evt: Event) => void))[]): HTMLAudioElement | undefined;
		tryAudio(options: { audioList: string[]; autoplay?: boolean; random?: boolean; addVideo?: boolean }): HTMLAudioElement | (() => HTMLAudioElement | undefined) | undefined;
		parseSkillAudio(skill: string, player?: Player | object | string, skillInfo?: SkillAudioInfo | AudioInfo): string[];
		parseSkillText(skill: string, player?: Player | object | string, skillInfo?: SkillAudioInfo | AudioInfo): string[];
		parseSkillTextMap(skill: string, player?: Player | object | string, skillInfo?: SkillAudioInfo | AudioInfo): any;
		parseDieTextMap(player: string | Player): any;
		trySkillAudio(skill: string, player: Player | string, directaudio?: boolean, nobroadcast?: boolean | null, skillInfo?: any, args?: any[]): any;
		tryDieAudio(player: Player | string): any;
		playSkillAudio(name: string, index?: number | "video"): void;
		playCardAudio(card: string | Card | VCard, sex: Player | Sex): void;

		// audio/backgroundMusic.ts
		addBackgroundMusic(link: string, musicName?: string, aozhan?: boolean): void;
		removeBackgroundMusic(link: string, aozhan?: boolean): void;
		generateBeatmapTimeleap(bpm: number, beats: number[], offset?: number): number[];
		playBackgroundMusic(): void;

		// extension/contentRegistration.ts
		createTrigger(name: string, skill: string, player: Player, event: GameEvent, indexedData?: any): GameEvent | false | undefined;
		createEvent(name: string, trigger?: false, triggerEvent?: RuntimeGameEvent): GameEvent;
		addCharacter(name: string, information: { extension: string; sex: Sex; group: string; hp: string | number; skills?: string[]; tags?: string[]; translate: string }): void;
		addCharacterPack(pack: { mode?: string; forbid?: any; character: { [key: string]: Character }; skill: { [key: string]: object }; [key: string]: any }, packagename?: string): void;
		addCard(name: string, info: CardData, info2: { extension: string; translate: string; description: string; number?: number; color?: string }): void;
		addCardPack(pack: { extension?: string; mode?: string[]; forbid?: string[]; list: any[]; card: { [key: string]: CardData }; skill: { [key: string]: object }; [key: string]: any }, packagename?: string): void;
		addSkill(name: string, info: { [key: string]: any }, translate?: string, description?: string, appendInfo?: string, abInfo?: string): boolean;

		// extension/modeAndExtensionManage.ts
		addMode(name: string, info: any, info2: { translate: string; config: { [key: string]: object }; extension?: string }): void;
		addGlobalSkill(skill: string, player?: Player): boolean;
		removeGlobalSkill(skill: string, player?: Player): void;
		resetSkills(): void;
		hasExtension(extensionName: string): boolean;
		hasExtensionInstalled(extensionName: string): boolean;
		hasExtensionLoaded(extensionName?: string): boolean;
		removeExtension(extensionName: string, keepFile?: boolean): void;
		addRecentCharacter(...args: string[]): void;
		createCard(name: Card | VCard | Record<string, any> | string, suit?: string | null, number?: number | string | null, nature?: string | boolean | null): Card;
		createCard2(...args: Parameters<Game["createCard"]>): Card;

		// extension/extensionLoader.ts
		import(type: string, content: any, url?: any): Promise<any>;
		loadExtension(object: any): Promise<any>;
		importExtension(data: any, finishLoad?: Function, exportExtension?: string): Promise<false | undefined>;

		// storage/platformFileIO.ts
		multiDownload2(list: string[], onsuccess?: (remaining: number) => void, onerror?: Parameters<NonNullable<typeof Game.prototype.download>>[3], onfinish?: () => void, process?: (url: string) => string, dev?: "nodev" | null): void;
		multiDownload(list: string[], onsuccess: (remaining: number) => void, onerror: Parameters<NonNullable<typeof Game.prototype.download>>[3], onfinish: () => void, process?: (url: string) => string, dev?: "nodev" | null): void;
		fetch(url: string, onload: NonNullable<Parameters<NonNullable<typeof Game.prototype.readFile>>[1]>, onerror?: Parameters<NonNullable<typeof Game.prototype.download>>[3], onprogress?: Parameters<NonNullable<typeof Game.prototype.download>>[5]): void;

		// storage/globalHistory.ts
		hasGlobalHistory<T extends GameHistoryEventKey>(key: T, filter: (event: GameHistory[T][number]) => boolean, last?: GameHistory[T][number]): boolean;
		checkGlobalHistory<T extends GameHistoryEventKey>(key: T, filter: (event: GameHistory[T][number]) => void, last?: GameHistory[T][number]): void;
		getGlobalHistory(): GameHistory;
		getGlobalHistory<T extends GameHistoryEventKey>(key: T, filter?: (event: GameHistory[T][number]) => boolean, last?: GameHistory[T][number]): GameHistory[T];
		hasAllGlobalHistory<T extends GameHistoryEventKey>(key: T, filter: (event: GameHistory[T][number]) => boolean, last?: GameHistory[T][number]): boolean;
		checkAllGlobalHistory<T extends GameHistoryEventKey>(key: T, filter: (event: GameHistory[T][number]) => boolean, last?: GameHistory[T][number]): void;
		getAllGlobalHistory(): GameHistory[];
		getAllGlobalHistory<T extends GameHistoryEventKey>(key: T, filter?: (event: GameHistory[T][number]) => boolean, last?: GameHistory[T][number]): GameHistory[T];
		getRoundHistory<T extends GameHistoryEventKey>(key: T, filter?: (event: GameHistory[T][number]) => boolean, last?: GameHistory[T][number], num?: number, keep?: boolean): GameHistory[T][number][];

		// storage/battleLog.ts
		log(...args: any[]): void;
		logv(player: Player | string, card: string | [Card | VCard, Card[]], targets?: Player | Player[] | (Card | VCard)[], event?: GameEvent, forced?: boolean, logvid?: string): HistoryLogNode | undefined;

		// storage/database.ts
		putDB(storeName: string, idbValidKey: IDBValidKey | undefined, value: any, onSuccess?: Function, onError?: Function): Promise<Event | void>;
		getDB(storeName: string, query?: IDBValidKey | null, onSuccess?: Function, onError?: Function): Promise<unknown>;
		deleteDB(storeName: string, query?: IDBValidKey, onSuccess?: Function, onError?: Function): Promise<any>;

		// storage/configAndChangelog.ts
		save(key?: string, value?: any, mode?: string): void;
		showChangeLog(): void;
		showExtensionChangeLog(str: string | Array<{ type: string; data: string | string[]; addText?: boolean }> | { type: string; data: string | string[]; addText?: boolean } | null, extname?: string): void;
		saveConfig(key: string, value?: any, local?: string | boolean, callback?: () => void): Promise<void> | undefined;
		saveConfigValue(key: string): Promise<void> | undefined;
		saveExtensionConfig(extension: string, key: string, value?: any): Promise<void> | undefined;
		saveExtensionConfigValue(extension: string, key: string): Promise<void> | undefined;
		getExtensionConfig(extension: string, key: string): any;
		clearModeConfig(mode: string): void;
	}
}
