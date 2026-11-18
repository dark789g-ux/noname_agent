import type * as Element from "../element/index.js";
import type { lib } from "noname";

export type Player = InstanceType<typeof lib.element.Player>;

export type Card = InstanceType<typeof lib.element.Card>;

export type VCard = InstanceType<typeof lib.element.VCard>;

export type Button = InstanceType<typeof lib.element.Button>;

export type Dialog = InstanceType<typeof lib.element.Dialog>;

export type GameEvent = InstanceType<typeof lib.element.GameEvent>;

export type NodeWS = InstanceType<typeof lib.element.NodeWS>;

export type Control = InstanceType<typeof lib.element.Control>;

export type ClientInitConfig = {
	id: string | null;
	onlineKey: string | null;
	avatar: string;
	nickname: string;
	versionLocal: string;
	extension: boolean;
};

export type CommonAreaDefinition = {
	translate: string;
	areaStatusName: string;
	toName: string;
	fromName: string;
	isUnseen?: boolean;
	addHandeler: (
		event: GameEvent & {
			cards: Card[];
		},
		trigger?: GameEvent,
		player?: Player | null
	) => Promise<void>;
	removeHandeler: (
		event: GameEvent & {
			cards: Card[];
		},
		trigger?: GameEvent,
		player?: Player | null
	) => Promise<void>;
};

export type NodeRuntimeBase = {
	fs?: typeof import("fs");
	path?: typeof import("path");
	debug?: () => void;
	http?: typeof import("http");
	https?: typeof import("https");
	clients?: Element.Client[];
	banned?: string[];
	observing?: Element.Client[];
	torespond?: Record<string, GameEventResult | NodeResponseCallback>;
	torespondtimeout?: Record<string, ReturnType<typeof setTimeout>>;
	waitForResult?: Record<string, ((result: GameEventResult) => void)[]>;
};

export type NodePlatformRuntime = NodeRuntimeBase & {
	fs: typeof import("fs");
	path: typeof import("path");
	debug: () => void;
};

export type NodeResponseCallback = ((result: GameEventResult, player: Player) => boolean | void | (() => void)) & {
	_noname_waiting?: boolean;
};

export type NodeServerRuntime = NodeRuntimeBase & {
	clients: Element.Client[];
	banned: string[];
	observing: Element.Client[];
	torespond: Record<string, GameEventResult | NodeResponseCallback>;
	torespondtimeout: Record<string, ReturnType<typeof setTimeout>>;
	waitForResult: Record<string, ((result: GameEventResult) => void)[]>;
};

export type NodeRuntimeReset = NodeRuntimeBase;
