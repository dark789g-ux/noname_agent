import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshangyu" | "dccaixia">} */
export const groupSkills = {
	//新杀许靖
	dcshangyu: {
		audio: 2,
		init: () => {
			game.addGlobalSkill("dcshangyu_ai");
		},
		onremove: () => {
			if (!game.hasPlayer(i => i.hasSkill("dcshangyu", null, null, false), true)) {
				game.removeGlobalSkill("dcshangyu_ai");
			}
		},
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		content() {
			"step 0";
			var card = get.cardPile(card => get.name(card, false) == "sha");
			if (card) {
				event.card = card;
				player.gain(card, "gain2").gaintag.add("dcshangyu_tag");
				player.markAuto("dcshangyu", card);
			} else {
				player.chat("不是，连杀都没有？");
				event.finish();
			}
			"step 1";
			if (get.owner(card) == player && get.position(card) == "h" && game.hasPlayer(current => current != player)) {
				let targets = game
					.filterPlayer(
						i => {
							return get.attitude(player, i) > 0;
						},
						null,
						true
					)
					.sortBySeat(
						get.zhu(player) ||
							game.findPlayer(i => {
								return i.getSeatNum() === 1;
							})
					);
				if (targets.includes(player)) {
					targets = targets.slice(0, targets.indexOf(player));
				}
				player
					.chooseTarget(`是否将${get.translation(card)}交给一名其他角色？`, lib.filter.notMe)
					.set("ai", target => {
						let idx = _status.event.targets.indexOf(target);
						if (idx < 0) {
							return -1;
						}
						return 1 / (idx + 1);
					})
					.set("targets", targets);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target);
				if (get.mode() !== "identity" || player.identity !== "nei") {
					player.addExpose(0.2);
				}
				player.give(card, target).gaintag.add("dcshangyu_tag");
			}
			player.addSkill("dcshangyu_effect");
		},
		subSkill: {
			ai: {
				mod: {
					aiOrder(player, card, num) {
						if (
							get.itemtype(card) == "card" &&
							card.hasGaintag("dcshangyu_tag") &&
							game.hasPlayer(current => {
								return current.hasSkill("dcshangyu") && get.attitude(player, current) >= 0;
							})
						) {
							return num + 0.1;
						}
					},
					aiValue(player, card, num) {
						if (
							get.itemtype(card) == "card" &&
							card.hasGaintag("dcshangyu_tag") &&
							game.hasPlayer(current => {
								return current.hasSkill("dcshangyu") && get.attitude(player, current) >= 0;
							})
						) {
							return num / 10;
						}
					},
					aiUseful() {
						return lib.skill.dcshangyu_ai.mod.aiValue.apply(this, arguments);
					},
				},
				trigger: {
					player: "dieAfter",
				},
				filter: () => {
					return !game.hasPlayer(i => i.hasSkill("dcshangyu", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				forced: true,
				popup: false,
				content: () => {
					game.removeGlobalSkill("dcshangyu_ai");
				},
			},
			effect: {
				audio: "dcshangyu",
				trigger: {
					global: "damageSource",
				},
				filter(event, player) {
					return event.cards && event.cards.some(card => player.getStorage("dcshangyu").includes(card));
				},
				forced: true,
				charlotte: true,
				direct: true,
				group: ["dcshangyu_transfer", "dcshangyu_addTag"],
				content() {
					"step 0";
					var list = [player];
					if (trigger.source && trigger.source.isIn()) {
						player.logSkill("dcshangyu_effect", trigger.source);
						list.push(trigger.source);
					} else {
						player.logSkill("dcshangyu_effect");
					}
					list.sortBySeat();
					game.asyncDraw(list);
				},
			},
			transfer: {
				audio: "dcshangyu",
				trigger: {
					global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter", "equipAfter"],
				},
				forced: true,
				direct: true,
				filter(event, player) {
					if (
						!game.hasPlayer(current => {
							return !player.getStorage("dcshangyu_transfer").includes(current);
						})
					) {
						return false;
					}
					return event.getd().some(card => {
						return get.position(card) == "d" && player.getStorage("dcshangyu").includes(card);
					});
				},
				content() {
					"step 0";
					var cards = trigger.getd().filter(card => {
							return get.position(card) == "d" && player.getStorage("dcshangyu").includes(card);
						}),
						targets = game
							.filterPlayer(current => {
								return !player.getStorage("dcshangyu_transfer").includes(current);
							})
							.sortBySeat(_status.currentPhase);
					if (targets.length && targets[0] === _status.currentPhase && !_status.currentPhase?.getCardUsable("sha")) {
						targets.push(targets.shift());
					}
					event.cards = cards;
					player
						.chooseTarget(
							`赏誉：将${get.translation(cards)}交给一名可选角色`,
							(card, player, target) => {
								return !player.getStorage("dcshangyu_transfer").includes(target);
							},
							true
						)
						.set("ai", target => {
							let att = get.sgnAttitude(_status.event.player, target),
								idx = 1 + _status.event.targets.indexOf(target);
							if (att < 0) {
								return -idx;
							}
							return att + 1 / idx;
						})
						.set("targets", targets);
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						player.logSkill("dcshangyu_transfer", target);
						if (!player.storage.dcshangyu_transfer) {
							player.when({ global: "phaseAfter" }).step(async () => {
								player.unmarkSkill("dcshangyu_transfer");
								delete player.storage.dcshangyu_transfer;
							});
						}
						player.markAuto("dcshangyu_transfer", target);
						target.gain(cards, "gain2").set("giver", player).gaintag.add("dcshangyu_tag");
					}
				},
				intro: {
					content: "本回合已交给过$",
				},
			},
			addTag: {
				trigger: {
					global: ["gainAfter", "loseAsyncAfter"],
				},
				charlotte: true,
				popup: false,
				silent: true,
				lastDo: true,
				filter(event, player) {
					return game.hasPlayer(current => {
						var cards = event.getg(current);
						return cards.some(card => player.getStorage("dcshangyu").includes(card));
					});
				},
				content() {
					game.countPlayer(current => {
						var cards = trigger.getg(current);
						if (cards.length) {
							cards = cards.filter(card => player.getStorage("dcshangyu").includes(card));
							current.addGaintag(cards, "dcshangyu_tag");
						}
					});
				},
			},
		},
	},
	dccaixia: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player) {
			return !player.hasMark("dccaixia_clear");
		},
		direct: true,
		locked: false,
		content() {
			"step 0";
			var choices = Array.from({
				length: Math.min(5, game.players.length + game.dead.length),
			}).map((_, i) => get.cnNumber(i + 1, true));
			player
				.chooseControl(choices, "cancel2")
				.set("prompt", get.prompt("dccaixia"))
				.set("prompt2", "你可以摸至多" + get.cnNumber(choices.length) + "张牌，但是你此后需要再使用等量的牌才可再发动本技能。")
				.set("ai", () => {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						var cards = player.getCards("hs", card => get.name(card, player) !== "sha" && player.hasValueTarget(card));
						var damage = Math.min(player.getCardUsable({ name: "sha" }), player.countCards("hs", "sha")) + cards.filter(i => get.tag(i, "damage")).length;
						if (player.isPhaseUsing() || player.hp + player.hujia + player.countCards("hs", card => get.tag(card, "recover")) > 2) {
							if (damage) {
								return Math.min(choices.length - 1, cards.length - damage);
							}
							return Math.min(choices.length - 1, cards.length - 1);
						}
						return choices.length - 1;
					})()
				);
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("dccaixia");
				var num = result.index + 1;
				player.draw(num);
				player.addMark("dccaixia_clear", num, false);
				player.addSkill("dccaixia_clear");
			}
		},
		mod: {
			aiOrder(player, card, num) {
				if (!get.tag(card, "damage")) {
					return;
				}
				if (player.countMark("dccaixia_clear") > 1) {
					return num / 3;
				}
				return num + 6;
			},
		},
		subSkill: {
			clear: {
				trigger: { player: "useCard1" },
				filter(event, player) {
					return player.hasMark("dccaixia_clear");
				},
				forced: true,
				popup: false,
				charlotte: true,
				content() {
					player.removeMark("dccaixia_clear", 1, false);
				},
				intro: {
					name: "才瑕",
					name2: "瑕",
					content: "距离刷新技能还需使用&张牌",
				},
			},
		},
	},
};
