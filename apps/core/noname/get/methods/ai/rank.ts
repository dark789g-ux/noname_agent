import { game, lib, _status } from "noname";
import { get } from "../../dependencies.js";

export const aiRankMethods = {
	/**
	 * @overload
	 * @param {string | undefined | {name: string}} name
	 * @param {true} num
	 * @returns {number}
	 */
	/**
	 * @overload
	 * @param {string | {name: string}} name
	 * @param {boolean | number} [num]
	 * @returns {string | number}
	 */
	/** @param {boolean | number} [num] */
	rank(name, num: number | boolean | undefined) {
		if (typeof name === "object" && name.name) {
			name = name.name;
		}
		num = num === true ? 9 : typeof num === "number" ? num : false;

		if (name === _status.lord) {
			return num ? Math.round((7 * (num - 1)) / 8 + 1) : "ap";
		}

		const rank = lib.rank;
		const RANK_MAP = [
			{ key: "s", factor: 8, ref: rank?.s },
			{ key: "ap", factor: 7, ref: rank?.ap },
			{ key: "a", factor: 6, ref: rank?.a },
			{ key: "am", factor: 5, ref: rank?.am },
			{ key: "bp", factor: 4, ref: rank?.bp }, // 中位数等级
			{ key: "b", factor: 3, ref: rank?.b },
			{ key: "bm", factor: 2, ref: rank?.bm },
			{ key: "c", factor: 1, ref: rank?.c },
			{ key: "d", factor: 0, ref: rank?.d },
		];
		for (const { key, factor, ref } of RANK_MAP) {
			if (ref?.includes(name)) {
				return num ? Math.round((factor * (num - 1)) / 8 + 1) : key;
			}
		}

		const charInfo = lib.character[name];
		if (charInfo?.isBoss || charInfo?.isBossAllowed || charInfo?.isHiddenBoss) {
			return num ? Math.round((9 * (num - 1)) / 8 + 1) : "sp";
		}

		console.warn(`"${name}"未配置等级，已按众数"bp"处理`);
		return num ? Math.round((4 * (num - 1)) / 8 + 1) : "bp";
	},

	skillRank(skill, type, grouped) {
		// Function-scoped bindings intentionally remain shared across legacy branches.
		let list, i;

		let info = lib.skill[skill];
		let player = _status.event.skillRankPlayer || _status.event.player;
		if (!info) {
			return 0;
		}
		if (info.ai) {
			if (info.ai.halfneg) {
				return 0;
			}
			if (player?.hasSkill && info?.ai?.combo) {
				let skills = info.ai.combo;
				if (!Array.isArray(skills)) {
					skills = [skills];
				}
				if (!skills.every((skill: string) => player!.hasSkill(skill, null, null, false))) {
					return 0;
				}
			}
			if (info.ai.neg) {
				return -1;
			}
		}
		let num = 1;
		let threaten = 1;
		if (info.ai && info.ai.threaten) {
			if (typeof info.ai.threaten == "number") {
				threaten = info.ai.threaten;
			} else if (typeof info.ai.threaten == "function" && player) {
				const result = info.ai.threaten(player, player);
				if (typeof result === "number") {
					threaten = result;
				}
			}
		}
		if (type && type.includes("in")) {
			if (info.enable == "phaseUse") {
				num += 0.5;
			}
			if (info.trigger && info.trigger.player) {
				list = Array.isArray(info.trigger.player) ? info.trigger.player : [info.trigger.player];
				let add = false;
				for (i of list) {
					if (i.startsWith("phase")) {
						num += 0.5;
						add = true;
					} else {
						for (let j of lib.phaseName) {
							if (i.indexOf(j) == 0) {
								num += 0.5;
								add = true;
								break;
							}
						}
					}
					if (add) {
						break;
					}
				}
			}
			if (info.trigger && ((typeof info.trigger.player == "string" && info.trigger.player.startsWith("use")) || info.trigger.source)) {
				num += 0.3;
			}
			if (num > 1 && threaten > 1) {
				num += Math.sqrt(threaten) - 1;
			}
		}
		if (type && type.includes("out")) {
			if (threaten < 1) {
				num *= 1 / Math.sqrt(threaten);
			}
			if (info.trigger) {
				if (info.trigger.global) {
					list = Array.isArray(info.trigger.global) ? info.trigger.global : [info.trigger.global];
					num += Math.min(3, list.length) / 10;
					for (i of list) {
						if (i.startsWith("lose") || i.startsWith("use")) {
							num += 0.3;
						}
						if (i.startsWith("cardsDiscard")) {
							num += 0.4;
						}
					}
				}
				if (info.trigger.target || (typeof info.trigger.player == "string" && (info.trigger.player.startsWith("damage") || info.trigger.player.startsWith("lose")))) {
					num += 0.1;
				}
			}
			if (info.ai) {
				if (info.ai.maixie || info.ai.maixie_hp || info.ai.maixie_defend) {
					num += 0.5;
				}
				if (info.ai.nolose || info.ai.noh || info.ai.noe || info.ai.nodiscard) {
					num += 0.3;
				}
			}
		}
		if (!grouped) {
			let groups = game.expandSkills([skill]);
			groups.remove(skill);
			let ggt: any[] = [];
			for (let i = 0; i < groups.length; i++) {
				let gi = get.skillRank(groups[i], type, true);
				if (gi < 0) {
					num -= 0.5;
				} else if (gi > 1) {
					ggt.push(gi);
				}
			}
			if (ggt.length) {
				num += Math.max.apply(this, ggt) - 1 + ggt.length / 20;
			}
		}
		return num;
	},
};
