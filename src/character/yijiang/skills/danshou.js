import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "danshou" | "qice" | "zhiyu" | "xuanfeng" | "jiangchi" | "jiangchi2" | "jiangchi3" | "xinzhan">} */
export const groupSkills = {
	danshou: {
		enable: "phaseUse",
		filterCard: true,
		position: "he",
		audio: 2,
		filter(event, player) {
			var num = player.getStat().skill.danshou;
			if (num) {
				num++;
			} else {
				num = 1;
			}
			return player.countCards("he") >= num;
		},
		check(card) {
			if (ui.selected.cards.length >= 2) {
				return 4 - get.value(card);
			}
			return 6 - get.value(card);
		},
		selectCard(card) {
			var num = _status.event.player.getStat().skill.danshou;
			if (num) {
				return num + 1;
			}
			return 1;
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			var num = player.getStat().skill.danshou;
			if (num) {
				num++;
			} else {
				num = 1;
			}
			if (num <= 2 && !target.countCards("he")) {
				return false;
			}
			return player.inRange(target);
		},
		async content(event, trigger, player) {
			const { target } = event;
			const num = player.getStat().skill.danshou;
			switch (num) {
				case 1:
					await player.discardPlayerCard({
						target,
						forced: true,
					});
					return;
				case 2: {
					const result = await target
						.chooseCard({
							prompt: "选择一张牌交给" + get.translation(player),
							position: "he",
							forced: true,
						})
						.forResult();
					if (result.cards) {
						await target.give(result.cards, player);
					}
					return;
				}
				case 3:
					await target.damage({
						nocard: true,
					});
					return;
				default:
					await game.asyncDraw([player, target], 2);
			}
		},
		ai: {
			order: 8.6,
			result: {
				target(player, target) {
					var num = player.getStat().skill.danshou;
					if (num) {
						num++;
					} else {
						num = 1;
					}
					if (num > 3) {
						return 0;
					}
					if (num == 3) {
						return get.damageEffect(target, player, target);
					}
					return -1;
				},
			},
		},
	},
	qice: {
		audio: 2,
		audioname: ["clan_xunyou", "pot_huanjie"],
		enable: "phaseUse",
		filter(event, player) {
			const hs = player.getCards("h");
			if (!hs.length) {
				return false;
			}
			if (
				hs.some(card => {
					const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					return mod2 === false;
				})
			) {
				return false;
			}
			return lib.inpile.some(name => {
				if (get.type(name) != "trick") {
					return false;
				}
				const card = get.autoViewAs({ name }, hs);
				return event.filterCard(card, player, event);
			});
		},
		usable: 1,
		chooseButton: {
			dialog(player) {
				var list = [];
				for (var i = 0; i < lib.inpile.length; i++) {
					if (get.type(lib.inpile[i]) == "trick") {
						list.push(["锦囊", "", lib.inpile[i]]);
					}
				}
				return ui.create.dialog(get.translation("qice"), [list, "vcard"]);
			},
			filter(button, player) {
				const event = _status.event.getParent(),
					card = get.autoViewAs(
						{
							name: button.link[2],
						},
						player.getCards("h")
					);
				return event.filterCard(card, player, event);
			},
			check(button) {
				var player = _status.event.player;
				var recover = 0,
					lose = 1,
					players = game.filterPlayer();
				for (var i = 0; i < players.length; i++) {
					if (players[i].hp == 1 && get.damageEffect(players[i], player, player) > 0 && !players[i].hasSha()) {
						return button.link[2] == "juedou" ? 2 : -1;
					}
					if (!players[i].isOut()) {
						if (players[i].hp < players[i].maxHp) {
							if (get.attitude(player, players[i]) > 0) {
								if (players[i].hp < 2) {
									lose--;
									recover += 0.5;
								}
								lose--;
								recover++;
							} else if (get.attitude(player, players[i]) < 0) {
								if (players[i].hp < 2) {
									lose++;
									recover -= 0.5;
								}
								lose++;
								recover--;
							}
						} else {
							if (get.attitude(player, players[i]) > 0) {
								lose--;
							} else if (get.attitude(player, players[i]) < 0) {
								lose++;
							}
						}
					}
				}
				if (lose > recover && lose > 0) {
					return button.link[2] == "nanman" ? 1 : -1;
				}
				if (lose < recover && recover > 0) {
					return button.link[2] == "taoyuan" ? 1 : -1;
				}
				return button.link[2] == "wuzhong" ? 1 : -1;
			},
			backup(links, player) {
				return {
					audio: "qice",
					audioname: ["clan_xunyou"],
					filterCard: true,
					selectCard: -1,
					position: "h",
					popname: true,
					viewAs: { name: links[0][2] },
				};
			},
			prompt(links, player) {
				return "将全部手牌当作" + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					var num = 0;
					var cards = player.getCards("h");
					if (cards.length >= 3 && player.hp >= 3) {
						return 0;
					}
					for (var i = 0; i < cards.length; i++) {
						num += Math.max(0, get.value(cards[i], player, "raw"));
					}
					num /= cards.length;
					num *= Math.min(cards.length, player.hp);
					return 12 - num;
				},
			},
			nokeep: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "nokeep") {
					return (!arg || (arg.card && get.name(arg.card) === "tao")) && player.isPhaseUsing() && !player.getStat("skill").qice && player.hasCard(card => get.name(card) != "tao", "h");
				}
			},
			threaten: 1.6,
		},
	},
	zhiyu: {
		audio: 2,
		audioname2: { sxrm_caocao: "zhiyu_sxrm_caocao" },
		trigger: { player: "damageEnd" },
		preHidden: true,
		async content(event, trigger, player) {
			await player.draw();
			if (!player.hasCard(() => true, "h")) {
				return;
			}
			await player.showHandcards();
			if (!trigger.source) {
				return;
			}
			const cards = player.getCards("h");
			const color = get.color(cards[0], player);
			for (const card of cards.slice(1)) {
				if (get.color(card, player) !== color) {
					return;
				}
			}
			await trigger.source.chooseToDiscard({ forced: true });
		},
		ai: {
			maixie_defend: true,
			threaten: 0.9,
		},
	},
	xuanfeng: {
		audio: 2,
		audioname: ["boss_lvbu3"],
		audioname2: {
			re_heqi: "fenwei_heqi",
		},
		trigger: {
			player: ["loseAfter", "phaseDiscardEnd"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (event.name == "phaseDiscard") {
				var cards = [];
				player.getHistory("lose", function (evt) {
					if (evt && evt.type == "discard" && evt.getParent("phaseDiscard") == event && evt.hs) {
						cards.addArray(evt.hs);
					}
				});
				return cards.length > 1;
			} else {
				var evt = event.getl(player);
				return evt && evt.es && evt.es.length > 0;
			}
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("xuanfeng"),
					filterTarget(event, player, target) {
						return player !== target && target.countDiscardableCards(player, "he") > 0;
					},
					ai(target) {
						const player = get.player();
						return -get.attitude(player, target);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target1 = event.targets[0];
			player.line(target1, "green");
			await player.discardPlayerCard({
				target: target1,
				position: "he",
				forced: true,
			});

			const result = await player
				.chooseTarget({
					prompt: "旋风：弃置一名其他角色的一张牌",
					filterTarget(event, player, target) {
						return player !== target && target.countDiscardableCards(player, "he") > 0;
					},
					ai(target) {
						const player = get.player();
						return -get.attitude(player, target);
					},
				})
				.forResult();
			if (!result.bool || !result.targets?.length) {
				return;
			}

			const target2 = result.targets[0];
			player.line(target2, "green");
			await player.discardPlayerCard({
				target: target2,
				position: "he",
				forced: true,
			});
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						return [1, 3];
					}
				},
			},
			reverseEquip: true,
			noe: true,
		},
	},
	jiangchi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		filter(event, player) {
			return !event.numFixed;
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseControl({
					controls: ["jiangchi_less", "jiangchi_more", "cancel2"],
					ai() {
						const player = get.player();
						if (player.countCards("h") > 3 && player.countCards("h", "sha") > 1) {
							return "jiangchi_less";
						}
						if (player.countCards("h", "sha") > 2) {
							return "jiangchi_less";
						}
						if (player.hp - player.countCards("h") > 1) {
							return "jiangchi_more";
						}
						return "cancel2";
					},
				})
				.forResult();

			event.result = {
				bool: result.control !== "cancel2",
				cost_data: {
					control: result.control,
				},
			};
		},
		async content(event, trigger, player) {
			const { control } = event.cost_data;
			if (control == "jiangchi_less") {
				trigger.num--;
				player.addTempSkill("jiangchi2", "phaseUseEnd");
			} else if (control == "jiangchi_more") {
				trigger.num++;
				player.addTempSkill("jiangchi3", "phaseUseEnd");
			}
		},
	},
	jiangchi2: {
		mod: {
			targetInRange(card, player, target, now) {
				if (card.name == "sha") {
					return true;
				}
			},
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + 1;
				}
			},
		},
	},
	jiangchi3: {
		mod: {
			cardEnabled2(card) {
				if (card.name == "sha") {
					return false;
				}
			},
		},
	},
	xinzhan: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("h") > player.maxHp;
		},
		usable: 1,
		async content(event, trigger, player) {
			const cards = get.cards(3);
			const result = await player
				.chooseCardButton({
					prompt: "选择获得的红桃牌",
					cards,
					filter(button) {
						return get.suit(button.link) === "heart";
					},
					select: [1, Infinity],
				})
				.forResult();
			if (result.bool) {
				await player.gain({
					cards: result.links,
					animate: "draw",
				});
				cards.removeArray(result.links);
			}
			for (const card of cards.slice(0).reverse()) {
				ui.cardPile.insertBefore(card, ui.cardPile.firstChild);
			}
		},
		ai: {
			order: 11,
			result: {
				player: 1,
			},
		},
	},
};
