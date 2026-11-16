import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "wanwei" | "gzjili" | "xinshanjia" | "ol_shichou" | "dc_olshichou" | "ol_shichou2">} */
export const groupSkills = {
	//变权移植
	wanwei: {
		trigger: { target: ["rewriteGainResult", "rewriteDiscardResult"] },
		direct: true,
		preHidden: true,
		filter(event, player) {
			return event.player != player;
		},
		audio: 2,
		content() {
			"step 0";
			var prompt = "即将失去" + get.translation(trigger.result.cards) + "，是否发动【挽危】？";
			var next = player.choosePlayerCard(player, prompt, trigger.position);
			next.set("ai", function (button) {
				return 20 - get.value(button.link);
			});
			next.filterButton = trigger.filterButton;
			next.selectButton = trigger.result.cards.length;
			next.setHiddenSkill("wanwei");
			"step 1";
			if (result.bool) {
				player.logSkill("wanwei");
				trigger.result.cards = result.links.slice(0);
				trigger.result.links = result.links.slice(0);
				trigger.cards = result.links.slice(0);
				trigger.untrigger();
			}
		},
	},
	gzjili: {
		mod: {
			aiOrder(player, card, num) {
				if (player.isPhaseUsing() && get.subtype(card) == "equip1" && !get.cardtag(card, "gifts")) {
					var range0 = player.getAttackRange();
					var range = 0;
					var info = get.info(card);
					if (info && info.distance && info.distance.attackFrom) {
						range -= info.distance.attackFrom;
					}
					if (player.getEquip(1)) {
						var num = 0;
						var info = get.info(player.getEquip(1));
						if (info && info.distance && info.distance.attackFrom) {
							num -= info.distance.attackFrom;
						}
						range0 -= num;
					}
					range0 += range;
					if (
						range0 == player.getHistory("useCard").length + player.getHistory("respond").length + 2 &&
						player.countCards("h", function (cardx) {
							return get.subtype(cardx) != "equip1" && player.getUseValue(cardx) > 0;
						})
					) {
						return num + 10;
					}
				}
			},
		},
		trigger: { player: ["useCard", "respond"] },
		frequent: true,
		locked: false,
		preHidden: true,
		onremove(player) {
			player.removeTip("gzjili");
		},
		filter(event, player) {
			let count = player.getHistory("useCard").length + player.getHistory("respond").length;
			player.addTip("gzjili", "蒺藜 " + count, true);
			return count == player.getAttackRange();
		},
		audio: 2,
		content() {
			player.draw(player.getHistory("useCard").length + player.getHistory("respond").length);
		},
		ai: {
			threaten: 1.8,
			effect: {
				target_use(card, player, target, current) {
					let used = target.getHistory("useCard").length + target.getHistory("respond").length;
					if (get.subtype(card) == "equip1" && !get.cardtag(card, "gifts")) {
						if (player != target || !player.isPhaseUsing()) {
							return;
						}
						let range0 = player.getAttackRange();
						let range = 0;
						let info = get.info(card);
						if (info && info.distance && info.distance.attackFrom) {
							range -= info.distance.attackFrom;
						}
						if (player.getEquip(1)) {
							let num = 0;
							let info = get.info(player.getEquip(1));
							if (info && info.distance && info.distance.attackFrom) {
								num -= info.distance.attackFrom;
							}
							range0 -= num;
						}
						range0 += range;
						let delta = range0 - used;
						if (delta < 0) {
							return;
						}
						let num = player.countCards("h", function (card) {
							return (get.cardtag(card, "gifts") || get.subtype(card) != "equip1") && player.getUseValue(card) > 0;
						});
						if (delta == 2 && num > 0) {
							return [1, 3];
						}
						if (num >= delta) {
							return "zeroplayertarget";
						}
					} else if (get.tag(card, "respondShan") > 0) {
						if (current < 0 && used == target.getAttackRange() - 1) {
							if (card.name === "sha") {
								if (!target.mayHaveShan(player, "use")) {
									return;
								}
							} else if (!target.mayHaveShan(player)) {
								return 0.9;
							}
							return [1, (used + 1) / 2];
						}
					} else if (get.tag(card, "respondSha") > 0) {
						if (current < 0 && used == target.getAttackRange() - 1 && target.mayHaveSha(player)) {
							return [1, (used + 1) / 2];
						}
					}
				},
			},
		},
	},
	//新服曹笨
	xinshanjia: {
		init(player, skill) {
			player.addSkill("xinshanjia_count");
		},
		onremove(player, skill) {
			player.removeSkill("xinshanjia_count");
		},
		locked: false,
		mod: {
			aiValue(player, card, num) {
				if ((player.storage.xinshanjia || 0) < 3 && get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
					return num / player.hp;
				}
			},
		},
		audio: "shanjia",
		trigger: {
			player: "phaseUseBegin",
		},
		intro: {
			content: "本局游戏内已失去过#张装备牌",
		},
		frequent: true,
		sync(player) {
			var history = player.actionHistory;
			var num = 0;
			for (var i = 0; i < history.length; i++) {
				for (var j = 0; j < history[i].lose.length; j++) {
					if (history[i].lose[j].getParent().name == "useCard") {
						continue;
					}
					num += history[i].lose[j].cards2.filter(function (card) {
						return get.type(card) == "equip";
					}).length;
				}
			}
			player.storage.xinshanjia = num;
			if (num > 0) {
				player.markSkill("xinshanjia");
			}
		},
		async content(event, trigger, player) {
			await player.draw(3);
			lib.skill.xinshanjia.sync(player);
			const num = 3 - player.storage.xinshanjia;
			let result;
			if (num > 0) {
				result = await player.chooseToDiscard("he", true, num).set("ai", get.disvalue).forResult();
			}
			let bool1 = true,
				bool2 = true;
			if (result?.cards?.length) {
				const cards = result.cards;
				for (let i = 0; i < result.cards.length; i++) {
					var type = get.type(result.cards[i], "trick", result.cards[i].original == "h" ? player : false);
					if (type == "basic") {
						bool1 = false;
					}
					if (type == "trick") {
						bool2 = false;
					}
				}
			}
			if (bool1) {
				player.addTempSkill("xinshanjia_sha", "phaseChange");
			}
			if (bool2) {
				player.addTempSkill("xinshanjia_nodis", "phaseChange");
			}
			if (bool1 && bool2) {
				await player.chooseUseTarget({ name: "sha" }, "是否视为使用一张【杀】？", false);
			}
		},
		ai: {
			threaten: 3,
			noe: true,
			reverseOrder: true,
			skillTagFilter(player) {
				if (player.storage.xinshanjia > 2) {
					return false;
				}
			},
			effect: {
				target(card, player, target) {
					if (player.storage.xinshanjia < 3 && get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						return [1, 3];
					}
				},
			},
		},
		subSkill: {
			count: {
				forced: true,
				silent: true,
				popup: false,
				trigger: {
					player: "loseEnd",
				},
				filter(event, player) {
					return event.cards2 && event.cards2.length > 0;
				},
				content() {
					lib.skill.xinshanjia.sync(player);
				},
			},
			sha: {
				mark: true,
				charlotte: true,
				intro: { content: "使用【杀】的次数上限+1" },
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + 1;
						}
					},
				},
			},
			nodis: {
				mark: true,
				charlotte: true,
				intro: { content: "使用牌无距离限制" },
				mod: {
					targetInRange: () => true,
				},
			},
		},
	},
	//OL马超
	ol_shichou: {
		audio: 2,
		trigger: { player: "useCard2" },
		filter(event, player) {
			return event.card && event.card.name == "sha";
		},
		direct: true,
		content() {
			"step 0";
			var num = player.getDamagedHp() + 1;
			player
				.chooseTarget("是否发动【誓仇】？", "为" + get.translation(trigger.card) + "添加至多" + get.cnNumber(num) + "个目标", [1, num], function (card, player, target) {
					var evt = _status.event.getTrigger();
					return target != player && !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
				})
				.set("ai", function (target) {
					return get.effect(target, _status.event.getTrigger().card, _status.event.player);
				});
			"step 1";
			if (result.bool && result.targets && result.targets.length) {
				var targets = result.targets;
				player.logSkill("ol_shichou", targets);
				player.line(targets, trigger.card.nature);
				trigger.targets.addArray(targets);
			}
		},
	},
	dc_olshichou: {
		audio: "ol_shichou",
		trigger: { player: "useCard2" },
		filter(event, player) {
			return (
				event.card &&
				event.card.name == "sha" &&
				player.isDamaged() &&
				game.hasPlayer(function (current) {
					return !event.targets.includes(current) && lib.filter.filterTarget(event.card, player, current);
				})
			);
		},
		direct: true,
		content() {
			"step 0";
			var num = Math.min(
				player.getDamagedHp(),
				game.countPlayer(function (current) {
					return !trigger.targets.includes(current) && lib.filter.filterTarget(trigger.card, player, current);
				})
			);
			player.chooseTarget("是否发动【誓仇】，令至多" + get.cnNumber(num) + "名其他角色也成为此【杀】的目标？", [1, num], function (card, player, target) {
				var evt = _status.event.getTrigger();
				return target != player && !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
			}).ai = function (target) {
				return get.effect(target, { name: "sha" }, _status.event.player);
			};
			"step 1";
			if (result.bool && result.targets && result.targets.length) {
				var targets = result.targets;
				player.logSkill("dc_olshichou", targets);
				player.line(targets, trigger.card.nature);
				trigger.targets.addArray(targets);
				trigger.ol_shichou = true;
				player.addTempSkill("ol_shichou2");
			}
		},
	},
	ol_shichou2: {
		charlotte: true,
		trigger: { player: "useCardAfter" },
		sourceSkill: "ol_shichou",
		filter(event, player) {
			return (
				event.ol_shichou &&
				!player.getHistory("sourceDamage", function (evt) {
					return evt.card == event.card;
				}).length &&
				event.cards.filterInD().length > 0
			);
		},
		forced: true,
		popup: false,
		content() {
			player.gain(trigger.cards.filterInD(), "gain2");
		},
	},
};
