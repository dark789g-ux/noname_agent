import { game, lib, _status, ui } from "noname";
import { get, isCharacterTitlePlayer } from "../../dependencies.js";

export const characterCharacterSurnameMethods = {
	/**
	 * 用于获取武将的姓氏和名字
	 * @param { string } str 武将ID
	 * @param { string | undefined } [defaultSurname] 默认姓氏
	 * @param { string | undefined } [defaultName] 默认名字，为空则设“某”
	 * @returns { Array } 返回由[姓氏, 名字]组成的数组
	 */
	characterSurname(str: string, defaultSurname: string | undefined, defaultName: string | undefined) {
		const info = get.character(str).names;
		if (!info) {
			let rawName = get.rawName(str);
			return [[rawName[0], rawName.slice(1)]];
		}
		let infoarr = info.split("-");
		let names: any[] = [];
		for (let i = 0; i < infoarr.length; i++) {
			let name = infoarr[i].split("|");
			if (name[0] === "null") {
				name[0] = defaultSurname || "";
			}
			if (name[1] === "null") {
				name[1] = defaultName || "某";
			}
			names.push([name[0], name[1]]);
		}
		return names;
	},

	/**
	 * 获取角色称号，默认返回纯文本
	 * @param {Player|string} player 玩家对象或角色名
	 * @param {boolean} [name2=false] 是否返回玩家副将的称号
	 * @param {boolean} [plainText=true] 是否返回纯文本
	 * @returns {string} 称号
	 */
	characterTitle(player: string | Player, name2: boolean | undefined = false, plainText: boolean | undefined = true) {
		const key = isCharacterTitlePlayer(player) ? String(name2 ? player.name2 : player.name) : player;
		let characterTitle = lib.characterTitle[key] || "";
		if (plainText) {
			// 排除掉本体的几个颜色样式标记，如#r、#p、#g、#b
			if (characterTitle.startsWith("#")) {
				characterTitle = characterTitle.slice(2);
			}
			return get.plainText(characterTitle);
		}
		return characterTitle;
	},

	/**
	 * 返回角色对应的原角色
	 * @param { string } str
	 * @returns { string }
	 * @example
	 * //以界曹操为例
	 * get.sourceCharacter("re_caocao") == "caocao"
	 */
	sourceCharacter(str: string) {
		if (str) {
			for (let i in lib.characterReplace) {
				if (lib.characterReplace[i].includes(str)) {
					return i;
				}
			}
		}
		return str;
	},

	/**
	 * 返回玩家是否处于幸运星状态
	 * @param { Player } player
	 * @returns { boolean }
	 */
	isLuckyStar(player: Player) {
		if (player && player.hasSkillTag("luckyStar")) {
			return true;
		}
		if (_status.connectMode) {
			return false;
		}
		return (!player || player == game.me || player.isUnderControl()) && lib.config.lucky_star == true;
	},

	infoHp(hp) {
		if (typeof hp == "number") {
			return hp;
		} else if (typeof hp == "string") {
			if (hp.includes("/")) {
				const num = hp.split("/")[0];
				if (num) {
					if (num == "Infinity" || num == "∞") {
						return Infinity;
					} else {
						return parseInt(num);
					}
				}
			} else if (hp == "Infinity" || hp == "∞") {
				return Infinity;
			}
		}
		return 0;
	},

	infoMaxHp(hp) {
		if (typeof hp == "number") {
			return hp;
		} else if (typeof hp == "string") {
			if (hp.includes("/")) {
				const num = hp.split("/")[1];
				if (num) {
					if (num == "Infinity" || num == "∞") {
						return Infinity;
					} else {
						return parseInt(num);
					}
				}
			} else if (hp == "Infinity" || hp == "∞") {
				return Infinity;
			}
		}
		return 0;
	},

	infoHujia(hp) {
		if (typeof hp == "string" && hp.includes("/")) {
			const num = hp.split("/")[2];
			if (num) {
				if (num == "Infinity" || num == "∞") {
					return Infinity;
				} else {
					return parseInt(num);
				}
			}
		}
		return 0;
	},

	/**
	 * @returns { string[] } 技能名数组
	 */
	skills() {
		let skills: any[] = [];
		if (ui.skills) {
			skills = skills.concat(ui.skills.skills);
		}
		if (ui.skills2) {
			skills = skills.concat(ui.skills2.skills);
		}
		if (ui.skills3) {
			skills = skills.concat(ui.skills3.skills);
		}
		return skills;
	},

	zhu(player, skill, group) {
		// Function-scoped bindings intentionally remain shared across legacy branches.
		let i;

		if (typeof player == "string") {
			skill = player;
			player = null;
		}
		let mode = get.mode();
		if (mode == "identity") {
			if (_status.mode == "purple") {
				if (!player) {
					return null;
				}
				let zhu = game[player.identity.slice(0, 1) + "Zhu"];
				if (!zhu) {
					return null;
				}
				if (skill && !zhu.hasSkill(skill)) {
					return null;
				}
				return zhu;
			}
			if (!game.zhu) {
				return null;
			}
			if (skill && !game.zhu.hasSkill(skill)) {
				return null;
			}
			if (game.zhu.isZhu) {
				return game.zhu;
			}
		} else if (mode == "versus" && (_status.mode == "four" || _status.mode == "guandu")) {
			for (i = 0; i < game.players.length; i++) {
				if (game.players[i].isZhu) {
					if (skill && !game.players[i].hasSkill(skill)) {
						continue;
					}
					if (!player) {
						return game.players[i];
					}
					if (player.side == game.players[i].side) {
						return game.players[i];
					}
				}
			}
		} else if (mode == "guozhan") {
			for (i = 0; i < game.players.length; i++) {
				if (get.is.jun(game.players[i]) && !game.players[i].isUnseen()) {
					if (skill && !game.players[i].hasSkill(skill)) {
						continue;
					}
					if (!player) {
						return game.players[i];
					}
					if (player.identity == game.players[i].identity) {
						return game.players[i];
					} else if (group && group == game.players[i].identity) {
						return game.players[i];
					}
				}
			}
		}
		return null;
	},

	/**
	 * @overload
	 * @param { string | undefined } name
	 * @returns { import("../library/element/character").Character }
	 */
	/**
	 * @template { 0 | 1 | 2 | 3 | 4 } T
	 * @overload
	 * @param { string | undefined } name
	 * @param { T } num
	 * @returns { Character[T] }
	 */
	character<T>(name, num) {
		const characterName = String(name);
		/** @type {Character | undefined} */
		let info: Character | undefined = lib.character[characterName];
		if (!info) {
			const pack = Object.keys(lib.characterPack).find((pack: string) => characterName in lib.characterPack[pack]);
			if (pack) {
				info = lib.characterPack[pack][characterName];
			}
		}
		if (typeof num === "number") {
			if (!info) {
				if (num === 3 || num === 4) {
					return [];
				}
				return;
			}
			if (info[num]) {
				return info[num];
			}
			if (num === 3 || num === 4) {
				return [];
			}
			return;
		}
		return get.convertedCharacter(info || { isNull: true });
	},

	characterInitFilter(name) {
		const info = get.character(name);
		if (!info) {
			return [];
		}
		return info.initFilters || [];
	},

	/**
	 * 返回武将介绍
	 * @param { string } name
	 * @returns { string }
	 */
	characterIntro(name: string) {
		if (lib.characterIntro[name]) {
			return lib.characterIntro[name];
		}
		let tags = get.character(name, 4);
		if (tags) {
			for (let i = 0; i < tags.length; i++) {
				if (tags[i].startsWith("des:")) {
					return tags[i].slice(4);
				}
			}
		}
		while (name.includes("_") && !lib.characterIntro[name]) {
			name = name.slice(name.indexOf("_") + 1);
		}
		if (lib.characterIntro[name]) {
			return lib.characterIntro[name];
		}
		return "暂无武将介绍";
	},

	bordergroup(info, raw) {
		if (typeof info == "string") {
			info = get.character(info);
		}
		if (info.groupBorder) {
			return info.groupBorder;
		}
		return raw ? "" : info.group || "";
	},

	groupnature(group, method) {
		let nature = lib.groupnature[group];
		if (!nature) {
			return "";
		}
		if (method == "raw") {
			return nature;
		}
		return nature + "mm";
	},

	/**
	 * Get the source of the skill or event
	 *
	 * 获取一个技能或事件的某个属性的源技能
	 * @param { string | Object } skill - 传入的技能或事件
	 * @param { string } [text] - 要获取的属性（不填写默认获取sourceSkill）
	 * @returns { string }
	 */
	sourceSkillFor(skill, text: string | undefined) {
		if (!text) {
			text = "sourceSkill";
		}
		if (typeof skill !== "string") {
			skill = skill[text] || skill.skill;
		}
		let info = lib.skill[skill];
		while (true) {
			if (!info || typeof info[text] !== "string") {
				break;
			}
			skill = info[text];
			info = lib.skill[skill];
		}
		return skill;
	},

	playerNumber() {
		let num;
		if (_status.brawl && _status.brawl.playerNumber) {
			num = _status.brawl.playerNumber;
		} else {
			num = get.config("player_number", undefined);
		}
		return parseInt(num) || 2;
	},
};
