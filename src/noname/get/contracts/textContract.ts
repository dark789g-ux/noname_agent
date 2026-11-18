import type JSZip from "jszip";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		pinyin(chinese: string, withTone?: boolean): any[];

		yunmu(str: string): string;

		yunjiao(str: string): string | null;

		colorspan(str?: any): any;

		plainText(htmlContent: string): string;

		verticalStr(str?: any, sp?: any): string;

		numStr(num?: any, method?: any): any;

		rawName(str?: any, noab?: boolean): string;

		rawName2(str?: any): string;

		slimNameHorizontal(str?: any): string;

		prefixSpan(prefix: string, name?: string): string;

		slimName(str?: any): string;

		skillTranslation(str: string, player?: Player | null, prefix?: boolean): string;

		skillInfoTranslation(name?: any, player?: any, noHTML?: boolean): any;

		translation(str?: any, arg?: "skill" | "viewAs" | undefined): string;

		translation(str?: any, arg?: string | undefined): string | NonNullable<Skill["prompt"]>;

		strNumber(num: number | "unsure" | null | undefined, forced?: boolean): string | undefined;

		numString(str: string, forced?: boolean): number | undefined;

		cnNumber(num: number | undefined, ordinal?: boolean): string | number;
	}
}
