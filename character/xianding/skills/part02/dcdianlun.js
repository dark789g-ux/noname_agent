import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcdianlun" | "dcjiwei" | "dcsugang">} */
export const groupSkills = {
	//威曹丕
	dcdianlun: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countDiscardableCards(player, "h");
		},
		filterCard(card, player) {
			const cards = ui.selected?.cards.slice();
			cards.push(card);
			if (cards.length > 2) {
				const nums = cards.map(card => get.number(card, player)).sort((a, b) => a - b);
				const diffs = [];
				for (let i = 1; i < nums.length; i++) {
					diffs.add(nums[i] - nums[i - 1]);
				}
				if (diffs.length != 1) {
					return false;
				}
			}
			return lib.filter.cardDiscardable(card, player, "dcdianlun");
		},
		complexCard: true,
		selectCard: [1, Infinity],
		check(card) {
			return 7 - get.value(card);
		},
		async content(event, trigger, player) {
			let num = event.cards?.length;
			if (player.hasSkill(event.name + "_double")) {
				num *= 2;
			}
			player.addTempSkill(event.name + "_effect");
			const next = player.draw(num);
			next.gaintag.add(event.name);
			await next;
		},
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
		subSkill: {
			effect: {
				onremove(player) {
					player.removeGaintag("dcdianlun");
				},
				charlotte: true,
				forced: true,
				popup: false,
				mod: {
					cardUsable(card) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("dcdianlun"))) {
							return Infinity;
						}
					},
					targetInRange(card) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("dcdianlun"))) {
							return true;
						}
					},
				},
				trigger: {
					player: "useCard1",
				},
				filter(event, player) {
					return (
						event.addCount !== false &&
						player.hasHistory("lose", evt => {
							if ((evt.relatedEvent || evt.getParent()) !== event) {
								return false;
							}
							return Object.values(evt.gaintag_map).flat().includes("dcdianlun");
						})
					);
				},
				firstDo: true,
				content() {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				},
			},
			double: { charlotte: true },
		},
	},
	dcjiwei: {
		audio: 2,
		global: ["dcjiwei_global"],
		subSkill: {
			global: {
				enable: "phaseUse",
				filter(event, player) {
					return player.group == "wei" && game.hasPlayer(target => target != player && target.hasSkill("dcjiwei"));
				},
				filterCard: true,
				filterTarget(card, player, target) {
					return target != player && target.hasSkill("dcjiwei");
				},
				lose: false,
				discard: false,
				delay: false,
				log: false,
				line: false,
				usable: 1,
				check(card) {
					return 6 - get.value(card);
				},
				async precontent(event, trigger, player) {
					event.result.targets[0].logSkill("dcjiwei", player);
				},
				prompt: `交给拥有〖极威〗的角色一张手牌，然后其可令你发动一次至多弃置三张牌的〖典论〗`,
				async content(event, trigger, player) {
					const cards = event.cards,
						target = event.targets[0];
					await player.give(cards, target);
					const result1 = await target
						.chooseBool(`极威：是否令${get.translation(player)}发动一次至多弃置三张牌的〖典论〗`)
						.set("ai", () => get.attitude(get.player(), get.event().getParent().player) > 0)
						.forResult();
					if (!result1?.bool) {
						target.popup("拒绝");
						return;
					}
					target.popup("同意");
					const result2 = await player
						.chooseToDiscard(`###典论###${lib.translate["dcdianlun_infox"]}`, [1, 3], true, "chooseonly")
						.set("filterCard", get.info("dcdianlun").filterCard)
						.set("complexCard", true)
						.set("ai", card => 7 - get.value(card))
						.forResult();
					if (result2?.bool && result2.cards?.length) {
						await player.useSkill("dcdianlun", result2.cards).set("addCount", false);
					}
				},
				ai: {
					order: 7,
					result: {
						target(player, target) {
							if (!player.countCards(card => 7 - get.value(card), "h") || player.countCards("h") < 3) {
								return 0;
							}
							return 1;
						},
					},
				},
			},
		},
	},
	dcsugang: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		async content(event, trigger, player) {
			const result = await player
				.judge()
				.set("callback", () => {
					const player = get.event().getParent(2).player,
						card = get.event().judgeResult.card;
					if (get.position(card, true) == "o") {
						player.gain(card, "gain2").gaintag.add("dcsugang_viewAs");
					}
					player.when({ global: "phaseAfter" }).step(async () => {
						player.removeGaintag("dcsugang_viewAs");
					});
				})
				.forResult();
			if (!result?.card) {
				return;
			}
			const card = result.card,
				num = get.number(card);
			const resultx = await player
				.chooseButton(
					[
						`肃纲：请选择至多两项`,
						[
							[
								["viewAs", `${get.translation(card)}本回合可以当任意伤害牌使用`],
								["debuff", `展示一张手牌，然后本回合所有角色均只能使用${get.translation(card)}与展示牌点数之间的手牌`],
								["buff", `本回合获得〖行殇〗且〖典论〗中的“等量”改为“两倍”`],
							],
							"textbutton",
						],
					],
					true,
					[1, 2]
				)
				.set("ai", button => {
					switch (button.link) {
						case "viewAs":
						case "buff":
							return 5 + Math.random();
						case "debuff":
							return 10;
					}
				})
				.forResult();
			if (resultx?.links?.length) {
				const links = resultx.links,
					skill = event.name;
				if (links.includes("viewAs")) {
					game.log(player, "选择了", "#y选项一");
					player.addTempSkill(skill + "_viewAs");
				}
				if (links.includes("debuff")) {
					game.log(player, "选择了", "#y选项二");
					if (player.countCards("h")) {
						const resulty = await player
							.chooseCard(`肃纲：请展示一张手牌`, true)
							.set("num", num)
							.set("ai", card => {
								return -Math.abs(get.number(card, get.player()) - get.event().num);
							})
							.forResult();
						if (resulty?.cards) {
							const cardx = resulty.cards[0],
								name = skill + "_debuff";
							await player.showCards(cardx, `${get.translation(player)}发动【肃纲】展示的牌`);
							const range = [num, get.number(cardx, player)].sort((a, b) => a - b);
							player.line(game.filterPlayer(), "yellow");
							for (const target of game.filterPlayer()) {
								let storage = target.getStorage(name);
								if (!storage.length) {
									storage = range;
								} else {
									storage = storage
										.concat(range)
										.sort((a, b) => a - b)
										.slice(1, 3);
								}
								target.setStorage(name, storage);
								target.addTempSkill(name);
							}
						}
					}
				}
				if (links.includes("buff")) {
					game.log(player, "选择了", "#y选项三");
					await player.addTempSkills(["rexingshang"]);
					player.addTempSkill("dcdianlun_double");
				}
			}
		},
		derivation: "rexingshang",
		subSkill: {
			viewAs_backup: {},
			viewAs: {
				enable: "phaseUse",
				filter(event, player) {
					return player.countCards("h", card => card.hasGaintag("dcsugang_viewAs")) > 0;
				},
				chooseButton: {
					dialog(event, player) {
						const list = get.inpileVCardList(info => {
							if (info[0] == "delay") {
								return false;
							}
							return get.tag({ name: info[2] }, "damage");
						});
						return ui.create.dialog("肃纲", [list, "vcard"]);
					},
					filter(button, player) {
						return get
							.event()
							.getParent()
							.filterCard(get.autoViewAs({ name: button.link[2], nature: button.link[3] }, "unsure"), player, get.event().getParent());
					},
					check(button) {
						var player = get.player();
						if (player.countCards("hs", button.link[2]) > 0) {
							return 0;
						}
						var effect = player.getUseValue(button.link[2]);
						if (effect > 0) {
							return effect;
						}
						return 0;
					},
					backup(links, player) {
						return {
							// filterCard: true,
							audio: "dcsugang",
							filterCard: card => card.hasGaintag("dcsugang_viewAs"),
							popname: true,
							check(card) {
								return 7 - get.value(card);
							},
							viewAs: { name: links[0][2], nature: links[0][3] },
						};
					},
					prompt(links, player) {
						return "将「肃纲」牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
					},
				},
				ai: {
					order: 7,
					result: {
						player: 1,
					},
				},
			},
			debuff: {
				charlotte: true,
				mark: true,
				intro: {
					markcount(storage, player) {
						if (!storage) {
							return;
						}
						return `${get.strNumber(storage[0])}${get.strNumber(storage[1])}`;
					},
					content(storage, player) {
						if (!storage) {
							return `无事发生`;
						}
						return `只能使用点数在[${storage[0]},${storage[1]}]区间的手牌`;
					},
				},
				onremove: true,
				ai: {
					save: true,
				},
				mod: {
					cardEnabled(card, player) {
						const num = get.number(card, player),
							range = player.storage["dcsugang_debuff"],
							hs = player.getCards("h"),
							cards = card.cards;
						if (num === "unsure" || !range?.length) {
							return;
						}
						if (!cards?.length || cards?.some(cardx => !hs.includes(cardx))) {
							return false;
						}
						if (!cards.some(cardx => !cardx.hasGaintag("dcdianlun"))) {
							return;
						}
						if (typeof num != "number" || num < range[0] || num > range[1]) {
							return false;
						}
					},
					cardSavable(card, player) {
						const num = get.number(card, player),
							range = player.storage["dcsugang_debuff"],
							hs = player.getCards("h"),
							cards = card.cards;
						if (num === "unsure" || !range?.length) {
							return;
						}
						if (!cards?.length || cards?.some(cardx => !hs.includes(cardx))) {
							return false;
						}
						if (!cards.some(cardx => !cardx.hasGaintag("dcdianlun"))) {
							return;
						}
						if (typeof num != "number" || num < range[0] || num > range[1]) {
							return false;
						}
					},
				},
			},
		},
	},
};
