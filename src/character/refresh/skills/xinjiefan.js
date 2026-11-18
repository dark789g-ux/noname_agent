import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const xinjiefanSkills = {
	xinjiefan: {
		skillAnimation: true,
		animationColor: "wood",
		audio: 2,
		limited: true,
		enable: "phaseUse",
		filterTarget: true,
		async content(event, trigger, player) {
			const { target } = event;
			let result;

			// step 0
			player.awakenSkill(event.name);
			event.players = game.filterPlayer(function (current) {
				return current != target && current.inRange(target);
			});
			event.players.sortBySeat();

			// step 1
			while (event.players.length) {
				event.current = event.players.shift();
				event.current.addTempClass("target");
				player.line(event.current, "green");
				if (event.current.countCards("he") && target.isIn()) {
					result = await event.current
						.chooseToDiscard({ subtype: "equip1" }, "he", "弃置一张武器牌或让" + get.translation(target) + "摸一张牌")
						.set("ai", function (card) {
							if (get.attitude(_status.event.player, _status.event.target) < 0) {
								return 7 - get.value(card);
							}
							return -1;
						})
						.set("target", target)
						.forResult();
					event.tempbool = false;
				} else {
					event.tempbool = true;
				}

				// step 2
				if (event.tempbool || result.bool == false) {
					await target.draw();
				}
			}

			if (game.roundNumber <= 1) {
				player.addTempSkill("xinjiefan2");
			}
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					if (player.hp > 2 && game.roundNumber > 1) {
						if (game.phaseNumber < game.players.length * 2) {
							return 0;
						}
					}
					var num = 0,
						players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i] != target && players[i].inRange(target)) {
							num++;
						}
					}
					return num;
				},
			},
		},
	},
	xinjiefan2: {
		trigger: { player: "phaseEnd" },
		forced: true,
		popup: false,
		sourceSkill: "xinjiefan",
		async content(event, trigger, player) {
			player.restoreSkill("xinjiefan");
		},
	},
	residi: {
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		audio: 2,
		filter(event, player) {
			return (
				player.countCards("he", function (card) {
					if (_status.connectMode) {
						return true;
					}
					return get.type(card) != "basic";
				}) > 0
			);
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			result = await player
				.chooseCard("he", get.prompt("residi"), "将一张非基本牌置于武将牌上作为“司”", function (card, player) {
					return get.type(card) != "basic";
				})
				.set("ai", function (card) {
					if (get.position(card) == "e") {
						return 5 + player.hp - get.value(card);
					}
					return 7 - get.value(card);
				})
				.forResult();

			// step 1
			if (result.bool) {
				player.logSkill("residi");
				player.addToExpansion(result.cards, "give", player).gaintag.add("residi");
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: "residi_push",
		ai: {
			notemp: true,
		},
	},
	residi_push: {
		trigger: { global: "phaseUseBegin" },
		direct: true,
		sourceSkill: "residi",
		filter(event, player) {
			return event.player != player && player.getExpansions("residi").length > 0;
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			result = await player
				.chooseButton([get.prompt("residi", trigger.player), player.getExpansions("residi")])
				.set("ai", function (button) {
					var player = _status.event.player;
					var target = _status.event.getTrigger().player;
					if (get.attitude(player, target) > -1) {
						return 0;
					}
					var card = button.link;
					var color = get.color(button.link, false);
					var eff = target.countCards("h", function (card) {
						return get.color(card, target) == color && target.hasValueTarget(card);
					});
					if (
						!target.countCards("h", function (card) {
							return get.color(card, target) == color && get.name(card, target) == "sha" && target.hasValueTarget(card);
						})
					) {
						eff += 1.5;
					}
					if (
						!target.countCards("h", function (card) {
							return get.color(card, target) == color && get.type2(card, target) == "trick" && target.hasValueTarget(card);
						})
					) {
						eff += 1.5;
					}
					return eff - 1;
				})
				.forResult();

			// step 1
			if (result.bool) {
				if (!trigger.residi) {
					trigger.residi = [];
				}
				trigger.residi.push(player);
				var card = result.links[0];
				var target = trigger.player;
				player.logSkill("residi", target);
				player.loseToDiscardpile(card);
				var color = get.color(card, false);
				if (!target.storage.residi2) {
					target.storage.residi2 = [];
				}
				target.storage.residi2.add(color);
				target.addTempSkill("residi2", "phaseUseAfter");
				target.markSkill("residi2");
				player.addTempSkill("residi3", "phaseUseAfter");
			}
		},
	},
	residi2: {
		onremove: true,
		mod: {
			cardEnabled(card, player) {
				if (player.getStorage("residi2").includes(get.color(card, player))) {
					return false;
				}
			},
			cardRespondable(card, player) {
				if (player.getStorage("residi2").includes(get.color(card, player))) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (player.getStorage("residi2").includes(get.color(card, player))) {
					return false;
				}
			},
		},
		intro: {
			content: "不能使用或打出$牌",
		},
		marktext: "敌",
	},
	residi3: {
		audio: "residi",
		trigger: { global: "phaseUseEnd" },
		forced: true,
		sourceSkill: "residi",
		filter(event, player) {
			if (!event.residi || !event.residi.includes(player)) {
				return false;
			}
			var sha = player.canUse("sha", event.player, false),
				trick = true;
			event.player.getHistory("useCard", function (evt) {
				if (evt.getParent("phaseUse") != event) {
					return false;
				}
				if (sha && evt.card.name == "sha") {
					sha = false;
				}
				if (trick && get.type2(evt.card, false) == "trick") {
					trick = false;
				}
			});
			return sha || trick;
		},
		async content(event, trigger, player) {
			const canUseSha = player.canUse("sha", trigger.player, false);
			let sha = canUseSha;
			let trick = true;

			trigger.player.getHistory("useCard", evt => {
				if (evt.getParent("phaseUse") != trigger) {
					return false;
				}
				if (sha && evt.card.name == "sha") {
					sha = false;
				}
				if (trick && get.type2(evt.card, false) == "trick") {
					trick = false;
				}
				return false;
			});

			if (sha) {
				await player.useCard({ name: "sha", isCard: true }, trigger.player).forResult();
			}
			if (trick) {
				await player.draw(2).forResult();
			}
		},
	},
	rehuaiyi: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + (player.hasSkill(skill + "_rewrite", null, null, false) ? 1 : 0);
		},
		delay: false,
		filter(event, player) {
			return player.countCards("h");
		},
		async content(event, trigger, player) {
			await player.showHandcards();
			const hs = player.getCards("h"),
				color = get.color(hs[0], player);
			if (
				hs.length === 1 ||
				!hs.some((card, index) => {
					return index > 0 && get.color(card) !== color;
				})
			) {
				await player.draw();
				player.addTempSkill(event.name + "_rewrite", "phaseUseEnd");
			} else {
				const list = [],
					bannedList = [],
					indexs = Object.keys(lib.color);
				player.getCards("h").forEach(card => {
					const color = get.color(card, player);
					list.add(color);
					if (!lib.filter.cardDiscardable(card, player, "rehuaiyi")) {
						bannedList.add(color);
					}
				});
				list.removeArray(bannedList);
				list.sort((a, b) => indexs.indexOf(a) - indexs.indexOf(b));
				let result;
				if (!list.length) {
					return;
				} else if (list.length === 1) {
					result = { control: list[0] };
				} else {
					result = await player
						.chooseControl(list.map(i => `${i}2`))
						.set("ai", () => {
							const player = get.player();
							if (player.countCards("h", { color: "red" }) == 1 && player.countCards("h", { color: "black" }) > 1) {
								return 1;
							}
							return 0;
						})
						.set("prompt", "请选择弃置一种颜色的所有手牌")
						.forResult();
				}
				const control = result.control.slice(0, -1);
				const cards = player.getCards("h", { color: control }),
					num = cards.length;
				await player.discard(cards);
				const { targets } = await player
					.chooseTarget(`请选择至多${get.cnNumber(num)}名有牌的其他角色，获得这些角色的各一张牌。`, [1, num], (card, player, target) => {
						return target != player && target.countGainableCards(player, "he");
					})
					.set("ai", target => {
						return -get.attitude(get.player(), target) + 0.5;
					})
					.forResult();
				if (!targets || !targets.length) {
					return;
				}
				player.line(targets, "green");
				for (const target of targets.sortBySeat()) {
					if (target.isIn() && target.countGainableCards(player, "he")) {
						await player.gainPlayerCard(target, "he", true);
					}
				}
				if (player.getHistory("gain", evt => evt.getParent(2) == event).reduce((sum, evt) => sum + evt.cards.length, 0) > 1) {
					await player.loseHp();
				}
			}
		},
		ai: {
			order(item, player) {
				if (player.countCards("h", { color: "red" }) == 0) {
					return 10;
				}
				if (player.countCards("h", { color: "black" }) == 0) {
					return 10;
				}
				return 1;
			},
			result: {
				player: 1,
			},
		},
		subSkill: { rewrite: { charlotte: true } },
	},
	rezhuikong: {
		audio: 2,
		audioname: ["ol_fuhuanghou"],
		audioname2: { tw_fuhuanghou: "xinzhuikong" },
		trigger: { global: "phaseZhunbeiBegin" },
		check(event, player) {
			if (get.attitude(player, event.player) < -2) {
				var cards = player.getCards("h");
				if (cards.length > player.hp) {
					return true;
				}
				for (var i = 0; i < cards.length; i++) {
					var useful = get.useful(cards[i]);
					if (useful < 5) {
						return true;
					}
					if (get.number(cards[i]) > 7 && useful < 7) {
						return true;
					}
				}
			}
			return false;
		},
		logTarget: "player",
		filter(event, player) {
			return player.hp < player.maxHp && player.canCompare(event.player);
		},
		async content(event, trigger, player) {
			const { player: target } = trigger;
			const result = await player
				.chooseToCompare(target)
				.set("small", player.hp > 1 && get.effect(player, { name: "sha" }, target, player) > 0 && Math.random() < 0.9)
				.forResult();
			if (result.bool) {
				target.addTempSkill("zishou2");
			} else {
				if (result.target && get.position(result.target) == "d") {
					await player.gain(result.target, "gain2", "log");
				}
				const card = { name: "sha", isCard: true };
				if (target.canUse(card, player, false)) {
					await target.useCard(card, player, false);
				}
			}
		},
	},
	reqiuyuan: {
		inherit: "qiuyuan",
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const { card } = trigger;
			const result = await target
				.chooseToGive(
					(card, player) => {
						const name = get.name(card, player);
						return name != "sha" && get.type(name) == "basic";
					},
					`交给${get.translation(player)}一张不为【杀】的基本牌，或成为${get.translation(card)}的额外目标且不可响应此牌`,
					player
				)
				.set("ai", card => {
					const { player, target } = get.event();
					return get.attitude(player, target) >= 0 ? 1 : -1;
				})
				.forResult();
			if (!result?.bool) {
				trigger.getParent().targets.push(target);
				trigger.getParent().triggeredTargets2.push(target);
				trigger.directHit.push(target);
				game.log(target, "成为了", card, "的额外目标");
			}
		},
	},
	reenyuan: {
		audio: 2,
		group: ["reenyuan1", "reenyuan2"],
	},
	reenyuan1: {
		audio: "reenyuan",
		inherit: "xinenyuan1",
		sourceSkill: "reenyuan",
	},
};
