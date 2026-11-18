import type JSZip from "jszip";

import type { YingbianCard, OwnerQueryCard, RuntimeRowItemOption } from "./types.js";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		addNewRowList(cards: Card[], type?: "suit" | "color", player?: false | Player): Array<RuntimeRowItemOption | RuntimeRowItemOption[]>;

		cardDescription(
			node:
				| Card
				| VCard
				| (CardBaseUIData & {
						name: string;
				  }),
			player: Player
		): string;

		cardTranslation(filter?: Function): string[];

		skillsFromEquips(cards: Card[] | VCard[]): any[];

		inpileVCardList(filter?: Function): string[][];

		cardNameLength(card: Card, player?: Player): number;

		yingbianConditions(card?: any): string[];

		complexYingbianConditions(card?: any): string[];

		simpleYingbianConditions(card?: any): string[];

		yingbianEffects(card?: any): string[];

		defaultYingbianEffect(card?: any): any;

		subtypes(
			obj:
				| string
				| ((Card | VCard | CardBaseUIData) & {
						subtypes?: string[];
				  }),
			player?: false | Player
		): string[];

		zhinangs(filter?: Function | boolean): string[];

		bottomCards(num?: number, putBack?: boolean): Card[];

		discarded(): Card[];

		cardOffset(): number;

		autoViewAs(card: Card | VCard | CardBaseUIData, cards?: Card[] | "unsure", owner?: Player | false, ...args: any[]): VCard;

		_autoViewAs(card?: any, cards?: any): any;

		bingzhu(name: string | Card | VCard): string[];

		inpilefull(type?: any): {
			name: any;
			suit: any;
			number: any;
			nature: any;
		}[];

		inpile(type?: any, filter?: any): any[];

		inpile2(type?: any): any[];

		typeCard(type?: any, filter?: any): string[];

		libCard(filter?: any): string[];

		equipNum(card?: any): number;

		type(obj: Card | VCard | CardBaseUIData | string | undefined, method?: "trick" | null, player?: Player | false): string | undefined;

		type2(card?: any, player?: any): string | undefined;

		subtype(obj: string | Card | VCard | CardBaseUIData | undefined, player?: false | Player): string | undefined;

		equiptype(card?: any, player?: any): number;

		name(card: Card | VCard | CardBaseUIData, player?: false | Player): string | undefined;

		suit(card: Card | VCard | CardBaseUIData | Card[] | VCard[] | CardBaseUIData[] | undefined, player?: false | Player): string | null | undefined;

		color(card: Card | VCard | CardBaseUIData | Card[] | VCard[] | CardBaseUIData[] | undefined, player?: false | Player): string | undefined;

		number(card: Card | VCard | CardBaseUIData | Card[] | VCard[] | CardBaseUIData[] | undefined, player?: false | Player): number | "unsure" | null | undefined;

		nature(card: string | string[] | Card | VCard | CardBaseUIData, player?: false | Player): string | boolean | null | undefined;

		natureList(card: string[] | string | Card | VCard | CardBaseUIData, player?: false | Player): string[];

		canRespond(card: string | Card | VCard | CardBaseUIData, player?: false | Player): (string | ((card: Card | VCard | CardBaseUIData, player: Player) => boolean))[];

		cards(num?: number, putBack?: boolean): Card[];

		judge(card?: any): any;

		judge2(card?: any): any;

		position(card?: any, ordering?: any): any;

		cardCount(card: true, player?: import("@/library/element/player.js").Player | undefined): number;

		cardCount(card: Card, player?: import("@/library/element/player.js").Player | undefined): number;

		cardCount(card: string, player?: import("@/library/element/player.js").Player | undefined): number;

		owner(card: OwnerQueryCard, method?: "judge"): Player | undefined;

		cardtag(item: YingbianCard, tag: string): any;

		tag(item?: any, tag?: any, item2?: any, bool?: any): any;

		sortCard(sort?: any): ((card: any) => any) | undefined;

		cardPile(pattern: string | true | Record<string, any> | ((card: Card) => boolean), position?: boolean | "cardPile" | "discardPile" | "field", start?: "top" | "bottom" | "random"): Card | null;

		cardPile2(pattern: string | true | Record<string, any> | ((card: Card) => boolean), start?: "top" | "bottom" | "random"): Card | null;

		discardPile(pattern: string | true | Record<string, any> | ((card: Card) => boolean), start?: "top" | "bottom" | "random"): Card | null;

		groups(): string[];

		selectGroup(name?: any, type?: false): string[];

		selectGroup(name: any, type: true): "default" | "double" | "kami";

		selectGroup(name?: any, type?: any): any[] | "kami" | "default" | "double";

		types(): any[];
	}
}
