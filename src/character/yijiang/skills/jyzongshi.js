import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jyzongshi" | "xinsidi" | "xinsidi2" | "taoluan" | "taoluan2" | "taoluan_backup" | "jishe" | "jishe2" | "jishe3" | "lianhuo">} */
export const groupSkills = {
	jyzongshi: {
		audio: 2,
		audioname: ["re_jianyong"],
		trigger: {
			global: ["chooseToCompareAfter", "compareMultipleAfter"],
		},
		getCards(event, player) {
			if (event.compareMultiple) {
				return [];
			}
			if (event.compareMeanwhile) {
				const index = [...event.targets, event.player].indexOf(player),
					winner = event.winner || event.result.winner;
				if (index < 0) {
					return [];
				}
				return event.cards
					.filter((card, i) => {
						return (i == index) != (winner == player);
					})
					.filterInD("od");
			}
			if (player != event.player && player != event.target) {
				return [];
			}
			const winner = event.winner || event.result.winner;
			const bool = (winner == player) == (player == event.player);
			return [event[bool ? "card2" : "card1"]].filterInD("od");
		},
		prompt2(event, player) {
			const cards = get.info("jyzongshi").getCards(event, player);
			return `获得${get.translation(cards)}`;
		},
		filter(event, player) {
			if (event.preserve) {
				return false;
			}
			const cards = get.info("jyzongshi").getCards(event, player);
			return cards.length;
		},
		check(event, player) {
			const cards = get.info("jyzongshi").getCards(event, player);
			return cards.every(card => card.name != "du");
		},
		async content(event, trigger, player) {
			const cards = get.info(event.name).getCards(trigger, player);
			await player.gain(cards, "gain2", "log");
		},
	},
	xinsidi: {
		audio: "sidi",
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			if (event.player == player || event.player.isDead()) {
				return false;
			}
			return player.countCards("e") > 0;
		},
		async cost(event, trigger, player) {
			const attitude = get.attitude(player, trigger.player) >= -0.8;
			const ocards = trigger.player.countCards("h") <= 3;
			const scards = player.countCards("h", "shan") === 0;

			const goon = !(attitude && ocards && scards);
			const es = player.getCards("e");
			// AI给出的神秘去重代码
			const colors = es.map(card => get.color(card)).filter((color, index, self) => self.indexOf(color) === index);

			const color = colors.length === 2 ? "all" : colors[0];

			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt2("xinsidi", trigger.player),
					filterCard(card) {
						if (get.type(card) === "basic") {
							return false;
						}
						const { color } = get.event();
						if (color === "all") {
							return true;
						}
						return get.color(card) === color;
					},
					ai(card) {
						return get.event().goon ? 6 - get.value(card) : 0;
					},
				})
				.set("goon", goon)
				.set("color", color)
				.set("chooseonly", true)
				.forResult();

			event.result.targets = [trigger.player];
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const { cards } = event;
			await player.discard({
				cards,
				discarder: player,
			});
			trigger.player.addSkill("xinsidi2");
			trigger.player.markAuto("xinsidi2", [get.color(cards[0], cards[0].original === "h" ? player : false)]);
			trigger.player.storage.xinsidi4 = player;
			trigger.player.syncStorage("xinsidi2");
		},
		ai: {
			threaten: 1.5,
		},
	},
	xinsidi2: {
		mark: true,
		group: ["xinsidi2_end"],
		sourceSkill: "xinsidi",
		subSkill: {
			end: {
				trigger: { player: "phaseUseEnd" },
				forced: true,
				popup: false,
				audio: false,
				async content(event, trigger, player) {
					if (player.storage.xinsidi4.isIn() && !player.getHistory("useCard", evt => evt.card.name === "sha").length && player.storage.xinsidi4.canUse({ name: "sha", isCard: true }, player, false)) {
						player.storage.xinsidi4.logSkill("xinsidi", player);
						await player.storage.xinsidi4.useCard({ name: "sha", isCard: true }, player);
					}
					delete player.storage.xinsidi2;
					delete player.storage.xinsidi3;
					delete player.storage.xinsidi4;
					player.removeSkill("xinsidi2");
				},
			},
		},
		mod: {
			cardEnabled(card, player) {
				if (player.getStorage("xinsidi2").includes(get.color(card))) {
					return false;
				}
			},
			cardRespondable(card, player) {
				if (player.getStorage("xinsidi2").includes(get.color(card))) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (player.getStorage("xinsidi2").includes(get.color(card))) {
					return false;
				}
			},
		},
		intro: {
			content: "不能使用或打出$的牌",
		},
	},
	taoluan: {
		hiddenCard(player, name) {
			return !player.getStorage("taoluan").includes(name) && player.countCards("hes") > 0 && lib.inpile.includes(name);
		},
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			return player.hasCard(
				card =>
					lib.inpile.some(name => {
						if (player.getStorage("taoluan").includes(name)) {
							return false;
						}
						if (get.type(name) != "basic" && get.type(name) != "trick") {
							return false;
						}
						if (event.filterCard({ name: name, isCard: true, cards: [card] }, player, event)) {
							return true;
						}
						if (name == "sha") {
							for (var nature of lib.inpile_nature) {
								if (event.filterCard({ name: name, nature: nature, isCard: true, cards: [card] }, player, event)) {
									return true;
								}
							}
						}
						return false;
					}),
				"hes"
			);
		},
		onremove: true,
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var name of lib.inpile) {
					if (get.type(name) == "basic" || get.type(name) == "trick") {
						if (player.getStorage("taoluan").includes(name)) {
							continue;
						}
						list.push([get.translation(get.type(name)), "", name]);
						if (name == "sha") {
							for (var j of lib.inpile_nature) {
								list.push(["基本", "", "sha", j]);
							}
						}
					}
				}
				return ui.create.dialog("滔乱", [list, "vcard"]);
			},
			filter(button, player) {
				return _status.event.getParent().filterCard({ name: button.link[2] }, player, _status.event.getParent());
			},
			check(button) {
				var player = _status.event.player;
				var card = { name: button.link[2], nature: button.link[3] };
				if (player.countCards("hes", cardx => cardx.name == card.name)) {
					return 0;
				}
				return _status.event.getParent().type == "phase" ? player.getUseValue(card) : 1;
			},
			backup(links, player) {
				return {
					audio: "taoluan",
					filterCard: true,
					popname: true,
					check(card) {
						return 7 - get.value(card);
					},
					position: "hes",
					viewAs: { name: links[0][2], nature: links[0][3] },
					onuse(result, player) {
						player.markAuto("taoluan", [result.card.name]);
					},
				};
			},
			prompt(links, player) {
				return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			save: true,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (!player.countCards("hes") || player.isTempBanned("taoluan")) {
					return false;
				}
				if (tag == "respondSha" || tag == "respondShan") {
					if (arg == "respond") {
						return false;
					}
					return !player.getStorage("taoluan").includes(tag == "respondSha" ? "sha" : "shan");
				}
				return !player.getStorage("taoluan").includes("tao") || (!player.getStorage("taoluan").includes("jiu") && arg == player);
			},
			order: 4,
			result: {
				player(player) {
					var allshown = true,
						players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i].ai.shown == 0) {
							allshown = false;
						}
						if (players[i] != player && players[i].countCards("h") && get.attitude(player, players[i]) > 0) {
							return 1;
						}
					}
					if (allshown) {
						return 1;
					}
					return 0;
				},
			},
			threaten: 1.9,
		},
		group: "taoluan2",
	},
	taoluan2: {
		charlotte: true,
		trigger: { player: "useCardAfter" },
		sourceSkill: "taoluan",
		filter(event, player) {
			if (!game.hasPlayer(current => current != player)) {
				return false;
			}
			return event.skill == "taoluan_backup";
		},
		forced: true,
		popup: false,
		async content(event, trigger, player) {
			let result = await player
				.chooseTarget({
					prompt: '滔乱<br /><br /><div class="text center">令一名其他角色选择一项：1.交给你一张与你以此法使用的牌类别不同的牌；2.你失去1点体力',
					filterTarget: lib.filter.notMe,
					forced: true,
					ai(target) {
						const current = _status.event.player;
						if (get.attitude(current, target) > 0) {
							if (get.attitude(target, current) > 0) {
								return target.countCards("he");
							}
							return target.countCards("he") / 2;
						}
						return 0;
					},
				})
				.forResult();
			const target = result.targets[0];
			player.line(target, "green");
			const type = get.type(trigger.card, "trick");
			result = await target
				.chooseCard({
					prompt: `滔乱<br><br><div class="text center">交给${get.translation(player)}一张不为${get.translation(type)}牌的牌，或令其失去1点体力且滔乱无效直到回合结束`,
					position: "he",
					filterCard(card) {
						return get.type(card, "trick") !== get.event().cardType;
					},
					ai(card) {
						if (get.event().att) {
							return 11 - get.value(card);
						}
						return 0;
					},
				})
				.set("cardType", type)
				.set("att", get.attitude(target, player) > 0)
				.forResult();
			if (!result.bool) {
				player.tempBanSkill("taoluan");
				await player.loseHp();
				return;
			}
			await target.give(result.cards, player);
		},
	},
	taoluan_backup: {},
	jishe: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.getHandcardLimit() > 0;
		},
		usable: 20,
		locked: false,
		delay: false,
		async content(event, trigger, player) {
			await player.draw({ nodelay: true });
			player.addTempSkill("jishe2");
			player.addMark("jishe2", 1, false);
		},
		ai: {
			order: 10,
			result: {
				player(player) {
					if (!player.needsToDiscard(1)) {
						return 1;
					}
					return 0;
				},
			},
		},
		group: ["jishe3"],
	},
	jishe2: {
		mod: {
			maxHandcard(player, num) {
				return num - player.countMark("jishe2");
			},
		},
		onremove: true,
		charlotte: true,
		marktext: "奢",
		intro: { content: "手牌上限-#" },
	},
	jishe3: {
		audio: "jishe",
		trigger: { player: "phaseJieshuBegin" },
		sourceSkill: "jishe",
		filter(event, player) {
			if (player.countCards("h")) {
				return false;
			}
			return game.hasPlayer(current => !current.isLinked());
		},
		async cost(event, trigger, player) {
			const num = game.countPlayer(current => !current.isLinked());
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("jishe"),
					prompt2: `横置至多${get.cnNumber(Math.min(num, player.hp))}名未横置的角色`,
					filterTarget(card, player, target) {
						return !target.isLinked();
					},
					selectTarget: [1, Math.min(num, player.hp)],
					ai(target) {
						return -get.attitude(get.player(), target);
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			await game.doAsyncInOrder(event.targets, target => target.link());
		},
		ai: {
			expose: 0.3,
		},
	},
	lianhuo: {
		audio: 2,
		trigger: { player: "damageBegin3" },
		forced: true,
		filter(event, player) {
			return player.isLinked() && event.notLink() && event.hasNature("fire");
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
		ai: {
			neg: true,
		},
	},
};
