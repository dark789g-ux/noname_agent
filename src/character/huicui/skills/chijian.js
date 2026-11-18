import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "chijian" | "shiwu" | "xinkuangfu">} */
export const groupSkills = {
	// 夏侯恩
	chijian: {
		audio: 2,
		locked: false,
		init(player, skill) {
			player.addExtraEquip(skill, "qinggang", true, player => player.hasEmptySlot(1) && !player.getVEquip(1) && lib.card.qinggang);
		},
		onremove(player, skill) {
			player.removeExtraEquip(skill);
		},
		mod: {
			cardUsable(card, player, num) {
				if (card.name === "sha" && player.isPhaseUsing()) return num + 1;
			},
		},
		group: "chijian_qinggang",
		subSkill: {
			qinggang: {
				mod: {
					attackRange(player, num) {
						if (player.hasEmptySlot(1) && !player.getVEquip(1)) return num + 1;
					},
				},
				audio: "chijian",
				inherit: "qinggang_skill",
				filter(event, player) {
					if (!player.hasEmptySlot(1) || player.getVEquip(1)) return false;
					return event.card.name == "sha";
				},
			},
		},
	},
	shiwu: {
		audio: 2,
		trigger: { global: "phaseBegin" },
		filter(event, player) {
			if (event.player === player) return false;
			const juedou = new lib.element.VCard({ name: "juedou", isCard: true });
			return player.canUse(juedou, event.player);
		},
		prompt2(event, player) {
			return `视为对${get.translation(event.player)}使用【决斗】，失败则本回合抢走你的剑`;
		},
		check(event, player) {
			const juedou = new lib.element.VCard({ name: "juedou", isCard: true });
			return get.effect(event.player, juedou, player, player) > 0 && get.attitude(player, event.player) <= 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player;
			const next = player.useCard({
				card: new lib.element.VCard({ name: "juedou", isCard: true }),
				targets: [target],
			});
			await next;
			const damagedEvents = game.getAllGlobalHistory("everything", evt => evt.name === "damage" && evt.card === next.card);
			if (damagedEvents.some(evt => evt.source === player && evt.player === target)) {
				const card = get.cardPile(card => get.is.damageCard(card), "bottom");
				if (card) await player.gain(card, "gain2");
			}
			if (damagedEvents.some(evt => evt.source === target && evt.player === player)) {
				await target.addTempSkills("chijian");
				await player.removeSkills("chijian");
				player
					.when({ global: "phaseEnd" })
					.filter(evt => trigger.getParent("phase", true, true) === evt)
					.step(async (event2, trigger2, player2) => {
						await player.addSkills("chijian");
					});
			}
		},
		group: "shiwu_lose",
		subSkill: {
			lose: {
				audio: "shiwu",
				trigger: { player: "dieAfter" },
				filter(event, player) {
					return event.source?.isIn();
				},
				forced: true,
				locked: false,
				forceDie: true,
				async content(event, trigger, player) {
					await trigger.source.addSkills("chijian");
				},
			},
		},
	},
	//新潘凤
	xinkuangfu: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		delay: false,
		filterTarget(card, player, target) {
			if (player == target) {
				return (
					player.countCards("e", function (card) {
						return lib.filter.cardDiscardable(card, player);
					}) > 0
				);
			}
			return target.countDiscardableCards(player, "e") > 0;
		},
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countCards("e") > 0;
			});
		},
		useShaValue(player) {
			let cache = _status.event.getTempCache("xinkuangfu", "useShaValue");
			if (cache) {
				return cache;
			}
			let eff = -Infinity,
				odds = 0,
				tar = null;
			game.countPlayer(cur => {
				if (!player.canUse("sha", cur, false)) {
					return;
				}
				let eff2 = get.effect(cur, { name: "sha" }, player, player);
				if (eff2 < eff) {
					return;
				}
				let directHit = 1 - cur.mayHaveShan(player, "use", true, "odds");
				if (get.attitude(player, cur) > 0) {
					directHit = 1;
				} else {
					eff2 *= directHit;
				}
				if (eff2 <= eff) {
					return;
				}
				tar = cur;
				eff = eff2;
				odds = directHit;
			});
			_status.event.putTempCache("xinkuangfu", "useShaValue", {
				tar,
				eff,
				odds,
			});
			return { tar, eff, odds };
		},
		async content(event, trigger, player) {
			const target = event.target;
			if (player == target) {
				await player.chooseToDiscard("e", true);
			} else {
				await player.discardPlayerCard(target, "e", true);
			}
			await player.chooseUseTarget("sha", true, false, "nodistance");
			const bool = game.hasPlayer2(current => {
				return current.getHistory("damage", evt => evt.getParent("xinkuangfu") == event).length > 0;
			});
			if (player == target && bool) {
				await player.draw(2);
			} else if (player != target && !bool) {
				await player.chooseToDiscard("h", 2, true);
			}
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) - 0.3;
			},
			result: {
				player(player, target) {
					let cache = lib.skill.xinkuangfu.useShaValue(player),
						eff = cache.eff / 10;
					if (player === target) {
						return 2 * cache.odds + eff;
					}
					return Math.min(2, player.countCards("h")) * (cache.odds - 1) + eff;
				},
				target(player, target) {
					let att = get.attitude(player, target),
						max = 0,
						min = 1;
					target.countCards("e", function (card) {
						var val = get.value(card, target);
						if (val > max) {
							max = val;
						}
						if (val < min) {
							min = val;
						}
					});
					if (att <= 0) {
						if (target.hasSkillTag("noe")) {
							return 2 - max / 3;
						}
						if (min <= 0) {
							return 1;
						}
						return -max / 3;
					}
					if (target.hasSkillTag("noe")) {
						return 2 - min / 4;
					}
					if (min <= 0) {
						return 1;
					}
					if (player === target) {
						let cache = lib.skill.xinkuangfu.useShaValue(player);
						return cache.eff / 10 - 1;
					}
					return 0;
				},
			},
		},
	},
};
