import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { getRegisteredSkill } from "@/library/skillRegistry.js";
import { lib } from "noname";
import type { Player } from "@/library/contracts/runtime.js";
import type { Card } from "@/library/contracts/runtime.js";
import type { VCard } from "@/library/contracts/runtime.js";
import type { GameEvent } from "@/library/contracts/runtime.js";

export function createFilterSelection() {
	return {
		/**
		 * 判断武将是否因配置、模式或禁用列表而不可选用。
		 *
		 * @param { string } name - 武将名称
		 * @param { Record<string, Character> } [_characters] - 候选武将表；保留此参数以兼容现有调用。
		 * @param { ...string } options - 附加选项，包含 `"ignoreForibidden"` 时忽略 AI 禁用标记。
		 * @returns { boolean }
		 */
		characterDisabled(name: string, _characters?: Record<string, Character>, ...options: string[]): boolean {
			const character = lib.character[name];
			if (!character || character.isUnseen) {
				return true;
			}
			if (!options.includes("ignoreForibidden")) {
				if (lib.config.forbidai.includes(name) || character.isAiForbidden) {
					return true;
				}
			}
			if (lib.characterFilter[name] && !lib.characterFilter[name](get.mode())) {
				return true;
			}
			if (_status.connectMode) {
				if (lib.configOL.banned.includes(name) || lib.connectBanned.includes(name)) {
					return true;
				}
				const doubleCharacter = lib.configOL.mode === "guozhan" || (lib.configOL.double_character && (lib.configOL.mode === "identity" || lib.configOL.mode === "stone")) || (lib.configOL.double_character_jiange && lib.configOL.mode === "versus" && _status.mode === "jiange");
				if (doubleCharacter && lib.config.forbiddouble.includes(name)) {
					return true;
				}
			} else {
				if (lib.config.banned.includes(name)) {
					return true;
				}
				const doubleCharacter = get.mode() === "guozhan" || (get.config("double_character") && (lib.config.mode === "identity" || lib.config.mode === "stone")) || (get.config("double_character_jiange") && lib.config.mode === "versus" && _status.mode === "jiange");
				if (doubleCharacter && lib.config.forbiddouble.includes(name)) {
					return true;
				}
			}
			return false;
		},
		/**
		 * 判断武将是否因特殊标签或模式限制而不可选用。
		 *
		 * @param { string } name - 武将名称
		 * @param { ...string } options - 附加选项，包含 `"ignoreForibidden"` 时忽略 AI 禁用标记。
		 * @returns { boolean }
		 */
		characterDisabled2(name: string, ...options: string[]): boolean {
			const character = lib.character[name];
			if (!character) {
				return true;
			}
			if (character[4]) {
				if (character.isBoss || character.isHiddenBoss) {
					return !lib.config?.plays?.includes("boss");
				}
				if (character.isMinskin) {
					return true;
				}
				if (character.isUnseen) {
					return true;
				}
				if (!options.includes("ignoreForibidden") && character.isAiForbidden && (!_status.event.isMine || !_status.event.isMine())) {
					return true;
				}
				if (lib.characterFilter[name] && !lib.characterFilter[name](get.mode())) {
					return true;
				}
			}
			return false;
		},
		/**
		 * 判断技能是否因缺少翻译或具有非普通技能标签而不可选用。
		 *
		 * @param { string } skill - 技能名称
		 * @returns { boolean }
		 */
		skillDisabled(skill: string): boolean {
			if (!lib.translate[skill] || !lib.translate[skill + "_info"]) {
				return true;
			}
			const info = getRegisteredSkill(lib.skill, skill);
			return Boolean(!info || info.unique || info.temp || info.sub || info.fixed || info.vanish);
		},
		/**
		 * 判断一张牌对某角色在指定事件中是否可用。
		 *
		 * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
		 * @param { Player } [player] - 使用/发动此牌的角色。
		 * @param { GameEvent | import("@/library/element/gameEvent.js").GameEventParentFallback | "forceEnable" } [event] - 当前事件上下文；传`"forceEnable"`时强制跳过牌自身 enable 判断。
		 * @returns { boolean }
		 */
		cardEnabled(card: Card | VCard | CardBaseUIData, player?: Player, event?: GameEvent | import("@/library/element/gameEvent.js").GameEventParentFallback | "forceEnable"): boolean {
			const currentPlayer = player ?? get.player();
			if (!currentPlayer) {
				return false;
			}
			if (get.itemtype(card) === "card") {
				const mod2 = game.checkMod(card, currentPlayer, event, "unchanged", "cardEnabled2", currentPlayer);
				if (mod2 !== "unchanged") {
					return Boolean(mod2);
				}
			}
			const card2 = get.autoViewAs(card);
			if (event === "forceEnable") {
				const mod = game.checkMod(card2, currentPlayer, event, "unchanged", "cardEnabled", currentPlayer);
				if (mod != "unchanged") {
					return Boolean(mod);
				}
				return true;
			} else {
				const filter = get.info(card2).enable;
				if (!filter) {
					return false;
				}
				const mod = game.checkMod(card2, currentPlayer, event, "unchanged", "cardEnabled", currentPlayer);
				if (mod !== "unchanged") {
					return Boolean(mod);
				}
				if (typeof filter === "boolean") {
					return filter;
				}
				if (typeof filter === "function") {
					return filter(card2, currentPlayer, event);
				}
			}
			return false;
		},
		/**
		 * 判断一张牌对某角色在指定事件中是否可以打出。
		 *
		 * @param { Card | VCard | CardBaseUIData } card
		 * @param { Player } [player]
		 * @param { GameEvent | import("@/library/element/gameEvent.js").GameEventParentFallback } [event]
		 * @returns { boolean }
		 */
		cardRespondable(card: Card | VCard | CardBaseUIData, player?: Player, event?: GameEvent | import("@/library/element/gameEvent.js").GameEventParentFallback): boolean {
			event ??= _status.event;
			if (event.name !== "chooseToRespond") {
				return true;
			}
			const currentPlayer = player ?? get.player();
			if (!currentPlayer) {
				return false;
			}
			if (typeof event.getParent != "function") {
				throw new TypeError("card response requires an event parent");
			}
			const source = event.getParent()?.player;
			if (source && source !== currentPlayer) {
				if (source.hasSkillTag("norespond", false, [card, currentPlayer, event], true)) {
					return false;
				}
			}
			if (get.itemtype(card) === "card") {
				const mod2 = game.checkMod(card, currentPlayer, event, "unchanged", "cardEnabled2", currentPlayer);
				if (mod2 !== "unchanged") {
					return Boolean(mod2);
				}
			}
			const card2 = get.autoViewAs(card);
			const mod = game.checkMod(card2, currentPlayer, "unchanged", "cardRespondable", currentPlayer);
			if (mod !== "unchanged") {
				return Boolean(mod);
			}
			return true;
		},
		/**
		 * 判断一张牌对某角色在指定事件中是否仍有使用次数。
		 *
		 * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
		 * @param { Player } [player] - 使用/发动此牌的角色。
		 * @param { GameEvent | import("@/library/element/gameEvent.js").GameEventParentFallback } [event] - 当前事件上下文。
		 * @returns { boolean }
		 */
		cardUsable2(card: Card | VCard | CardBaseUIData, player?: Player, event?: GameEvent | import("@/library/element/gameEvent.js").GameEventParentFallback): boolean {
			const card2 = get.autoViewAs(card);
			const info = get.info(card2);
			if (info.updateUsable === "phaseUse") {
				let currentEvent = event ?? _status.event;
				if (currentEvent.type === "chooseToUse_button") {
					if (typeof currentEvent.getParent != "function") {
						throw new TypeError("phase-use card check requires an event parent");
					}
					currentEvent = currentEvent.getParent();
					if (currentEvent == null) {
						return false;
					}
				}
				if (player !== get.player()) {
					return true;
				}
				if (typeof currentEvent.getParent != "function") {
					throw new TypeError("phase-use card check requires an event parent");
				}
				const phaseUseEvent = currentEvent.getParent();
				if (phaseUseEvent == null) {
					return false;
				}
				if (phaseUseEvent.name !== "phaseUse") {
					return true;
				}
				if (phaseUseEvent.player !== player) {
					return true;
				}
			}
			const currentPlayer = player ?? get.player();
			if (!currentPlayer) {
				return false;
			}
			let num = info.usable;
			if (typeof num === "function") {
				num = num(card2, currentPlayer);
			}
			num = game.checkMod(card2, currentPlayer, num, "cardUsable", currentPlayer);
			if (typeof num !== "number") {
				return true;
			}
			return currentPlayer.countUsed(card2) < num;
		},
		/**
		 * 判断一张牌对某角色在指定事件中是否可使用。
		 *
		 * @param { Card | VCard | CardBaseUIData } card - 需要判断的牌
		 * @param { Player } player - 使用/发动此牌的角色。
		 * @param { GameEvent | import("@/library/element/gameEvent.js").GameEventParentFallback } [event] - 当前事件上下文。
		 * @returns { boolean }
		 */
		cardUsable(card: Card | VCard | CardBaseUIData, player: Player, event?: GameEvent | import("@/library/element/gameEvent.js").GameEventParentFallback): boolean {
			const card2 = get.autoViewAs(card);
			const info = get.info(card2);
			let currentEvent = event ?? _status.event;
			if (currentEvent.type === "chooseToUse_button") {
				if (typeof currentEvent.getParent != "function") {
					throw new TypeError("phase-use card check requires an event parent");
				}
				currentEvent = currentEvent.getParent();
				if (currentEvent == null) {
					return false;
				}
			}
			if (player !== currentEvent.player) {
				return true;
			}
			if (info.updateUsable === "phaseUse") {
				if (typeof currentEvent.getParent != "function") {
					throw new TypeError("phase-use card check requires an event parent");
				}
				const phaseUseEvent = currentEvent.getParent();
				if (phaseUseEvent == null) {
					return false;
				}
				if (phaseUseEvent.name !== "phaseUse") {
					return true;
				}
				if (phaseUseEvent.player !== player) {
					return true;
				}
			}
			Object.assign(currentEvent, { addCount_extra: true });
			let num = info.usable;
			if (typeof num === "function") {
				num = num(card2, player);
			}
			num = game.checkMod(card2, player, num, "cardUsable", player);
			if (typeof num !== "number") {
				return typeof num === "boolean" ? num : true;
			}
			if (player.countUsed(card2) < num) {
				return true;
			}
			return game.hasPlayer2(current => Boolean(game.checkMod(card2, player, current, false, "cardUsableTarget", player)), true);
		},
		/**
		 * player的card在event事件中能否被自己弃置
		 *
		 * @param { Card } card - 需要判断的牌
		 * @param { Player } player - 执行弃牌的角色
		 * @param { string | GameEvent } [event] - 弃置牌事件或事件名称
		 * @returns { boolean }
		 */
		cardDiscardable(card: Card, player: Player, event?: string | GameEvent): boolean {
			const currentEvent = event ?? get.event();
			const eventName = typeof currentEvent === "string" ? currentEvent : currentEvent?.getParent()?.name;
			const mod = game.checkMod(card, player, eventName, "unchanged", "cardDiscardable", player);
			if (mod !== "unchanged") {
				return Boolean(mod);
			}
			return true;
		},
		/**
		 * target的card在event事件中能否被player弃置
		 *
		 * @param { Card } card - 需要判断的牌
		 * @param { Player } player - 执行弃牌的角色
		 * @param { Player } target - 被弃置牌的现持有者
		 * @param { string | GameEvent } [event] - 弃置牌事件或事件名称
		 * @returns { boolean }
		 */
		canBeDiscarded(card: Card, player: Player, target: Player, event?: string | GameEvent): boolean {
			const currentEvent = event ?? _status.event;
			const eventName = typeof currentEvent === "string" ? currentEvent : currentEvent.getParent()?.name;
			if (player === target && !lib.filter.cardDiscardable(card, player, eventName)) {
				return false;
			}
			const mod = game.checkMod(card, player, target, eventName, "unchanged", "canBeDiscarded", target);
			if (mod !== "unchanged") {
				return Boolean(mod);
			}
			return true;
		},
		/**
		 * target的card在event事件中能否被player获得
		 *
		 * @param { Card } card - 需要判断的牌
		 * @param { Player } player - 获得牌的角色
		 * @param { Player } target - 被获得牌的现持有者
		 * @param { string | GameEvent } [event] - 获得牌事件或事件名称
		 * @returns { boolean }
		 */
		canBeGained(card: Card, player: Player, target: Player, event?: string | GameEvent): boolean {
			const currentEvent = event ?? _status.event;
			const eventName = typeof currentEvent === "string" ? currentEvent : currentEvent.getParent()?.name;
			const mod = game.checkMod(card, player, target, eventName, "unchanged", "canBeGained", target);
			if (mod !== "unchanged") {
				return Boolean(mod);
			}
			return true;
		},
	};
}
