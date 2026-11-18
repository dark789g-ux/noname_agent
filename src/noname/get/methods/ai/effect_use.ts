import { game, lib, _status } from "noname";
import { CacheContext, get } from "../../dependencies.js";

export const aiEffect_useMethods = {
	/**
	 * 计算使用牌或技能时的AI效果分值。
	 *
	 * 与`effect`类似，但会优先读取`player_use`和`target_use`作为使用阶段的基础收益；
	 * 随后叠加发动者和目标的技能修正、目标威胁度、血量、手牌数，以及自然伤害的连环传导收益。
	 * 数值越高，表示该使用行为对评估立场越有利；数值越低，表示越不利。
	 *
	 * @param { Player } [target] - 被作用的目标；无目标牌可省略
	 * @param { string | Card | VCard | CardBaseUIData } [card] - 要评估的牌、虚拟牌、技能名或可被当前事件推断的对象
	 * @param { Player | null } [player] - 牌或技能的发动者；省略时取当前事件的玩家
	 * @param { Player | null } [player2] - 评估立场；省略或为空时以`player`立场评估
	 * @param { boolean | EffectLinkContext } [linking] - 是否正在计算连环传导，或传导计算时携带的上下文
	 * @returns { number } 综合态度、技能和状态修正后的AI效果分值
	 */
	effect_use(target: Player | undefined, card: string | Card | VCard | CardBaseUIData | undefined, player: Player | null | undefined, player2: Player | null | undefined, linking: boolean | EffectLinkContext | undefined) {
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
		let cardInfo;
		if (typeof card === "string") {
			cardInfo = get.info(card);
		} else if (card !== null && typeof card === "object") {
			cardInfo = get.info(card, undefined);
		}
		if (typeof card === "object" && cardInfo && cardInfo.changeTarget) {
			const targets = [target];
			cardInfo.changeTarget(player, targets);
			let eff = 0;
			for (const currentTarget of targets) {
				eff += cache.get.effect(currentTarget, card, player, player2, linking);
			}
			return eff;
		}
		const result = get.result(card, eventskill);
		/** @type {number | boolean | void | AIResultScore} */
		let result1: number | boolean | void | AIResultScore = typeof result === "number" ? undefined : result.player_use || result.player;
		/** @type {number | boolean | void | AIResultScore} */
		let result2: number | boolean | void | AIResultScore = typeof result === "number" ? undefined : result.target_use || result.target;
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
			if (temp1 && typeof temp1.effect === "object" && typeof temp1.effect.player_use === "function") {
				temp1 = cache.delegate(temp1.effect).player_use(card, player, target, result1, linking);
			} else if (temp1 && typeof temp1.effect === "object" && typeof temp1.effect.player === "function") {
				temp1 = cache.delegate(temp1.effect).player(card, player, target, result1, linking);
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
				const threatValue = temp2 && temp2.threaten;
				if (temp2 && (threatValue || typeof threatValue === "number")) {
					temp3 = temp2.threaten;
				} else {
					temp3 = undefined;
				}
				if (temp2 && typeof temp2.effect === "function") {
					if (
						!player.hasSkillTag("ignoreSkill", true, {
							card: card,
							target: target,
							skill: skill,
							isLink: linking,
						})
					) {
						temp2 = cache.delegate(temp2).effect(card, player, target, result2, linking);
					} else {
						temp2 = undefined;
					}
				} else if (temp2 && typeof temp2.effect === "object" && typeof temp2.effect.target_use === "function") {
					if (
						!player.hasSkillTag("ignoreSkill", true, {
							card: card,
							target: target,
							skill: skill,
							isLink: linking,
						})
					) {
						temp2 = cache.delegate(temp2.effect).target_use(card, player, target, result2, linking);
					} else {
						temp2 = undefined;
					}
				} else if (temp2 && typeof temp2.effect === "object" && typeof temp2.effect.target === "function") {
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
					const threat = temp3(player, target);
					temp3 = typeof threat === "number" ? threat : undefined;
				} else if (typeof temp3 === "object") {
					const targetThreat = temp3.target;
					const threat = typeof targetThreat === "function" ? targetThreat.call(temp3, player, target) : targetThreat;
					temp3 = typeof threat === "number" ? threat : undefined;
				}
				if (typeof temp3 === "number") {
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
					result2 *= 2.5;
				}
				if (target.hp === 2) {
					result2 *= 1.8;
				}
				const countTargetCards = target.countCards("h");
				if (countTargetCards === 0) {
					if (get.tag(card, "respondSha", undefined, undefined) || get.tag(card, "respondShan", undefined, undefined)) {
						result2 *= 1.7;
					} else {
						result2 *= 1.5;
					}
				} else if (countTargetCards === 1) {
					result2 *= 1.3;
				} else if (countTargetCards === 2) {
					result2 *= 1.1;
				} else if (countTargetCards >= 3) {
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
				console.warn("计算get.effect_use(", target, card, player, player2, linking, ")时缺少target参数");
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

	cacheEffect(target, card, player, player2, isLink) {
		let cache = CacheContext.requireCacheContext();
		return cache.get.effect(target, card, player, player2, isLink);
	},

	threaten(target, player, hp) {
		let threaten = 1;
		let skills = target.getSkills();
		if (!player && player !== false) {
			player = _status.event.player;
		}
		for (let i = 0; i < skills.length; i++) {
			let info = get.info(skills[i]);
			if (info && info.ai && info.ai.threaten) {
				if (typeof info.ai.threaten == "function" && player) {
					let tmp = info.ai.threaten(player, target);
					if (typeof tmp == "number") {
						threaten *= tmp;
					}
				} else if (typeof info.ai.threaten == "number") {
					threaten *= info.ai.threaten;
				}
			}
		}
		if (hp) {
			switch (target.hp) {
				case 0:
					threaten *= 1.5;
					break;
				case 1:
					threaten *= 1.2;
					break;
			}
			switch (target.countCards("h")) {
				case 0:
					threaten *= 1.5;
					break;
				case 1:
					threaten *= 1.2;
					break;
			}
		}
		return threaten;
	},

	condition(player) {
		let num = player.hp;
		if (num > 4) {
			num = 4 + Math.sqrt(num - 4);
		} else {
			if (player.isHealthy()) {
				if (player.hp == 3) {
					num += 0.5;
				} else if (player.hp < 3) {
					num++;
				}
			}
		}
		num += player.countCards("h") / 2;
		let es = player.getCards("e");
		for (let i = 0; i < es.length; i++) {
			let val = get.equipValueNumber(es[i]);
			if (val >= 7) {
				num += 0.8;
			}
			if (val >= 5) {
				num += 0.5;
			}
			if (val >= 3) {
				num += 0.2;
			}
		}
		return num;
	},

	attitude(from, to) {
		if (!from || !to) {
			return 0;
		}
		from = from._trueMe || from;
		// Mode hooks observe the original argument object and argument count.
		// eslint-disable-next-line prefer-rest-params
		arguments[0] = from;
		const rawAttitude = CacheContext.requireCacheContext().get.rawAttitude;
		if (typeof rawAttitude != "function") {
			throw new TypeError("The current mode must provide get.rawAttitude");
		}
		// eslint-disable-next-line prefer-rest-params
		let att = arguments.length > 2 ? rawAttitude.call(this, from, to, arguments[2]) : rawAttitude.call(this, from, to);
		if (from.isMad()) {
			att = -att;
		}
		if (to.isMad() && att > 0) {
			if (to.identity == "zhu") {
				att = 1;
			} else {
				att = 0;
			}
		}
		if (!_status.tempnofake) {
			_status.tempnofake = true;
			if (from.ai.modAttitudeFrom) {
				att = from.ai.modAttitudeFrom(from, to, att);
			}
			if (to.ai.modAttitudeTo) {
				att = to.ai.modAttitudeTo(from, to, att);
			}
			delete _status.tempnofake;
		}
		return att;
	},
};
