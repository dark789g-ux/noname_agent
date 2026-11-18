import { lib } from "noname";
import { Character } from "@/library/element/index";

export type OptionPair = [id: string, label: string];

export const SUIT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "heart", label: "♥" },
	{ value: "diamond", label: "♦" },
	{ value: "club", label: "♣" },
	{ value: "spade", label: "♠" },
];

/** 按 ID 最后一段（`_` 后缀）升序排列，suffix 相同时按完整 ID 排序。 */
export function sortPairsByIdSuffix(list: OptionPair[]): OptionPair[] {
	return [...list].sort((a, b) => {
		const idxA = a[0].lastIndexOf("_");
		const idxB = b[0].lastIndexOf("_");
		const suffixA = idxA >= 0 ? a[0].slice(idxA + 1) : a[0];
		const suffixB = idxB >= 0 ? b[0].slice(idxB + 1) : b[0];
		if (suffixA !== suffixB) return suffixA > suffixB ? 1 : -1;
		if (a[0] === b[0]) return 0;
		return a[0] > b[0] ? 1 : -1;
	});
}

/** 获取所有带技能的武将 `[id, 译名]` 选项；按需向空库注入 `noname_sunce` 兜底。 */
export function getCharactersWithSkillsOptions(options?: { ensureFallbackSunce?: boolean }): OptionPair[] {
	const list: OptionPair[] = [];
	for (const id in lib.character) {
		const skills = lib.character[id]?.[3];
		if (skills?.length) {
			list.push([id, lib.translate[id]]);
		}
	}
	if (!list.length && options?.ensureFallbackSunce) {
		if (!lib.character["noname_sunce"]) {
			lib.character["noname_sunce"] = new Character({
				sex: "male",
				group: "wu",
				hp: 4,
				skills: ["jiang"],
				isUnseen: true,
			});
		}
		if (!lib.translate["noname_sunce"]) {
			lib.translate["noname_sunce"] = "孙策";
		}
		list.push(["noname_sunce", lib.translate["noname_sunce"]]);
	}
	return sortPairsByIdSuffix(list);
}

/** 获取所有带译名的卡牌 `[id, 译名]` 选项，按 ID 后缀排序。 */
export function getTranslatedCardOptions(): OptionPair[] {
	const list: OptionPair[] = [];
	for (const id in lib.card) {
		if (lib.translate[id]) {
			list.push([id, lib.translate[id]]);
		}
	}
	return sortPairsByIdSuffix(list);
}
