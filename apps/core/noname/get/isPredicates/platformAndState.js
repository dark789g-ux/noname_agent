import { _status, lib, game, get, ui } from "noname";
import { userAgentLowerCase, GeneratorFunction, AsyncFunction } from "@/util/index.js";
import { getRegisteredSkill } from "../../library/skillRegistry.js";

/** @typedef {import("../is.js").YingbianCard} YingbianCard */

export const platformAndStatePredicates = {
	/**
	 * @param { GameEvent } event
	 */
	converted(event) {
		return !(event.card && event.card.isCard);
	},
	safari() {
		return userAgentLowerCase.indexOf("safari") != -1 && userAgentLowerCase.indexOf("chrome") == -1;
	},
	/**
	 * @param { (Card | VCard)[]} cards
	 */
	freePosition(cards) {
		return !cards.some(card => !("hasPosition" in card) || !card.hasPosition || card.hasPosition());
	},
	/**
	 * @param { string } name
	 * @param { boolean } item
	 */
	nomenu(name, item) {
		const menus = ["system", "menu"];
		const configs = {
			show_round_menu: lib.config.show_round_menu,
			round_menu_func: lib.config.round_menu_func,
			touchscreen: lib.config.touchscreen,
			swipe_up: lib.config.swipe_up,
			swipe_down: lib.config.swipe_down,
			swipe_left: lib.config.swipe_left,
			swipe_right: lib.config.swipe_right,
			right_click: lib.config.right_click,
			phonelayout: lib.config.phonelayout,
		};
		configs[name] = item;
		if (!configs.phonelayout) {
			return false;
		}
		if (configs.show_round_menu && menus.includes(configs.round_menu_func)) {
			return false;
		}
		if (configs.touchscreen) {
			if (menus.includes(configs.swipe_up)) {
				return false;
			}
			if (menus.includes(configs.swipe_down)) {
				return false;
			}
			if (menus.includes(configs.swipe_left)) {
				return false;
			}
			if (menus.includes(configs.swipe_right)) {
				return false;
			}
		} else {
			if (configs.right_click == "config") {
				return false;
			}
		}
		if (name) {
			setTimeout(function () {
				alert("请将至少一个操作绑定为显示按钮或打开菜单，否则将永远无法打开菜单");
			});
		}
		return true;
	},
	altered(skillName) {
		return false;
	},
	/**
	 * @param { any } obj
	 * @returns { boolean }
	 */
	node(obj) {
		return Object.prototype.toString.call(obj).startsWith("[object HTML");
	},
	/**
	 * @param { any } obj
	 */
	div(obj) {
		return Object.prototype.toString.call(obj) === "[object HTMLDivElement]";
	},
	/**
	 * @param { any } obj
	 */
	map(obj) {
		return Object.prototype.toString.call(obj) === "[object Map]";
	},
	/**
	 * @param { any } obj
	 */
	set(obj) {
		return Object.prototype.toString.call(obj) === "[object Set]";
	},
	/**
	 * @param { any } obj
	 */
	object(obj) {
		return Object.prototype.toString.call(obj) === "[object Object]";
	},
	/**
	 * @overload
	 * @param { Function | number | [number, number] } func
	 * @returns { boolean }
	 */
	singleSelect(func) {
		if (typeof func == "function") {
			return false;
		}
		const select = get.select(func);
		return select[0] == 1 && select[1] == 1;
	},
	/**
	 * @param { string | Player } name
	 */
	jun(name) {
		if (get.mode() == "guozhan") {
			if (name instanceof lib.element.Player) {
				if (name.isUnseen && name.isUnseen(0)) {
					return false;
				}
				const name1 = name.name1;
				if (!name1) {
					return false;
				}
				name = name1;
			}
			if (typeof name == "string" && name.startsWith("gz_jun_")) {
				return true;
			}
		}
		return false;
	},
	versus() {
		return !_status.connectMode && get.mode() == "versus" && _status.mode == "three";
	},
	changban() {
		return get.mode() == "single" && _status.mode == "changban";
	},
	single() {
		return get.mode() == "single" && _status.mode == "normal";
	},
	/**
	 * @param { Player } [player]
	 */
	mobileMe(player) {
		return (game.layout == "mobile" || game.layout == "long") && !game.chess && player && player.dataset.position == "0";
	},
	newLayout() {
		return game.layout != "default";
	},
	phoneLayout() {
		if (!lib.config.phonelayout) {
			return false;
		}
		return game.layout == "mobile" || game.layout == "long" || game.layout == "long2" || game.layout == "nova";
	},
	singleHandcard() {
		return game.singleHandcard || game.layout == "mobile" || game.layout == "long" || game.layout == "long2" || game.layout == "nova";
	},
	/**
	 * @param { Player } player
	 */
	linked2(player) {
		if (game.chess) {
			return true;
		}
		if (lib.config.link_style2 != "rotate") {
			return true;
		}
		// if(game.chess) return false;
		if (game.layout == "long" || game.layout == "long2" || game.layout == "nova") {
			return true;
		}
		if (player.dataset.position == "0") {
			return ui.arena.classList.contains("oblongcard");
		}
		return false;
	},
	/**
	 * @param { {} } obj
	 */
	empty(obj) {
		return Object.keys(obj).length == 0;
	},
	/**
	 * @param { string } str
	 * @returns { str is "h" | "e" | "j" | "he" | "hej" | "ej" | "hj" }
	 */
	pos(str) {
		return str == "h" || str == "e" || str == "j" || str == "he" || str == "hj" || str == "ej" || str == "hej";
	},
	/**
	 * @param { string } skill
	 * @param { Player } [player]
	 * @returns
	 */
	locked(skill, player) {
		const info = getRegisteredSkill(lib.skill, skill);
		if (!info) {
			return false;
		}
		if (typeof info.locked == "function") {
			return info.locked(skill, player);
		}
		if (info.locked == false) {
			return false;
		}
		if (info.trigger && info.forced) {
			return true;
		}
		if (info.mod) {
			return true;
		}
		if (info.locked) {
			return true;
		}
		return false;
	},
	/**
	 * @param { string } skill
	 * @param { Player } player
	 * @returns
	 */
	zhuanhuanji(skill, player) {
		const info = get.info(skill),
			{ zhuanhuanji } = info;
		if ("zhuanhuanji2" in info) {
			const { zhuanhuanji2 } = info;
			if (typeof zhuanhuanji2 === "function") {
				return Boolean(zhuanhuanji2(skill, player));
			}
			return Boolean(zhuanhuanji2);
		}
		return Boolean(zhuanhuanji);
	},
	/**
	 * @param { string } skill
	 * @param { Player } player
	 * @returns
	 */
	qidingSkill(skill, player) {
		const info = get.info(skill);
		if (!info) {
			return false;
		}
		const { qidingSkill } = info;
		if (typeof qidingSkill === "function") {
			return Boolean(qidingSkill(skill, player));
		}
		return Boolean(qidingSkill);
	},
	/**
	 * 检查指定玩家的名称的子串是否包含指定字符串
	 *
	 * @author tangXins
	 * @param {Player} player
	 * @param {string} name
	 * @returns {boolean}
	 */
	playerNames(player, name) {
		return get.nameList(player).some(namex => namex.startsWith(name));
	},
};
