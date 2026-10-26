import { _status, lib, game, get, ui } from "noname";
import { userAgentLowerCase, GeneratorFunction, AsyncFunction } from "@/util/index.js";
import { getRegisteredSkill } from "../../library/skillRegistry.js";

/** @typedef {import("../is.js").YingbianCard} YingbianCard */

export const skillAndTextPredicates = {
	/**
	 * 押韵判断
	 * @param { string } str1
	 * @param { string } str2
	 */
	yayun(str1, str2) {
		if (str1 == str2) {
			return true;
		}
		let pinyin1 = get.pinyin(str1, false),
			pinyin2 = get.pinyin(str2, false);
		if (!pinyin1.length || !pinyin2.length) {
			return false;
		}
		let pron1 = pinyin1[pinyin1.length - 1],
			pron2 = pinyin2[pinyin2.length - 1];
		if (pron1 == pron2) {
			return true;
		}
		return get.yunjiao(pron1) == get.yunjiao(pron2);
	},
	/**
	 * @param { string } skill 技能id
	 * @param { Player } player 玩家
	 * @returns
	 */
	blocked(skill, player) {
		if (!player.storage.skill_blocker || !player.storage.skill_blocker.length) {
			return false;
		}
		for (let i of player.storage.skill_blocker) {
			const blocker = getRegisteredSkill(lib.skill, i);
			if (blocker?.skillBlocker && blocker.skillBlocker(skill, player)) {
				return true;
			}
		}
		return false;
	},
	/**
	 * 是否是双势力武将
	 * @overload
	 * @param { string | undefined } name
	 * @param { true | string[] } array
	 * @returns { false | string[] }
	 */
	/**
	 * @overload
	 * @param { string | undefined } name
	 * @param { false | undefined } [array]
	 * @returns { boolean }
	 */
	/**
	 * @overload
	 * @param { string | undefined } name
	 * @param { boolean } array
	 * @returns { boolean | string[] }
	 */
	/**
	 * @param { string | undefined } name
	 * @param { boolean | string[] } [array]
	 * @returns { boolean | string[] }
	 */
	double(name, array) {
		const extraInformation = get.character(name);
		if (extraInformation && extraInformation.doubleGroup && extraInformation.doubleGroup.length > 0) {
			return array ? extraInformation.doubleGroup.slice(0) : true;
		}
		return false;
	},
	/**
	 * Check if the card has a Yingbian condition
	 *
	 * 检测此牌是否具有应变条件
	 * @param { YingbianCard } card
	 */
	yingbianConditional(card) {
		return get.is.complexlyYingbianConditional(card) || get.is.simplyYingbianConditional(card);
	},
	/**
	 * @param { YingbianCard } card
	 */
	complexlyYingbianConditional(card) {
		for (const key of lib.yingbian.condition.complex.keys()) {
			if (get.cardtag(card, `yingbian_${key}`)) {
				return true;
			}
		}
		return false;
	},
	/**
	 * @param { YingbianCard } card
	 */
	simplyYingbianConditional(card) {
		for (const key of lib.yingbian.condition.simple.keys()) {
			if (get.cardtag(card, `yingbian_${key}`)) {
				return true;
			}
		}
		return false;
	},
	/**
	 * Check if the card has a Yingbian effect
	 *
	 * 检测此牌是否具有应变效果
	 *
	 * @param { YingbianCard } card
	 */
	yingbianEffective(card) {
		for (const key of lib.yingbian.effect.keys()) {
			if (get.cardtag(card, `yingbian_${key}`)) {
				return true;
			}
		}
		return false;
	},
	/**
	 * @param { Card | VCard } card
	 */
	yingbian(card) {
		return get.is.yingbianConditional(card) || get.is.yingbianEffective(card);
	},
	/**
	 * @param { string } [substring]
	 */
	emoji(substring) {
		if (substring) {
			const reg = new RegExp("[~#^$@%&!?%*]", "g");
			if (substring.match(reg)) {
				return true;
			}
			for (let i = 0; i < substring.length; i++) {
				const hs = substring.charCodeAt(i);
				if (0xd800 <= hs && hs <= 0xdbff) {
					if (substring.length > 1) {
						const ls = substring.charCodeAt(i + 1);
						const uc = (hs - 0xd800) * 0x400 + (ls - 0xdc00) + 0x10000;
						if (0x1d000 <= uc && uc <= 0x1f77f) {
							return true;
						}
					}
				} else if (substring.length > 1) {
					const ls = substring.charCodeAt(i + 1);
					if (ls == 0x20e3) {
						return true;
					}
				} else {
					if (0x2100 <= hs && hs <= 0x27ff) {
						return true;
					} else if (0x2b05 <= hs && hs <= 0x2b07) {
						return true;
					} else if (0x2934 <= hs && hs <= 0x2935) {
						return true;
					} else if (0x3297 <= hs && hs <= 0x3299) {
						return true;
					} else if (hs == 0xa9 || hs == 0xae || hs == 0x303d || hs == 0x3030 || hs == 0x2b55 || hs == 0x2b1c || hs == 0x2b1b || hs == 0x2b50) {
						return true;
					}
				}
			}
		}
		return false;
	},
	/**
	 * @param { string } str
	 */
	banWords(str) {
		return get.is.emoji(str) || window.bannedKeyWords?.some(item => str.includes(item));
	},
};
