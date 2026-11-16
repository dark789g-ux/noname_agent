import type { Button, Card, Control, Dialog, Player } from "../../../library/element/index.js";

export interface ConnectEventInfo {
	creator?: string;
	content: string;
	day: number;
	hour: number;
	nickname: string;
	members: string[];
	title: string;
	id: string;
}

export type ConnectInputKeydown = (this: HTMLInputElement, event: KeyboardEvent) => void;

export type ConnectInput = Omit<HTMLInputElement, "onkeydown"> & {
	onkeydown: ConnectInputKeydown | null;
};

export type ConnectEventsButton = HTMLDivElement & {
	info: ConnectEventInfo[];
	focused?: boolean;
	textnode: HTMLElement;
	input: ConnectInput;
	interval?: ReturnType<typeof setInterval>;
	intervaltext?: string;
};

export type ConnectClientInfo = [
	nickname: string,
	avatar: string,
	available: boolean,
	status: string | undefined,
	wsid: string,
	onlineKey: string | undefined,
];

export type ConnectClientsButton = HTMLDivElement & {
	info: ConnectClientInfo[];
	focused?: boolean;
	textnode: HTMLElement;
	input: ConnectInput;
	interval?: ReturnType<typeof setInterval>;
	intervaltext?: string;
};

export type ConnectEventContentNode = HTMLDivElement & {
	info: { content: string };
};

export type ConnectEventNode = HTMLDivElement & {
	info: ConnectEventInfo;
};

export type InteractiveCard = Card & {
	_waitingfordrag?: { clientX: number; clientY: number };
	parentNode: (HTMLDivElement & { parentNode: HTMLDivElement | null }) | null;
};

export type LongPressTarget = HTMLDivElement & {
	_longpresstimeout?: ReturnType<typeof setTimeout>;
	_longpressevent?: TouchEvent;
	_longpresscallback?: (this: HTMLDivElement, event: TouchEvent) => void;
	_waitingfordrag?: { clientX: number; clientY: number };
};

export type ControlContainer = Control & {
	_doubleclick?: boolean;
	firstChild: ControlButton | null;
};

export type ControlButton = HTMLDivElement & {
	link: string;
};

export type ScrollableDiv = HTMLDivElement & {
	_scrollnum?: number;
	_scrollspeed?: number;
	interval?: ReturnType<typeof setInterval>;
};

export type IntroTarget = HTMLDivElement & {
	name?: string;
};

export type LogvTarget = IntroTarget & {
	logvtimeout?: ReturnType<typeof setTimeout>;
};

export type IdentityTarget = HTMLDivElement & {
	firstChild: HTMLElement;
	parentNode: Player;
	_customintro?: (intro: Dialog) => void;
};

export type IdentityCircleContainer = HTMLDivElement & {
	childNodes: NodeListOf<IdentityCircleNode>;
};

export type IdentityCircleNode = HTMLDivElement & {
	link: [IdentityTarget, string, string];
	_source: Player;
	parentNode: ParentNode | null;
};

export type ButtonNameTarget = Button & {
	node: { name: HTMLDivElement };
	buttonscrollinterval?: ReturnType<typeof setInterval>;
};

export type DraggableDialog = Dialog & {
	_dragorigin?: { clientX: number; clientY: number };
	_dragtransform?: number[];
	_dragorigintransform?: number[];
};

export type PoppedTarget = HoverTarget & {
	_uiintro?: Dialog;
	_poppedfunc?: () => Dialog | undefined;
	_poppedwidth?: number;
	_poppedheight?: number;
	forceclick?: boolean;
	_paused2?: boolean;
	parentNode: HTMLElement;
};

export type DraggablePlayer = Player & {
	_waitingfordrag?: { clientX: number; clientY: number };
};

export type HoverTarget = HTMLDivElement & {
	_mouseentercreated?: boolean;
	_hoveration?: number;
	_hoverfunc?: (this: HoverTarget, event: MouseEvent) => Dialog | undefined;
	_nopup?: boolean;
	_hoverwidth?: number;
	_mouseenterdialog?: Dialog;
	parentNode: HTMLDivElement | null;
};

export type CharacterSkillButton = HTMLDivElement & {
	link: string;
	linkname: string;
	linkAudioName?: string;
	playername?: string;
	dieAudios?: string[];
	playAudio?: () => void;
	audioName?: string;
};

export type CharacterAvatarNode = HTMLDivElement & {
	tempSkin?: string;
};

export type CharacterSkinButton = HTMLDivElement & {
	name: string;
};

export type TouchScrollTarget = HTMLDivElement & {
	startX: number;
	startY: number;
};

export type SkillToggleTarget = HTMLDivElement & {
	link: string;
};

export type SkillButtonTarget = HTMLDivElement & {
	link: Player;
	func: (player: Player) => void;
};

export type CharacterSkillClick = (this: CharacterSkillButton, event: Event | "init") => void;

export type ConfigRow = HTMLDivElement & {
	querySelector(selectors: ".toggle"): ConfigSwitcher;
};

export type ToggleTarget = HTMLDivElement & {
	link: boolean;
	parentNode: ConfigRow;
	additionalCommand?: (value: boolean, parent: ConfigRow) => void;
};

export type EditorTarget = HTMLDivElement & {
	link: string;
	additionalCommand?: (target: EditorTarget) => void;
};

export type ConfigSwitcher = HTMLDivElement & {
	link: string | number;
	choice: (string | number)[];
	expand?: boolean;
	parentNode: ConfigRow;
	nextSibling: HTMLDivElement;
	previousSibling: HTMLDivElement;
	additionalCommand?: (value: string | number, parent: ConfigRow) => void;
};

export type SwitcherChoice = HTMLDivElement & {
	link: string | number;
	parentNode: HTMLDivElement & { parentNode: ConfigRow };
};

export type AvatarTarget = HTMLDivElement & {
	parentNode: Player;
	_doubleClicking?: boolean;
};

export type ConnectRoomTarget = HTMLDivElement & {
	roomfull: boolean;
	roomgaming: boolean;
	roomempty: boolean;
	version: number | string | null;
	serving: boolean;
	key: string;
	config?: { observe?: boolean };
};

export function isCharacterSkillButton(node: Node | null): node is CharacterSkillButton {
	return node instanceof HTMLDivElement && "link" in node && typeof node.link == "string" && "linkname" in node && typeof node.linkname == "string";
}

export function isTouchScrollTarget(node: HTMLDivElement): node is TouchScrollTarget {
	return "startX" in node && typeof (node as Partial<TouchScrollTarget>).startX === "number" && "startY" in node && typeof (node as Partial<TouchScrollTarget>).startY === "number";
}

export function isSkillToggleTarget(node: HTMLDivElement): node is SkillToggleTarget {
	return "link" in node && typeof (node as Partial<SkillToggleTarget>).link === "string";
}

export function isDraggingDialog(item: Element, itemtype: string | void): item is DraggableDialog {
	return itemtype === "dialog";
}
