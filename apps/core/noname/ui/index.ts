import { lib } from "noname";
import type { Card, Control, Dialog, Player } from "../library/element/index.js";
import { Click } from "./click/index.js";
import { Create } from "./create/index.js";
import { installPrototypeMethods } from "./installPrototypeMethods.js";
import "./contracts/uiContract.js";
import type { RuntimeTimer } from "./contracts/domNodesContract.js";
import { controlAndJudgeLayoutMethods } from "./methods/controlAndJudgeLayout.js";
import { handcardsLayoutMethods } from "./methods/handcardsLayout.js";
import { arenaAndPlayerStateMethods } from "./methods/arenaAndPlayerState.js";

export type * from "./contracts/uiContract.js";

export class UI {
	updates: Array<() => void> = [];
	thrown: Card[] = [];
	touchlines: HTMLDivElement[] = [];
	todiscard: Record<string, Card[]> = {};
	_recycle: Record<string, HTMLElement> = {};
	playerPositions: string[] = [];
	create = new Create();
	click = new Click();
	selected = {
		buttons: [] as HTMLDivElement[],
		cards: [] as Card[],
		targets: [] as Player[],
	};
	dialogs: Dialog[];
	dialog: Dialog;
	system: HTMLDivElement;
	arena: RuntimeArena;
	controls: Control[];
	control: HTMLDivElement;
	confirm?: Control;
	skills?: Control;
	skills1?: Control;
	skills2?: Control;
	skills3?: Control;
	window: HTMLDivElement;
	pause: HTMLDivElement;
	backgroundMusic: HTMLAudioElement;
	special: HTMLDivElement;
	fakeme: HTMLDivElement;
	chess: HTMLDivElement;
	/** 手动在菜单栏中添加一个武将包的ui */
	updateCharacterPackMenu: Array<(packName: string) => void> = [];
	/** 手动在菜单栏中添加一个卡牌包的ui */
	updateCardPackMenu: Array<(packName: string) => void> = [];
	/** 挑战模式下正在操作的角色 */
	mebg: HTMLDivElement;
	updateUpdate?: Function;
	commandnode: HTMLDivElement;
	updateVideoMenu: () => void;
	menuContainer: HTMLDivElement;
	auto: HTMLDivElement;
	wuxie: HTMLDivElement;
	tempnowuxie?: Control & { _origin?: string };
	toastQueue: HTMLDivElement[] = [];
	cardPile: HTMLDivElement;
	discardPile: HTMLDivElement;
	ordering: HTMLDivElement;
	coin: HTMLDivElement;
	css: Record<string, HTMLLinkElement | HTMLStyleElement>;
	/** PC端悬浮的手牌 */
	_handcardHover: HTMLElement | null = null;
	timer: RuntimeTimer;
}

installPrototypeMethods("UI", UI.prototype, [controlAndJudgeLayoutMethods, handcardsLayoutMethods, arenaAndPlayerStateMethods]);

export let ui = new UI();

export let setUI = (instance?: InstanceType<typeof UI>) => {
	ui = instance || new UI();
	if (lib.config.dev) {
		window.ui = ui;
	}
};
