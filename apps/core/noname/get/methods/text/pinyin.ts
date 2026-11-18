import { lib, _status, ui } from "noname";
import { pinyinPro, get } from "../../dependencies.js";

export const textPinyinMethods = {
	//装备栏 END
	/**
	 * @param {string} chinese
	 * @param {boolean} [withTone]
	 * @returns { any[] }
	 */
	pinyin(chinese: string, withTone: boolean | undefined) {
		let result: any[] = [];
		const pinyins = lib.pinyins;
		if (pinyins && pinyins[chinese] && Array.isArray(pinyins[chinese])) {
			result = pinyins[chinese].slice(0);
		} else {
			result = pinyinPro.pinyin(chinese, { type: "array" });
		}
		if (withTone === false) {
			result = pinyinPro.convert(result, { format: "toneNone" });
		}
		return result;
	},

	/**
	 * @param { string } str
	 * @returns { string }
	 */
	yunmu(str: string) {
		//部分整体认读音节特化处理
		if (lib.pinyins._metadata.zhengtirendu.includes(pinyinPro.convert(str, { format: "toneNone" }))) {
			return "-" + str[str.length - 1];
		}
		//排除声母
		for (let i of lib.pinyins._metadata.shengmu) {
			if (str.startsWith(i)) {
				str = str.slice(i.length);
				if (str[0] == "u" && lib.pinyins._metadata.special_shengmu.includes(i)) {
					str = "ü" + str.slice(1);
				}
				break;
			}
		}
		//排除介母
		if (str.length > 0) {
			for (let i in lib.pinyins._metadata.feijiemu) {
				if (str[0] == i) {
					let goon = false;
					for (let j of lib.pinyins._metadata.feijiemu[i]) {
						if (str.startsWith(j)) {
							goon = true;
						}
					}
					if (!goon) {
						str = str.slice(1);
					}
					break;
				}
			}
		}
		return str;
	},

	/**
	 * @param { string } str
	 * @returns { string|null }
	 */
	yunjiao(str: string) {
		str = pinyinPro.convert(str, { format: "toneNone" });
		if (lib.pinyins._metadata.zhengtirendu.includes(str)) {
			str = "-" + str[str.length - 1];
		} else {
			for (let i of lib.pinyins._metadata.shengmu) {
				if (str.startsWith(i)) {
					str = str.slice(i.length);
					if (str[0] == "u" && lib.pinyins._metadata.special_shengmu.includes(i)) {
						str = "ü" + str.slice(1);
					}
					break;
				}
			}
		}
		for (let i in lib.pinyins._metadata.yunjiao) {
			if (lib.pinyins._metadata.yunjiao[i].includes(str)) {
				return i;
			}
		}
		return null;
	},

	/**
	 *
	 * @param { string } str
	 * @param { Player | null } [player]
	 * @param { boolean } prefix 是否考虑重复技能前缀，默认为false
	 * @returns { string }
	 */
	skillTranslation(str: string, player: Player | null | undefined, prefix: boolean = false) {
		let str2;
		if (get.itemtype(player) !== "player" || prefix === false) {
			return get.translation(str);
		}
		const name = lib.translate[str];
		if (
			!player?.getSkills("invisible", null, false).some((skill: string) => {
				if (!get.skillInfoTranslation(skill, player).length || lib.translate[skill] !== name) {
					return false;
				}
				return skill != str && get.sourceSkillFor(skill) != get.sourceSkillFor(str);
			})
		) {
			return get.translation(str);
		}
		const info = get.info(str);
		if (info?.duplicatePrefix !== undefined) {
			const prefix = info.duplicatePrefix;
			if (typeof prefix == "function") {
				return `${prefix(player, str)}${name}`;
			}
			return `${prefix}${name}`;
		}
		const map = lib.duplicatePrefix;
		for (let key in map) {
			if (str.startsWith(key) && lib.skill[str.slice(key.length)]) {
				return `${map[key]}${name}`;
			}
			let key2 = `${key}_`;
			if (str.startsWith(key2)) {
				return `${map[key]}${name}`;
			}
		}
		if (_status.skillOwner?.[str] !== undefined) {
			return `${get.translation(str)}（${get.translation(_status.skillOwner[str])}）`;
		}
		return get.translation(str);
	},

	verticalStr(str, sp) {
		if (typeof str != "string") {
			return "";
		}
		return Array.from(str)
			.filter((value: string) => value != "`")
			.join("");
	},

	numStr(num, method) {
		if (num == Infinity) {
			if (method == "card") {
				return get.selectableCards().length + ui.selected.cards.length;
			}
			if (method == "target") {
				return get.selectableTargets().length + ui.selected.targets.length;
			}
			return "∞";
		}
		return num.toString();
	},

	rawName(str, noab: boolean = false) {
		let str2 = lib.translate[str];
		if (noab !== true && lib.translate[str + "_ab"]) {
			str2 = lib.translate[str + "_ab"];
		}
		if (str2) {
			const prefixTranslation = lib.translate[str + "_prefix"];
			if (prefixTranslation) {
				let prefixList = prefixTranslation.split("|");
				while (prefixList.length) {
					const prefix = prefixList.shift();
					if (prefix === undefined) {
						break;
					}
					if (str2.startsWith(prefix)) {
						str2 = str2.slice(prefix.length);
						continue;
					}
					break;
				}
			}
			return str2;
		}
		return "";
	},

	/**
	 * 作用修改：只读前缀 不读_ab
	 */
	rawName2(str) {
		return get.rawName(str, true);
	},

	slimNameHorizontal(str) {
		let slimName = lib.translate[`${str}_ab`] || lib.translate[str];
		if (slimName) {
			const prefixTranslation = lib.translate[`${str}_prefix`];
			if (prefixTranslation) {
				let prefixList = prefixTranslation.split("|");
				let setPrefix: any[] = [];
				while (prefixList.length) {
					const prefix = prefixList.shift();
					if (prefix === undefined) {
						break;
					}
					if (slimName.startsWith(prefix)) {
						setPrefix.push(prefix);
						slimName = slimName.slice(prefix.length);
						continue;
					}
					break;
				}
				if (setPrefix.length) {
					return `${setPrefix.map((prefix: string) => get.prefixSpan(prefix, str), "").join("")}<span>${slimName}</span>`;
				}
			}
			return slimName;
		}
		return "";
	},

	/**
	 * @param {string} prefix
	 * @param {string} [name]
	 * @returns {string}
	 */
	prefixSpan(prefix: string, name: string | undefined) {
		const config = lib.config.buttoncharacter_prefix;
		if (config == "off") {
			return "";
		}
		if (config == "simple") {
			const span = document.createElement("span");
			span.innerHTML = prefix;
			return span.outerHTML;
		}
		const namePrefix = lib.namePrefix.get(prefix);
		if (namePrefix && "getSpan" in namePrefix && typeof namePrefix.getSpan == "function") {
			return namePrefix.getSpan(prefix, name);
		}
		const span = document.createElement("span");
		if (namePrefix) {
			if ("color" in namePrefix && typeof namePrefix.color == "string") {
				span.style.color = namePrefix.color;
			}
			if ("nature" in namePrefix && typeof namePrefix.nature == "string") {
				span.dataset.nature = namePrefix.nature;
			}
			if ("showName" in namePrefix && typeof namePrefix.showName == "string") {
				prefix = namePrefix.showName;
			}
		} else {
			span.style.color = "#ffffff";
		}
		span.innerHTML = prefix;
		return span.outerHTML;
	},

	slimName(str) {
		return get.verticalStr(get.slimNameHorizontal(str), true);
	},

	colorspan(str) {
		if (str[0] == "#") {
			let color;
			switch (str[1]) {
				case "r":
					color = "fire";
					break;
				case "p":
					color = "legend";
					break;
				case "b":
					color = "blue";
					break;
				case "g":
					color = "green";
					break;
				default:
					return str.slice(2);
			}
			return '<span class="' + color + "text " + color + 'auto">' + str.slice(2) + "</span>";
		}
		return str;
	},

	skillInfoTranslation(name, player, noHTML: boolean = true) {
		let str = (() => {
			if (player && lib.dynamicTranslate[name]) {
				return lib.dynamicTranslate[name](player, name);
			}
			const str = lib.translate[name + "_info"];
			if (!str) {
				return "";
			}
			return str;
		})();
		if (typeof str === "string") {
			if (noHTML === true) {
				str = get.plainText(str);
			}
			return str;
		} else {
			console.warn(`孩子，你${name}的翻译传的是什么？！`);
			return "";
		}
		// return str.replace(/锁定技/g,'<span class="yellowtext">锁定技</span>').
		// 	replace(/限定技/g,'<span class="yellowtext">限定技</span>').
		// 	replace(/觉醒技/g,'<span class="greentext">觉醒技</span>').
		// 	replace(/主将技/g,'<span class="bluetext">主将技</span>').
		// 	replace(/副将技/g,'<span class="bluetext">副将技</span>').
		// 	replace(/阵法技/g,'<span class="bluetext">阵法技</span>').
		// 	replace(/主公技/g,'<span class="firetext">主公技</span>');
	},
};
