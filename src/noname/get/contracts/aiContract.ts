import type JSZip from "jszip";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		coinCoeff(list?: any): number;

		rank(
			name:
				| string
				| undefined
				| {
						name: string;
				  },
			num: true
		): number;

		rank(
			name:
				| string
				| {
						name: string;
				  },
			num?: number | boolean | undefined
		): string | number;

		skillRank(skill?: any, type?: any, grouped?: any): number;

		aiStrategy(): 1 | 2 | 3 | 4 | 5 | 6;

		threaten(target?: any, player?: any, hp?: any): number;

		condition(player?: any): any;

		attitude(from?: any, to?: any, ...args: any[]): number;

		sgnAttitude(from?: any, to?: any, ...args: any[]): 0 | 1 | -1;

		useful_raw(card?: any, player?: any): any;

		useful(card?: any, player?: any): any;

		unuseful(card?: any): number;

		unuseful2(card?: any): number;

		unuseful3(card?: any): number;

		value(card?: any, player?: any, method?: any): any;

		equipResult(player?: any, target?: any, name?: any): number;

		equipValue(card?: any, player?: any): any;

		equipValueNumber(card?: any): number;

		disvalue(card?: any, player?: any): number;

		disvalue2(card?: any, player?: any): number;

		skillthreaten(skill?: any, player?: any, target?: any): number | void;

		cacheOrder(item?: any): number;

		order(item?: any, player?: import("@/library/element/player.js").Player | null | undefined): number;

		result(item: AIResultItem, skill?: string | null): AIResultConfig | number;

		cacheEffectUse(target?: any, card?: any, player?: any, player2?: any, isLink?: any): number;

		effect_use(target?: Player, card?: string | Card | VCard | CardBaseUIData, player?: Player | null, player2?: Player | null, linking?: boolean | EffectLinkContext): number;

		cacheEffect(target?: any, card?: any, player?: any, player2?: any, isLink?: any): number;

		effect(target?: Player, card?: string | Card | VCard | CardBaseUIData, player?: Player | null, player2?: Player | null, linking?: boolean | EffectLinkContext): number;

		damageEffect(target?: any, player?: any, viewer?: any, nature?: any): any;

		recoverEffect(target?: any, player?: any, viewer?: any): number;

		buttonValue(button?: any): any;

		attitude2(to?: any): number;

		zhuanhuanItemNum(skill: string, player: Player): number;
	}
}
