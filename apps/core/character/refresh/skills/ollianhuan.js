import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const ollianhuanSkills = {
	ollianhuan: {
		audio: "xinlianhuan",
		audioname: ["ol_pangtong"],
		hiddenCard: (player, name) => {
			return name == "tiesuo" && player.hasCard(card => get.suit(card) == "club", "she");
		},
		filter(event, player) {
			if (!player.hasCard(card => get.suit(card) == "club", "she")) {
				return false;
			}
			return event.type == "phase" || event.filterCard({ name: "tiesuo" }, player, event);
		},
		position: "hes",
		inherit: "lianhuan",
		group: "ollianhuan_add",
		subSkill: {
			add: {
				audio: "xinlianhuan",
				audioname: ["ol_pangtong"],
				trigger: { player: "useCard2" },
				filter(event, player) {
					if (event.card.name != "tiesuo") {
						return false;
					}
					var info = get.info(event.card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						if (
							game.hasPlayer(current => {
								return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current);
							})
						) {
							return true;
						}
					}
					return false;
				},
				charlotte: true,
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const result = await player
						.chooseTarget({
							prompt: get.prompt("ollianhuan"),
							filterTarget(card, player, target) {
								const event = get.event();
								return !event.sourcex.includes(target) && lib.filter.targetEnabled2(event.card, player, target);
							},
						})
						.set("prompt2", `为${get.translation(trigger.card)}额外指定一个目标`)
						.set("sourcex", trigger.targets)
						.set("ai", function (target) {
							var player = _status.event.player;
							return get.effect(target, _status.event.card, player, player);
						})
						.set("card", trigger.card)
						.forResult();
					if (result?.bool && result.targets) {
						if (!event.isMine() && !event.isOnline()) {
							await game.delayex();
						}
						const targets = result.targets;
						player.logSkill("ollianhuan_add", targets);
						trigger.targets.addArray(targets);
						game.log(targets, "也成为了", trigger.card, "的目标");
					}
				},
			},
		},
	},
	rehuomo: {
		audio: "huomo",
		audioname: ["huzhao", "re_zhongyao"],
		enable: "chooseToUse",
		hiddenCard(player, name) {
			if (get.type(name) != "basic") {
				return false;
			}
			const list = player.getStorage("rehuomo");
			if (list.includes(name)) {
				return false;
			}
			return player.hasCard(function (card) {
				return get.color(card) == "black" && get.type(card) != "basic";
			}, "eh");
		},
		filter(event, player) {
			if (
				event.type == "wuxie" ||
				!player.hasCard(function (card) {
					return get.color(card) == "black" && get.type(card) != "basic";
				}, "eh")
			) {
				return false;
			}
			const list = player.getStorage("rehuomo");
			for (let name of lib.inpile) {
				if (get.type(name) != "basic" || list.includes(name)) {
					continue;
				}
				let card = { name: name, isCard: true };
				if (event.filterCard(card, player, event)) {
					return true;
				}
				if (name == "sha") {
					for (let nature of lib.inpile_nature) {
						card.nature = nature;
						if (event.filterCard(card, player, event)) {
							return true;
						}
					}
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				const vcards = [];
				const list = player.getStorage("rehuomo");
				for (let name of lib.inpile) {
					if (get.type(name) != "basic" || list.includes(name)) {
						continue;
					}
					let card = { name: name, isCard: true };
					if (event.filterCard(card, player, event)) {
						vcards.push(["基本", "", name]);
					}
					if (name == "sha") {
						for (let nature of lib.inpile_nature) {
							card.nature = nature;
							if (event.filterCard(card, player, event)) {
								vcards.push(["基本", "", name, nature]);
							}
						}
					}
				}
				return ui.create.dialog("活墨", [vcards, "vcard"], "hidden");
			},
			check(button) {
				const player = _status.event.player;
				const card = { name: button.link[2], nature: button.link[3] };
				if (game.hasPlayer(current => player.canUse(card, current) && get.effect(current, card, player, player) > 0)) {
					switch (button.link[2]) {
						case "tao":
							return 5;
						case "jiu":
							return 3.01;
						case "sha":
							if (button.link[3] == "fire") {
								return 2.95;
							} else if (button.link[3] == "thunder") {
								return 2.92;
							} else {
								return 2.9;
							}
						case "shan":
							return 1;
					}
				}
				return 0;
			},
			backup(links, player) {
				return {
					check(card) {
						return 1 / Math.max(0.1, get.value(card));
					},
					filterCard(card) {
						return get.type(card) != "basic" && get.color(card) == "black";
					},
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						suit: "none",
						number: undefined,
						isCard: true,
					},
					position: "he",
					popname: true,
					ignoreMod: true,
					async precontent(event, trigger, player) {
						if (!event.result?.bool || !event.result.card || !event.result.cards?.length) {
							return;
						}
						player.logSkill("rehuomo");
						const card = event.result.cards[0];
						game.log(player, "将", card, "置于牌堆顶");
						await player
							.loseToDiscardpile({
								cards: [card],
								position: ui.cardPile,
								insert_card: true,
							})
							.set("log", false);
						const viewAs = {
							name: event.result.card.name,
							nature: event.result.card.nature,
							isCard: true,
						};
						event.result.card = viewAs;
						event.result.cards = [];
						if (!player.storage.rehuomo) {
							player.when({ global: "phaseAfter" }).step(async (event, trigger, player) => {
								player.unmarkSkill("rehuomo");
							});
						}
						player.markAuto("rehuomo", viewAs.name);
					},
				};
			},
			prompt(links, player) {
				return "将一张黑色非基本牌置于牌堆顶并视为使用一张" + get.translation(links[0][3] || "") + get.translation(links[0][2]);
			},
		},
		marktext: "墨",
		intro: {
			content: "本回合已因〖活墨〗使用过$",
			onunmark: true,
		},
		ai: {
			order() {
				var player = _status.event.player;
				var event = _status.event;
				var list = player.getStorage("rehuomo");
				if (!list.includes("jiu") && event.filterCard({ name: "jiu" }, player, event) && get.effect(player, { name: "jiu" }) > 0) {
					return 3.1;
				}
				return 2.9;
			},
			respondSha: true,
			fireAttack: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "fireAttack") {
					return true;
				}
				if (
					player.hasCard(function (card) {
						return get.color(card) == "black" && get.type(card) != "basic";
					}, "he")
				) {
					if (arg === "respond") {
						return false;
					}
					var list = player.getStorage("rehuomo");
					if (tag == "respondSha") {
						if (list.includes("sha")) {
							return false;
						}
					} else if (tag == "respondShan") {
						if (list.includes("shan")) {
							return false;
						}
					}
				} else {
					return false;
				}
			},
			result: {
				player: 1,
			},
		},
	},
	//界张梁
	rejijun: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			return event.targets && event.targets.includes(player);
		},
		frequent: true,
		async content(event, trigger, player) {
			const judgeEvent = player.judge({
				judge(card) {
					return 1;
				},
			});
			judgeEvent.callback = lib.skill.rejijun.callback;
			await judgeEvent;
		},
		async callback(event, trigger, player) {
			const { card } = event;
			if (typeof card?.number == "number") {
				const next = player.addToExpansion(card, "gain2");
				next.gaintag.add("rejijun");
				await next;
			}
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile({
					cards,
				});
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		marktext: "方",
		ai: { combo: "refangtong" },
	},
	refangtong: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard({
					prompt: get.prompt2("refangtong"),
					filterCard(card) {
						return typeof card.number === "number";
					},
				})
				.set("ai", card => {
					var player = _status.event.player;
					if (!game.hasPlayer(target => target != player && get.damageEffect(target, player, player, "thunder") > 0)) {
						return 0;
					}
					if (
						player.getExpansions("rejijun").reduce(function (num, card) {
							const number = get.number(card, false);
							return num + (typeof number === "number" ? number : 0);
						}, 0) > 36
					) {
						return 1 / (get.value(card) || 0.5);
					} else {
						if (lib.skill.refangtong.thunderEffect(card, player)) {
							return 10 - get.value(card);
						}
						return 5 - get.value(card);
					}
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const cards = event.cards;
			await player.addToExpansion({
				cards,
				source: player,
				animate: "give",
				gaintag: ["rejijun"],
			});
			const result = await player
				.chooseButton({
					selectButton: [1, player.getExpansions("rejijun").length],
					createDialog: ["###是否移去任意张“方”，对一名其他角色造成1点雷属性伤害？###若你移去的“方”的点数和大于36，则改为造成3点雷属性伤害", player.getExpansions("rejijun")],
					allowChooseAll: true,
					ai(button) {
						var player = _status.event.player;
						var cards = player.getExpansions("rejijun");
						if (
							cards.reduce((num, card) => {
								const number = get.number(card, false);
								return num + (typeof number === "number" ? number : 0);
							}, 0) <= 36
						) {
							if (!ui.selected.buttons.length) {
								const number = get.number(button.link, false);
								if (typeof number !== "number") {
									return 0;
								}
								return 1 / number;
							}
							return 0;
						} else {
							var num = 0,
								list = [];
							cards.sort((a, b) => {
								const numberA = get.number(a, false);
								const numberB = get.number(b, false);

								if (typeof numberA !== "number") {
									return 1;
								}
								if (typeof numberB !== "number") {
									return -1;
								}
								return numberB - numberA;
							});
							for (const card of cards) {
								list.push(card);
								const number = get.number(card, false);
								if (typeof number !== "number") {
									continue;
								}
								num += number;
								if (num > 36) {
									break;
								}
							}
							return list.includes(button.link) ? 1 : 0;
						}
					},
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				const bool =
					result.links.reduce((num, card) => {
						const number = get.number(card, false);
						return num + (typeof number === "number" ? number : 0);
					}, 0) > 36;
				await player.loseToDiscardpile({ cards: result.links });
				const result2 = await player
					.chooseTarget({
						prompt: "请选择一名其他角色",
						prompt2: `对其造成${bool ? 3 : 1}点雷属性伤害`,
						filterTarget: lib.filter.notMe,
						ai(target) {
							return get.damageEffect(target, _status.event.player, _status.event.player, "thunder");
						},
					})
					.forResult();
				if (result2?.bool && result2.targets?.length) {
					const target = result2.targets[0];
					player.line(target, "thunder");
					await target.damage({
						num: bool ? 3 : 1,
						nature: "thunder",
					});
				}
			}
		},
		thunderEffect(card, player) {
			let cards = player.getExpansions("rejijun"),
				num = 0;
			cards.push(card);
			if (
				cards.reduce(function (num, card) {
					return num + get.number(card, false);
				}, 0) <= 36
			) {
				return false;
			}
			// @ts-ignore
			cards.sort((a, b) => get.number(b, false) - get.number(a, false));
			let bool = false;
			for (let i = 0; i < cards.length; i++) {
				if (cards[i] == card) {
					bool = true;
				}
				// @ts-ignore
				num += get.number(cards[i], false);
				if (num > 36) {
					break;
				}
			}
			return bool;
		},
	},
	//界司马朗
	requji: {
		inherit: "quji",
		async content(event, trigger, player) {
			const { target, targets, cards } = event;
			await target.recover();
			if (target.isDamaged()) {
				await target.draw();
			}
			if (target == targets[targets.length - 1] && cards.some(card => get.color(card, player) == "black")) {
				await player.loseHp();
			}
		},
	},
};
