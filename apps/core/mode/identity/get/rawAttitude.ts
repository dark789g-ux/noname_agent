import type { IdentityPlayerAI } from "../runtimeTypes.js";
import html from "dedent";
import { createRealAttitude } from "../ai/realAttitude.js";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createIdentityAttitudeMethods() {
	return {
		/**
		 * 计算一名角色对另一名角色的显式态度。
		 *
		 * @param { Player } from - 态度来源角色。
		 * @param { Player } to - 态度目标角色。
		 * @returns { number } 态度分值。
		 */
		rawAttitude(from, to) {
			let total = 0;
			let count = 0;
			if (_status.ai.customAttitude) {
				for (const customAttitude of _status.ai.customAttitude) {
					const value = customAttitude(from, to);
					if (value !== undefined) {
						total += value;
						count++;
					}
				}
			}
			if (count) {
				return total / count;
			}
			if (_status.mode === "purple") {
				const real = get.realAttitude!(from, to);
				if (from === to || to.identityShown || (from.storage.zhibi && from.storage.zhibi.includes(to)) || (_status.yeconfirm && ["rYe", "bYe"].includes(to.identity) && ["rYe", "bYe"].includes(to.identity))) {
					return real! * 1.1;
				}
				return ((to.ai as IdentityPlayerAI).shown + 0.1) * real! + (from.identity.slice(0, 1) === to.identity.slice(0, 1) ? 3 : -3) * (1 - (to.ai as IdentityPlayerAI).shown);
			}
			if (_status.mode === "stratagem") {
				let stratagemTotal = 0;
				let stratagemCount = 0;
				if (_status.ai.customAttitude) {
					for (const customAttitude of _status.ai.customAttitude) {
						const value = customAttitude(from, to);
						if (value !== undefined) {
							stratagemTotal += value;
							stratagemCount++;
						}
					}
				}
				if (stratagemCount) {
					return stratagemTotal / stratagemCount;
				}
				const real = get.realAttitude!(from, to);
				const zhibi = from.storage.zhibi;
				const stratagemExpose = from.storage.stratagem_expose;
				const followCamouflage = true;
				if ((to.ai as IdentityPlayerAI).shown) {
					return (to.ai as IdentityPlayerAI).shown * (real! + (from.identity === to.identity || (from.identity === "zhu" && to.identity === "zhong") || (from.identity === "zhong" && to.identity === "zhu") || (from.identity === "nei" && to.identity === "zhu" && get.situation!() <= 1) || (to.identity === "nei" && get.situation!() <= 0 && ["zhu", "zhong"].includes(from.identity)) || (get.situation!() >= 3 && from.identity === "fan") ? 2.9 : -2.9));
				}
				if (from === to || to.identityShown || (((stratagemExpose && stratagemExpose.includes(to)) || (zhibi && zhibi.includes(to))) && !(to.ai as IdentityPlayerAI).stratagemCamouflage)) {
					return real! * 1.1;
				}
				if (from.identity === "nei" && (to.ai as IdentityPlayerAI).stratagemCamouflage) {
					return real! * 1.1;
				}
				if (to.identity === "nei" && from.identity === "fan" && get.population("zhong") === 0 && zhibi) {
					const dead = game.dead.slice();
					for (const current of dead) {
						if (from.storage.zhibi.includes(current) && (current.ai as IdentityPlayerAI).stratagemCamouflage && from.storage.stratagem_expose && from.storage.stratagem_expose.includes(to)) {
							return -7;
						}
					}
					if (zhibi.includes(to)) {
						return 3;
					}
				}
				if (
					to.identity === "fan" &&
					from.identity === "nei" &&
					zhibi.includes(game.zhu) &&
					game.players
						.filter(current => current !== from && !zhibi.includes(current))
						.map(current => current.identity)
						.reduce((previous, current) => (!previous.includes(current) ? previous.push(current) && previous : previous) as string[], [] as string[]).length === 1
				) {
					return real;
				}
				for (const fan of game.dead) {
					if (fan.identity !== "fan" || !fan.storage.stratagem_revitalization) {
						continue;
					}
					for (const current of fan.storage.stratagem_expose) {
						if (to === current) {
							return real;
						}
					}
				}
				if (from.identity === "fan" && to.identity === "fan") {
					if ((from.ai as IdentityPlayerAI).stratagemCamouflage) {
						const zhu = game.zhu && game.zhu.isZhu && game.zhu.identityShown ? game.zhu : undefined;
						if (zhu && zhu.storage.stratagem_expose && zhu.storage.stratagem_expose.includes(to)) {
							return 0;
						}
						if (zhibi && zhibi.includes(to)) {
							return -7;
						}
					}
					if ((to.ai as IdentityPlayerAI).stratagemCamouflage) {
						const zhu = game.zhu && game.zhu.isZhu && game.zhu.identityShown ? game.zhu : undefined;
						if (zhu && zhu.storage.stratagem_expose && zhu.storage.stratagem_expose.includes(to)) {
							return 0;
						}
						if (zhibi && zhibi.includes(to)) {
							return -7;
						}
					}
				}
				if (from.identity !== "nei" && zhibi && zhibi.includes(to) && !to.identityShown && followCamouflage && (to.ai as IdentityPlayerAI).stratagemCamouflage) {
					return -5;
				}
				if (from.identity !== "nei" && stratagemExpose && stratagemExpose.includes(to) && !to.identityShown) {
					return -5;
				}
				if (zhibi) {
					for (const to2 of zhibi) {
						if (!to2.storage.stratagem_expose) {
							continue;
						}
						if (to2.ai.stratagemCamouflage) {
							for (const to3 of to2.storage.stratagem_expose) {
								if (zhibi.slice().addArray(stratagemExpose).includes(to3)) {
									if (to === to2) {
										return real;
									}
								} else if (to === to3) {
									return Math.abs(real! + 10) / 10;
								}
							}
							continue;
						}
						for (const to3 of to2.storage.stratagem_expose) {
							if (!zhibi.slice().addArray(stratagemExpose).includes(to3) && to === to3) {
								return get.rawAttitude!(to3, to) * Math.sign(real!);
							}
						}
					}
				}
				return Math.max(-1, Math.min(-0.1, (-Math.min(5, to.countCards("hes") / 2 + 1) / 5 - Math.max(0, 5 - to.hp) / 4) / 2));
			}
			//正常身份模式态度
			let difficulty = 0;
			if (to === game.me) {
				difficulty = 2 - get.difficulty();
			}
			if (from === to || to.identityShown || from.storage.dongcha === to || to.identityShown || (from.storage.zhibi && from.storage.zhibi.includes(to))) {
				return get.realAttitude!(from, to)! + difficulty * 1.5;
			}
			if (from.identity === "zhong" && (to.ai as IdentityPlayerAI).shown === 0 && (from.ai as IdentityPlayerAI).tempIgnore && !(from.ai as IdentityPlayerAI).tempIgnore!.includes(to)) {
				for (const current of game.players) {
					if ((current.ai as IdentityPlayerAI).shown === 0 && current.identity === "fan") {
						return -0.1 + difficulty * 1.5;
					}
				}
			}
			let aishown = (to.ai as IdentityPlayerAI).shown;
			if ((to.identity === "nei" || to.identity === "commoner") && (to.ai as IdentityPlayerAI).shown < 1 && ((to.ai as IdentityPlayerAI).identity_mark === "fan" || (to.ai as IdentityPlayerAI).identity_mark === "zhong")) {
				aishown = 0.5;
			} else if (aishown === 0 && to.identity !== "fan" && to.identity !== "zhu") {
				let fanshown = true;
				for (const current of game.players) {
					if (current.identity === "fan" && (current.ai as IdentityPlayerAI).shown === 0 && current !== from) {
						fanshown = false;
						break;
					}
				}
				if (fanshown) {
					aishown = 0.3;
				}
			}
			return get.realAttitude!(from, to)! * aishown + difficulty * 1.5;
		},
		realAttitude: createRealAttitude(),

		/**
		 * 计算当前主忠方相对反贼方的局势分。
		 *
		 * @param { boolean } [absolute] - 是否直接返回未归一化的局势分。
		 * @returns { number } 局势分；正数偏主忠，负数偏反贼。
		 */
		situation(absolute) {
			let zhuzhong = 0;
			let total = 0;
			let zhu;
			let fan = 0;
			for (const player of game.players) {
				let php = player.hp;
				if (player.hasSkill("benghuai") && php! > 4) {
					php = 4;
				} else if (php! > 6) {
					php = 6;
				}
				const score = player.countCards("h") + player.countCards("e") * 1.5 + php! * 2;
				if (player.identity === "zhu") {
					zhuzhong += score * 1.2 + 5;
					total += score * 1.2 + 5;
					zhu = score;
				} else if (player.identity === "zhong" || player.identity === "mingzhong") {
					zhuzhong += score * 0.8 + 3;
					total += score * 0.8 + 3;
				} else if (player.identity === "fan") {
					zhuzhong -= score + 4;
					total += score + 4;
					fan += score + 4;
				}
			}
			if (absolute) {
				return zhuzhong;
			}
			let result = parseInt((10 * Math.abs(zhuzhong / total)) as unknown as string);
			if (zhuzhong < 0) {
				result = -result;
			}
			if (!game.zhong) {
				if (zhu < 12 && fan > 30) {
					result--;
				}
				if (zhu < 6 && fan > 15) {
					result--;
				}
				if (zhu < 4) {
					result--;
				}
			}
			return result;
		},

		/**
		 * 计算谋攻模式洞察时显示的阵营关系。
		 *
		 * @param { Player } from - 洞察来源角色。
		 * @param { Player } to - 洞察目标角色。
		 * @returns { string } 洞察结果。
		 */
		insightResult(from, to) {
			const friend = "friend";
			const enemy = "enemy";
			if (from.identity === "nei") {
				return to.identity;
			}
			if (to.identity === "nei") {
				return friend;
			}
			if ((from.ai as IdentityPlayerAI).stratagemCamouflage || (to.ai as IdentityPlayerAI).stratagemCamouflage) {
				return enemy;
			}
			if (from.identity === to.identity || (from.identity === "zhu" && to.identity === "zhong") || (from.identity === "zhong" && to.identity === "zhu")) {
				return friend;
			}
			return enemy;
		},
	};
}
