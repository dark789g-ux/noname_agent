import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import skills from "@/library/skill.js";
import { getRegisteredSkill } from "@/library/skillRegistry.js";
import { requireRegisteredSkill } from "@/library/skillRegistry.js";
import { lib } from "noname";
import type { Player } from "@/library/contracts/runtime.js";
import type { Card } from "@/library/contracts/runtime.js";
import type { VCard } from "@/library/contracts/runtime.js";
import type { Button } from "@/library/contracts/runtime.js";
import type { GameEvent } from "@/library/contracts/runtime.js";

export function createFilterSkill() {
	return {
		/**
		 * 恒真函数，用于允许所有传递的对象
		 *
		 * @returns { true }
		 */
		all: (): true => true,
		/**
		 * 恒假函数，用于过滤所有传递的对象
		 *
		 * @returns { false }
		 */
		none: (): false => false,
		/**
		 * 检测此牌是否不计入此角色的手牌上限
		 *
		 * @param { Card } card - 需要判断的牌
		 * @param { Player } player - 拥有此牌的玩家
		 * @returns { boolean }
		 */
		ignoredHandcard: (card: Card, player: Player): boolean => Boolean(game.checkMod(card, player, false, "ignoredHandcard", player)),
		/**
		 * 检测此牌是否可赠予
		 *
		 * @param { Card } card - 需要判断的牌
		 * @param { Player } player - 发起赠与的玩家
		 * @param { Player } target - 被赠与的对象
		 * @param { boolean } [strict] - 是否执行合法性校验
		 * @returns { boolean }
		 */
		cardGiftable(card: Card, player: Player, target: Player, strict?: boolean): boolean {
			const mod = game.checkMod(card, player, target, "unchanged", "cardGiftable", player);
			if (!mod || (strict && ((mod === "unchanged" && (get.position(card) !== "h" || !get.cardtag(card, "gifts"))) || player === target))) {
				return false;
			}
			return get.type(card, null, target) !== "equip" || target.canEquip(card, true);
		},
		/**
		 * 检查此牌是否可重铸
		 *
		 * @param { Card } card - 需要判断的牌
		 * @param { Player } [player] - 拥有牌的角色
		 * @param { Player | null } [source] - 执行重铸的玩家
		 * @param { boolean } [strict] - 是否执行合法性校验
		 */
		cardRecastable(card: Card, player?: Player, source?: Player | null, strict?: boolean) {
			player ??= get.owner(card);
			if (player == null) {
				throw new ReferenceError("尝试检查一张无拥有者牌是否可以重铸");
			}
			source ??= player;
			const mod = game.checkMod(card, player, source, "unchanged", "cardRecastable", player);
			if (!mod) {
				return false;
			}
			if (strict && mod === "unchanged") {
				if (get.position(card) !== "h") {
					return false;
				}
				const info = get.info(card);
				const recastable = info.recastable || info.chongzhu;
				return Boolean(typeof recastable === "function" ? recastable(_status.event, player) : recastable);
			}
			return true;
		},
		/**
		 * 判断一张装备牌是否可以被替换。
		 *
		 * @param { Card | VCard } card - 需要判断的装备牌
		 * @param { Player } player - 持有/装备此牌的角色
		 * @returns { boolean }
		 */
		canBeReplaced(card: Card | VCard, player: Player): boolean {
			const mod = game.checkMod(card, player, "unchanged", "canBeReplaced", player);
			if (mod !== "unchanged") {
				return Boolean(mod);
			}
			return true;
		},
		/**
		 * 判断按钮是否未被当前事件排除。
		 *
		 * @param { Button } button - 待判断的按钮
		 * @returns { boolean }
		 */
		buttonIncluded(button: Button): boolean {
			return !_status.event.excludeButton?.includes(button);
		},
		/**
		 * 默认的按钮筛选条件，允许所有按钮。
		 *
		 * @param { Button } button - 待筛选的按钮
		 * @returns { boolean }
		 */
		filterButton(button: Button): boolean {
			return true;
		},
		/**
		 * 检测此牌是否可用于救助目标
		 *
		 * @param { Card | VCard | CardBaseUIData  } card - 需要判断的牌
		 * @param { Player } player - 使用此牌的玩家
		 * @param { Player } target - 被救助的目标
		 * @returns { boolean }
		 */
		cardSavable(card: Card | VCard | CardBaseUIData, player: Player, target: Player): boolean {
			if (get.itemtype(card) === "card") {
				const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
				if (mod2 !== "unchanged") {
					return Boolean(mod2);
				}
			}
			const card2 = get.autoViewAs(card);
			let mod = game.checkMod(card2, player, target, "unchanged", "cardSavable", player);
			if (mod !== "unchanged") {
				return Boolean(mod);
			}
			let savable = get.info(card2).savable;
			if (typeof savable === "function") {
				savable = savable(card2, player, target);
			}
			return savable;
		},
		/**
		 * 判断技能是否可响应指定事件。
		 *
		 * @param { GameEvent } event - 待响应的事件
		 * @param { Player } player - 技能所属角色
		 * @param { string } triggerName - 触发时机名称
		 * @param { string } skill - 技能名称
		 * @param { any } [indexedData] - 触发时附带的索引数据
		 * @returns { boolean }
		 */
		filterTrigger(event: GameEvent, player: Player, triggerName: string, skill: string, indexedData?: any): boolean {
			if (
				player._hookTrigger &&
				player._hookTrigger.some(i => {
					const info = requireRegisteredSkill(lib.skill, i).hookTrigger;
					return info && info.block && info.block(event, player, triggerName, skill);
				})
			) {
				return false;
			}
			const info = get.info(skill);
			if (!info) {
				console.error(new ReferenceError("缺少info的技能:"));
				return false;
			}
			if (!game.expandSkills(player.getSkills("invisible").concat(lib.skill.global)).includes(skill)) {
				return false;
			}
			if (!game.expandSkills(player.getSkills(false).concat(lib.skill.global)).includes(skill)) {
				//hiddenSkills
				if (get.mode() !== "guozhan") {
					return false;
				}
				if (info.noHidden) {
					return false;
				}
			}
			if (!info.forceDie && player.isDead()) {
				return false;
			}
			if (!info.forceOut && (player.isOut() || player.removed)) {
				return false;
			}
			const triggers = info.trigger;
			if (!triggers) {
				return false;
			}
			if (
				!Object.keys(triggers).some(role => {
					if (role !== "global" && player !== event[role]) {
						return false;
					}
					const list: string[] = [];
					if (typeof triggers[role] === "string") {
						list.add(triggers[role]);
					} else if (Array.isArray(triggers[role])) {
						list.addArray(triggers[role]);
					}
					if (list.includes(triggerName)) {
						return true;
					}
					const map = lib.relatedTrigger,
						names = Object.keys(map);
					for (const trigger of list.slice()) {
						for (const name of names) {
							if (trigger.startsWith(name)) {
								list.addArray(map[name].map(i => i + trigger.slice(name.length)));
							}
						}
					}
					return list.includes(triggerName);
				})
			) {
				return false;
			}
			if (info.filter && !info.filter(event, player, triggerName, indexedData)) {
				return false;
			}
			if (event._notrigger.includes(player) && !lib.skill.global.includes(skill)) {
				return false;
			}
			if (info.usable !== undefined) {
				let num = info.usable;
				if (typeof num === "function") {
					num = num.call(info, skill, player);
				}
				if (typeof num === "number" && (player.getStat("triggerSkill")[skill] ?? 0) >= num) {
					return false;
				}
			}
			if (info.round && info.round - (game.roundNumber - player.storage[skill + "_roundcount"]) > 0) {
				return false;
			}
			for (const item in player.storage) {
				if (!item.startsWith("temp_ban_") || player.storage[item] !== true) {
					continue;
				}
				const skillName = item.slice(9);
				if (!getRegisteredSkill(lib.skill, skillName)) {
					continue;
				}
				const skills = game.expandSkills([skillName]);
				if (skills.includes(skill)) {
					return false;
				}
			}
			return true;
		},
		/**
		 * 判断技能是否可在当前事件中发动。
		 *
		 * @param { GameEvent } event - 当前事件
		 * @param { Player } player - 技能所属角色
		 * @param { string } skill - 技能名称
		 * @returns { boolean }
		 */
		filterEnable(event: GameEvent, player: Player, skill: string): boolean {
			const info = get.info(skill);
			if (!info) {
				console.error(new ReferenceError("缺少info的技能:"));
				return false;
			}
			if (!game.expandSkills(player.getSkills(false).concat(lib.skill.global)).includes(skill)) {
				//hiddenSkills
				if (player.hasSkillTag("nomingzhi", false, null, true)) {
					return false;
				}
				if (get.mode() !== "guozhan") {
					return false;
				}
				if (info.noHidden) {
					return false;
				}
			}
			const checkEnable = enable => {
				if (typeof enable === "function") {
					return enable(event);
				}
				if (Array.isArray(enable)) {
					return enable.some(i => checkEnable(i));
				}
				if (enable === "phaseUse") {
					return event.type === "phase";
				}
				if (typeof enable === "string") {
					return enable === event.name;
				}
				return false;
			};
			if (!checkEnable(info.enable)) {
				return false;
			}
			if (info.filter && !info.filter(event, player)) {
				return false;
			}
			if (info.viewAs && typeof info.viewAs !== "function") {
				if (info.viewAsFilter && info.viewAsFilter(player) === false) {
					return false;
				}
				if (event.filterCard) {
					const viewAs = info.viewAs;
					const card = typeof viewAs === "string" ? { name: viewAs } : viewAs;
					if (!event.filterCard(get.autoViewAs(card, "unsure"), player, event)) {
						return false;
					}
				}
			}
			if (info.usable !== undefined) {
				let num = info.usable;
				if (typeof num === "function") {
					num = num.call(info, skill, player);
				}
				if (typeof num === "number" && get.skillCount(skill, player) >= num) {
					return false;
				}
			}
			if (info.chooseButton && _status.event.noButton) {
				return false;
			}
			if (info.round && info.round - (game.roundNumber - player.storage[skill + "_roundcount"]) > 0) {
				return false;
			}
			for (const item in player.storage) {
				if (!item.startsWith("temp_ban_")) {
					continue;
				}
				if (player.storage[item] !== true) {
					continue;
				}
				const skillName = item.slice(9);
				if (!getRegisteredSkill(lib.skill, skillName)) {
					continue;
				}
				const skills = game.expandSkills([skillName]);
				if (skills.includes(skill)) {
					return false;
				}
			}
			return true;
		},
	};
}
