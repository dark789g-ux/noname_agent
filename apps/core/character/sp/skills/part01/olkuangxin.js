import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olkuangxin" | "olleishi" | "olxiewei" | "olyouque">} */
export const groupSkills = {
	//OL张曼成 —— by 星の语
	olkuangxin: {
		init(player) {
			player.addSkill("olkuangxin_record");
		},
		onremove(player) {
			player.removeSkill("olkuangxin_record");
		},
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		forced: true,
		async content(event, trigger, player) {
			const list = [];
			for (let i = 1; i <= player.hp; i++) {
				list.add(i);
			}
			const result = await player
				.chooseControl(list)
				.set("prompt", "###狂信###你失去任意点体力，摸等量的牌并展示已损失体力值+1张手牌。")
				.set("ai", () => {
					if (get.player().hp < 3) {
						return 0;
					}
					return get.player().hp - 2;
				})
				.forResult();
			if (!result?.control) {
				return;
			}
			await player.loseHp(result.control);
			await player.draw(result.control);
			const num = player.getDamagedHp() + 1;
			const resultx = await player
				.chooseCard(`狂信：展示${num}张手牌`, "h", num, true)
				.set("ai", card => get.player().getUseValue(card))
				.forResult();
			if (!resultx?.cards?.length) {
				return;
			}
			await player.showCards(resultx.cards, `${get.translation(player)}发动了【狂信】`);
			player.setMark(event.name, resultx.cards.length, false);
		},
		intro: {
			content: "上次展示了#张牌",
		},
		group: ["olkuangxin_recover"],
		subSkill: {
			record: {
				trigger: { player: ["phaseZhunbeiAfter", "phaseBefore", "enterGame"] },
				lastDo: true,
				charlotte: true,
				forced: true,
				popup: false,
				forceDie: true,
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				content() {
					_status.olkuangxin ??= {};
					_status.olkuangxin[player.playerid] = player.hp;
				},
			},
			recover: {
				audio: "olkuangxin",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					const number = _status.olkuangxin?.[player.playerid];
					return typeof number === "number" && number !== player.hp;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const num = _status.olkuangxin[player.playerid] - player.hp;
					await player[num > 0 ? "recover" : "loseHp"](Math.abs(num));
				},
			},
		},
	},
	olleishi: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			return (
				player.isPhaseUsing() &&
				player.countMark("olleishi_used") < player.countMark("olkuangxin") &&
				player.hasHistory("lose", evt => {
					const evtx = evt.relatedEvent || evt.getParent();
					if (evtx != event) {
						return false;
					}
					return Object.values(evt.gaintag_map).flat().includes("olleishi");
				})
			);
		},
		async content(event, trigger, player) {
			player.addTempSkill(event.name + "_used", ["phaseUseAfter", "phaseChange"]);
			player.addMark(event.name + "_used", 1, false);
			const result = await player
				.judge()
				.set("callback", () => {
					const player = get.event().getParent(2).player,
						card = get.event().judgeResult.card;
					if (get.position(card, true) == "o") {
						player.gain(card, "gain2");
					}
				})
				.forResult();
			if (result.suit == get.suit(trigger.card)) {
				const resultx = await player
					.chooseTarget(`雷噬：对一名角色造成1点雷电伤害`, true)
					.set("ai", target => get.damageEffect(target, get.player(), get.player(), "thunder"))
					.forResult();
				if (!resultx?.targets?.length) {
					return;
				}
				const target = resultx.targets[0];
				player.line(target, "thunder");
				await target.damage("nocard", "thunder");
			} else {
				const resultx = await player
					.chooseCard(`雷噬：展示一张手牌，本回合下次判定时，若此牌在你的手牌区内，将此牌作为判定牌。`, "h", true)
					.set("ai", card => 6 - get.value(card))
					.forResult();
				if (!resultx?.cards?.length) {
					return;
				}
				const skill = event.name + "_judge";
				player.addGaintag(resultx.cards, skill);
				player.addTempSkill(skill);
				await player.showCards(resultx.cards, `${get.translation(player)}发动【雷噬】展示的牌`);
			}
		},
		group: ["olleishi_mark"],
		ai: {
			combo: "olkuangxin",
		},
		subSkill: {
			judge: {
				audio: "olleishi",
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				trigger: {
					player: "judgeBefore",
				},
				forced: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					return !event.directresult && player.countCards("h", card => card.hasGaintag("olleishi_judge"));
				},
				async content(event, trigger, player) {
					const cards = player.getCards("h", card => card.hasGaintag(event.name));
					if (!cards.length) {
						return;
					}
					let result;
					if (cards.length == 1) {
						result = { cards: cards };
					} else {
						result = await player
							.chooseCard(`雷噬：请选择一张牌作为判定牌`, "h", true, (card, player) => {
								return card.hasGaintag(get.event().getParent().name);
							})
							.set("ai", card => -get.value(card))
							.forResult();
					}
					if (!result?.cards?.length) {
						return;
					}
					player.$throw(result.cards);
					trigger.directresult = result.cards[0];
				},
			},
			used: {
				charlotte: true,
				onremove: true,
			},
			mark: {
				trigger: {
					global: "showCardsEnd",
				},
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					return event.cards.some(i => get.owner(i) == player);
				},
				content() {
					game.broadcastAll(
						function (cards) {
							cards.forEach(card => card.addGaintag("olleishi"));
						},
						trigger.cards.filter(i => get.owner(i) == player)
					);
					player.when({ global: "phaseAfter" }).step(async () => {
						player.removeGaintag("olleishi");
					});
				},
			},
		},
	},
	//OL管亥 —— by 星の语
	olxiewei: {
		audio: 2,
		enable: ["chooseToUse"],
		hiddenCard(player, name) {
			if (["sha", "shan"].includes(name) && player.countCards("h") > 1) {
				return true;
			}
		},
		filter(event, player) {
			if (event.responded || event.olxiewei) {
				return false;
			}
			return player.countCards("h") > 1 && ["sha", "shan"].some(name => event.filterCard({ name: name, isCard: true }, player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const list = [
					["基本", "", "sha"],
					["基本", "", "shan"],
				];
				const dialog = ui.create.dialog("卸尾", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			filter(button, player) {
				return get.event().getParent().filterCard({ name: button.link[2] }, player, get.event().getParent());
			},
			backup(links, player) {
				return {
					audio: "olxiewei",
					selectCard: 2,
					filterCard: true,
					viewAs: {
						name: links[0][2],
						isCard: true,
						suit: "none",
						number: null,
					},
					position: "h",
					ignoreMod: true,
					check(card) {
						return 6 - get.value(card);
					},
					log: false,
					precontent() {
						const skill = "olxiewei",
							cards = event.result.cards;
						player.logSkill(skill);
						if (cards.length < 2) {
							var evt = event.getParent();
							evt.set(skill, true);
							evt.result.cancel = true;
							return;
						}
						player.addToExpansion(cards, player, "give").gaintag.add(skill);
						event.result.card = {
							name: event.result.card.name,
							isCard: true,
						};
						event.result.cards = [];
					},
				};
			},
			prompt(links, player) {
				return "将两张手牌置于武将牌上，然后视为使用" + get.translation(links[0][2]);
			},
		},
		marktext: "饵",
		intro: {
			name: "卸尾（饵）",
			markcount: "expansion",
			content: "expansion",
		},
		ai: {
			order(item, player) {
				player ??= get.player();
				return get.order({ name: "sha" }, player) - 0.1;
			},
			result: {
				player: 1,
			},
		},
	},
	olyouque: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.getExpansions("olxiewei").length && game.hasPlayer(target => player.canCompare(target));
		},
		delay: false,
		lose: false,
		discard: false,
		async precontent(event, trigger, player) {
			const cards = player.getExpansions("olxiewei");
			const result = await player
				.chooseButtonTarget({
					createDialog: [`###诱阙###${get.skillInfoTranslation("olyouque", null, false)}`, cards],
					cards: cards,
					filterButton(button) {
						return !get.event().cards.some(card => get.number(card) < get.number(button.link));
					},
					filterTarget(card, player, target) {
						return player.canCompare(target, true);
					},
					ai2(target) {
						return -get.attitude(get.player(), target) * target.countCards("h");
					},
				})
				.forResult();
			if (result?.bool && result.links?.length && result.targets?.length) {
				event.result.targets = result.targets;
				event.result.cards = result.links;
			} else {
				event.getParent().goto(0);
				if (player != game.me && !player.isOnline()) {
					event.getParent()._aiexclude.add("olyouque");
				}
			}
		},
		async content(event, trigger, player) {
			const card = event.cards[0],
				target = event.targets[0];
			if (!player.canCompare(target, true)) {
				return;
			}
			player.addTempSkill(event.name + "_effect");
			let next = player.chooseToCompare(target);
			//next.small = true;
			if (!next.fixedResult) {
				next.fixedResult = {};
			}
			next.fixedResult[player.playerid] = card;
			const resultx = await next.forResult();
			for (const targetx of [player, target]) {
				if (resultx.winner != targetx) {
					const card = targetx == player ? resultx.player : resultx.target,
						num = get.number(card),
						winner = resultx.winner;
					await targetx.modedDiscard(targetx.getCards("h", cardx => get.number(cardx, player) > num));
					if (winner && targetx.canUse({ name: "sha", isCard: true }, winner, false, false)) {
						const sha = get.autoViewAs({ name: "sha", isCard: true, storage: { olyouque: true } });
						await targetx.useCard(sha, winner, false);
					}
				}
			}
		},
		ai: {
			combo: "olxiewei",
			order: 7,
			result: {
				player: 1,
			},
		},
		subSkill: {
			effect: {
				audio: "olyouque",
				trigger: { global: "damageSource" },
				filter(event, player) {
					return event.card?.storage?.olyouque;
				},
				forced: true,
				async content(event, trigger, player) {
					await player.draw(2);
					if (!player.getExpansions("olxiewei").some(card => get.suit(card) == "spade")) {
						player.tempBanSkill("olyouque", ["phaseChange", "phaseUseAfter"]);
					}
				},
			},
		},
	},
};
