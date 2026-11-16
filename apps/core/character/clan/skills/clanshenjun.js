import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanshenjun" | "clanbalong" | "clanyunshen" | "clanshangshen" | "clanfenchai">} */
export const groupSkills = {
	//族荀淑
	clanshenjun: {
		audio: 2,
		trigger: { global: "useCard" },
		forced: true,
		locked: false,
		filter(event, player) {
			return (event.card.name == "sha" || get.type(event.card) == "trick") && player.countCards("h", event.card.name) > 0;
		},
		async content(event, trigger, player) {
			const cards = player.getCards("h", trigger.card.name);
			await player.showCards(cards, get.translation(player) + "发动了【神君】");
			player.markSkill("clanshenjun");
			player.addGaintag(cards, "clanshenjun");
			for (const name of lib.phaseName) {
				const evt = _status.event.getParent(name);
				if (!evt || evt.name != name) {
					continue;
				}
				player.addTempSkill("clanshenjun_viewAs", name + "After");
				break;
			}
		},
		marktext: "君",
		intro: {
			markcount(storage, player) {
				return player.countCards("h", card => card.hasGaintag("clanshenjun"));
			},
			mark(dialog, content, player) {
				var cards = player.getCards("h", card => card.hasGaintag("clanshenjun"));
				if (cards.length) {
					dialog.addAuto(cards);
				} else {
					return "无展示牌";
				}
			},
		},
		subSkill: {
			viewAs: {
				audio: "clanshenjun",
				trigger: { global: ["phaseZhunbeiEnd", "phaseJudgeEnd", "phaseDrawEnd", "phaseUseEnd", "phaseDiscardEnd", "phaseJieshuEnd"] },
				filter(event, player) {
					return player.countCards("h", card => card.hasGaintag("clanshenjun")) > 0;
				},
				forced: true,
				charlotte: true,
				async content(event, trigger, player) {
					let result;

					const markedCards = player.getCards("h", card => card.hasGaintag("clanshenjun"));
					const list = [];
					const names = [];

					for (const card of markedCards) {
						const name = get.name(card);
						const nature = get.nature(card);
						let namex = name;

						if (nature && nature.length) {
							namex += nature;
							if (names.includes(namex)) {
								continue;
							}
							list.push([get.type(card), "", name, nature]);
						} else {
							if (names.includes(namex)) {
								continue;
							}
							list.push([get.type(card), "", name]);
						}

						names.push(namex);
					}

					list.sort((a, b) => {
						const del1 = lib.inpile.indexOf(a[2]) - lib.inpile.indexOf(b[2]);
						if (del1 !== 0) {
							return del1;
						}

						let a1 = 0;
						let b1 = 0;
						if (a.length > 3) {
							a1 = lib.nature.get(a) || 0;
						}
						if (b.length > 3) {
							b1 = lib.nature.get(b) || 0;
						}
						return a1 - b1;
					});

					result = await player
						.chooseButton(["是否将" + get.cnNumber(markedCards.length) + "张牌当下列一张牌使用？", [list, "vcard"]])
						.set("ai", button => {
							return get.event().player.getUseValue({
								name: button.link[2],
								nature: button.link[3],
							});
						})
						.forResult();

					if (result.bool) {
						const name = result.links[0][2];
						const nature = result.links[0][3];
						const cards = player.getCards("h", card => card.hasGaintag("clanshenjun"));

						game.broadcastAll(
							(num, card) => {
								lib.skill.clanshenjun_backup.selectCard = num;
								lib.skill.clanshenjun_backup.viewAs = card;
							},
							cards.length,
							{ name: name, nature: nature }
						);

						const next = player.chooseToUse();
						next.set("openskilldialog", "将" + get.cnNumber(cards.length) + "张牌当做" + (get.translation(nature) || "") + "【" + get.translation(name) + "】使用");
						next.set("norestore", true);
						next.set("addCount", false);
						next.set("_backupevent", "clanshenjun_backup");
						next.set("custom", {
							add: {},
							replace: { window() {} },
						});
						next.backup("clanshenjun_backup");
						await next;
					}
				},
			},
			backup: {
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				position: "hes",
				filterTarget: lib.filter.filterTarget,
				check: card => 6 - get.value(card),
				log: false,
			},
		},
	},
	clanbalong: {
		audio: 2,
		trigger: { player: "changeHpAfter" },
		forced: true,
		filter(event, player) {
			if (event.changedHp == 0) {
				return false;
			}
			const evts = game.getGlobalHistory("changeHp", evt => evt.player == player && evt.changedHp != 0);
			if (evts.indexOf(event) !== 0) {
				return false;
			}
			const cards = player.getCards("h"),
				map = {};
			if (!cards.length) {
				return false;
			}
			for (const card of cards) {
				const type = get.type2(card);
				if (typeof map[type] != "number") {
					map[type] = 0;
				}
				map[type]++;
			}
			const list = [];
			for (let i in map) {
				if (map[i] > 0) {
					list.push([i, map[i]]);
				}
			}
			list.sort((a, b) => b[1] - a[1]);
			return list[0][0] == "trick" && (list.length == 1 || list[0][1] > list[1][1]);
		},
		async content(event, trigger, player) {
			await player.showHandcards(get.translation(player) + "发动了【八龙】");
			await player.drawTo(game.countPlayer());
		},
	},
	//族荀粲
	clanyunshen: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player != target && target.isDamaged();
		},
		async content(event, trigger, player) {
			const { target } = event;

			await target.recover();

			const name = get.translation(target);
			const card = new lib.element.VCard({ name: "sha", nature: "ice", isCard: true });
			const result = await player
				.chooseControl()
				.set("choiceList", [`${name}视为对你使用一张冰【杀】`, `你视为对${name}使用一张冰【杀】`])
				.set("prompt", "熨身：请选择一项")
				.set("ai", () => _status.event.choice)
				.set(
					"choice",
					(() => {
						const eff = get.effect(player, card, target, player);
						const eff2 = get.effect(target, card, player, player);
						return eff > eff2 ? "选项一" : "选项二";
					})()
				)
				.forResult();

			const players = result.control == "选项二" ? [player, target] : [target, player];
			if (players[0].canUse(card, players[1], false)) {
				await players[0].useCard(card, players[1], false, "noai");
			}
		},
		ai: {
			order: 10,
			expose: 0.2,
			result: {
				player(player, target) {
					const card = new lib.element.VCard({ name: "sha", nature: "ice", isCard: true });
					let list = [];
					if (player.canUse(card, target, false)) {
						list.push(get.effect(target, card, player, player));
					}
					if (target.canUse(card, player, false)) {
						list.push(get.effect(player, card, target, player));
					}
					if (!list.length) {
						list.push(0);
					}
					return get.recoverEffect(target, player, player) + Math.max(...list);
				},
			},
		},
	},
	clanshangshen: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			if (!event.hasNature() || !event.player.isIn()) {
				return false;
			}
			return (
				game.countPlayer2(current => {
					return current.hasHistory("damage", evt => {
						return evt.hasNature() && evt != event;
					});
				}) == 0
			);
		},
		logTarget: "player",
		check(event, player) {
			if (get.attitude(player, event.player) <= 2) {
				return false;
			}
			if (event.player.countCards("h") >= 4) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			await player.executeDelayCardEffect("shandian");
			await trigger.player.drawTo(4);
		},
		ai: { expose: 0.25 },
	},
	clanfenchai: {
		audio: 2,
		init(player) {
			if (player.getStorage("clanfenchai").length > 0) {
				return;
			}
			var history = player.getHistory("useSkill", evt => {
				if (evt.type != "player") {
					return false;
				}
				var skill = get.sourceSkillFor(evt),
					targets = evt.targets;
				var info = get.info(skill);
				if (!info || info.charlotte) {
					return false;
				}
				if (targets && targets.length) {
					if (targets.filter(i => player.differentSexFrom(i)).length > 0) {
						return true;
					}
				}
				return false;
			});
			if (history.length) {
				var evt = history[0],
					targets = evt.targets;
				player.markAuto(
					"clanfenchai",
					targets.filter(i => player.differentSexFrom(i))
				);
			}
		},
		trigger: {
			player: ["logSkillBegin", "useSkill"],
		},
		forced: true,
		silent: true,
		onremove: true,
		marktext: "钗",
		intro: {
			content: (storage, player) => "对象：" + get.translation(storage),
		},
		group: "clanfenchai_audio",
		filter(event, player) {
			if (event.type != "player") {
				return false;
			}
			var targets = event.targets;
			if (!targets || !targets.length) {
				return false;
			}
			var info = get.info(get.sourceSkillFor(event));
			if (!info || info.charlotte) {
				return false;
			}
			if (player.getStorage("clanfenchai").length != 0) {
				return false;
			}
			return targets.filter(i => player.differentSexFrom(i)).length > 0;
		},
		async content(event, trigger, player) {
			player.markAuto(
				"clanfenchai",
				trigger.targets.filter(i => player.differentSexFrom(i))
			);
		},
		subSkill: {
			audio: {
				audio: "clanfenchai",
				forced: true,
				trigger: { player: "judge" },
				filter(event, player) {
					return player.getStorage("clanfenchai").length;
				},
				async content(event, trigger, player) {},
			},
		},
		mod: {
			suit(card, suit) {
				var player = get.owner(card) || _status.event.player;
				if (!player || !player.judging || player.judging[0] != card) {
					return;
				}
				var storage = player.getStorage("clanfenchai");
				if (!storage.length) {
					return;
				}
				return storage.filter(i => i.isIn()).length > 0 ? "heart" : "spade";
			},
		},
	},
};
