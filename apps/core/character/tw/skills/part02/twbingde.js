import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twbingde" | "twqingtao" | "twjuntun" | "baonvezhi" | "baonvezhi_faq" | "twxiongjun" | "twxiongxi" | "twxiafeng">} */
export const groupSkills = {
	//邴原
	twbingde: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") && player.getStorage("twbingde_clear").length < 4;
		},
		onChooseToUse(event) {
			if (event.type == "phase" && !game.online) {
				const map = {};
				event.player.getHistory("useCard", evt => {
					const evtx = evt.getParent("phaseUse"),
						suit = get.suit(evt.card);
					if (!lib.suit.includes(suit)) {
						return;
					}
					if (evtx != event.getParent("phaseUse")) {
						return;
					}
					if (typeof map[suit] != "number") {
						map[suit] = 0;
					}
					map[suit]++;
				});
				event.set("twbingde_map", map);
			}
		},
		chooseButton: {
			dialog(event, player) {
				let str = get.translation("twbingde_info"),
					str2 = "";
				if (event.twbingde_map) {
					str2 = '<div class="text center">本回合使用牌对应花色数：</div>';
					str2 += '<div class="text center">';
					for (const suit of lib.suit) {
						str2 += get.translation(suit) + "：" + get.cnNumber(event.twbingde_map[suit] || 0) + "张；";
					}
					str2 = str2.slice(0, str2.length - 1) + "</div>";
				}
				return ui.create.dialog("###秉德###" + str, str2);
			},
			chooseControl(event, player) {
				const list = lib.suit.slice();
				list.removeArray(player.getStorage("twbingde_clear"));
				list.push("cancel2");
				return list;
			},
			check(event, player) {
				const map = event.twbingde_map;
				const suit = lib.suit
					.filter(suit => !player.getStorage("twbingde_clear").includes(suit) && player.hasCard(card => get.suit(card) == suit, "he"))
					.sort((a, b) => {
						return map[b] - map[a];
					})[0];
				if (map[suit] == 0) {
					return "cancel2";
				}
				return suit;
			},
			backup(result, player) {
				return {
					audio: "twbingde",
					filterCard: lib.filter.cardDiscardable,
					position: "he",
					suit: result.control,
					check(card) {
						const suit = lib.skill.twbingde_backup.suit;
						if (get.suit(card) == suit) {
							return 10 - get.value(card);
						}
						return 6 - get.value(card);
					},
					async content(event, trigger, player) {
						const { suit } = get.info(event.name);
						let num = 0;
						player.popup(suit + 2);
						game.log(player, "选择了", "#y" + suit + 2);
						player.addTempSkill("twbingde_clear", "phaseUseAfter");
						player.markAuto("twbingde_clear", [suit]);
						player.getHistory("useCard", evt => {
							var evtx = evt.getParent("phaseUse"),
								suitx = get.suit(evt.card);
							if (!evtx || evtx != event.getParent("phaseUse") || suit != suitx) {
								return false;
							}
							num++;
						});
						if (num > 0) {
							await player.draw(num);
						}
						if (get.suit(event.cards[0], player) == suit && player.getStat("skill").twbingde) {
							delete player.getStat("skill").twbingde;
							game.log(player, "重置了", "#g【秉德】");
						}
					},
					ai: { result: { player: 1 } },
				};
			},
			prompt: () => "秉德：弃置一张牌",
		},
		ai: {
			order: 2,
			result: { player: 1 },
		},
		subSkill: {
			backup: {},
			clear: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	twqingtao: {
		audio: 2,
		trigger: { player: ["phaseDrawEnd", "phaseJieshuBegin"] },
		filter(event, player) {
			if (!player.countCards("he")) {
				return false;
			}
			return event.name == "phaseDraw" || !player.hasHistory("custom", evt => evt.twqingtao);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), "he", lib.filter.cardRecastable)
				.set("ai", function (card) {
					if (card.name == "jiu" || get.type(card) != "basic") {
						return 10 - get.value(card);
					}
					return 6 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			await player.recast(cards);
			if (trigger.name == "phaseDraw") {
				player.getHistory("custom").push({ [event.name]: true });
			}
			if (get.name(cards[0]) == "jiu" || get.type(cards[0], false, player) != "basic") {
				await player.draw();
			}
		},
	},
	//牛董
	twjuntun: {
		audio: 2,
		trigger: {
			global: ["phaseBefore", "dieAfter"],
			player: "enterGame",
		},
		init(player) {
			lib.skill.baonvezhi.change(player, 0);
		},
		direct: true,
		derivation: ["twxiongjun", "baonvezhi_faq"],
		group: "twjuntun_extra",
		filter(event, player) {
			return (
				(event.name != "phase" || game.phaseNumber == 0) &&
				game.hasPlayer(current => {
					return !current.hasSkill("twxiongjun");
				})
			);
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("twjuntun"), "令一名角色获得〖凶军〗", (card, player, target) => {
					return !target.hasSkill("twxiongjun");
				})
				.set("ai", target => get.attitude(player, target) - 2);
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("twjuntun", target);
				target.addSkills("twxiongjun");
				if (target != player) {
					player.addExpose(0.25);
				}
			}
		},
		subSkill: {
			extra: {
				audio: 2,
				trigger: { global: "damageSource" },
				forced: true,
				locked: false,
				filter(event, player) {
					return event.source && event.source.hasSkill("twxiongjun") && event.source != player;
				},
				logTarget: "source",
				content() {
					lib.skill.baonvezhi.change(player, trigger.num);
				},
			},
		},
	},
	baonvezhi: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		silent: true,
		forced: true,
		charlotte: true,
		baonvezhi_max: 5,
		change(player, num) {
			var baonvezhi_max = lib.skill.baonvezhi.baonvezhi_max;
			player.addSkill("baonvezhi");
			var tmp = player.countMark("baonvezhi");
			if (tmp + num > baonvezhi_max) {
				num = baonvezhi_max - tmp;
			} else if (tmp + num < 0) {
				num = -tmp;
			}
			if (num === 0) {
				return;
			}
			player[num > 0 ? "addMark" : "removeMark"]("baonvezhi", Math.abs(num), false);
			game.log(player, num >= 0 ? "获得了" : "失去了", get.cnNumber(Math.abs(num)) + '点<span class="firetext">暴虐值</span>');
			player[player.countMark("baonvezhi") > 0 ? "markSkill" : "unmarkSkill"]("baonvezhi");
		},
		filter(event, player) {
			return player.countMark("baonvezhi") < lib.skill.baonvezhi.baonvezhi_max;
		},
		content() {
			lib.skill.baonvezhi.change(player, trigger.num);
		},
		marktext: "暴",
		intro: {
			name: "暴虐值",
			content(storage, player) {
				return get.translation(player) + "的暴虐值为" + (player.storage.baonvezhi || 0);
			},
		},
	},
	baonvezhi_faq: {},
	twxiongjun: {
		init(player) {
			lib.skill.baonvezhi.change(player, 0);
		},
		audio: 2,
		trigger: { source: "damageSource" },
		forced: true,
		usable: 1,
		content() {
			var targets = game.filterPlayer(current => current.hasSkill("twxiongjun")).sortBySeat();
			player.line(targets, "green");
			game.asyncDraw(targets);
		},
	},
	twxiongxi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		init(player) {
			lib.skill.baonvezhi.change(player, 0);
		},
		filterCard: () => true,
		selectCard() {
			return (lib.skill.baonvezhi.baonvezhi_max || 5) - _status.event.player.countMark("baonvezhi");
		},
		check(card) {
			return 8 - get.value(card);
		},
		position: "he",
		filterTarget(card, player, target) {
			return target != player;
		},
		content() {
			target.damage();
		},
		ai: {
			combo: "twjuntun",
			expose: 0.25,
			order: 1,
			result: {
				player(player, target) {
					let num = -ui.selected.cards.length;
					if (player.hasSkill("twxiongjun") && !player.storage.counttrigger?.twxiongjun) {
						num += game.countPlayer(current => {
							if (current.hasSkill("twxiongjun")) {
								return get.sgnAttitude(player, current);
							}
						});
					}
					return num * get.effect(player, { name: "draw" }, player, player);
				},
				target(player, target) {
					return get.damageEffect(target, player, target);
				},
			},
		},
	},
	twxiafeng: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countMark("baonvezhi") > 0;
		},
		init(player) {
			lib.skill.baonvezhi.change(player, 0);
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseButton(["黠凤：选择要消耗的暴虐值", [["tw_bn_1", "tw_bn_2", "tw_bn_3"], "vcard"]], button => {
					var num = player.countCards(
						"hs",
						card => get.tag(card, "damage") && game.hasPlayer(current => get.effect(current, card, player, player) > 0)
					);
					if (num <= 0) {
						return 0;
					}
					if (num >= 3) {
						num = 3;
					}
					if (button.link[2] == "tw_bn_" + num) {
						return 10;
					}
					return 1;
				})
				.set("filterButton", button => {
					var player = _status.event.player;
					var link = button.link[2];
					if (link[link.length - 1] * 1 > player.storage.baonvezhi) {
						return false;
					}
					return true;
				});
			"step 1";
			if (result.bool) {
				player.logSkill("twxiafeng");
				var link = result.links[0][2],
					num = link[link.length - 1] * 1;
				player.addTempSkill("twxiafeng_effect");
				player.storage.twxiafeng_effect = num;
				lib.skill.baonvezhi.change(player, -num);
			}
		},
		subSkill: {
			effect: {
				audio: "twxiafeng",
				trigger: { player: "useCard" },
				filter(event, player) {
					return !player.storage.twxiafeng_effect2;
				},
				forced: true,
				content() {
					var count = player.getHistory("useCard", evt => evt.getParent("phaseUse").player == player).length;
					if (count == player.storage.twxiafeng_effect) {
						player.storage.twxiafeng_effect2 = true;
					}
					if (count <= player.storage.twxiafeng_effect) {
						trigger.directHit.addArray(game.players);
						if (trigger.addCount !== false) {
							trigger.addCount = false;
							var stat = player.getStat().card,
								name = trigger.card.name;
							if (typeof stat[name] == "number") {
								stat[name]--;
							}
						}
					}
				},
				onremove(player) {
					delete player.storage.twxiafeng_effect;
					delete player.storage.twxiafeng_effect2;
				},
				mod: {
					targetInRange(card, player, target, now) {
						if (!player.storage.twxiafeng_effect2) {
							return true;
						}
					},
					cardUsableTarget(card, player, target) {
						if (!player.storage.twxiafeng_effect2) {
							return true;
						}
					},
					maxHandcard(player, num) {
						return num + (player.storage.twxiafeng_effect || 0);
					},
				},
			},
		},
		ai: {
			combo: "twjuntun",
		},
	},
};
