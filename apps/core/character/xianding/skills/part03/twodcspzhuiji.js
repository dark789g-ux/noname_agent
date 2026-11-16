import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twodcspzhuiji" | "zhuiji_matie" | "twodcspshichou" | "onedcspzhuiji" | "onedcspshichou" | "dcjiedang" | "dcjidi">} */
export const groupSkills = {
	//SP马超二号
	twodcspzhuiji: {
		audio: "zhuiji",
		audioname2: { matie: "zhuiji_matie" },
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			return event.targets?.some(i => i !== player && !player.getStorage("twodcspzhuiji_buff").includes(i));
		},
		forced: true,
		logTarget(event, player) {
			return event.targets.filter(i => i !== player && !player.getStorage("twodcspzhuiji_buff").includes(i));
		},
		async content(event, trigger, player) {
			player.addTempSkill("twodcspzhuiji_buff");
			player.markAuto("twodcspzhuiji_buff", event.targets);
		},
		subSkill: {
			buff: {
				charlotte: true,
				onremove: true,
				mod: {
					globalFrom(from, to) {
						if (from.getStorage("twodcspzhuiji_buff").includes(to)) {
							return -Infinity;
						}
					},
				},
				intro: { content: "计算与$的距离视为1" },
			},
		},
	},
	zhuiji_matie: { audio: 2 },
	twodcspshichou: {
		audio: "ol_shichou",
		enable: "phaseUse",
		viewAs: {
			name: "sha",
		},
		position: "hes",
		viewAsFilter(player) {
			return (
				player.countCards("hes", function (card) {
					return lib.skill.twodcspshichou.filterCard(card, player);
				}) > 0
			);
		},
		filterCard(card, player) {
			const color = player.getStorage("twodcspshichou_used", [[], []])[0];
			return !color.includes(get.color(card));
		},
		filterTarget(card, player, target) {
			const targetsx = player.getStorage("twodcspshichou_used", [[], []])[1];
			if (targetsx.length > 0 && !targetsx.includes(target)) {
				return false;
			}
			return lib.filter.filterTarget(card, player, target);
		},
		async precontent(event, trigger, player) {
			const { result } = event;
			event.getParent().addCount = false;
			player.addTempSkill("twodcspshichou_used");
			const storage = player.getStorage("twodcspshichou_used");
			storage[0].add(get.color(result.card));
		},
		ai: {
			order(item, player) {
				return get.order({ name: "sha" }, player) + 0.1;
			},
		},
		subSkill: {
			used: {
				init(player, skill) {
					player.storage[skill] = [[], []];
				},
				onremove: true,
				group: "twodcspshichou_directHit",
			},
			directHit: {
				charlotte: true,
				trigger: { player: "useCardToBegin" },
				filter(event, trigger, player) {
					if (!event.target?.isIn()) {
						return false;
					}
					return event.card.name === "sha" && event.skill == "twodcspshichou";
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const { card, target } = trigger;
					const storage = player.getStorage("twodcspshichou_used");
					storage[1].add(trigger.target);
					let func, prompt;
					if (get.color(card) == "red") {
						prompt = "弃置一张装备牌，否则无法响应此【杀】";
						func = function (card) {
							return get.type(card) == "equip";
						};
					} else if (get.color(card) == "black") {
						prompt = "弃置一张黑色手牌，否则无法响应此【杀】";
						func = function (card) {
							return get.color(card) == "black" && get.position(card) == "h";
						};
					} else {
						return;
					}
					const { bool } = await target
						.chooseToDiscard("he", func, prompt)
						.set("ai", card => {
							const player = get.player(),
								trigger = get.event().getTrigger();
							if (get.effect(player, trigger.card, trigger.player, player) >= 0) {
								return 0;
							}
							const num = player.countCards("hs", { name: "shan" });
							if (num === 0) {
								return 0;
							}
							if (card.name === "shan" && num <= 1) {
								return 0;
							}
							return 8 - get.value(card);
						})
						.forResult();
					if (!bool) {
						trigger.set("directHit", true);
						game.log(target, "不可响应", card);
					}
				},
			},
		},
	},
	//SP马超一号
	onedcspzhuiji: {
		audio: "zhuiji",
		trigger: { player: "phaseUseEnd" },
		filter(event, player) {
			return (
				player.getHistory("sourceDamage", evt => {
					return evt.getParent("phaseUse") === event;
				}).length > 0
			);
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("filterTarget", (card, player, target) => {
					return get.event().targets.includes(target);
				})
				.set(
					"targets",
					player
						.getHistory("sourceDamage", evt => {
							return evt.getParent("phaseUse") === trigger;
						})
						.map(evt => evt.player)
				)
				.set("ai", function (target) {
					const sha = get.autoViewAs({ name: "sha" });
					return get.effect(target, sha, get.player());
				})
				.forResult();
			event.result = result;
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			let numx = player
				.getHistory("sourceDamage", evt => {
					return evt.player === target && evt.getParent("phaseUse") === trigger;
				})
				.reduce((num, evt) => num + evt.num, 0);
			const sha = get.autoViewAs({ name: "sha", isCard: true });
			while (numx--) {
				if (player.canUse(sha, target, false)) {
					await player.useCard(sha, target, false);
				}
			}
		},
	},
	onedcspshichou: {
		audio: "ol_shichou",
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return (
				player.getHistory("sourceDamage", evt => {
					return evt.card === event.card;
				}).length == 0
			);
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			const { targets } = trigger;
			const next = player.chooseToUse();
			next.set(
				"targets",
				game.filterPlayer(function (current) {
					return targets.includes(current) && trigger.targets.includes(current);
				})
			);
			next.set("openskilldialog", get.prompt2("onedcspshichou"));
			next.set("norestore", true);
			next.set("_backupevent", "onedcspshichou_backup");
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup("onedcspshichou_backup");
			next.set("logSkill", event.name);
			await next;
		},
		subSkill: {
			backup: {
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				position: "hes",
				viewAs: {
					name: "juedou",
				},
				filterTarget(card, player, target) {
					return _status.event.targets && _status.event.targets.includes(target) && lib.filter.filterTarget.apply(this, arguments);
				},
				log: false,
				prompt: "将一张牌当决斗使用",
				check(card) {
					return 7 - get.value(card);
				},
			},
		},
	},
	//孙霸
	dcjiedang: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		frequent: true,
		logTarget: () => game.filterPlayer().sortBySeat(),
		async content(event, trigger, player) {
			for (const target of event.targets) {
				if (!target.isIn() || !target.countCards("he")) {
					continue;
				}
				const result = await target
					.chooseCard([1, Infinity], "he", "allowChooseAll")
					.set("ai", card => {
						const { targetx, player } = get.event();
						const att = get.attitude(player, targetx);
						if (att <= 0) {
							return 0;
						}
						if (player == targetx) {
							return 7.5 - get.value(card);
						}
						if (!ui.selected.cards.length) {
							return 6 - get.value(card);
						}
						return 0;
					})
					.set("targetx", player)
					.set("prompt", `是否响应${get.translation(player)}的【结党】？`)
					.set("prompt2", `将任意张牌置于${get.translation(player)}的武将牌上`)
					.forResult();
				if (result?.bool && result?.cards?.length) {
					target.chat("我没意见");
					target.line(player);
					const next = player.addToExpansion(result.cards, target, "give");
					next.gaintag.add(event.name);
					await next;
					await target.draw();
				} else {
					target.chat("但是我拒绝");
				}
			}
		},
		marktext: "党",
		intro: {
			markcount: "expansion",
			content: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: "dcjiedang_lose",
		subSkill: {
			lose: {
				audio: "dcjiedang",
				trigger: { player: ["phaseUseBegin", "phaseJieshuBegin", "dying"] },
				filter(event, player) {
					return player.getExpansions("dcjiedang").length > 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const expansions = player.getExpansions("dcjiedang");
					const list = expansions.map(card => get.type2(card)).unique();
					const dialog = ["结党：移去一种类别的所有“结党”牌并摸等量张牌"];
					for (let i = 0; i < list.length; i++) {
						const type = list[i];
						const cards = expansions.filter(card => get.type2(card) == type);
						if (cards.length) {
							dialog.addArray([`<span class="text center">${get.translation(type)}</span>`, cards]);
						}
					}
					const result =
						list.length > 1
							? await player
									.chooseControl(list)
									.set("ai", () => {
										let { player, controls, expansions } = get.event();
										return controls.sort((a, b) => {
											return expansions.filter(card => get.type2(card) === b).length - expansions.filter(card => get.type2(card) === a).length;
										})[0];
									})
									.set("dialog", dialog)
									.set("expansions", expansions)
									.forResult()
							: { control: list[0] };
					const control = result?.control;
					if (control) {
						const lose = expansions.filter(card => get.type2(card) == control);
						if (!lose.length) {
							return;
						}
						await player.loseToDiscardpile(lose);
						await player.draw(lose.length);
					}
				},
			},
		},
	},
	dcjidi: {
		audio: 2,
		trigger: {
			player: "damageBegin4",
		},
		forced: true,
		filter(event, player) {
			const { source } = event;
			if (!source) {
				return false;
			}
			return source.getHp() > player.getHp() || source.countCards("h") > player.countCards("h");
		},
		async content(event, trigger, player) {
			const { source } = trigger;
			if (source.getHp() > player.getHp()) {
				await source.loseHp();
			}
			if (source.countCards("h") > player.countCards("h")) {
				await source.randomDiscard(2);
			}
		},
	},
};
