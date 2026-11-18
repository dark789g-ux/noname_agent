import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "huaiyi" | "yaoming" | "yaoming2" | "anguo" | "reyanzhu" | "reyanzhu2" | "rexingxue" | "rezhaofu" | "rezhaofu2" | "zhaofu" | "zhaofu2" | "xingxue">} */
export const groupSkills = {
	huaiyi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		delay: false,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			await player.showHandcards();

			const hs = player.getCards("h");
			const color = get.color(hs[0], player);
			if (hs.length === 1 || !hs.some((card, index) => index > 0 && get.color(card) !== color)) {
				return;
			}

			const colors = [];
			const bannedList = [];
			const indexs = Object.keys(lib.color);
			for (const card of player.getCards("h")) {
				const color = get.color(card, player);
				colors.add(color);
				if (!lib.filter.cardDiscardable(card, player, "huaiyi")) {
					bannedList.add(color);
				}
			}
			colors.removeArray(bannedList);
			colors.sort((a, b) => indexs.indexOf(a) - indexs.indexOf(b));

			let result;
			if (!colors.length) {
				return;
			}
			if (colors.length === 1) {
				result = { control: colors[0] };
			} else {
				result = await player
					.chooseControl({
						controls: colors.map(color => `${color}2`),
						prompt: "请选择弃置一种颜色的所有手牌",
						ai() {
							const player = get.player();
							if (player.countCards("h", { color: "red" }) == 1 && player.countCards("h", { color: "black" }) > 1) {
								return 1;
							}
							return 0;
						},
					})
					.forResult();
			}

			const control = result.control.slice(0, result.control.length - 1);
			const cards = player.getCards("h", { color: control });
			const num = cards.length;
			await player.discard({ cards });

			result = await player
				.chooseTarget({
					prompt: `请选择至多${get.cnNumber(num)}名有牌的其他角色，获得这些角色的各一张牌。`,
					filterTarget(card, player, target) {
						return target !== player && target.countCards("he") > 0;
					},
					selectTarget: [1, num],
					ai(target) {
						return -get.attitude(get.player(), target) + 0.5;
					},
				})
				.forResult();
			if (!result.bool || !result.targets?.length) {
				return;
			}
			const targets = result.targets;
			player.line(targets, "green");
			let gained = 0;
			for (const target of targets.sortBySeat()) {
				if (!player.isIn() || !target.countCards("he")) {
					continue;
				}
				const result = await player
					.gainPlayerCard({
						target,
						position: "he",
						forced: true,
					})
					.forResult();
				if (result.bool && result.cards?.length) {
					gained += result.cards.length;
				}
			}

			if (gained > 1) {
				await player.loseHp();
			}
		},
		ai: {
			order(item, player) {
				if (player.countCards("h", { color: "red" }) == 1) {
					return 10;
				}
				if (player.countCards("h", { color: "black" }) == 1) {
					return 10;
				}
				return 1;
			},
			result: {
				player: player => {
					if (get.color(player.getCards("h")) != "none") {
						return 0;
					}
					return 1;
				},
			},
		},
	},
	yaoming: {
		audio: 2,
		trigger: { player: "damageEnd", source: "damageSource" },
		filter(event, player) {
			if (player.hasSkill("yaoming2")) {
				return false;
			}
			var nh = player.countCards("h");
			return game.hasPlayer(function (current) {
				return current.countCards("h") != nh;
			});
		},
		async cost(event, trigger, player) {
			const nh = player.countCards("h");
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("yaoming"),
					filterTarget(card, player, target) {
						return _status.event.nh != target.countCards("h");
					},
					ai(target) {
						const att = get.attitude(_status.event.player, target);
						if (target.countCards("h") > _status.event.nh) {
							return -att;
						}
						return att;
					},
				})
				.set("nh", nh)
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			player.addTempSkill("yaoming2");
			const target = event.targets[0];
			if (target.countCards("h") < player.countCards("h")) {
				await target.draw();
			} else {
				await target.discard({
					cards: [target.getCards("h").randomGet()],
				});
			}
		},
		ai: {
			expose: 0.2,
		},
	},
	yaoming2: {},
	anguo: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player != target && target.countCards("e") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await player
				.choosePlayerCard({
					target,
					position: "e",
					forced: true,
				})
				.forResult();
			if (!result.links?.length) {
				return;
			}
			const numOld = game.filterPlayer().filter(current => target.inRange(current)).length;
			await target.gain({
				cards: result.links,
				animate: "gain2",
			});
			const numNew = game.filterPlayer().filter(current => target.inRange(current)).length;
			if (numOld > numNew) {
				await player.draw();
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (target.hasSkillTag("noe")) {
						return 1;
					}
					if (target.getEquip(1) || target.getEquip(4)) {
						return -1;
					}
					if (target.getEquip(2)) {
						return -0.7;
					}
					return -0.5;
				},
			},
		},
	},
	reyanzhu: {
		audio: 2,
		audioname: ["ol_sunxiu"],
		enable: "phaseUse",
		filterTarget: lib.filter.notMe,
		derivation: ["reyanzhu_rewrite", "rexingxue_rewrite"],
		prompt() {
			return lib.translate[(_status.event.player.storage.reyanzhu ? "reyanzhu_rewrite" : "reyanzhu") + "_info"];
		},
		usable: 1,
		async content(event, trigger, player) {
			const { target } = event;
			let result;
			if (player.storage.reyanzhu || !target.countCards("e")) {
				result = { index: 1 };
			} else {
				result = await target
					.chooseControl()
					.set("prompt", get.translation(player) + "发动了【宴诛】，请选择一项")
					.set("choiceList", ["将装备区内的所有牌交给" + get.translation(player) + "并令其修改技能", "弃置一张牌，并令下次受到的伤害+1直到下回合开始"])
					.set("ai", function () {
						if (_status.event.player.countCards("e") >= 3) {
							return 1;
						}
						return 0;
					})
					.forResult();
			}
			if (result.index == 0) {
				await target.give(target.getCards("e"), player);
				player.storage.reyanzhu = true;
			} else {
				target.addTempSkill("reyanzhu2", { player: "phaseBegin" });
				target.addMark("reyanzhu2", 1, false);
				if (!player.storage.reyanzhu && target.countCards("he") > 0) {
					await target.chooseToDiscard({
						position: "he",
						forced: true,
					});
				}
			}
		},
		ai: {
			order: 6,
			result: {
				target(player, target) {
					if (player.storage.reyanzhu) {
						return -1;
					}
					var ne = target.countCards("e");
					if (!ne) {
						return -2;
					}
					if (ne >= 2) {
						return -ne;
					}
					return 0;
				},
			},
		},
	},
	reyanzhu2: {
		charlotte: true,
		trigger: { player: "damageBegin3" },
		forced: true,
		onremove: true,
		sourceSkill: "reyanzhu",
		async content(event, trigger, player) {
			trigger.num += player.countMark("reyanzhu2");
			game.log(player, "受到的伤害+" + player.countMark("reyanzhu2"));
			player.removeSkill("reyanzhu2");
		},
		intro: {
			content: "下次受到的伤害+#直到下回合开始",
		},
	},
	rexingxue: {
		audio: 2,
		audioname: ["ol_sunxiu"],
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return (player.storage.reyanzhu ? player.maxHp : player.hp) > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("rexingxue"),
					prompt2: "令所有目标角色依次摸一张牌，然后所有手牌数大于体力值的目标角色依次将一张牌置于牌堆顶",
					selectTarget: [1, player.storage.reyanzhu ? player.maxHp : player.hp],
					ai(target) {
						let att = get.attitude(player, target);
						if (target.countCards("h") == target.hp - 1) {
							att *= 2;
						}
						return att;
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const { targets } = event;
			targets.sortBySeat();

			await game.asyncDraw(targets);
			await game.delay();

			for (const target of targets) {
				if (target.isDead()) {
					continue;
				}
				if (!(target.isIn() && target.countCards("h") && target.countCards("h") > target.hp)) {
					continue;
				}

				const result = await target
					.chooseCard({
						prompt: "将一张牌置于牌堆顶",
						position: "he",
						forced: true,
					})
					.forResult();
				if (!result.bool || !result?.cards.length) {
					continue;
				}

				const card = result.cards[0];
				game.log(target, "将", get.position(card) == "h" ? "一张牌" : card, "置于牌堆顶");
				await target.lose({
					cards: result.cards,
					position: ui.cardPile,
					insert_card: true,
				});
				game.broadcastAll(current => {
					const cardx = ui.create.card();
					cardx.classList.add("infohidden");
					cardx.classList.add("infoflip");
					current.$throw(cardx, 1000, "nobroadcast");
				}, target);
			}
		},
	},
	rezhaofu: {
		locked: true,
		global: "rezhaofu2",
		zhuSkill: true,
	},
	rezhaofu2: {
		mod: {
			inRangeOf(from, to) {
				if (from.group != "wu") {
					return;
				}
				var players = game.filterPlayer();
				for (var i = 0; i < players.length; i++) {
					if (from != players[i] && to != players[i] && players[i].hasZhuSkill("rezhaofu", from)) {
						if (players[i].inRange(to)) {
							return true;
						}
					}
				}
			},
		},
	},
	zhaofu: {
		audio: 2,
		audioname: ["ol_sunxiu"],
		global: "zhaofu2",
		zhuSkill: true,
		locked: true,
	},
	zhaofu2: {
		mod: {
			inRangeOf(from, to) {
				if (from.group != "wu") {
					return;
				}
				var players = game.filterPlayer();
				for (var i = 0; i < players.length; i++) {
					if (from != players[i] && to != players[i] && players[i].hasZhuSkill("zhaofu", from)) {
						if (get.distance(players[i], to) <= 1) {
							return true;
						}
					}
				}
			},
		},
	},
	xingxue: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		async content(event, trigger, player) {
			let num = player.hp;
			if (!player.hasSkill("yanzhu")) {
				num = player.maxHp;
			}
			const { targets, bool } = await player
				.chooseTarget([1, num], get.prompt2("xingxue"))
				.set("ai", function (target) {
					const att = get.attitude(_status.event.player, target);
					if (target.countCards("he")) {
						return att;
					}
					return att / 10;
				})
				.forResult();
			if (bool) {
				player.logSkill("xingxue", targets);
				const chooseToPutCard = async function (target) {
					await target.draw();
					if (target.countCards("he")) {
						const { cards, bool } = await target.chooseCard("选择一张牌置于牌堆顶", "he", true).forResult();
						if (bool) {
							await target.lose(cards, ui.cardPile, "insert");
						}
						game.broadcastAll(function (player) {
							const cardx = ui.create.card();
							cardx.classList.add("infohidden");
							cardx.classList.add("infoflip");
							player.$throw(cardx, 1000, "nobroadcast");
						}, target);
						if (player == game.me) {
							await game.delay(0.5);
						}
					}
				};
				await game.doAsyncInOrder(targets, chooseToPutCard);
			}
		},
	},
};
