import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twkanpo" | "twshiyi" | "twchunhui" | "twfenxian" | "twjuyan">} */
export const groupSkills = {
	//外服谋诸葛亮
	twkanpo: {
		init(player) {
			if (!player.storage.twkanpo) {
				player.storage.twkanpo = [3, [], []];
				player.markSkill("twkanpo");
			}
		},
		audio: "sbkanpo",
		trigger: { global: "roundStart" },
		filter(event, player) {
			var storage = player.storage.twkanpo;
			return storage[0] || storage[1].length;
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			var storage = player.storage.twkanpo;
			var sum = storage[0];
			storage[1] = [];
			player.markSkill("twkanpo");
			if (!sum) {
				return;
			}
			const list = get.inpileVCardList(info => {
				if (info[2] == "sha" && info[3]) {
					return false;
				}
				return info[0] != "equip";
			});
			const func = () => {
				const event = get.event();
				const controls = [
					link => {
						const evt = get.event();
						if (evt.dialog && evt.dialog.buttons) {
							for (let i = 0; i < evt.dialog.buttons.length; i++) {
								const button = evt.dialog.buttons[i];
								button.classList.remove("selectable");
								button.classList.remove("selected");
								const counterNode = button.querySelector(".caption");
								if (counterNode) {
									counterNode.childNodes[0].innerHTML = ``;
								}
							}
							ui.selected.buttons.length = 0;
							game.check();
						}
						return;
					},
				];
				event.controls = [ui.create.control(controls.concat(["清除选择", "stayleft"]))];
			};
			if (event.isMine()) {
				func();
			} else if (event.isOnline()) {
				event.player.send(func);
			}
			var result = await player
				.chooseButton(["看破：是否记录至多" + get.cnNumber(sum) + "个牌名？", [list, "vcard"]], [1, sum], false)
				.set("ai", function (button) {
					if (ui.selected.buttons.length >= Math.max(3, game.countPlayer() / 2)) {
						return 0;
					}
					switch (button.link[2]) {
						case "wuxie":
							return 5 + Math.random();
						case "sha":
							return 5 + Math.random();
						case "tao":
							return 4 + Math.random();
						case "jiu":
							return 3 + Math.random();
						case "lebu":
							return 3 + Math.random();
						case "shan":
							return 4.5 + Math.random();
						case "wuzhong":
							return 4 + Math.random();
						case "shunshou":
							return 2.7 + Math.random();
						case "nanman":
							return 2 + Math.random();
						case "wanjian":
							return 1.6 + Math.random();
						default:
							return 1.5 + Math.random();
					}
				})
				.set("filterButton", button => {
					return !_status.event.names.includes(button.link[2]);
				})
				.set("names", storage[2])
				.set("custom", {
					add: {
						confirm(bool) {
							if (bool != true) {
								return;
							}
							const event = get.event().parent;
							if (event.controls) {
								event.controls.forEach(i => i.close());
							}
							if (ui.confirm) {
								ui.confirm.close();
							}
							game.uncheck();
						},
						button() {
							if (ui.selected.buttons.length) {
								return;
							}
							const event = get.event();
							if (event.dialog && event.dialog.buttons) {
								for (let i = 0; i < event.dialog.buttons.length; i++) {
									const button = event.dialog.buttons[i];
									const counterNode = button.querySelector(".caption");
									if (counterNode) {
										counterNode.childNodes[0].innerHTML = ``;
									}
								}
							}
							if (!ui.selected.buttons.length) {
								const evt = event.parent;
								if (evt.controls) {
									evt.controls[0].classList.add("disabled");
								}
							}
						},
					},
					replace: {
						button(button) {
							const event = get.event(),
								sum = event.sum;
							if (!event.isMine()) {
								return;
							}
							if (button.classList.contains("selectable") == false) {
								return;
							}
							if (ui.selected.buttons.length >= sum) {
								return false;
							}
							button.classList.add("selected");
							ui.selected.buttons.push(button);
							let counterNode = button.querySelector(".caption");
							const count = ui.selected.buttons.filter(i => i == button).length;
							if (counterNode) {
								counterNode = counterNode.childNodes[0];
								counterNode.innerHTML = `×${count}`;
							} else {
								counterNode = ui.create.caption(
									`<span style="font-size:24px; font-family:xinwei; text-shadow:#FFF 0 0 4px, #FFF 0 0 4px, rgba(74,29,1,1) 0 0 3px;">×${count}</span>`,
									button
								);
								counterNode.style.right = "5px";
								counterNode.style.bottom = "2px";
							}
							const evt = event.parent;
							if (evt.controls) {
								evt.controls[0].classList.remove("disabled");
							}
							game.check();
						},
					},
				})
				.set("sum", sum)
				.forResult();
			if (result.bool) {
				var names = result.links.map(link => link[2]);
				storage[0] -= names.length;
				storage[1] = names;
				storage[2] = names;
			} else {
				storage[2] = [];
			}
			player.markSkill("twkanpo");
		},
		marktext: "破",
		intro: {
			markcount(storage) {
				return storage[1].length;
			},
			mark(dialog, content, player) {
				const storage = player.getStorage("twkanpo");
				const sum = storage[0];
				const names = storage[1];
				dialog.addText("剩余可记录" + sum + "次牌名");
				if (player.isUnderControl(true) && names.length) {
					dialog.addText("当前记录牌名：");
					dialog.addSmall([names, "vcard"]);
				}
			},
		},
		group: "twkanpo_kanpo",
		subSkill: {
			kanpo: {
				audio: "sbkanpo",
				trigger: { global: "useCard" },
				filter(event, player) {
					return event.player != player && player.storage.twkanpo[1].includes(event.card.name);
				},
				prompt2(event, player) {
					return "移除" + get.translation(event.card.name) + "的记录，令" + get.translation(event.card) + "无效";
				},
				check(event, player) {
					var effect = 0;
					if (event.card.name == "wuxie" || event.card.name == "shan") {
						if (get.attitude(player, event.player) < -1) {
							effect = -1;
						}
					} else if (event.targets && event.targets.length) {
						for (var i = 0; i < event.targets.length; i++) {
							effect += get.effect(event.targets[i], event.card, event.player, player);
						}
					}
					if (effect < 0) {
						if (event.card.name == "sha") {
							var target = event.targets[0];
							if (target == player) {
								return !player.countCards("h", "shan");
							} else {
								return target.hp == 1 || (target.countCards("h") <= 2 && target.hp <= 2);
							}
						} else {
							return true;
						}
					}
					return false;
				},
				logTarget: "player",
				content() {
					player.storage.twkanpo[1].remove(trigger.card.name);
					player.markSkill("twkanpo");
					trigger.targets.length = 0;
					trigger.all_excluded = true;
					player.draw();
				},
			},
		},
	},
	//幻丁尚涴
	twshiyi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			return target.countCards("h") > 0;
		},
		async content({ target }, trigger, player) {
			const result1 = await player.choosePlayerCard("h", target).set("forced", true).set("visible", true).forResult();
			const result2 = await target.choosePlayerCard("h", player).set("forced", true).set("visible", true).forResult();
			if (result1?.bool) {
				await player.showCards(result1.links);
			}
			if (result2?.bool) {
				await target.showCards(result2.links);
			}
			if (result1?.bool) {
				await player.gain(
					get.cardPile(function (card) {
						return get.type(card) === get.type(result1.links[0]);
					}),
					"gain2"
				);
			}
			if (result2?.bool) {
				await target.gain(
					get.cardPile(function (card) {
						return get.type(card) === get.type(result2.links[0]);
					}),
					"gain2"
				);
			}
			if (!result1?.bool || !result2?.bool) {
				return;
			}
			if (get.type(result1.links[0]) === get.type(result2.links[0])) {
				await game.asyncDraw([player, target], 2);
			} else {
				await player.gain(
					get.cardPile(function (card) {
						return get.type(card) === get.type(result1.links[0]);
					}),
					"gain2"
				);
				await target.gain(
					get.cardPile(function (card) {
						return get.type(card) === get.type(result2.links[0]);
					}),
					"gain2"
				);
			}
		},
		ai: {
			order: 7,
			result: {
				player: 1,
				target: 1,
			},
		},
	},
	twchunhui: {
		audio: 2,
		trigger: { global: "useCardToTargeted" },
		usable: 1,
		filter(event, player) {
			if (player.hp < event.target.hp || get.distance(player, event.target) > 1 || !player.countCards("h")) {
				return false;
			}
			return get.tag(event.card, "damage") && get.type(event.card) == "trick";
		},
		check(event, player) {
			return get.attitude(player, event.target) >= 0;
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const { target } = trigger;
			if (player.countCards("h") && player != target) {
				await target.gainPlayerCard(player, "h", true, "visible");
			}
			player
				.when({ global: "useCardAfter" })
				.filter(evt => evt == trigger.getParent())
				.step(async () => {
					if (!target.hasHistory("damage", evt => evt.card == trigger.card)) {
						await player.draw();
					}
				});
		},
	},
	//幻黄盖
	twfenxian: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		async content(event, trigger, player) {
			const { target } = event;
			let bool = false;
			if (
				[player, target].some(i =>
					i.getCards("ej").some(card => {
						const juedou = get.autoViewAs({ name: "juedou" }, [card]);
						return game.hasPlayer(current => current != player && target.canUse(juedou, current));
					})
				)
			) {
				bool = true;
			}
			const { links } = bool
				? await target
						.chooseButton(
							[
								"焚险：请选择一项",
								[
									[
										[
											"juedou",
											`将${get.translation(player)}或你场上的一张牌当做【决斗】对一名除${get.translation(player)}以外的角色使用`,
										],
										["huogong", `${get.translation(player)}视为对你使用一张【火攻】`],
									],
									"textbutton",
								],
							],
							true
						)
						.forResult()
				: { links: ["huogong"] };
			if (links[0] === "huogong") {
				const huogong = get.autoViewAs({ name: "huogong", isCard: true });
				if (player.canUse(huogong, target, false)) {
					await player.useCard(huogong, target, false);
				}
			} else {
				const dialog = [`将${get.translation(player)}或你场上的一张牌当做【决斗】对一名除${get.translation(player)}以外的角色使用`];
				for (const i of [player, target].unique().sortBySeat()) {
					if (i.countCards("ej") > 0) {
						dialog.addArray([`${get.translation(i)}场上的牌`, i.getCards("ej")]);
					}
				}
				const { links: cards } = await target
					.chooseButton(dialog, true)
					.set("filterButton", button => {
						const { link: card } = button;
						const player = get.player();
						const target = get.event().getParent().player;
						const juedou = get.autoViewAs({ name: "juedou" }, [card]);
						return game.hasPlayer(current => current != target && player.canUse(juedou, current));
					})
					.forResult();
				await target
					.chooseUseTarget({ name: "juedou", isCard: true }, cards)
					.set("targetx", player)
					.set("filterTarget", function (card, player, target) {
						var evt = _status.event;
						if (_status.event.name == "chooseTarget") {
							evt = evt.getParent();
						}
						if (target === evt.targetx) {
							return false;
						}
						return lib.filter.filterTarget(card, player, target);
					});
			}
		},
		ai: {
			order: 7,
			result: { target: -1 },
		},
	},
	twjuyan: {
		audio: 2,
		trigger: { source: "damageSource" },
		filter(event, player) {
			return event.hasNature("fire");
		},
		forced: true,
		async content(event, trigger, player) {
			await player.draw();
			await trigger.player.loseMaxHp();
		},
	},
};
