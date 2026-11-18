import type { NodeResponseCallback } from "../../../contracts/runtime.js";
import type { ClientSend } from "../../client.js";
import type { Card, GameEvent, VCard } from "../../index.js";
import type { Player } from "../../player.js";

export type ChangeSkinMatcher =
	| string
	| {
			skill?: string;
			characterName?: string;
			characterSkinName?: string;
			source?: string;
	  }
	| ((player: Player, name: "name" | "name2") => boolean);

export type ReinitMaxHpOption = number | [number, number, number?] | number[] | "nosmooth" | boolean | null;

export interface RoomConfigInfo {
	mode?: string;
	doudizhu_mode?: string;
	version?: string;
	gameStarted?: boolean;
	observe?: boolean;
	observeReady?: boolean;
	number: string | number;
	cardPack: string[];
	[key: string]: any;
}

export type RoomInitTuple = [string, any, RoomConfigInfo, number, string, ...any[]];

export interface PlayerCardMapStateEntry {
	isViewAsCard?: boolean;
	_destroyed_Virtua?: any;
	destroyed?: any;
	name2?: string;
	vcard?: VCard;
}

export interface PlayerState {
	hp: number | undefined;
	maxHp: number | undefined;
	nickname: string | null | undefined;
	sex: string | undefined;
	group: string | undefined;
	name: string | undefined;
	name1: string | undefined;
	name2: string | undefined;
	handcards: Card[];
	gaintag: string[][];
	equips: Card[];
	extraEquip: Player["extraEquip"];
	equips_map: Record<string, PlayerCardMapStateEntry>;
	judges: Card[];
	judges_map: Record<string, PlayerCardMapStateEntry>;
	specials: Card[];
	expansions: Card[];
	vcardsMap: Player["vcardsMap"];
	expansion_gaintag: string[][];
	disableJudge: boolean;
	disabledSlots: Record<string, number>;
	expandedSlots: Record<string, number>;
	views: (string | undefined)[];
	position: number;
	hujia: number | undefined;
	side: boolean | null | undefined;
	identityShown: boolean | undefined;
	identityNode: [string, string | undefined];
	identity: string;
	dead: boolean;
	linked: boolean;
	turnedover: boolean;
	out: boolean;
	phaseNumber: number;
	unseen: boolean;
	unseen2: boolean;
	seatNum: number;
	mode?: { unseen: boolean; unseen2: boolean };
}

declare module "../../player.js" {
	interface Player {
		// lifecycle/build.ts (5)
		build(noclick?: boolean): this;
		buildNode(): void;
		buildExtra(): void;
		buildProperty(): void;
		buildEventListener(noclick?: boolean): void;

		// lifecycle/characterInit.ts (4)
		reinitCharacter(from: string, to: string, log?: boolean): GameEvent | undefined;
		changeCharacter(newPairs: (string | undefined)[], log?: boolean): GameEvent | undefined;
		init(character: string | undefined, character2?: string | boolean | null, skill?: boolean | null, update?: boolean): this;
		$init(character: string, character2?: string | boolean | null): this;

		// lifecycle/characterReinitUninit.ts (7)
		reinit2(newPairs: (string | undefined)[]): void;
		$reinit12(newPairs: (string | undefined)[]): void;
		$reinit21(newPairs: (string | undefined)[]): void;
		reinit(from: string | undefined, to: string | undefined, maxHp?: ReinitMaxHpOption, online?: boolean): this | undefined;
		$reinit(from: string | undefined, to: string | undefined, maxHp?: ReinitMaxHpOption, online?: boolean): void;
		uninit(): this;
		$uninit(): void;

		// lifecycle/showCharacterAndSkin.ts (5)
		showCharacter(num: 0 | 1 | 2, log?: boolean): GameEvent | undefined;
		$showCharacter(num: 0 | 1 | 2, log?: boolean): void;
		changeSkin(map: ChangeSkinMatcher, character: string): void;
		changeSkinByName(character: string, index?: number): void;
		checkShow(skill: string, showonly?: boolean): "main" | "vice" | false;

		// lifecycle/onlineAndState.ts (10)
		initOL(name?: string | null, character?: string | null): void;
		uninitOL(): void;
		initRoom(info?: RoomInitTuple | "server" | never[] | null, info2?: unknown): this;
		send: ClientSend<this>;
		getId(): this;
		showGiveup(): void;
		applySkills(skills: Record<string, any>): void;
		getState(): PlayerState;
		setNickname(str?: string | null): this;
		syncSkills(): void;

		// lifecycle/waitAndTimer.ts (5)
		wait(callback?: NodeResponseCallback | boolean): void;
		unwait(result?: any): void;
		tempUnwait(result?: any): void;
		showTimer(time?: number): void;
		hideTimer(): void;
	}
}
