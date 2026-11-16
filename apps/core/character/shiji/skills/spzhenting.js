import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "spzhenting" | "spjincui" | "spdifei" | "spyanjiao">} */
export const groupSkills = {
	//蒋琬
	spzhenting: {
		audio: 4,
		logAudio(_1, _2, _3, _4, costResult) {
			if (costResult?.cost_data == "all") {
				return ["spzhenting3.mp3", "spzhenting4.mp3"];
			}
			return 2;
		},
		trigger: { global: "useCardToTarget" },
		usable: 1,
		filter(event, player) {
			if (event.card.name != "sha" && get.type(event.card, null, false) != "delay") {
				return false;
			}
			return event.player != player && (event.target == player || player.inRange(event.target));
		},
		async cost(event, trigger, player) {
			let list = [
				["discard", `弃置${get.translation(trigger.player)}一张手牌`],
				["draw", "摸一张牌"],
				["all", "背水！代替其成为此牌目标"],
			];
			if (player.hasSkill("spjincui_delete")) {
				list = list.slice(0, 2);
			}
			const result = await player
				.chooseButton([get.prompt(event.skill, trigger.target), [list, "textbutton"]])
				.set("filterButton", button => {
					const user = get.event().getTrigger().player,
						player = get.player();
					return button.link != "discard" || user.countDiscardableCards(player, "h");
				})
				.set("ai", button => {
					const trigger = get.event().getTrigger(),
						player = get.player(),
						{ target, player: user, card } = trigger;
					let eff1 = get.effect(user, { name: "guohe_copy2" }, player, player),
						eff2 = get.effect(player, { name: "draw" }, player, player);
					if (button.link == "discard") {
						return eff1;
					}
					if (button.link == "draw") {
						return eff2;
					}
					const getV = current => get.effect(current, card, user, player);
					let eff = getV(player) - getV(target) + eff2;
					if (user.countDiscardableCards(player, "h")) {
						eff += eff1;
					}
					return eff;
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const { cost_data: link } = event,
				{ target, player: user } = trigger;
			if (link != "draw" && user.countDiscardableCards(player, "h")) {
				player.line(user, "fire");
				await player.discardPlayerCard(user, "h", true);
			}
			if (link != "discard") {
				await player.draw();
			}
			if (link != "all") {
				return;
			}
			const evt = trigger.getParent();
			if (evt.targets?.includes(player)) {
				return;
			}
			evt.triggeredTargets2.remove(target);
			evt.targets.remove(target);
			evt.triggeredTargets2.add(player);
			evt.targets.add(player);
			game.log(trigger.card, "的目标被改为了", player);
			trigger.untrigger();
		},
		ai: {
			threaten: 1.4,
		},
	},
	spjincui: {
		audio: 4,
		enable: "phaseUse",
		usable: 1,
		seatRelated: "changeSeat",
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		filterTarget: lib.filter.notMe,
		prompt() {
			const player = get.player();
			const num = player.hp - player.getAllHistory("useSkill", evt => evt.skill == "spzhenting").length;
			let str = "与一名其他角色交换座次";
			if (num > 0) {
				str = `${str}并失去${num}点体力`;
			}
			return str;
		},
		async content(event, trigger, player) {
			const { name, target } = event;
			player.awakenSkill(name);
			game.broadcastAll(
				function (target1, target2) {
					game.swapSeat(target1, target2);
				},
				player,
				target
			);
			const num = player.hp - player.getAllHistory("useSkill", evt => evt.skill == "spzhenting").length;
			if (num > 0) {
				await player.loseHp(num);
			}
			if (
				game.hasGlobalHistory("changeHp", evt => {
					if (evt.player != player || !evt.num) {
						return false;
					}
					return evt.getParent().name == "loseHp" && evt.getParent(2) == event;
				})
			) {
				return;
			}
			await player.gainMaxHp();
			player.addSkill("spjincui_delete");
		},
		ai: {
			order: 5,
			result: {
				player(player, target) {
					if (player.hasUnknown()) {
						return 0;
					}
					let num = 0,
						current = player.next;
					while (true) {
						num -= get.sgnAttitude(player, current);
						if (current == target) {
							break;
						}
						current = current.next;
					}
					while (true) {
						if (current == player) {
							break;
						}
						num += get.sgnAttitude(player, current) * 1.1;
						current = current.next;
					}
					const count = Math.max(0, player.hp - player.getAllHistory("useSkill", evt => evt.skill == "spzhenting").length);
					return num + 1 - count;
				},
			},
		},
		subSkill: {
			delete: {
				charlotte: true,
			},
		},
	},
	//张昌蒲
	spdifei: {
		audio: 2,
		trigger: { player: "damageEnd" },
		forced: true,
		usable: 1,
		content() {
			"step 0";
			var next = player.chooseToDiscard("h", "抵诽：弃置一张手牌或摸一张牌");
			if (trigger.card) {
				var suit = get.suit(trigger.card, false);
				if (lib.suit.includes(suit)) {
					next.set("suit", suit);
					next.set("prompt2", "然后若没有" + get.translation(suit) + "手牌则回复1点体力");
					next.set("ai", function (card) {
						var player = _status.event.player,
							suit = _status.event.suit;
						if (
							player.hasCard(function (cardx) {
								return cardx != card && get.suit(cardx) == suit;
							}, "h")
						) {
							return 0;
						}
						if (get.name(card) != "tao" && ((get.position(card) == "h" && get.suit(card) == suit) || player.hp == 1)) {
							return 8 - get.value(card);
						}
						return 5 - get.value(card);
					});
				} else {
					next.set("ai", function (card) {
						return -get.value(card);
					});
				}
			}
			"step 1";
			if (!result.bool) {
				player.draw();
			}
			"step 2";
			player.showHandcards();
			if (trigger.card) {
				var suit = get.suit(trigger.card, false);
				if (!lib.suit.includes(suit) || !player.countCards("h", { suit: suit })) {
					player.recover();
				}
			}
		},
	},
	spyanjiao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				const list = get.addNewRowList(player.getCards("h"), "suit", player);
				const dialog = ui.create.dialog();
				dialog.add([
					[[`###严教###<div class="text center">${get.translation("spyanjiao", "info")}</div>`], "addNewRow"],
					[
						dialog => {
							dialog.classList.add("fullheight");
							dialog.forcebutton = false;
							dialog._scrollset = false;
						},
						"handle",
					],
					list.map(item => [Array.isArray(item) ? item : [item], "addNewRow"]),
				]);
				return dialog;
			},
			filter(button, player) {
				return button.links.length;
			},
			check(button) {
				const player = get.player();
				let map = {},
					hs = player.getCards("h"),
					min = Infinity,
					min_suit = null;
				for (const card of hs) {
					const suit = get.suit(card, player);
					if (!map[suit]) {
						map[suit] = 0;
					}
					map[suit] += get.value(card);
				}
				for (let suit in map) {
					if (map[suit] < min) {
						min = map[suit];
						min_suit = suit;
					}
				}
				if (get.suit(button.links[0], player) == min_suit) return 1;
				return 0;
			},
			backup(links, player) {
				return {
					audio: "spyanjiao",
					filterCard: { suit: links[0] },
					selectCard: -1,
					position: "h",
					filterTarget: lib.filter.notMe,
					discard: false,
					lose: false,
					delay: false,
					async content(event, trigger, player) {
						const { cards, target } = event;
						player.addSkill("spyanjiao_draw");
						player.addMark("spyanjiao_draw", cards.length, false);
						await player.give(cards, target);
						await target.damage("nocard");
					},
					ai: {
						result: {
							target(player, target) {
								if (!ui.selected.cards.length) {
									return 0;
								}
								const val = get.value(ui.selected.cards, target);
								if (val < 0) {
									return val + get.damageEffect(target, player, target);
								}
								if (val > 5 || get.value(ui.selected.cards, player) > 5) {
									return 0;
								}
								return get.damageEffect(target, player, target);
							},
						},
					},
				};
			},
			prompt: () => "请选择【严教】的目标",
		},
		subSkill: {
			draw: {
				audio: "spyanjiao",
				charlotte: true,
				onremove: true,
				trigger: { player: "phaseBegin" },
				forced: true,
				async content(event, trigger, player) {
					const num = player.countMark(event.name);
					player.removeSkill(event.name);
					await player.draw(num);
				},
				mark: true,
				intro: { content: "下回合开始时摸#张牌" },
			},
			backup: { audio: "spyanjiao" },
		},
		ai: {
			order: 1,
			result: { player: 1 },
		},
	},
};
