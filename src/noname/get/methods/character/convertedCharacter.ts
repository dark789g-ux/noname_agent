import { game, lib, _status } from "noname";
import { getRegisteredSkill, get, isPlayerSeat } from "../../dependencies.js";

export const characterConvertedCharacterMethods = {
	/**
	 * 将一个传统格式的character转化为Character对象格式
	 * @param { Array|Object|import("../library/element/character").Character } data
	 * @returns {import("../library/element/character").Character}
	 */
	convertedCharacter(data) {
		if (!(data instanceof lib.element.Character)) {
			return new lib.element.Character(data);
		}
		return data;
	},

	/**
	 * 根据(Player的)座次数n（从1开始）获取对应的“n号位”翻译
	 * @param {number | Player} seat
	 * @returns { string }
	 */
	seatTranslation(seat: number | Player) {
		if (isPlayerSeat(seat)) {
			seat = seat.getSeatNum() - 1;
		}
		return `${get.cnNumber(seat + 1, true)}号位`;
	},

	/**
	 * @param {number} numberOfPlayers
	 * @returns {string[]}
	 */
	identityList(numberOfPlayers: number) {
		const modeConfig = lib.config.mode_config;
		if (modeConfig) {
			const identityConfig = modeConfig.identity;
			if (identityConfig) {
				const identityLists = identityConfig.identity;
				if (identityLists) {
					const identityList = identityLists[numberOfPlayers - 2];
					if (Array.isArray(identityList)) {
						return identityList.slice();
					}
				}
			}
		}
		const numberOfPlayersExceptLord = numberOfPlayers - 1,
			numberOfLoyalists = Math.round((numberOfPlayersExceptLord * 3) / 9),
			numberOfSpys = Math.round((numberOfPlayersExceptLord * 2) / 9);
		return ["zhu"].concat(
			Array.from(
				{
					length: numberOfLoyalists,
				},
				() => "zhong"
			),
			Array.from(
				{
					length: numberOfSpys,
				},
				() => "nei"
			),
			Array.from(
				{
					length: numberOfPlayersExceptLord - numberOfLoyalists - numberOfSpys,
				},
				() => "fan"
			)
		);
	},

	/**
	 * 优先度判断
	 * @param { string } skill
	 * @returns { number }
	 */
	priority(skill: string) {
		const info = get.info(skill);
		if (!info) {
			return 0;
		}
		if ("_priority" in info) {
			return info._priority;
		}
		let priority = 0;
		if (info.priority) {
			priority = info.priority * 100;
		}
		if (info.silent) {
			priority++;
		}
		if (info.equipSkill) {
			priority -= 25;
		}
		if (info.cardSkill) {
			priority -= 50;
		}
		if (info.ruleSkill) {
			priority -= 75;
		}
		info._priority = priority;
		return priority;
	},

	/**
	 * @overload
	 * @param { string | Symbol } item
	 * @returns { Skill }
	 */
	/**
	 * @overload
	 * @param { Card | VCard | CardBaseUIData } item
	 * @param { Player | false } [player]
	 * @returns { any }
	 */
	/**
	 * @overload
	 * @param { AIResultItem } item
	 * @returns { { ai?: SkillAI } | undefined }
	 */
	info(item, player) {
		if (typeof item == "string" || typeof item == "symbol") {
			const info = getRegisteredSkill(lib.skill, item);
			if (!info) {
				const str = typeof item == "string" ? item : `[${item.toString()}]`;
				console.warn(`孩子，你的技能${str}是不是忘写了什么？！`);
				return {};
			}
			return info;
		}
		if (typeof item == "object") {
			let name = item.name;
			if (player !== false) {
				name = get.name(item, player);
			}
			return lib.card[name];
		}
	},

	/**
	 * 返回指定角色所有的id，用于统一双将和单将的检查
	 *
	 * @author tangXins
	 * @param {Player} player
	 * @returns {string[]}
	 */
	nameList(player: Player) {
		let type;
		if (typeof player == "undefined" || ((type = typeof player), type != "object") || ((type = get.itemtype(player)), type != "player")) {
			throw new Error(`函数接受了一个不是Player的东西: ${type}: ${player}`);
		}

		return ["name", "name1", "name2"]
			.filter((prop: string) => player[prop])
			.map((prop: string) => player[prop])
			.toUniqued();
	},

	/**
	 * 返回所有可获得的技能列表（遍历所有武将并排除禁将、Boss、隐藏等特殊武将，同时支持自定义筛选和combo技能前置校验）
	 *
	 * @param { ((info: object, skill: string, character: string) => boolean) } [func] - 自定义筛选函数，返回falsy则排除该技能
	 * @param { Player } [player] - 当前玩家，用于校验combo技能的前置条件
	 * @returns { string[] } 可获得的技能名数组
	 */
	gainableSkills(func: ((info: object, skill: string, character: string) => boolean) | undefined, player: Player | undefined) {
		const list: any[] = [];
		for (const i in lib.character) {
			if (lib.filter.characterDisabled(i)) {
				continue;
			}
			if (lib.filter.characterDisabled2(i)) {
				continue;
			}
			const character = lib.character[i];
			if (character.isBoss) {
				continue;
			}
			if (character.isHiddenBoss) {
				continue;
			}
			if (character.isMinskin) {
				continue;
			}
			if (character.isUnseen) {
				continue;
			}
			for (const skill of character.skills) {
				const info = getRegisteredSkill(lib.skill, skill);
				if (lib.filter.skillDisabled(skill)) {
					continue;
				}
				if (func && !func(info!, skill, i)) {
					continue;
				}
				if (player?.hasSkill && info?.ai?.combo) {
					let skills = info.ai.combo;
					if (!Array.isArray(skills)) {
						skills = [skills];
					}
					if (!skills.every((comboSkill: string) => player.hasSkill(comboSkill, null, null, false))) {
						continue;
					}
				}
				list.add(skill);
			}
		}
		return list;
	},

	/**
	 * 返回指定武将的所有可获得技能（排除Boss、隐藏等特殊判定，同时支持自定义筛选）
	 *
	 * @param { string } name - 武将名
	 * @param { ((info: object, skill: string, character: string) => boolean) } [func] - 自定义筛选函数，返回falsy则排除该技能
	 * @returns { string[] } 该武将可获得的技能名数组；武将不存在时返回空数组
	 */
	gainableSkillsName(name: string, func: ((info: object, skill: string, character: string) => boolean) | undefined) {
		const list: any[] = [];
		if (!name || !lib.character[name]) {
			return list;
		}
		const character = lib.character[name];
		if (character.isBoss) {
			return list;
		}
		if (character.isHiddenBoss) {
			return list;
		}
		if (character.isMinskin) {
			return list;
		}
		if (character.isUnseen) {
			return list;
		}
		for (const skill of character.skills) {
			const info = lib.skill[skill];
			if (lib.filter.skillDisabled(skill)) {
				continue;
			}
			if (func && !func(info, skill, name)) {
				continue;
			}
			list.add(skill);
		}
		return list;
	},

	/**
	 * 返回所有可获得技能的武将列表（排除禁将等不可选武将，同时支持自定义筛选和排除场上已有武将）
	 *
	 * @param { ((info: object, name: string) => boolean) | true } [func] - 自定义筛选函数（返回falsy则排除该武将），或传入`true`以额外排除场上（含已死亡）玩家的武将
	 * @returns { string[] } 可获得的武将名数组
	 */
	gainableCharacters(func: true | ((info: object, name: string) => boolean) | undefined) {
		const list: any[] = [];
		for (const i in lib.character) {
			const info = lib.character[i];
			if (!info) {
				continue;
			}
			if (typeof func === "function" && !func(info, i)) {
				continue;
			}
			if (lib.filter.characterDisabled(i)) {
				continue;
			}
			if (lib.filter.characterDisabled2(i)) {
				continue;
			}
			list.push(i);
		}
		if (func === true) {
			const players = game.players.concat(game.dead);
			for (const player of players) {
				list.remove(player.name);
				list.remove(player.name1);
				if (player.name2) {
					list.remove(player.name2);
				}
			}
		}
		return list;
	},

	/**
	 * 返回玩家本回合某个主动技的使用次数
	 * @param { string } skill 技能ID
	 * @param { Player } [player = _status.event.player]
	 * @returns { number }
	 */
	skillCount(skill: string, player: Player | undefined) {
		if (player == undefined) {
			const eventPlayer = _status.event.player;
			if (!eventPlayer) throw new TypeError("Skill usage counts require an event player");
			player = eventPlayer;
		}
		let num = player.getStat("skill")[skill];
		if (num == undefined) {
			return 0;
		}
		return num;
	},

	population(identity) {
		return identity == undefined ? game.players.length + game.dead.length : game.players.filter((current: Player) => current.identity == identity).length;
	},

	totalPopulation(identity) {
		return identity == undefined ? game.players.length + game.dead.length : game.players.concat(game.dead).filter((current: Player) => current.identity == identity).length;
	},

	/**
	 * @param { string } skill
	 * @param { Player } player
	 * @returns { string[] }
	 */
	skillCategoriesOf(skill: string, player: Player) {
		const list: any[] = [],
			info = get.info(skill);
		if (!info) {
			return list;
		}
		if (get.is.locked(skill, player)) {
			list.add("锁定技");
		}
		if (info.zhuSkill) {
			list.add("主公技");
		}
		if (info.limited) {
			list.add("限定技");
		}
		if (info.juexingji) {
			list.add("觉醒技");
		}
		if (get.is.zhuanhuanji(skill, player)) {
			list.add("转换技");
		}
		if (info.hiddenSkill) {
			list.add("隐匿技");
		}
		if (info.clanSkill) {
			list.add("宗族技");
		}
		if (info.groupSkill) {
			list.add("势力技");
		}
		if (info.dutySkill) {
			list.add("使命技");
		}
		if (info.chargeSkill) {
			list.add("蓄力技");
		}
		if (info.zhenfa) {
			list.add("阵法技");
		}
		if (info.mainSkill) {
			list.add("主将技");
		}
		if (info.viceSkill) {
			list.add("副将技");
		}
		if (info.lordSkill) {
			list.add("君主技");
		}
		if (info.chargingSkill) {
			list.add("蓄能技");
		}
		if (info.charlotte) {
			list.add("Charlotte");
		}
		if (info.sunbenSkill) {
			list.add("昂扬技");
		}
		if (info.persevereSkill) {
			list.add("持恒技");
		}
		if (info.transformSkill) {
			list.add("变身技");
		}
		if (info.comboSkill) {
			list.add("连招技");
		}
		if (info.feedPigSkill) {
			list.add("威主技");
		}
		if (get.is.qidingSkill(skill, player)) {
			list.add("契定技");
		}
		if (info.categories) {
			list.addArray(info.categories(skill, player));
		}
		return list;
	},
};
