import type JSZip from "jszip";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		convertedCharacter(data: any[] | any | import("@/library/element/character").Character): import("@/library/element/character").Character;

		seatTranslation(seat: number | Player): string;

		identityList(numberOfPlayers: number): string[];

		priority(skill: string): number;

		skillCategoriesOf(skill: string, player: Player): string[];

		characterSurname(str: string, defaultSurname?: string | undefined, defaultName?: string | undefined): any[];

		characterTitle(player: Player | string, name2?: boolean, plainText?: boolean): string;

		sourceCharacter(str: string): string;

		isLuckyStar(player: Player): boolean;

		infoHp(hp?: any): number;

		infoMaxHp(hp?: any): number;

		infoHujia(hp?: any): number;

		character(name: string | undefined): import("@/library/element/character").Character;

		character<T extends 0 | 1 | 2 | 3 | 4>(name: string | undefined, num: T): Character[T];

		characterInitFilter(name?: any): string[];

		characterIntro(name: string): string;

		bordergroup(info?: any, raw?: any): any;

		groupnature(group?: any, method?: any): any;

		sourceSkillFor(skill: string | any, text?: string): string;

		playerNumber(): number;

		zhu(player?: any, skill?: any, group?: any): any;

		// Preserve the original boxed-Symbol as well as primitive-symbol contract.
		// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
		info(item: string | Symbol): Skill;

		info(item: Card | VCard | CardBaseUIData, player?: false | import("@/library/element/player.js").Player | undefined): any;

		info(item: AIResultItem):
			| {
					ai?: SkillAI;
			  }
			| undefined;

		nameList(player: Player): string[];

		skills(): string[];

		gainableSkills(func?: (info: object, skill: string, character: string) => boolean, player?: Player): string[];

		gainableSkillsName(name: string, func?: (info: object, skill: string, character: string) => boolean): string[];

		gainableCharacters(func?: ((info: object, name: string) => boolean) | true): string[];

		skillCount(skill: string, player?: Player): number;

		population(identity?: any): number;

		totalPopulation(identity?: any): number;
	}
}
