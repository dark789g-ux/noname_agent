/* eslint-disable prefer-rest-params */
import { _status, game, get, lib } from "noname";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import type { Card } from "../../card.js";
import type { GameEvent, GameEventParentFallback } from "../../gameEvent.js";
import type { Player } from "../../player.js";
import type { CooperationInfo } from "../contracts/choiceAndPhaseContract.js";
import "../contracts/choiceAndPhaseContract.js";
import type { EventChooseCooperationForParams, EventChooseToDebateParams } from "../eventParams.js";

export const compareAndCooperationMethods = {
	chooseToDebate(this: Player, params?: EventChooseToDebateParams): GameEvent {
		const next: any = game.createEvent("chooseToDebate");
		next.player = this;
		next._args = [];

		const args = [...arguments];
		if (args.length === 1 && typeof params === "object" && !Array.isArray(params)) {
			next.list = params.list;
			next._args = params.args;
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "players") {
					next.list = arg.slice(0);
				} else {
					next._args.push(arg);
				}
			}
		}
		next.setContent("chooseToDebate");
		return next;
	},

	cooperationWith(this: Player, target: Player, type: string, reason?: any): void {
		if (!this.storage.cooperation) {
			this.storage.cooperation = [];
		}
		const info: CooperationInfo = {
			target,
			type,
			reason,
		};
		this.storage.cooperation.add(info);
		this.addTempSkill("cooperation", { player: "dieAfter" });
		this.addTempSkill("cooperation_" + type, { player: "dieAfter" });
		game.log(this, "向", target, "发起了“协力”，合作类型是", "#g" + get.translation("cooperation_" + type));
	},

	chooseCooperationFor(this: Player, params?: EventChooseCooperationForParams): GameEvent {
		const next: any = game.createEvent("chooseCooperationFor");
		next.player = this;

		const args = [...arguments];
		if (args.length === 1 && typeof params === "object" && !Array.isArray(params) && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.target = arg;
				} else if (Array.isArray(arg)) {
					next.cardlist = arg;
				} else if (typeof arg == "string") {
					next.reason = arg;
				}
			}
		}
		if (!next.cardlist) {
			next.cardlist = ["cooperation_damage", "cooperation_draw", "cooperation_discard", "cooperation_use"];
		}
		next.setContent("chooseCooperationFor");
		return next;
	},

	checkCooperationStatus(this: Player, target: Player, reason?: any): boolean {
		const storage: CooperationInfo[] = this.getStorage("cooperation");
		for (const info of storage) {
			if (info.target == target && info.reason == reason) {
				const skill: (Skill & { checkx?: (info: CooperationInfo) => boolean }) | undefined = getRegisteredSkill(lib.skill, "cooperation_" + info.type);
				if (skill && skill.checkx && skill.checkx(info)) {
					return true;
				}
			}
		}
		return false;
	},

	removeCooperation(this: Player, info: CooperationInfo): void {
		const storage: CooperationInfo[] = this.getStorage("cooperation");
		if (!storage.includes(info)) {
			return;
		}
		storage.remove(info);
		let unmark = true;
		const reason = info.type;
		if (!storage.length) {
			this.removeSkill("cooperation");
		} else {
			for (const i of storage) {
				if (i.type == reason) {
					unmark = false;
					break;
				}
			}
		}
		if (unmark) {
			this.removeSkill("cooperation_" + reason);
		} else {
			this.markSkill("cooperation_" + reason);
		}
	},

	canCompare(this: Player, target: Player, goon?: boolean, bool?: boolean): boolean {
		if (this == target) {
			return false;
		}
		if ((!this.countCards("h") && goon !== true) || (!target.countCards("h") && bool !== true)) {
			return false;
		}
		if (this.hasSkillTag("noCompareSource") || target.hasSkillTag("noCompareTarget")) {
			return false;
		}
		return true;
	},

	chooseToCompare(this: Player, targetOrTargets: Player | Player[], check?: (card: Card) => number): GameEvent {
		const next = game.createEvent("chooseToCompare");
		next.player = this;
		if (Array.isArray(targetOrTargets)) {
			next.targets = targetOrTargets;
			if (check) {
				next.ai = check;
			} else {
				next.ai = function (card) {
					const skillInfo = typeof card == "string" ? getRegisteredSkill(lib.skill, card) : undefined;
					if (skillInfo) {
						const ais =
							(skillInfo.check as (() => number) | undefined) ||
							function () {
								return 0;
							};
						return ais();
					}
					let addi = get.value(card) >= 8 && get.type(card) != "equip" ? -3 : 0;
					if (card.name == "du") {
						addi -= 3;
					}
					const currentEvent = _status.event;
					const source = currentEvent?.source;
					const player = currentEvent?.player;
					const event: (RuntimeGameEvent & { small?: boolean }) | GameEventParentFallback | undefined = currentEvent?.getParent();
					if (!player || !event) {
						return NaN;
					}
					const getn = function (card) {
						//会赢吗？会赢的！
						if (player.hasSkillTag("forceWin", null, { card })) {
							return 13 * (event.small ? -1 : 1);
						}
						const number = get.number(card);
						return typeof number == "number" ? number * (event.small ? -1 : 1) : NaN;
					};
					if (source && source != player && player) {
						if (get.attitude(player, source) > 1) {
							if (event.small) {
								return getn(card) - get.value(card) / 3 + addi;
							}
							return -getn(card) - get.value(card) / 3 + addi;
						}
						if (event.small) {
							return -getn(card) - get.value(card) / 5 + addi;
						}
						return getn(card) - get.value(card) / 5 + addi;
					} else {
						if (event.small) {
							return -getn(card) - get.value(card) / 5 + addi;
						}
						return getn(card) - get.value(card) / 5 + addi;
					}
				};
			}
			next.setContent("chooseToCompareMultiple");
		} else {
			next.target = targetOrTargets;
			if (check) {
				next.ai = check;
			} else {
				next.ai = function (card) {
					const skillInfo = typeof card == "string" ? getRegisteredSkill(lib.skill, card) : undefined;
					if (skillInfo) {
						const ais =
							(skillInfo.check as (() => number) | undefined) ||
							function () {
								return 0;
							};
						return ais();
					}
					const player = get.owner(card);
					const currentEvent = _status.event;
					const event: (RuntimeGameEvent & { small?: boolean }) | GameEventParentFallback | undefined = currentEvent?.getParent();
					if (!event) {
						return NaN;
					}
					const getn = function (card) {
						if (player && player.hasSkillTag("forceWin", null, { card })) {
							return 13;
						}
						const number = get.number(card);
						return typeof number == "number" ? number : NaN;
					};
					const to = player == event.player ? event.target : event.player;
					let addi = get.value(card) >= 8 && get.type(card) != "equip" ? -6 : 0;
					const friend = player && to && to !== "cardPile" ? get.attitude(player, to) > 0 : false;
					if (card.name == "du") {
						addi -= 5;
					}
					if (player == event.player) {
						if (event.small) {
							return -getn(card) - get.value(card) / (friend ? 4 : 5) + addi;
						}
						return getn(card) - get.value(card) / (friend ? 4 : 5) + addi;
					} else {
						if (friend == Boolean(event.small)) {
							return getn(card) - get.value(card) / (friend ? 3 : 5) + addi;
						}
						return -getn(card) - get.value(card) / (friend ? 3 : 5) + addi;
					}
				};
			}
			next.setContent("chooseToCompare");
		}
		next.forceDie = true;
		next._args = [...arguments];
		return next;
	},
};
