import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbmingshi" | "dcsbmengmou" | "dc_zj_a" | "dc_zj_b">} */
export const groupSkills = {
	//鲁肃
	dcsbmingshi: {
		audio: 2,
		audioname: ["dc_sb_lusu_shadow"],
		trigger: { player: "phaseDrawEnd" },
		frequent: true,
		async content(event, trigger, player) {
			await player.draw({ num: 2 });
			if (player.countCards("h") < 3 || !game.hasPlayer(current => player != current)) {
				return;
			}
			const result = await player
				.chooseCardTarget({
					prompt: "明势：请展示三张手牌并令一名其他角色选择获得其中的一张牌",
					filterTarget: lib.filter.notMe,
					filterCard: true,
					selectCard: 3,
					position: "h",
					forced: true,
					ai1(card) {
						return -get.value(card);
					},
					ai2(target) {
						const player = _status.event.player;
						if (player.hasSkill("dcsbmengmou") && !get.is.blocked("dcsbmengmou", player) && player.storage.dcsbmengmou && get.attitude(player, target) < 0) {
							return get.effect(target, { name: "losehp" }, player, player);
						}
						return get.attitude(player, target);
					},
				})
				.forResult();
			if (!result?.bool || !result.targets?.length) {
				return;
			}
			const target = result.targets[0];
			const cards = result.cards;
			await player.showCards(cards, get.translation(player) + "发动了【明势】");
			const result2 = await target
				.chooseButton(["明势：请获得其中一张牌", cards], true)
				.set("ai", button => get.value(button.link))
				.set("source", player)
				.forResult();
			if (result2?.bool) {
				const card = result2.links[0];
				if (lib.filter.canBeGained(card, player, target)) {
					await target.gain({ cards: [card], giver: player, animate: "giveAuto" });
				} else {
					game.log("但", card, "不能被", player, "获得！");
				}
			}
			if (!player.isMaxHandcard()) {
				await player.draw({ num: 2 });
			}
		},
	},
	dcsbmengmou: {
		mark: true,
		marktext: "☯",
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			player.changeSkin({ characterName: "dc_sb_lusu" }, "dc_sb_lusu" + (player.storage[skill] ? "_shadow" : ""));
		},
		intro: {
			content(storage) {
				if (!storage) {
					return "每回合限一次，当你得到其他角色的牌后，或其他角色得到你的牌后，你可以令该角色使用至多X张【杀】，且其每以此法造成1点伤害，你与其回复1点体力。（X为你的体力上限）";
				}
				return "每回合限一次，当你得到其他角色的牌后，或其他角色得到你的牌后，你可令该角色打出至多X张【杀】，然后其失去Y点体力。（X为你的体力上限，Y为X-其打出【杀】数）";
			},
		},
		audio: 2,
		audioname: ["dc_sb_lusu_shadow"],
		trigger: { global: ["gainAfter", "loseAsyncAfter"] },
		filter(event, player) {
			if (typeof player.maxHp != "number" || player.maxHp <= 0) {
				return false;
			}
			if (event.name == "loseAsync" && event.type != "gain") {
				return false;
			}
			if (player.getStorage("dcsbmengmou_used").includes(player.storage.dcsbmengmou ? "yin" : "yang")) {
				return false;
			}
			var cards1 = event.getl?.(player)?.cards2,
				cards2 = event.getg?.(player);
			return (
				game.hasPlayer(current => {
					if (current == player) {
						return false;
					}
					var cardsx = event.getg?.(current);
					return cardsx?.some(i => cards1?.includes(i));
				}) ||
				game.hasPlayer(current => {
					if (current == player) {
						return false;
					}
					var cardsx = event.getl?.(current)?.cards2;
					return cards2?.some(i => cardsx?.includes(i));
				})
			);
		},
		direct: true,
		async content(event, trigger, player) {
			var storage = player.storage.dcsbmengmou;
			player.addTempSkill("dcsbmengmou_effect", "dcsbmengmouAfter");
			var targets = [],
				num = player.maxHp;
			var cards1 = trigger.getl?.(player)?.cards2;
			var cards2 = trigger.getg?.(player);
			targets.addArray(
				game.filterPlayer(current => {
					if (current == player) {
						return false;
					}
					var cardsx = trigger.getg?.(current);
					return cardsx?.some(i => cards1?.includes(i));
				})
			);
			targets.addArray(
				game.filterPlayer(current => {
					if (current == player) {
						return false;
					}
					var cardsx = trigger.getl?.(current)?.cards2;
					return cards2?.some(i => cardsx?.includes(i));
				})
			);
			targets.sortBySeat();
			var check_true = (player, target) => {
				if (get.attitude(player, target) > 0) {
					if (
						target.countCards("hs", card => {
							if (get.name(card) != "sha") {
								return false;
							}
							return target.hasValueTarget(card);
						})
					) {
						return 4;
					}
					return 0.5;
				}
				if (get.attitude(player, target) < 0) {
					if (
						!target.countCards("hs", card => {
							if (get.name(card) != "sha") {
								return false;
							}
							return target.hasValueTarget(card);
						})
					) {
						if (
							target.countCards("hs", card => {
								if (get.name(card) != "sha") {
									return false;
								}
								return target.hasUseTarget(card);
							})
						) {
							return -3;
						}
						return -1;
					}
					return 0;
				}
				return 0;
			};
			var check_false = (player, target) => {
				if (get.attitude(player, target) < 0) {
					return get.effect(target, { name: "losehp" }, player, player);
				}
				return 0;
			};
			var result, target;
			if (targets.length == 1) {
				target = targets[0];
				var str;
				if (storage) {
					str = "令" + get.translation(target) + "打出至多" + get.cnNumber(num) + "张【杀】，然后其失去Y点体力。（Y为" + num + "-其打出【杀】数）";
				} else {
					str = "令" + get.translation(target) + "使用至多" + get.cnNumber(num) + "张【杀】，其每以此法造成1点伤害，你与其回复1点体力";
				}
				result = await player
					.chooseBool(get.prompt("dcsbmengmou", target), str)
					.set("choice", (storage ? check_false(player, target) : check_true(player, target)) > 0)
					.forResult();
			} else {
				result = await player
					.chooseTarget(get.prompt("dcsbmengmou"), lib.skill.dcsbmengmou.intro.content(storage), (card, player, target) => _status.event.targets.includes(target))
					.set("ai", target => {
						return _status.event.check(_status.event.player, target);
					})
					.set("targets", targets)
					.set("check", storage ? check_false : check_true)
					.set("ainmate", false)
					.forResult();
			}
			if (result.bool) {
				if (!target) {
					target = result.targets[0];
				}
				await player.logSkill("dcsbmengmou", target);
				player.addTempSkill("dcsbmengmou_used");
				player.markAuto("dcsbmengmou_used", [storage ? "yin" : "yang"]);
				player.changeZhuanhuanji("dcsbmengmou");
				while (num > 0) {
					num--;
					var result2;
					if (storage) {
						result2 = await target
							.chooseToRespond((card, player) => {
								return get.name(card) == "sha";
							})
							.set("ai", card => {
								return 1 + Math.random();
							})
							.set("prompt", "盟谋：是否打出一张【杀】？")
							.set("prompt2", "当前进度:" + (3 - num) + "/3")
							.forResult();
					} else {
						result2 = await target
							.chooseToUse(card => {
								if (!lib.filter.cardEnabled(card, _status.event.player, _status.event)) {
									return false;
								}
								return get.name(card) == "sha";
							})
							.set("prompt", "盟谋：是否使用一张【杀】？")
							.set("prompt2", "当前进度:" + (3 - num) + "/3")
							.forResult();
					}
					if (!result2.bool) {
						if (storage) {
							target.popup("杯具");
							await target.loseHp(num + 1);
						}
						break;
					}
				}
			}
		},
		group: "dcsbmengmou_change",
		subSkill: {
			effect: {
				charlotte: true,
				trigger: { global: "damageSource" },
				filter(event, player) {
					if (!event.source || event.getParent().type != "card") {
						return false;
					}
					if (event.source.isHealthy() || event.card.name != "sha") {
						return false;
					}
					return event.getParent(4).name == "dcsbmengmou" && event.getParent(4).player == player;
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					await player.recover(trigger.num);
					await trigger.source.recover(trigger.num);
				},
			},
			used: { charlotte: true, onremove: true },
			change: {
				audio: "dcsbmengmou",
				audioname: ["dc_sb_lusu_shadow"],
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				prompt2(event, player) {
					return "切换【盟谋】为状态" + (player.storage.dcsbmengmou ? "阳" : "阴");
				},
				check: () => Math.random() > 0.5,
				content() {
					player.changeZhuanhuanji("dcsbmengmou");
				},
			},
		},
	},
	//张臶
	dc_zj_a: {
		audio: 2,
		trigger: { player: "damageBegin2" },
		filter(event, player) {
			return event.card;
		},
		forced: true,
		async content(event, trigger, player) {
			var num = get.number(trigger.card);
			if (typeof num == "number" && num > 0) {
				trigger.num = num;
			} else {
				trigger.cancel();
			}
		},
		ai: {
			filterDamage: true,
			nodamage: true,
			nofire: true,
			nothunder: true,
			skillTagFilter(player, tag, arg) {
				if (!arg?.card) {
					return false;
				}
				if (tag === "filterDamage") {
					return true;
				}
				return typeof get.number(arg.card) !== "number";
			},
			effect: {
				target(card, player, target, current) {
					let cardx = card;
					if (card.name == "damage" || card.name?.endsWith("Damage")) {
						cardx = (function () {
							let count = 0;
							do {
								let evt = get.event().getParent(count, null, true);
								let name = evt?.skill || evt?.name;
								if (!name) {
									break;
								}
								if (name.startsWith("pre_")) {
									name = name.slice(4);
								}
								for (const suffix of ["_backup", "ContentBefore", "ContentAfter", "_cost"]) {
									if (name.endsWith(suffix)) {
										name = name.slice(0, name.lastIndexOf(suffix));
									}
								}
								if (!(name in lib.card) || !evt.card) {
									continue;
								}
								return evt.card;
							} while (++count < 5);
							return null;
						})();
					}
					if (!cardx) {
						return;
					} else if (get.is.damageCard(cardx) && typeof get.number(cardx) != "number") {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	dc_zj_b: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countDiscardableCards(player, "he");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2("dc_zj_b"), lib.filter.notMe)
				.set("ai", target => {
					var player = _status.event.player;
					if (!player.hasFriend()) {
						return 0;
					}
					return -game.countPlayer(current => current.inRange(target) && get.attitude(current, target) < 0 && get.damageEffect(target, current, current) > 0);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.discard(player.getDiscardableCards(player, "he"));
			player.addTempSkill("dc_zj_b_effect", { player: "phaseBegin" });
			await target.addAdditionalSkills("dc_zj_b_" + player.playerid, "dc_zj_a", true);
		},
		derivation: "dc_zj_a",
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player) {
					game.countPlayer(current => current.removeAdditionalSkills("dc_zj_b_" + player.playerid));
				},
			},
		},
	},
};
