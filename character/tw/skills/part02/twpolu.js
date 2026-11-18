import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twpolu" | "twqiushou" | "twzhuiting" | "twniju" | "twchongwang">} */
export const groupSkills = {
	//孙坚
	twpolu: {
		audio: "repolu",
		trigger: { global: ["dieAfter", "die"] },
		forceDie: true,
		zhuSkill: true,
		filter(event, player, name) {
			if (!player.hasZhuSkill("twpolu")) {
				return false;
			}
			if (event.player != player && player.isDead()) {
				return false;
			}
			if (name == "dieAfter" && event.source && event.source.group == "wu") {
				return true;
			}
			if (name == "die" && event.player.group == "wu") {
				return true;
			}
			return false;
		},
		async cost(event, trigger, player) {
			const num = player.getAllHistory("useSkill", evt => evt.skill == event.skill).length + 1;
			event.result = await player
				.chooseTarget([1, Infinity], get.prompt(event.skill), `令任意名角色摸${get.cnNumber(num)}张牌`)
				.set("forceDie", true)
				.set("ai", target => {
					const player = get.player();
					return get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const num = player.getAllHistory("useSkill", evt => evt.skill == event.name).length;
			await game.asyncDraw(event.targets.sortBySeat(), num);
			await game.delay();
		},
	},
	//孟获
	twqiushou: {
		trigger: { global: "useCardAfter" },
		filter(event, player) {
			if (event.card.name != "nanman") {
				return false;
			}
			var num = 0,
				bool = false;
			for (var i of event.targets) {
				if (!i.isAlive()) {
					bool = true;
				}
				i.getHistory("damage", function (evt) {
					if (evt.getParent(2) == event) {
						num += evt.num;
					}
				});
			}
			return player.hasZhuSkill("twqiushou") && (bool || num > 3);
		},
		zhuSkill: true,
		forced: true,
		logTarget(event, player) {
			return game.filterPlayer(function (target) {
				return ["shu", "qun"].includes(target.group);
			});
		},
		content() {
			"step 0";
			game.asyncDraw(lib.skill.twqiushou.logTarget(trigger.player));
			"step 1";
			game.delayx();
		},
	},
	//刘协
	twzhuiting: {
		zhuSkill: true,
		audio: 2,
		global: "twzhuiting_global",
		subSkill: {
			global: {
				hiddenWuxie(player, info) {
					if (player.group != "wei" && player.group != "qun") {
						return false;
					}
					const target = info.target,
						card = info.card;
					if (!target || target == player || !target.hasZhuSkill("twzhuiting")) {
						return false;
					}
					if (_status.connectMode && player.countCards("hs") > 0) {
						return true;
					}
					const color = get.color(card, false);
					if (color == "none") {
						return false;
					}
					return player.hasCard(card => get.color(card) == color, "hes");
				},
				audio: "twzhuiting",
				forceaudio: true,
				enable: "chooseToUse",
				filter(event, player) {
					if (event.type != "wuxie" || (player.group != "wei" && player.group != "qun")) {
						return false;
					}
					const info = event.info_map,
						target = info.target,
						card = info.card;
					if (!target || target == player || !target.hasZhuSkill("twzhuiting")) {
						return false;
					}
					const color = get.color(card, false);
					if (color == "none") {
						return false;
					}
					return player.hasCard(card => get.color(card) == color, "hes");
				},
				filterCard(card) {
					const info = _status.event.info_map;
					return info && get.color(card) == get.color(info.card, false);
				},
				viewAs: { name: "wuxie" },
				position: "hes",
				prompt() {
					const info = _status.event.info_map;
					return "将一张" + get.translation(get.color(info.card)) + "牌当作【无懈可击】对" + get.translation(info.target) + "使用";
				},
				check(card) {
					return 8 - get.value(card);
				},
			},
		},
	},
	//刘繇
	twniju: {
		audio: 2,
		zhuSkill: true,
		trigger: {
			global: "compare",
		},
		priority: 1,
		filter(event, player) {
			if (!player.hasZhuSkill("twniju")) {
				return false;
			}
			if (event.iwhile || (event.target && event.compareMeanwhile)) {
				return false;
			}
			const participant = [event.player];
			if (event.targets) {
				participant.addArray(event.targets);
			} else {
				participant.add(event.target);
			}
			return participant.includes(player);
		},
		direct: true,
		async content(event, trigger, player) {
			const num = game.countPlayer(current => current.group === "qun");
			const dialog = [
				get.prompt("twniju"),
				`<div class="text center">令一张拼点牌的点数+${num}或-${num}</div>`,
				[
					[
						["add", "增加"],
						["subtract", "减少"],
					],
					"tdnodes",
				],
			];
			const lose_list = trigger.lose_list.slice().sort((a, b) => lib.sort.seat(a[0], b[0]));
			dialog.push(
				`<div class="text center">${lose_list
					.map(list => {
						return get.translation(list[0]);
					})
					.join("　 / 　")}</div>`
			);
			const cards = lose_list.map(list => list[1]).flat();
			dialog.push(cards);
			const result = await player
				.chooseButton(dialog, 2)
				.set("filterButton", button => {
					const type = typeof button.link;
					if (ui.selected.buttons.length && type === typeof ui.selected.buttons[0].link) {
						return false;
					}
					return true;
				})
				.forResult();
			if (!result.bool) {
				return;
			}
			const { links } = result;
			if (typeof links[0] !== "string") {
				links.reverse();
			}
			let [fn, card] = links;
			const selectedPlayer = lose_list.find(item => {
				if (Array.isArray(item[1])) {
					return item[1].includes(card);
				}
				return item[1] == card;
			})[0];
			player.logSkill("twniju", selectedPlayer);
			selectedPlayer.addTempSkill("twniju_change");
			if (!selectedPlayer.storage.twniju_change) {
				selectedPlayer.storage.twniju_change = [];
			}
			selectedPlayer.storage.twniju_change.push([fn, num, card]);
			player
				.when("chooseToCompareAfter")
				.filter(evt => evt === trigger)
				.step(async (event, trigger, player) => {
					const num1 = trigger.result.num1,
						num2 = trigger.result.num2;
					let bool = false;
					if (typeof num1 === "number" && typeof num2 === "number") {
						if (num1 === num2) {
							bool = true;
						}
					} else {
						const num1List = num1.toUniqued();
						const totalList = num1List.concat(num2).toUniqued();
						if (totalList.length < num1List.length + num2.length) {
							bool = true;
						}
					}
					if (bool) {
						await player.draw(num);
					}
				});
		},
		subSkill: {
			change: {
				trigger: { global: "compare" },
				filter(event, player) {
					const storage = player.getStorage("twniju_change");
					if (!storage.length) {
						return false;
					}
					if ((player !== event.player || event.iwhile) && player !== event.target) {
						return false;
					}
					return event.lose_list.some(list => {
						const cards = Array.isArray(list[1]) ? list[1] : [list[1]];
						return list[0] === player && storage.some(s => cards.includes(s[2]));
					});
				},
				charlotte: true,
				forced: true,
				silent: true,
				async content(event, trigger, player) {
					const [fn, num] = player.getStorage("twniju_change").find(s => {
						return trigger.lose_list.some(list => {
							const cards = Array.isArray(list[1]) ? list[1] : [list[1]];
							return list[0] === player && cards.includes(s[2]);
						});
					});
					const numId = player === trigger.player ? "num1" : "num2";
					if (fn === "add") {
						trigger[numId] += num;
					} else {
						trigger[numId] -= num;
					}
					if (trigger[numId] > 13) {
						trigger[numId] = 13;
					} else if (trigger[numId] < 1) {
						trigger[numId] = 1;
					}
					game.log(player, "的拼点牌点数", fn === "add" ? "+" : "-", num);
				},
			},
		},
	},
	//刘虞
	twchongwang: {
		init(player) {
			player.storage.twchongwang = [];
			player.storage.twchongwangx = [];
		},
		mod: {
			playerEnabled(card, player, target) {
				if (!player.hasZhuSkill("twchongwang")) {
					return;
				}
				if (get.tag(card, "damage") > 0 && player.storage.twchongwangx.includes(target)) {
					return false;
				}
			},
			targetEnabled(card, player, target) {
				if (!target.hasZhuSkill("twchongwang")) {
					return;
				}
				if (get.tag(card, "damage") > 0 && target.storage.twchongwangx.includes(player)) {
					return false;
				}
			},
		},
		locked: false,
		onremove: true,
		global: "twchongwang_global",
		group: "twchongwang_clear",
		audio: 2,
		zhuSkill: true,
		subSkill: {
			clear: {
				charlotte: true,
				trigger: { player: "phaseAfter" },
				direct: true,
				content() {
					player.storage.twchongwangx = [];
				},
			},
			global: {
				trigger: { player: "phaseUseBegin" },
				filter(event, player) {
					return (
						player.group == "qun" &&
						game.hasPlayer(function (current) {
							return current != player && current.hasZhuSkill("twchongwang", player) && !current.storage.twchongwang.includes(player);
						})
					);
				},
				direct: true,
				content() {
					"step 0";
					player.chooseCardTarget({
						prompt: "崇望：是否将一张牌交给主公并获得双重庇护？",
						selectCard: 1,
						filterCard: true,
						filterTarget(card, player, target) {
							return target != player && target.hasZhuSkill("twchongwang", player) && !target.storage.twchongwang.includes(player);
						},
						position: "he",
						ai1(card) {
							if (card.name == "du") {
								return 10;
							} else if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
								return 0;
							}
							var player = _status.event.player;
							if (
								ui.selected.cards.length > 4 ||
								!game.hasPlayer(function (current) {
									return get.attitude(player, current) > 0 && !current.hasSkillTag("nogain");
								})
							) {
								return 0;
							}
							return 1 / Math.max(0.1, get.value(card));
						},
						ai2(target) {
							var player = _status.event.player,
								att = get.attitude(player, target);
							if (ui.selected.cards[0].name == "du") {
								return -att;
							}
							if (target.hasSkillTag("nogain")) {
								att /= 6;
							}
							return att;
						},
					});
					"step 1";
					if (result.bool) {
						player.logSkill("twchongwang", result.targets[0]);
						result.targets[0].gain(result.cards, player, "giveAuto");
						result.targets[0].storage.twchongwang.push(player);
						result.targets[0].storage.twchongwangx.push(player);
					}
				},
			},
		},
	},
};
