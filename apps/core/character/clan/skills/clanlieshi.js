import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanlieshi" | "clandianzhan" | "clanhuanyin" | "clandaojie">} */
export const groupSkills = {
	//族荀采
	clanlieshi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return !player.isDisabledJudge() || player.countCards("h", card => ["sha", "shan"].includes(get.name(card))) > 0;
		},
		chooseButton: {
			dialog(event, player) {
				var dialog = ui.create.dialog("烈誓：选择一项", "hidden");
				dialog.add([lib.skill.clanlieshi.choices.slice(), "textbutton"]);
				return dialog;
			},
			filter(button, player) {
				var link = button.link;
				if (link == "damage") {
					return !player.isDisabledJudge();
				}
				var num = player.countCards("h", link);
				return num > 0 && num == player.getDiscardableCards(player, "h").filter(i => get.name(i) == link).length;
			},
			check(button) {
				var player = _status.event.player;
				switch (button.link) {
					case "damage":
						if (get.damageEffect(player, player, player, "fire") >= 0) {
							return 10;
						}
						if (player.hp >= Math.max(2, 3 - player.getFriends().length) && game.countPlayer(current => get.attitude(player, current) < 0 && current.countCards("h", card => ["sha", "shan"].includes(get.name(card))))) {
							return 0.8 + Math.random();
						}
						return 0;
					case "shan":
						if (player.countCards("h", "shan") == 1) {
							return 8 + Math.random();
						}
						return 1 + Math.random();
					case "sha":
						if (player.countCards("h", "sha") == 1) {
							return 8 + Math.random();
						}
						return 0.9 + Math.random();
				}
			},
			backup(links) {
				var next = get.copy(lib.skill["clanlieshi_backupx"]);
				next.choice = links[0];
				return next;
			},
			prompt(links) {
				if (links[0] == "damage") {
					return "废除判定区并受到1点火焰伤害";
				}
				return "弃置所有【" + get.translation(links[0]) + "】";
			},
		},
		choices: [
			["damage", "废除判定区并受到1点火焰伤害"],
			["shan", "弃置所有【闪】"],
			["sha", "弃置所有【杀】"],
		],
		ai: {
			order(item, player) {
				if (!player) {
					return;
				}
				var eff = get.damageEffect(player, player, player, "fire"),
					disabled = !player.isDisabledJudge();
				if ((player.countCards("h", "sha") == 1 || player.countCards("h", "shan") == 1) && eff < 0 && !disabled) {
					return 8;
				} else if (eff >= 0 && !disabled) {
					return 5.8;
				}
				if (!disabled && !player.countCards("h", card => ["sha", "shan"].includes(get.name(card)))) {
					if ((!player.hasSkill("clanhuanyin") || !player.canSave(player)) && player.hp <= 1) {
						return 0;
					}
					if (player.canSave(player) && player.hp == 1 && player.countCards("h") <= 1) {
						return 2.6;
					}
					if (player.hp < Math.max(2, 3 - player.getFriends().length) || !game.countPlayer(current => get.attitude(player, current) < 0 && current.countCards("h", card => ["sha", "shan"].includes(get.name(card))))) {
						return 0;
					}
				}
				return 2.5;
			},
			expose: 0.2,
			result: { player: 1 },
		},
		subSkill: {
			backup: {},
			backupx: {
				audio: "clanlieshi",
				selectCard: -1,
				selectTarget: -1,
				filterCard: () => false,
				filterTarget: () => false,
				multitarget: true,
				async content(event, trigger, player) {
					const choice = lib.skill.clanlieshi_backup.choice;
					if (choice == "damage") {
						await player.damage("fire");
						if (!player.isDisabledJudge()) {
							player.disableJudge();
						}
					} else {
						const cards = player.getCards("h", choice);
						if (cards.length) {
							await player.discard(cards);
						}
					}

					if (!player.isIn() || !game.hasPlayer(current => current != player)) {
						return;
					}

					let result = await player
						.chooseTarget("烈誓：令一名其他角色选择另一项", lib.filter.notMe, true)
						.set("ai", target => {
							const player = _status.event.player;
							const chosen = _status.event.getParent().choice;
							const att = get.attitude(player, target);
							if (chosen == "damage") {
								if (att > 0) {
									return 0;
								}
								return -att / 2 + target.countCards("h", card => ["sha", "shan"].includes(get.name(card)));
							}
							return get.damageEffect(target, player, player, "fire");
						})
						.set("choice", choice)
						.forResult();

					if (!result.bool) {
						return;
					}

					const target = result.targets[0];
					player.line(target, "fire");

					const list = [];
					let choiceList = lib.skill.clanlieshi.choices.slice();
					choiceList = choiceList.map((link, ind, arr) => {
						let text = link[1];
						let ok = true;
						if (arr[ind][0] == choice) {
							text += "（" + get.translation(player) + "已选）";
							ok = false;
						}
						if (ind == 0) {
							if (target.isDisabledJudge()) {
								ok = false;
							}
						} else if (ind > 0) {
							const name = ind == 1 ? "shan" : "sha";
							if (!target.countCards("h", name)) {
								ok = false;
							}
						}
						if (!ok) {
							text = '<span style="opacity:0.5">' + text + "</span>";
						} else {
							list.push("选项" + get.cnNumber(ind + 1, true));
						}
						return text;
					});

					if (!list.length) {
						game.log(target, "没有能执行的选项");
						return;
					}

					result = await target
						.chooseControl(list)
						.set("choiceList", choiceList)
						.set("ai", () => {
							const controls = _status.event.controls.slice();
							const player = _status.event.player;
							const user = _status.event.getParent().player;
							if (controls.length == 1) {
								return controls[0];
							}
							if (controls.includes("选项一") && get.damageEffect(player, user, player, "fire") >= 0) {
								return "选项一";
							}
							if (controls.includes("选项一") && player.hp <= 2 && player.countCards("h", card => ["sha", "shan"].includes(get.name(card))) <= 3) {
								controls.remove("选项一");
							}
							if (controls.length == 1) {
								return controls[0];
							}
							if (player.getCards("h", "sha").reduce((p, c) => p + get.value(c, player), 0) > player.getCards("h", "sha").reduce((p, c) => p + get.value(c, player), 0)) {
								if (controls.includes("选项三")) {
									return "选项三";
								}
							} else if (controls.includes("选项二")) {
								return "选项二";
							}
							return controls.randomGet();
						})
						.forResult();

					if (result.control == "选项一") {
						if (!target.isDisabledJudge()) {
							target.disableJudge();
						}
						await target.damage("fire");
					} else {
						const cards = target.getCards("h", result.control == "选项二" ? "shan" : "sha");
						if (cards.length) {
							await target.discard(cards);
						}
					}
				},
			},
		},
	},
	clandianzhan: {
		audio: 2,
		intro: {
			content: "已使用过的花色：$",
			onunmark: true,
		},
		trigger: { player: "useCardAfter" },
		forced: true,
		filter(event, player) {
			if (!lib.suit.includes(get.suit(event.card))) {
				return false;
			}
			const suit = get.suit(event.card);
			if (player.getRoundHistory("useCard", evt => get.suit(evt.card) == suit).indexOf(event) != 0) {
				return false;
			}
			return (event.targets && event.targets.length == 1 && !event.targets[0].isLinked()) || player.hasCard(card => get.suit(card) == get.suit(event.card) && player.canRecast(card), "h");
		},
		async content(event, trigger, player) {
			let linked = false;
			let recasted = false;

			if (trigger.targets && trigger.targets.length === 1 && !trigger.targets[0].isLinked()) {
				await trigger.targets[0].link(true);
				linked = true;
			}

			const cards = player.getCards("h", card => get.suit(card) === get.suit(trigger.card) && player.canRecast(card));
			if (cards.length > 0) {
				await player.recast(cards);
				recasted = true;
			}

			if (linked && recasted) {
				await player.draw();
			}
		},
		group: "clandianzhan_count",
		subSkill: {
			count: {
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					let suit = get.suit(event.card);
					return lib.suits.includes(suit) && !player.getStorage("clandianzhan").includes(suit);
				},
				forced: true,
				silent: true,
				async content(event, trigger, player) {
					const suits = player
						.getRoundHistory("useCard", evt => {
							return lib.suits.includes(get.suit(evt.card));
						})
						.reduce((list, evt) => {
							return list.add(get.suit(evt.card));
						}, [])
						.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
					if (!player.storage.clandianzhan) {
						player.when({ global: "roundStart" }).step(async () => {
							delete player.storage.clandianzhan;
							player.unmarkSkill("clandianzhan");
						});
					}
					player.storage.clandianzhan = suits;
					player.markSkill("clandianzhan");
				},
			},
		},
		init(player) {
			let suits = player
				.getRoundHistory("useCard", evt => {
					return lib.suits.includes(get.suit(evt.card));
				})
				.reduce((list, evt) => {
					return list.add(get.suit(evt.card));
				}, [])
				.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
			if (suits.length) {
				if (!player.storage.clandianzhan) {
					player.when({ global: "roundStart" }).step(async () => {
						delete player.storage.clandianzhan;
						player.unmarkSkill("clandianzhan");
					});
				}
				player.storage.clandianzhan = suits;
				player.markSkill("clandianzhan");
			}
		},
	},
	clanhuanyin: {
		audio: 2,
		trigger: { player: "dying" },
		forced: true,
		check: () => true,
		filter(event) {
			return event.player.countCards("h") < 4;
		},
		async content(event, trigger, player) {
			await player.drawTo(4);
		},
	},
	clandaojie: {
		audio: 2,
		audioname: ["clan_xunshu", "clan_xunchen", "clan_xuncai", "clan_xuncan", "clan_xunyou", "clan_xunyu", "clan_xunshuang", "clan_xunshi"],
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			return (
				get.type(event.card, null, false) == "trick" &&
				!get.tag(event.card, "damage") &&
				event.cards.filterInD().length > 0 &&
				player
					.getHistory("useCard", evt => {
						return get.type(evt.card, null, false) == "trick" && !get.tag(evt.card, "damage");
					})
					.indexOf(event) == 0
			);
		},
		forced: true,
		clanSkill: true,
		async content(event, trigger, player) {
			const skills = player.getSkills(null, false, false).filter(skill => {
				let info = get.info(skill);
				if (!info || info.charlotte || !get.is.locked(skill) || get.skillInfoTranslation(skill, player).length == 0) {
					return false;
				}
				return true;
			});
			let result;
			if (!skills.length) {
				result = { bool: false };
			} else {
				result = await player
					.chooseButton(["蹈节：失去一个锁定技，或点“取消”失去1点体力", [skills, "skill"]])
					.set("displayIndex", false)
					.set("ai", button => {
						const player = get.player();
						const skills = get.event().listx.slice();
						skills.removeArray(["clanbaichu"]);
						const { link } = button;
						if (!skills.includes(link)) {
							return 0;
						}
						const info = get.info(link);
						if (info?.ai?.neg || info?.ai?.halfneg) {
							return 3;
						}
						if (get.effect(player, { name: "losehp" }, player, player) >= 0 || player.hp > 3 || player.countCards("hs", card => player.canSaveCard(card, player))) {
							return 0;
						}
						if (Math.random() < 0.75 && link == "clandaojie") {
							if (player.hasSkill("clanbaichu")) return 0;
							return 2;
						} else if (get.event().removeSkillCheck) {
							return 100 - get.skillRank(link);
						}
						return 0;
					})
					.set("listx", skills)
					.set("removeSkillCheck", player.hp < 2 && !player.countCards("hs", card => get.tag(card, "save")))
					.forResult();
			}
			if (result?.bool && result?.links?.length) {
				await player.removeSkills(result.links);
			} else {
				await player.loseHp();
			}
			const targets = game.filterPlayer(current => current == player || current.hasClan("颍川荀氏"));
			if (!targets.length || !trigger.cards.someInD()) {
				return;
			}
			result =
				targets.length == 1
					? { bool: true, targets }
					: await player
							.chooseTarget("蹈节：将" + get.translation(trigger.cards.filterInD()) + "交给一名颍川荀氏角色", true, (card, player, target) => {
								return target == player || target.hasClan("颍川荀氏");
							})
							.set("ai", target => get.attitude(get.player(), target))
							.forResult();
			if (result?.bool && result?.targets?.length) {
				const target = result.targets[0];
				player.line(target, "green");
				if (trigger.cards.someInD()) {
					await target.gain(trigger.cards.filterInD(), player, "gain2");
				}
			}
		},
	},
};
