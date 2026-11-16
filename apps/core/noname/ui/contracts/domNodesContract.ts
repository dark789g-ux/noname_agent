import type { makeConfigAdapter } from "@/ui/create/menu/vue/utils/configAdapter";
import type { Control, Dialog, Player } from "../../library/element/index.js";

export type PositionedControl = Control & {
	stayleft?: boolean;
	currentLeft?: number;
	_offset?: number;
};

export type RuntimeUIHandcardsContainer = HTMLDivElement & {
	onmousewheel?: (this: HTMLDivElement, event: WheelEvent & { readonly wheelDelta: number }) => void;
	_handcardsWidth?: number;
};

export type RuntimeRoundMenu = HTMLDivElement & {
	_position: [number, number];
	_dragtransform?: [number, number];
	_dragorigin?: { clientX: number; clientY: number };
	_dragorigintransform?: [number, number];
	_dragtouches?: Touch;
	_resetTimeout?: ReturnType<typeof setTimeout>;
};

export type RuntimeTime3 = HTMLDivElement & {
	starttime: number;
	interval: ReturnType<typeof setInterval>;
};

export type RuntimeTimer = HTMLDivElement & {
	fillnode: HTMLDivElement;
	popnode: HTMLDivElement;
	position: number;
	set(text: string | number, percentage: number): void;
};

export type RuntimeShortcut = HTMLDivElement & {
	autobutton: HTMLDivElement;
};

export type RuntimeFavouriteModeList = HTMLDivElement & {
	update(): void;
	add(name: string, index: number): void;
};

export type RuntimeChessContainer = HTMLDivElement & {
	chessLeft: number;
	chessTop: number;
	xmax: number;
	ymax: number;
	move(this: any, x: number, y?: number, scroll?: boolean): void;
	_scrolling?: boolean | ReturnType<typeof setTimeout> | null;
};

export type RuntimePoppedTarget = HTMLDivElement & {
	_uiintro?: Dialog;
	_poppedfunc?: () => Dialog | undefined;
	_poppedwidth?: number;
	_poppedheight?: number;
	forceclick?: boolean;
	_paused2?: boolean;
};

export type RuntimeEmotionButton = HTMLDivElement & {
	link?: string;
};

export type RuntimeLandNode = HTMLDivElement & {
	destroy(): void;
	name?: string;
	skill?: string;
	player?: Player;
	system?: HTMLDivElement;
};

export type RuntimeConnectClientInfo = [
	nickname: string,
	avatar: string,
	available: boolean,
	status: string | undefined,
	wsid: string,
	onlineKey: string | undefined,
];

export type RuntimeConnectClients = HTMLDivElement & {
	info?: RuntimeConnectClientInfo[];
};

export type RuntimeConnectEventBase = {
	id: string;
	nickname: string;
	avatar: string;
	utc: number;
	day: number;
	hour: number;
	content: string;
	members: string[];
};

export type RuntimeConnectEvent =
	| (RuntimeConnectEventBase & { creator: string; title?: string })
	| (RuntimeConnectEventBase & { creator?: undefined; title: string });

export type RuntimeConnectEvents = HTMLDivElement & {
	info?: RuntimeConnectEvent[];
};

export type RuntimeConnectRoom = HTMLDivElement & {
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

export type RuntimeConnecting = HTMLDivElement & {
	splashtimeout?: ReturnType<typeof setTimeout>;
};

export type RuntimeAudioSettingAdapter = ReturnType<typeof makeConfigAdapter>;
