import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsblunzhan" | "olsbjuejue" | "olsblucun" | "olsbtuisheng">} */
export const groupSkills = {
	//OL谋文丑
	olsblunzhan: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			const nums = Array.from({ length: 5 })
				.map((_, i) => i + 1)
				.removeArray(player.getStorage("olsblunzhan_used"));
			return nums.length > 0 && player.countCards("hes") >= Math.min(...nums);
		},
		onChooseToUse(event) {
			if (!game.online && !event.olsblunzhan) {
				const player = get.player();
				event.set("olsblunzhan", player.getHistory("useCard"));
			}
			event.targetprompt2.add(target => {
				if (!target.isIn() || get.event().skill != "olsblunzhan" || !get.event().filterTarget(get.card(), get.player(), target)) {
					return false;
				}
				const player = get.player(),
					history = get.event().olsblunzhan;
				const num = history?.filter(evt => evt.targets?.includes(target)).length;
				return `轮战${num}`;
			});
		},
		filterCard: true,
		selectCard: () => [1, 5],
		position: "hes",
		filterOk: () => !get.player().getStorage("olsblunzhan_used").includes(ui.selected.cards.length),
		viewAs: { name: "juedou", storage: { olsblunzhan: true } },
		allowChooseAll: true,
		precontent() {
			player.addTempSkill("olsblunzhan_used");
			player.markAuto("olsblunzhan_used", event.result.cards.length);
			player.addTempSkill("olsblunzhan_effect");
		},
		ai: {
			order(item, player) {
				return get.order({ name: "juedou" }, player) - 0.1;
			},
		},
		locked: false,
		mod: {
			playerEnabled(card, player, target) {
				if (card.storage?.olsblunzhan && player.getStorage("olsblunzhan_ban").includes(target)) {
					return false;
				}
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			ban: {
				charlotte: true,
				onremove: true,
			},
			effect: {
				charlottte: true,
				audio: "olsblunzhan",
				trigger: { source: "damageSource" },
				filter(event, player) {
					const evt = event.getParent(2);
					if (!evt || evt.name !== "useCard" || evt.player !== player || !evt.card?.storage?.olsblunzhan) {
						return false;
					}
					return evt.targets?.length === 1 && evt.targets[0] === event.player;
				},
				prompt2(event, player) {
					const num = player.getHistory("useCard", evt => evt.targets?.includes(event.player)).length;
					return "摸" + get.cnNumber(num) + "张牌，本回合不能再对其发动〖轮战〗";
				},
				logTarget: "player",
				async content(event, trigger, player) {
					await player.draw(player.getHistory("useCard", evt => evt.targets?.includes(trigger.player)).length);
					player.addTempSkill("olsblunzhan_ban");
					player.markAuto("olsblunzhan_ban", [trigger.player]);
				},
			},
		},
	},
	olsbjuejue: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			if (_status.currentPhase !== player) {
				return false;
			}
			if (!event.isFirstTarget || event.targets.length !== 1 || event.target === player) {
				return false;
			}
			return (
				player
					.getHistory("useCard", evt => {
						if (!evt.olsbjuejue) {
							return false;
						}
						return (evt.targets ?? []).length === 1 && evt.targets[0] !== player;
					})
					.indexOf(event.getParent()) === 0
			);
		},
		forced: true,
		logTarget: "target",
		content() {
			const { target } = trigger;
			target.chooseToDiscard("he", true, player.getHistory("useCard", evt => evt.targets?.includes(target)).length);
		},
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
		},
		subSkill: {
			mark: {
				charlotte: true,
				trigger: {
					player: "loseEnd",
					global: ["equipEnd", "addJudgeEnd", "gainEnd", "loseAsyncEnd", "addToExpansionEnd"],
				},
				filter(event, player) {
					if (_status.currentPhase !== player) {
						return false;
					}
					if (player.countCards("h") || event.getParent().name !== "useCard") {
						return false;
					}
					const evt = event.getl(player);
					return evt?.player == player && evt.hs?.length > 0 && evt.hs.length === evt.cards.length;
				},
				forced: true,
				popup: false,
				firstDo: true,
				content() {
					trigger.getParent().set("olsbjuejue", true);
				},
			},
		},
	},
	//OL谋张让
	olsblucun: {
		audio: 6,
		enable: "chooseToUse",
		filter(event, player) {
			const types = ["basic", "trick"].removeArray(player.getStorage("olsblucun_round"));
			return get
				.inpileVCardList(info => {
					const name = info[2];
					if (!types.includes(get.type(name))) {
						return false;
					}
					const infox = get.info({ name });
					if (!infox || infox.notarget || !infox.filterTarget) {
						return false;
					}
					return !player.getStorage("olsblucun_used").some(item => item.name === info[2] && item.nature === info[3]);
				})
				.some(info => event.filterCard(get.autoViewAs({ name: info[2], nature: info[3], isCard: true }, "unsure"), player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const types = ["basic", "trick"].removeArray(player.getStorage("olsblucun_round"));
				const vcards = get.inpileVCardList(info => {
					const name = info[2];
					if (!types.includes(get.type(name))) {
						return false;
					}
					const infox = get.info({ name });
					if (!infox || infox.notarget || !infox.filterTarget) {
						return false;
					}
					if (player.getStorage("olsblucun_used").some(item => item.name === info[2] && item.nature === info[3])) {
						return false;
					}
					return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3], isCard: true }, "unsure"), player, event);
				});
				return ui.create.dialog("赂存", [vcards, "vcard"]);
			},
			check(button) {
				const event = get.event().getParent();
				if (event.type !== "phase") {
					return 1;
				}
				return get.player().getUseValue(new lib.element.VCard({ name: button.link[2], nature: button.link[3], isCard: true }));
			},
			prompt(links) {
				return '###赂存###<div class="text center">视为使用' + (get.translation(links[0][3]) || "") + "【" + get.translation(links[0][2]) + "】</div>";
			},
			backup(links) {
				return {
					audio: "olsblucun",
					filterCard: () => false,
					selectCard: -1,
					popname: true,
					log: false,
					viewAs: { name: links[0][2], nature: links[0][3], isCard: true },
					async precontent(event, trigger, player) {
						player.logSkill("olsblucun");
						const name = "ol_sb_zhangrang";
						const key = ["name", "name2"].find(i => player[i] == name);
						if (key) {
							player.changeSkin({ characterName: name }, `${name}${player.skin[key] == name ? "_shadow" : ""}`);
						}
						player.addTempSkill("olsblucun_round", "roundStart");
						player.markAuto("olsblucun_round", [get.type(event.result.card.name)]);
						player.addSkill("olsblucun_used");
						player.markAuto("olsblucun_used", [event.result.card]);
						player.addTempSkill("olsblucun_effect");
					},
				};
			},
		},
		hiddenCard(player, name) {
			const type = get.type(name);
			if (player.getStorage("olsblucun_round").includes(type) || !["basic", "trick"].includes(type)) {
				return false;
			}
			const info = get.info({ name });
			if (!info || info.notarget || !info.filterTarget) {
				return false;
			}
			if (get.inpileVCardList().some(info => info[2] === name && player.getStorage("olsblucun_used").some(item => item.name === info[2] && item.nature === info[3]))) {
				return false;
			}
			return true;
		},
		marktext: "赂",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile({ cards });
			}
		},
		ai: {
			fireAttack: true,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond") {
					return false;
				}
				return (() => {
					switch (tag) {
						case "fireAttack":
							return ["sha", "huogong"];
						default:
							return [tag.slice("respond".length).toLowerCase()];
					}
				})().some(name => get.info("olsblucun").hiddenCard(player, name));
			},
			order(item, player) {
				if (player && _status.event.type === "phase") {
					let max = 0,
						names = get.inpileVCardList(info => {
							const name = info[2];
							if (!["basic", "trick"].includes(get.type(name))) {
								return false;
							}
							const infox = get.info({ name });
							if (!infox || infox.notarget || !infox.filterTarget) {
								return false;
							}
							return !player.getStorage("olsblucun_used").some(item => item.name === info[2] && item.nature === info[3]);
						});
					names = names.map(namex => new lib.element.VCard({ name: namex[2], nature: namex[3] }));
					names.forEach(card => {
						if (player.getUseValue(card) > 0) {
							let temp = get.order(card);
							if (temp > max) {
								max = temp;
							}
						}
					});
					return max + (max > 0 ? 0.2 : 0);
				}
				return 10;
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		group: ["olsblucun_draw"],
		subSkill: {
			round: {
				charlotte: true,
				onremove: true,
			},
			backup: {},
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					mark(dialog, storage = []) {
						if (!storage.length) {
							return "当前未因【赂存】视为使用牌";
						}
						dialog.addText("已因【赂存】视为使用牌");
						dialog.addSmall([storage, "vcard"]);
					},
				},
			},
			draw: {
				audio: "olsblucun",
				forced: true,
				popup: false,
				trigger: { global: "phaseEnd" },
				async content(event, trigger, player) {
					const name = "ol_sb_zhangrang";
					if (player.countExpansions("olsblucun") > 0) {
						player.logSkill(event.name);
						player.changeSkin({ characterName: name }, `${name}_shadow`);
						const cards = player.getExpansions("olsblucun").randomGets(1);
						await player.loseToDiscardpile({ cards });
						await player.draw();
					}
					player.changeSkin({ characterName: name }, name);
				},
			},
			effect: {
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.skill === "olsblucun_backup" && event.targets?.some(target => target.isIn() && !event.targets.some(targetx => targetx.countCards("h") > target.countCards("h")));
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const target = trigger.targets.filter(target => target.isIn() && !trigger.targets.some(targetx => targetx.countCards("h") > target.countCards("h"))).randomGet();
					if (!target) {
						return;
					}
					player.line(target);
					const result = await target
						.chooseCard({
							prompt: "赂存：将一张手牌置于" + get.translation(player) + "的武将牌",
							position: "h",
							forced: true,
						})
						.forResult();
					if (result?.cards?.length) {
						const name = "ol_sb_zhangrang";
						player.changeSkin({ characterName: name }, `${name}_shadow`);
						await player.addToExpansion({
							cards: result.cards,
							source: target,
							animate: "give",
							gaintag: ["olsblucun"],
						});
					}
				},
			},
		},
	},
	olsbtuisheng: {
		limited: true,
		audio: 6,
		trigger: { player: ["phaseZhunbeiBegin", "dying"] },
		filter(event, player) {
			return player.getStorage("olsblucun_used").length > 0;
		},
		check(event, player) {
			if (event.name === "dying") {
				return true;
			}
			return player.isDamaged() && player.getExpansions("olsblucun").length >= 5;
		},
		skillAnimation: true,
		animationColor: "water", //笑点解析——以水蜕生
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const names = player
				.getStorage("olsblucun_used")
				.map(item => item.name)
				.toUniqued()
				.slice();
			player.removeSkill("olsblucun_used");
			const goon = player.countCards("h") > 0;
			let result;
			const discard = Array.from(ui.discardPile.childNodes).filter(i => names.includes(get.name(i)));
			if (!goon) {
				result = { index: 1 };
			} else {
				const num = get.cnNumber(game.roundNumber);
				result = await player
					.chooseControl({
						choiceList: ["将所有手牌置于武将牌上，称为“赂”", `随机从弃牌堆中获得${num}张牌（${get.translation(names)}）`],
						prompt: "蜕生：请选择一项执行并回复1点体力",
						ai: () => {
							const { player, discard } = get.event();
							return Math.min(discard.length, game.roundNumber) >= player.countCards("h") ? 1 : 0;
						},
					})
					.set("discard", discard)
					.forResult();
			}
			if (result?.index === 0) {
				await player.addToExpansion({
					cards: player.getCards("h"),
					source: player,
					animate: "give",
					gaintag: ["olsblucun"],
				});
			} else {
				const cards = discard.randomGets(game.roundNumber);
				if (cards.length) {
					await player.gain({ cards, animate: "gain2" });
				} else {
					player.popup("杯具");
				}
			}
			await player.recover();
		},
		ai: { combo: "olsblucun" },
	},
};
