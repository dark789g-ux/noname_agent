import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zlhuji" | "zlshoufu" | "zlshoufu2" | "yinka" | "xinlianji" | "xinmoucheng" | "xinjingong">} */
export const groupSkills = {
	//张道陵
	zlhuji: {
		mod: {
			globalFrom(player, target, distance) {
				return distance - 1;
			},
		},
		audio: 2,
		trigger: { player: "damageEnd" },
		forced: true,
		filter(event, player) {
			return player != _status.currentPhase;
		},
		content() {
			"step 0";
			var func = function (result) {
				if (get.color(result) == "red") {
					return 1;
				}
				return 0;
			};
			if (get.itemtype(trigger.source) != "player" || !player.canUse("sha", trigger.source, false)) {
				func = function (result) {
					return 0;
				};
			} else if (get.effect(trigger.source, { name: "sha" }, player, player) < 0) {
				func = function (result) {
					if (get.color(result) == "red") {
						return -1;
					}
					return 0;
				};
			}
			player.judge(func).judge2 = function (result) {
				return result.color == "red" ? true : false;
			};
			"step 1";
			if (result.color == "red" && get.itemtype(trigger.source) == "player" && player.canUse("sha", trigger.source, false)) {
				player.useCard({ name: "sha", isCard: true }, trigger.source, false, "noai");
			}
		},
	},
	zlshoufu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		delay: false,
		content() {
			"step 0";
			player.draw();
			"step 1";
			var filterTarget = function (card, player, target) {
				return target != player && !target.hasSkill("zlshoufu2");
			};
			if (
				!player.countCards("h") ||
				!game.hasPlayer(function (current) {
					return filterTarget(null, player, current);
				})
			) {
				event.finish();
			} else {
				player.chooseCardTarget({
					forced: true,
					prompt: "将一张手牌作为“箓”置于其他角色的武将牌上",
					filterTarget: filterTarget,
					filterCard: true,
					position: "h",
					ai1(card) {
						if (get.type2(card, false) == "equip") {
							return 1 - get.value(card);
						}
						return 7 - get.value(card);
					},
					ai2(target) {
						var player = _status.event.player;
						var att = get.attitude(player, target);
						if (att > 0) {
							return -att;
						}
						return -att / get.distance(player, target, "absolute");
					},
				});
			}
			"step 2";
			var target = result.targets[0];
			var cards = result.cards;
			target.addToExpansion(cards, player, "give").gaintag.add("zlshoufu2");
			player.line(target, "green");
			if (get.mode() !== "identity" || player.identity !== "nei") {
				player.addExpose(0.12);
			}
			target.addSkill("zlshoufu2");
			"step 3";
			game.delayx();
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					if (
						game.hasPlayer(function (target) {
							return target != player && !target.hasSkill("zlshoufu2") && get.attitude(player, target) < 0;
						}) ||
						!game.hasPlayer(function (target) {
							return target != player && !target.hasSkill("zlshoufu2") && get.attitude(player, target) > 0;
						})
					) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	zlshoufu2: {
		marktext: "箓",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		charlotte: true,
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		mod: {
			cardEnabled(card, player) {
				if (
					player.getExpansions("zlshoufu2").filter(function (magic) {
						return get.type2(magic) == get.type2(card);
					}).length
				) {
					return false;
				}
			},
			cardRespondable(card, player) {
				if (
					player.getExpansions("zlshoufu2").filter(function (magic) {
						return get.type2(magic) == get.type2(card);
					}).length
				) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (
					player.getExpansions("zlshoufu2").filter(function (magic) {
						return get.type2(magic) == get.type2(card);
					}).length
				) {
					return false;
				}
			},
		},
		trigger: {
			player: ["damageEnd", "loseAfter"],
			global: "loseAsyncAfter",
		},
		forced: true,
		sourceSkill: "zlshoufu",
		filter(event, player) {
			var storage = player.getExpansions("zlshoufu2");
			if (!storage.length) {
				return false;
			}
			if (event.name == "damage") {
				return true;
			}
			if (event.type != "discard" || event.getlx === false || event.getParent("phaseDiscard").player != player) {
				return false;
			}
			var num = 0,
				evt = event.getl(player);
			if (!evt || !evt.cards2) {
				return false;
			}
			for (var i of evt.cards2) {
				if (
					storage.filter(function (magic) {
						return get.type2(magic) == get.type2(i, event.hs.includes(i) ? player : false);
					}).length
				) {
					num++;
				}
			}
			return num > 1;
		},
		content() {
			player.removeSkill("zlshoufu2");
		},
	},
	//蔡阳
	yinka: {
		trigger: { player: ["drawBegin", "judgeBegin"] },
		direct: true,
		filter() {
			return ui.cardPile.childNodes.length > 0;
		},
		content() {
			"step 0";
			player.chooseButton(["印卡：请选择要置于牌堆" + (trigger.bottom ? "底" : "顶") + "的牌（先选择的在上）", Array.from(ui.cardPile.childNodes)], [1, trigger.num || 1]);
			"step 1";
			if (result.bool) {
				while (result.links.length) {
					if (trigger.bottom) {
						var card = result.links.shift();
						ui.cardPile.removeChild(card);
						ui.cardPile.appendChild(card);
					} else {
						var card = result.links.pop();
						ui.cardPile.removeChild(card);
						ui.cardPile.insertBefore(card, ui.cardPile.firstChild);
					}
				}
			}
		},
		ai: { isLuckyStar: true },
	},
	//新王允
	xinlianji: {
		enable: "phaseUse",
		audio: "wylianji",
		usable: 1,
		check(card) {
			return 5 - get.value(card);
		},
		filterTarget(card, player, target) {
			if (ui.selected.targets.length) {
				return true;
			}
			return target != player;
		},
		filterCard: true,
		selectTarget: 2,
		multitarget: true,
		targetprompt: ["打人", "被打"],
		content() {
			"step 0";
			//player.addMark('xinlianji',1,false);
			var card = get.cardPile2(function (card) {
				return get.subtype(card) == "equip1" && targets[0].hasUseTarget(card);
			}, "random");
			if (card) {
				if (card.name == "qinggang" && !lib.inpile.includes("qibaodao")) {
					card.remove();
					card = game.createCard("qibaodao", card.suit, card.number);
				}
				targets[0].chooseUseTarget(card, true, "nopopup", "nothrow");
			} else {
				player.chat("没有装备牌了吗");
				game.log("但是牌堆里已经没有装备牌了！");
			}
			"step 1";
			game.updateRoundNumber();
			targets[0]
				.chooseToUse("对" + get.translation(targets[1]) + "使用一张杀，或将装备区里的武器牌交给一名其他角色", { name: "sha" })
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("complexTarget", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.filterTarget.apply(this, arguments);
				})
				.set("sourcex", targets[1])
				.set("addCount", false);
			"step 2";
			var cards = targets[0].getEquips(1);
			if (!result.bool && cards.length) {
				event.cards = cards;
				player.chooseTarget(true, "将" + get.translation(cards) + "交给一名其他角色").set("ai", function (target) {
					var card = _status.event.getParent().cards;
					return (target.hasSkillTag("nogain") ? 0 : get.attitude(_status.event.player, target)) * Math.max(0.1, target.getUseValue(cards[0]));
				});
			} else {
				event.finish();
			}
			"step 3";
			result.targets[0].gain(cards, result.targets[0], "give").giver = player;
		},
		ai: {
			order: 4,
			result: {
				target(player, target) {
					if (ui.selected.targets.length) {
						var pretarget = ui.selected.targets[0];
						if (pretarget.hasSha() && pretarget.canUse({ name: "sha" }, target)) {
							return get.effect(target, { name: "sha" }, pretarget, target);
						}
						return Math.random();
					}
					if (!target.getEquip(1)) {
						if (
							game.hasPlayer(function (current) {
								return current != target && !current.hasSkillTag("nogain") && get.attitude(current, target) > 0;
							})
						) {
							return 3;
						}
						return -3;
					}
					if (
						!game.hasPlayer(function (current) {
							return current != target && !current.hasSkillTag("nogain") && get.attitude(current, target) > 0;
						})
					) {
						return -6;
					}
					return 4 - get.value(target.getEquip(1));
				},
			},
		},
	},
	xinmoucheng: {
		trigger: { player: "phaseZhunbeiBegin" },
		audio: "moucheng",
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		derivation: "xinjingong",
		filter(event, player) {
			return game.hasPlayer2(function (current) {
				return (
					current.getAllHistory("sourceDamage", function (evt) {
						if (!evt.card || evt.card.name != "sha" || evt.getParent().type != "card") {
							return false;
						}
						var evt2 = evt.getParent(4);
						return evt2 && evt2.name == "xinlianji" && evt2.player == player;
					}).length > 0
				);
			});
		},
		content() {
			player.awakenSkill(event.name);
			player.changeSkills(["xinjingong"], ["xinlianji"]);
		},
		ai: { combo: "xinlianji" },
	},
	xinjingong: {
		audio: "jingong",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				event.xinjingong_list &&
				player.countCards("hes", function (card) {
					return card.name == "sha" || get.type(card) == "equip";
				})
			);
		},
		onChooseToUse(event) {
			if (!game.online) {
				var evt = event.getParent();
				if (evt.name != "phaseUse") {
					return;
				}
				if (!evt.xinjingong_list) {
					var list = get.inpile("trick").randomGets(2);
					if (Math.random() < 0.5) {
						list.push("wy_meirenji");
					} else {
						list.push("wy_xiaolicangdao");
					}
					evt.xinjingong_list = list;
				}
				if (!event.xinjingong_list) {
					event.set("xinjingong_list", evt.xinjingong_list);
				}
			}
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i of event.xinjingong_list) {
					list.push(["锦囊", "", i]);
				}
				return ui.create.dialog("矜功", [list, "vcard"]);
			},
			filter(button, player) {
				return lib.filter.filterCard({ name: button.link[2] }, player, _status.event.getParent());
			},
			check(button) {
				return _status.event.player.getUseValue({ name: button.link[2] });
			},
			backup(links, player) {
				return {
					audio: "jingong",
					popname: true,
					position: "hes",
					viewAs: { name: links[0][2] },
					check(card) {
						return 6 - get.value(card);
					},
					filterCard(card) {
						return card.name == "sha" || get.type(card) == "equip";
					},
				};
			},
			prompt(links, player) {
				return "将一张【杀】或装备牌当做" + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order: 2,
			result: {
				player: 1,
			},
		},
	},
};
