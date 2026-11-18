import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcchongwang" | "dchuagui" | "dcyingtu" | "dccongshi">} */
export const groupSkills = {
	//王烈
	dcchongwang: {
		audio: 2,
		trigger: { global: "useCard" },
		filter(event, player) {
			if (player == event.player) {
				return false;
			}
			const type = get.type(event.card);
			if (!["basic", "trick"].includes(type)) {
				return false;
			}
			const history = game.getAllGlobalHistory("useCard");
			const index = history.indexOf(event);
			if (index > 0) {
				return history[index - 1].player == player;
			}
			return false;
		},
		async cost(event, trigger, player) {
			const source = trigger.player;
			const list = [["exclude", `令${get.translation(trigger.card)}无效`]];
			const cards = trigger.cards.filterInD();
			if (source.isIn() && cards.length > 0) {
				list.push(["gain", `令${get.translation(source)}收回${get.translation(cards)}`]);
			}
			const result = await player
				.chooseButton([get.prompt(event.skill, source), [list, "textbutton"], "noforcebutton"])
				.set("ai", button => {
					const player = get.player();
					const choice = button.link;
					const evt = _status.event.getTrigger();
					if (choice == "exclude") {
						let effect = 0;
						if (!evt.targets.length && get.info(evt.card, false).notarget) {
							effect -= get.effect(evt.player, evt.card, evt.player, player);
						}
						for (const i of evt.targets) {
							effect -= get.effect(i, evt.card, evt.player, player);
						}
						return effect;
					} else {
						const cards = evt.cards.filterInD();
						return get.value(cards, evt.player) * get.attitude(player, evt.player);
					}
				})
				.forResult();
			event.result = {
				bool: result.bool,
				cost_data: result.links,
			};
		},
		logTarget: "player",
		async content(event, trigger, player) {
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			if (event.cost_data[0] == "gain") {
				player.addTempSkill("dcchongwang_gain");
				trigger._dcchongwang = true;
			} else {
				trigger.targets.length = 0;
				trigger.all_excluded = true;
				game.log(trigger.card, "被无效了");
			}
		},
		ai: {
			threaten: 3.5,
			directHit_ai: true,
		},
		subSkill: {
			gain: {
				trigger: { global: "useCardAfter" },
				charlotte: true,
				forced: true,
				popup: false,
				filter(event, player) {
					return event._dcchongwang;
				},
				async content(event, trigger, player) {
					trigger.player.gain(trigger.cards.filterInD(), "gain2");
				},
			},
		},
	},
	dchuagui: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		async cost(event, trigger, player) {
			const min = Math.max.apply(
				Math,
				game.filterPlayer().map(current => 1 + current.getFriends().length)
			);
			const max = Math.min(
				min,
				game.countPlayer(current => current != player && current.countCards("he") > 0)
			);
			event.result = await player
				.chooseTarget(get.prompt(event.skill), `令至多${get.cnNumber(max)}名角色进行囚徒困境选择`, [1, max], (card, player, target) => {
					return target != player && target.countCards("he") > 0;
				})
				.set("animate", false)
				.set("ai", target => {
					return -get.attitude(get.player(), target);
				})
				.forResult();
		},
		logLine: false,
		async content(event, trigger, player) {
			const targets = event.targets.sortBySeat();
			const shown = [],
				given = [];
			const map = await game.chooseAnyOL(targets, get.info(event.name).chooseButton, [player]).forResult();
			for (const target of targets) {
				target.addExpose(0.05);
				const { links } = map.get(target);
				let choice;
				if (links[0] == 0) {
					choice = "仅展示牌";
					shown.push([links[1], target, choice]);
				} else {
					choice = "交给牌";
					given.push([links[1], target, choice]);
				}
				target.popup(choice);
				game.log(target, "选择了", "#y" + choice);
			}
			if (shown.length) {
				await player
					.showCards(
						shown.flatMap(item => item[0]),
						get.translation(player) + "发动了【化归】"
					)
					.set("customButton", button => {
						const target = get.owner(button.link);
						if (target) {
							game.createButtonCardsetion(target.getName(true), button);
						}
					})
					.set("delay_time", 4)
					.set("multipleShow", true);
			}
			event.videoId = lib.status.videoId++;
			game.broadcastAll(
				(name, id, results) => {
					const dialog = ui.create.dialog(name + "发动了【化归】", "hidden", "forcebutton");
					dialog.videoId = id;
					dialog.classList.add("scroll1");
					dialog.classList.add("scroll2");
					dialog.classList.add("fullwidth");
					dialog.classList.add("fullheight");
					dialog.buttonss = [];

					const list = ["仅展示牌的玩家", "交出牌的玩家"];
					for (let i = 0; i < list.length; i++) {
						dialog.add('<div class="text center">' + list[i] + "</div>");
						const buttons = ui.create.div(".buttons", dialog.content);
						dialog.buttonss.push(buttons);
						buttons.classList.add("popup");
						buttons.classList.add("guanxing");
					}
					dialog.open();

					const getx = function () {
						const item = results.shift();
						const card = item[0],
							index = item[2] == "仅展示牌" ? 0 : 1;
						const button = ui.create.button(card, "card", dialog.buttonss[index]);
						game.createButtonCardsetion(item[1].getName(true), button);
						if (results.length > 0) {
							setTimeout(getx, 500);
						}
					};
					setTimeout(getx, 500);
				},
				get.translation(player),
				event.videoId,
				shown.concat(given)
			);
			await game.delay(0, 2000 + (shown.length + given.length) * 500);
			game.broadcastAll("closeDialog", event.videoId);
			const list = given.length > 0 ? given : shown;
			const cards = list.flatMap(item => item[0]);
			player.line(list.map(item => item[1]));
			await player.gain(cards, "give");
		},
		chooseButton(player, source, eventId) {
			const str = get.translation(source);
			return player
				.chooseButton(
					2,
					[
						`###${str}对你发动了【化归】，选择展示或交给其一张牌###<div class="text center">若所有人都选择了仅展示，则${str}获得这张牌</div>`,
						player.getCards("he"),
						[
							["仅展示一张牌", `将一张牌交给${str}`].map((item, i) => {
								return [i, item];
							}),
							"textbutton",
						],
					],
					true
				)
				.set("filterButton", button => {
					const { link } = button;
					if (!ui.selected.buttons.length) {
						return typeof link == "number";
					}
					return get.itemtype(link) == "card";
				})
				.set("source", source)
				.set("id", eventId)
				.set("_global_waiting", true)
				.set("ai", button => {
					const { player, source } = get.event();
					const { link } = button;
					const att = get.attitude(player, source),
						hs = player.getCards("he");
					hs.sort((b, a) => get.value(b, player) - get.value(a, player));
					if (!ui.selected.buttons.length) {
						if (att < -2 && Math.random() > (get.value(hs[0], player) - 3) / 5 && link == 1) {
							return 2;
						}
						if (link == 0) {
							return 1;
						}
					} else {
						const choice = ui.selected.buttons[0].link;
						if (choice == 0) {
							return 6 - get.value(link);
						}
						return 6 + (att > 0 ? 1.5 : 0) - get.value(link);
					}
				});
		},
	},
	//陈珪
	dcyingtu: {
		audio: 2,
		trigger: {
			global: ["gainAfter", "loseAsyncAfter"],
		},
		usable: 1,
		getIndex(event, player) {
			var targets = [];
			if (lib.skill.dcyingtu.filterx(event, player, player.getNext())) {
				targets.add(player.getNext());
			}
			if (lib.skill.dcyingtu.filterx(event, player, player.getPrevious())) {
				targets.add(player.getPrevious());
			}
			return targets.sortBySeat(_status.currentPhase);
		},
		filterx(event, player, target) {
			var evt = event.getParent("phaseDraw");
			if (evt && target == evt.player) {
				return false;
			}
			return (
				event.getg(target).length > 0 &&
				target.hasCard(function (card) {
					return lib.filter.canBeGained(card, target, player);
				}, "he")
			);
		},
		logTarget(event, player, triggername, target) {
			return target;
		},
		check(event, player, triggername, source) {
			var target = source == player.getNext() ? player.getPrevious() : player.getNext();
			return Math.min(0, get.attitude(player, target)) >= get.attitude(player, source);
		},
		prompt2: "获得该角色的一张牌，然后将一张牌交给该角色的对位角色。若你给出的是装备牌，则其使用其得到的牌。",
		async content(event, trigger, player) {
			let result;
			const target0 = event.targets[0];
			event.target = target0;
			const side = target0 == player.getPrevious() ? "getNext" : "getPrevious";
			event.side = side;
			await player.gainPlayerCard(target0, true, "he");

			const he = player.getCards("he");
			if (!he.length) {
				return;
			}

			const target = player[side]();
			event.target = target;
			if (he.length == 1) {
				result = { bool: true, cards: he };
			} else {
				result = await player.chooseCard("he", true, "交给" + get.translation(target) + "一张牌").forResult();
			}
			if (!result.bool) {
				return;
			}

			const card = result.cards[0];
			event.card = card;
			player.line(target);
			await player.give(card, target);

			if (target.getCards("h").includes(card) && get.type(card, null, target) == "equip" && target.canUse(card, target)) {
				await target.chooseUseTarget(card, true, "nopopup");
			}
		},
	},
	dccongshi: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		forced: true,
		filter(event, player) {
			return get.type(event.card, null, false) == "equip" && event.player.isMaxEquip();
		},
		async content(event, trigger, player) {
			player.draw();
		},
	},
};
