import { game, lib, _status } from "noname";
import { CacheContext, get } from "../../dependencies.js";

export const aiAiStrategyMethods = {
	aiStrategy() {
		switch (get.config("ai_strategy", undefined)) {
			case "ai_strategy_1":
				return 1;
			case "ai_strategy_2":
				return 2;
			case "ai_strategy_3":
				return 3;
			case "ai_strategy_4":
				return 4;
			case "ai_strategy_5":
				return 5;
			case "ai_strategy_6":
				return 6;
			default:
				return 1;
		}
	},

	/**
	 * 计算牌或技能对目标的AI效果分值。
	 *
	 * 该分值会以`player`或`player2`的立场，把牌本身的收益、发动者和目标的技能修正、
	 * 目标威胁度、血量、手牌数，以及自然伤害的连环传导收益合并为一个最终数值。
	 * 数值越高，表示该行为对评估立场越有利；数值越低，表示越不利。
	 *
	 * @param { Player } [target] - 被作用的目标；无目标牌可省略
	 * @param { string | Card | VCard | CardBaseUIData } [card] - 要评估的牌、虚拟牌、技能名或可被推断为当前事件牌的对象
	 * @param { Player | null } [player] - 牌或技能的发动者；省略时取当前事件的玩家
	 * @param { Player | null } [player2] - 评估立场；省略或为空时以`player`立场评估
	 * @param { boolean | EffectLinkContext } [linking] - 是否正在计算连环传导，或传导计算时携带的上下文
	 * @returns { number } 综合态度、技能和状态修正后的AI效果分值
	 */
	effect(target: Player | undefined, card: string | Card | VCard | CardBaseUIData | undefined, player: Player | null | undefined, player2: Player | null | undefined, linking: boolean | EffectLinkContext | undefined) {
		const cache = CacheContext.requireCacheContext();
		const event = _status.event;
		let eventskill: any = null;
		if (player === undefined) {
			player = _status.event.player;
		}
		if (card && typeof card === "object" && "name" in card) {
			card = get.autoViewAs(card);
		}
		if (typeof card !== "string" && (typeof card !== "object" || !card.name)) {
			const skill = event.skill;
			const skillinfo = skill ? get.info(skill) : undefined;
			if (skill && skillinfo?.viewAs === undefined) {
				card = skill;
			} else {
				card = get.card(undefined);
				const viewAs = skillinfo && skillinfo.viewAs;
				const viewAsName = viewAs && (typeof viewAs === "object" || typeof viewAs === "function") ? viewAs.name : undefined;
				if (skillinfo && viewAs && card && typeof card === "object" && card.name === viewAsName) {
					eventskill = event.skill;
				}
			}
		}
		const result = get.result(card, eventskill);
		/** @type {number | boolean | void | AIResultScore} */
		let result1: number | boolean | void | AIResultScore = typeof result === "number" ? undefined : result.player;
		/** @type {number | boolean | void | AIResultScore} */
		let result2: number | boolean | void | AIResultScore = typeof result === "number" ? undefined : result.target;
		if (typeof result1 === "function") {
			result1 = result1(player, target, card, linking);
		}
		if (typeof result2 === "function") {
			result2 = result2(player, target, card, linking);
		}

		if (typeof result1 !== "number") {
			result1 = 0;
		}
		if (typeof result2 !== "number") {
			result2 = 0;
		}
		let temp1;
		let temp2;
		/** @type {number | ((player: Player, target: Player) => number | void) | { target?: number | ((player: Player, target: Player) => number | void) } | undefined} */
		let temp3;
		let temp01 = 0;
		let temp02 = 0;
		let threaten = 1;
		if (!player) throw new TypeError("AI effect evaluation requires a player");
		const skills1 = player.getSkills().concat(lib.skill.global);
		game.expandSkills(skills1);
		let zerotarget = false;
		let zeroplayer = false;
		for (const skill of skills1) {
			const info = get.info(skill);
			if (!info) {
				throw new Error(`${skill}不存在的技能`);
			}
			temp1 = info.ai;
			if (temp1 && typeof temp1.effect === "object" && typeof temp1.effect.player === "function") {
				temp1 = temp1.effect.player(card, player, target, result1, linking);
			} else {
				temp1 = undefined;
			}
			if (typeof temp1 === "object") {
				if (temp1.length === 2 || temp1.length === 4) {
					result1 *= temp1[0];
					temp01 += temp1[1];
				}
				if (temp1.length === 4) {
					result2 *= temp1[2];
					temp02 += temp1[3];
				}
			} else if (typeof temp1 === "number") {
				result1 *= temp1;
			} else if (temp1 === "zeroplayer") {
				zeroplayer = true;
			} else if (temp1 === "zerotarget") {
				zerotarget = true;
			} else if (temp1 === "zeroplayertarget") {
				zeroplayer = true;
				zerotarget = true;
			}
		}
		if (target) {
			const skills2 = target.getSkills().concat(lib.skill.global);
			game.expandSkills(skills2);
			for (const skill of skills2) {
				const info = get.info(skill);
				if (!info) {
					throw new Error(`${skill}不存在的技能`);
				}
				temp2 = info.ai;
				if (!temp2) {
					continue;
				}
				const threatValue = temp2.threaten;
				if (threatValue || typeof threatValue === "number") {
					temp3 = cache.delegate(temp2).threaten;
				} else {
					temp3 = undefined;
				}
				if (typeof temp2.effect === "object" && typeof temp2.effect.target === "function") {
					if (
						!player.hasSkillTag("ignoreSkill", true, {
							card: card,
							target: target,
							skill: skill,
							isLink: linking,
						})
					) {
						temp2 = cache.delegate(temp2.effect).target(card, player, target, result2, linking);
					} else {
						temp2 = undefined;
					}
				} else {
					temp2 = undefined;
				}
				if (typeof temp2 === "object") {
					if (temp2.length === 2 || temp2.length === 4) {
						result2 *= temp2[0];
						temp02 += temp2[1];
					}
					if (temp2.length === 4) {
						result1 *= temp2[2];
						temp01 += temp2[3];
					}
				} else if (typeof temp2 === "number") {
					result2 *= temp2;
				} else if (temp2 === "zeroplayer") {
					zeroplayer = true;
				} else if (temp2 === "zerotarget") {
					zerotarget = true;
				} else if (temp2 === "zeroplayertarget") {
					zeroplayer = true;
					zerotarget = true;
				}
				if (typeof temp3 === "function") {
					const value = temp3(player, target);
					if (typeof value === "number") {
						threaten *= value;
					}
				} else if (typeof temp3 === "object") {
					const targetThreat = temp3.target;
					const value = typeof targetThreat === "function" ? targetThreat.call(temp3, player, target) : targetThreat;
					if (typeof value === "number") {
						threaten *= value;
					}
				} else if (typeof temp3 === "number") {
					threaten *= temp3;
				}
			}
			result2 += temp02;
			result1 += temp01;
			if (typeof card === "object" && (typeof result === "number" || !result.ignoreStatus)) {
				if (cache.get.attitude(player, target) < 0) {
					result2 *= Math.sqrt(threaten);
				} else {
					result2 *= Math.sqrt(Math.sqrt(threaten));
				}
				if (target.hp === 1) {
					result2 *= 3;
				}
				if (target.hp === 2) {
					result2 *= 1.8;
				}
				const targetCountCards = target.countCards("h");
				if (targetCountCards === 0) {
					if (get.tag(card, "respondSha", undefined, undefined) || get.tag(card, "respondShan", undefined, undefined)) {
						result2 *= 2.1;
					} else {
						result2 *= 1.5;
					}
				}
				if (targetCountCards === 1) {
					result2 *= 1.3;
				} else if (targetCountCards === 2) {
					result2 *= 1.1;
				} else if (targetCountCards > 3) {
					result2 *= 0.5;
				}
				if (target.hp === 4) {
					result2 *= 0.9;
				} else if (target.hp === 5) {
					result2 *= 0.8;
				} else if (Number(target.hp) > 5) {
					result2 *= 0.6;
				}
			}
		} else {
			result2 += temp02;
			result1 += temp01;
			if (typeof card === "object" && !get.info(card)?.notarget) {
				console.warn("计算get.effect(", target, card, player, player2, linking, ")时缺少target参数");
			}
		}
		if (zeroplayer) {
			result1 = 0;
		}
		if (zerotarget) {
			result2 = 0;
		}
		let final = 0;
		if (player2) {
			final = result1 * cache.get.attitude(player2, player) + (target ? result2 * cache.get.attitude(player2, target) : 0);
		} else {
			final = result1 * cache.get.attitude(player, player) + (target ? result2 * cache.get.attitude(player, target) : 0);
		}
		if (!linking && target && !zerotarget && get.tag(card, "natureDamage", undefined, undefined)) {
			let info;
			if (typeof card === "string") {
				info = get.info(card);
			} else if (card !== null && typeof card === "object") {
				info = get.info(card, undefined);
			}
			if (!info || !info.ai || !info.ai.canLink) {
				if (target.isLinked()) {
					game.players.forEach((current: Player) => {
						if (current !== target && current.isLinked()) {
							final += cache.get.effect(current, card, player, player2, { source: target });
						}
					});
				}
			} else {
				let canLink = info.ai.canLink(player, target, card);
				if (canLink) {
					if (typeof canLink !== "object") {
						canLink = {};
					}
					canLink.source = target;
					game.players.forEach((current: Player) => {
						if (current !== target && current.isLinked()) {
							final += cache.get.effect(current, card, player, player2, canLink);
						}
					});
				}
			}
		}
		return final;
	},

	damageEffect(target, player, viewer, nature) {
		if (get.itemtype(nature) == "natures") {
			let natures = get.natureList(nature);
			return natures.map((n: string) => get.damageEffect(target, player, viewer, n)).reduce((p, c) => p + c, 0) / (natures.length || 1);
		}
		if (!player) {
			player = target;
		}
		if (!viewer) {
			viewer = target;
		}
		let name = "damage";
		if (nature == "fire") {
			name = "firedamage";
		} else if (nature == "thunder") {
			name = "thunderdamage";
		} else if (nature == "ice") {
			name = "icedamage";
		}
		let eff = get.effect(target, { name: name }, player, viewer);
		if (eff > 0 && target.hujia > 0) {
			return eff / 1.3;
		}
		return eff;
	},

	recoverEffect(target, player, viewer) {
		if (target.hp == target.maxHp) {
			return 0;
		}
		if (!player) {
			player = target;
		}
		if (!viewer) {
			viewer = target;
		}
		return get.effect(target, { name: "recover" }, player, viewer);
	},

	buttonValue(button) {
		const card = button.link;
		const player = get.owner(card) || _status.event.player;
		if (!player) throw new TypeError("Card button values require a player");
		if (player.getCards("j").includes(card)) {
			const vcard = get.autoViewAs({ name: card.viewAs || card.name, cards: [card] }, [card]);
			return get.effect(player, vcard, player, player);
		}
		if (player.getCards("e").includes(card)) {
			const evalue = get.value(card, player, undefined);
			if (player.hasSkillTag("noe")) {
				return evalue / 1145141919810;
			}
			return evalue;
		}
		if (!player.getCards("h").includes(card) || player.hasSkillTag("noh")) {
			return 0.1;
		}
		if (!button.classList?.contains("blank")) {
			return get.value(card, undefined, undefined);
		}
		const nh = player.countCards("h");
		return 3 * Math.exp(-0.2 * nh) + Math.max(0, 4 - nh) * 0.5 + 0.1;
	},

	attitude2(to) {
		return get.attitude(_status.event.player, to);
	},

	/**
	 * Get the number of a skill's item's length
	 *
	 * 获取一个转换技的转换项数
	 * @param {string} skill 技能名
	 * @param {Player} player
	 * @returns {number}
	 */
	zhuanhuanItemNum(skill: string, player: Player) {
		if (!get.is.zhuanhuanji(skill, player)) {
			return 0;
		}
		const info = lib.skill[skill];
		if ("zhuanhuanLimit" in info) {
			const { zhuanhuanLimit } = info;
			if (typeof zhuanhuanLimit === "function") {
				return parseInt(zhuanhuanLimit(skill, player));
			}
			return parseInt(zhuanhuanLimit);
		}
		return 2;
	},
};
