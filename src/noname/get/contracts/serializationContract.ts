import type JSZip from "jszip";

import type { CardInfoTuple } from "./types.js";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		paramToCacheKey(...args: any[]): string;

		stringify(obj?: any, level?: number): any;

		copy<T>(obj: T, copyKeyDeep?: boolean | undefined): T;

		charactersOL(func?: (name: string) => boolean): string[];

		targetsInfo(targets?: any): any[];

		infoTargets(infos?: any): import("@/library/element/player.js").Player[];

		cardInfo(card: Card): CardInfoTuple;

		cardsInfo(cards?: any[]): import("@/library/element/card.js").CardInfoTuple[];

		infoCard(info?: any): any;

		infoCards(infos?: any): any[];

		vcardInfo(card?: any): NonNullable<unknown>;

		vcardsInfo(cards?: any[]): NonNullable<unknown>[];

		infoVCard(card?: any): import("@/library/element/vcard.js").VCard;

		infoVCards(infos?: any): import("@/library/element/vcard.js").VCard[];

		cardInfoOL(card?: any): string;

		infoCardOL(info?: any): any;

		cardsInfoOL(cards?: any): string[];

		infoCardsOL(infos?: any): any[];

		playerInfoOL(player?: any): string;

		infoPlayerOL(info?: any): any;

		playersInfoOL(players?: any): string[];

		infoPlayersOL(infos?: any): any[];

		isFunctionParam(paramstr: string): boolean;

		funcInfoOL(func?: any): any;

		infoFuncOL(info?: any): any;

		eventInfoOL(item?: any, level?: any, noMore?: any): string;

		infoEventOL(item: string): import("@/library/element/gameEvent.js").GameEvent<never>;

		vcardInfoOL(item?: any): string;

		vcardsInfoOL(cards?: any): string[];

		infoVCardOL(item?: any): import("@/library/element/vcard.js").VCard;

		infoVCardsOL(infos?: any): import("@/library/element/vcard.js").VCard[];

		mapInfoOL(map: Map<any, any>, level?: number, nomore?: false | null): NonNullable<unknown>;

		setInfoOL(set: Set<any>, level?: number, nomore?: false | null): NonNullable<unknown>;

		infoMapOL(item?: any): Map<any, any>;

		infoSetOL(item?: any): Set<any>;

		stringifiedResult(item?: any, level?: any, nomore?: any): any;

		parsedResult(item?: any): any;
	}
}
