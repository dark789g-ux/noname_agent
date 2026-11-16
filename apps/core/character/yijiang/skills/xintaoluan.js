import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xintaoluan" | "xintaoluan2" | "xintaoluan_backup" | "xincaishi" | "xinzhongjian" | "new_qingxian">} */
export const groupSkills = {
	xintaoluan: {
		selectionSpec: true,
		hiddenCard(player, name) {
			return !player.getStorage("xintaoluan").includes(name) && player.countCards("hes") > 0 && lib.inpile.includes(name);
		},
		audio: "taoluan",
		enable: "chooseToUse",
		filter(event, player) {
			return (
				player.hasCard(card =>
					lib.inpile.some(name => {
						if (player.getStorage("xintaoluan").includes(name)) {
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
					}, "hes")
				) && !_status.dying.length
			);
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var name of lib.inpile) {
					if (get.type(name) == "basic" || get.type(name) == "trick") {
						if (player.getStorage("xintaoluan").includes(name)) {
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
					filterCard: true,
					audio: "taoluan",
					popname: true,
					check(card) {
						return 7 - get.value(card);
					},
					position: "hes",
					viewAs: { name: links[0][2], nature: links[0][3] },
					onuse(result, player) {
						const evt = _status.event.getParent("phase");
						if (evt?.name === "phase" && !evt.xintaoluan) {
							evt.xintaoluan = true;
							const next = game.createEvent("xintaoluan_clear");
							_status.event.next.remove(next);
							evt.after.push(next);
							next.player = player;
							next.setContent(async (event, trigger, player) => {
								delete player.storage.xintaoluan;
								delete player.storage.xintaoluan2;
							});
						}
						player.markAuto("xintaoluan", [result.card.name]);
					},
				};
			},
			prompt(links, player) {
				return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order: 4,
			save: true,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (!player.countCards("hes") || player.isTempBanned("xintaoluan")) {
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
			result: {
				player(player) {
					var num = player.countMark("xintaoluan2");
					var players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i] != player && players[i].countCards("he") > (num + 1) * 2 && get.attitude(player, players[i]) > 0) {
							return 1;
						}
					}
					return 0;
				},
			},
			threaten: 1.9,
		},
		group: "xintaoluan2",
	},
	xintaoluan2: {
		trigger: { player: ["useCardAfter", "respondAfter"] },
		forced: true,
		popup: false,
		charlotte: true,
		sourceSkill: "xintaoluan",
		filter(event, player) {
			if (!game.hasPlayer(current => current != player)) {
				return false;
			}
			return event.skill == "xintaoluan_backup";
		},
		async content(event, trigger, player) {
			player.addMark("xintaoluan2", 1, false);
			const num = player.countMark("xintaoluan2");
			let result = await player
				.chooseTarget({
					prompt: `滔乱<br><br><div class="text center">令一名其他角色选择一项：1.交给你${get.cnNumber(num)}张与你以此法使用的牌类别不同的牌；2.你失去${get.cnNumber(num)}点体力`,
					filterTarget(card, player, target) {
						return target !== player;
					},
					forced: true,
					ai(target) {
						const player = get.player();
						if (get.attitude(player, target) > 0) {
							if (get.attitude(target, player) > 0) {
								return target.countCards("h");
							}
							return target.countCards("h") / 2;
						}
						return 0;
					},
				})
				.forResult();
			if (!result.bool || !result.targets?.length) {
				return;
			}

			const target = result.targets[0];
			player.line(target, "green");
			const type = get.type(trigger.card, "trick");
			result = await target
				.chooseCard({
					prompt: `滔乱<br><br><div class="text center">交给${get.translation(player)}${get.cnNumber(num)}张不为${get.translation(type)}牌的牌，或令其失去${get.cnNumber(num)}点体力且滔乱无效直到回合结束`,
					filterCard(card) {
						return get.type(card, "trick") !== get.event().cardType;
					},
					selectCard: num,
					position: "he",
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
			if (result.bool && result.cards?.length) {
				await target.give(result.cards, player, true);
			} else {
				player.tempBanSkill("xintaoluan");
				await player.loseHp(num);
			}
		},
	},
	xintaoluan_backup: {},
	xincaishi: {
		audio: "caishi",
		trigger: { player: "phaseDrawBegin2" },
		async cost(event, trigger, player) {
			const choices = [];
			const choiceList = ["少摸一张牌，本回合发动〖忠鉴〗时可以多展示自己的一张牌", "手牌上限-1且本回合发动〖忠鉴〗时可以多展示对方的一张牌", "多摸两张牌，然后本回合内不能发动〖忠鉴〗"];
			if (!trigger.numFixed && trigger.num > 0) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			choices.push("选项二");
			if (!trigger.numFixed) {
				choices.push("选项三");
			} else {
				choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "</span>";
			}
			const result = await player
				.chooseControl(choices, "cancel2")
				.set("choiceList", choiceList)
				.set("prompt", get.prompt(event.skill))
				.set("ai", () => {
					return 2;
				})
				.forResult();
			event.result = {
				bool: result?.control !== "cancel2",
				cost_data: result?.index,
			};
		},
		async content(event, trigger, player) {
			const index = event.cost_data;
			trigger.num += index > 1 ? 2 : index - 1;
			player.addTempSkill(`${event.name}_${index}`);
		},
		subSkill: {
			0: {
				charlotte: true,
				mark: true,
				intro: { content: "本回合发动〖忠鉴〗时可以多展示自己的一张牌" },
			},
			1: {
				charlotte: true,
				mark: true,
				intro: { content: "本回合发动〖忠鉴〗时可以多展示目标角色的一张牌" },
				mod: {
					maxHandcard(player, num) {
						return num - 1;
					},
				},
			},
			2: {
				charlotte: true,
				mark: true,
				intro: { content: "本回合不能发动〖忠鉴〗" },
			},
		},
	},
	xinzhongjian: {
		audio: "zhongjian",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return !player.hasSkill("xincaishi_2") && player.countCards("h") > 0;
		},
		filterTarget(event, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		filterCard: true,
		selectCard() {
			return get.player().hasSkill("xincaishi_0") ? [1, 2] : [1, 1];
		},
		check() {
			return 1;
		},
		discard: false,
		lose: false,
		async content(event, trigger, player) {
			const { cards, target } = event;
			const suits = cards.map(card => get.suit(card)).toUniqued();
			const numbers = cards.map(card => get.number(card)).toUniqued();
			await player.showCards(cards);
			if (!target.countCards("h")) {
				return;
			}
			const result = await player.choosePlayerCard(target, "h", [1, player.hasSkill("xincaishi_1") ? 4 : 3], `请选择${get.translation(target)}要展示的牌`, true).forResult();
			if (!result?.cards?.length) {
				return;
			}
			const cards2 = result.cards.slice(0);
			await target.showCards(cards2);
			while (cards2.length) {
				const card = cards2.shift();
				let bool = false;
				if (suits.includes(get.suit(card))) {
					bool = true;
					await player.draw();
				}
				if (numbers.includes(get.number(card))) {
					bool = true;
					await target.damage("nocard");
				}
				if (!bool && player.countDiscardableCards(player, "h")) {
					await player.chooseToDiscard("h", true);
				}
			}
		},
		ai: {
			result: {
				target(player, target) {
					return -target.countCards("h");
				},
			},
		},
	},
	new_qingxian: {
		group: ["qingxian_draw"],
		enable: "phaseUse",
		audio: "qingxian",
		usable: 1,
		position: "he",
		filterTarget(card, player, target) {
			return target != player;
		},
		complexCard: true,
		complexSelect: true,
		selectTarget() {
			return ui.selected.cards.length;
		},
		filterCard: true,
		selectCard() {
			var player = _status.event.player;
			return [1, player.hp];
		},
		check(cardx) {
			var player = _status.event.player;
			var number = game.countPlayer(function (target) {
				if (player == target) {
					return false;
				}
				var pe = player.countCards("e", function (card) {
					return card != cardx && ui.selected.cards.includes(card) == false;
				});
				var te = target.countCards("e");
				if (pe > te && target.isDamaged() && get.attitude(player, target) > 2) {
					return true;
				} else if (pe == te && get.attitude(player, target) > 2) {
					return true;
				} else if (pe < te && get.attitude(player, target) < 0) {
					return true;
				}
				return false;
			});
			if (ui.selected.cards.length < number) {
				return 7 - get.value(cardx);
			} else {
				return 0;
			}
		},
		targetprompt(target) {
			var pe = _status.event.player.countCards("e", function (card) {
				return ui.selected.cards.includes(card) == false;
			});
			var te = target.countCards("e");
			if (pe > te) {
				return "回复体力";
			} else if (pe == te) {
				return "摸一张牌";
			} else if (pe < te) {
				return "失去体力";
			}
		},
		line: "thunder",
		async content(event, trigger, player) {
			const { target } = event;
			const pe = player.countCards("e");
			const te = target.countCards("e");
			if (pe > te) {
				await target.recover();
			} else if (pe == te) {
				await target.draw();
			} else if (pe < te) {
				await target.loseHp();
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					var pe = player.countCards("e", function (card) {
						return ui.selected.cards.includes(card) == false;
					});
					var te = target.countCards("e");
					if (pe > te && target.isDamaged()) {
						return 2;
					} else if (pe == te) {
						return 1;
					} else if (pe < te) {
						return -2.5;
					} else {
						return 0;
					}
				},
			},
		},
	},
};
