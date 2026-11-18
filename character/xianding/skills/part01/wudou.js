import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "wudou" | "jiandao" | "liren" | "sejianchu" | "jige">} */
export const groupSkills = {
	//王越
	wudou: {
		audio: 2,
		group: ["wudou_use", "wudou_target"],
		subSkill: {
			use: {
				audio: "wudou",
				usable: 1,
				trigger: {
					global: "useCardAfter",
				},
				filter(event, player) {
					return event.player != player && event.targets?.includes(player) && get.is.damageCard(event.card) && event.player.isIn() && player.canUse(get.autoViewAs({ name: "juedou", isCard: true }), event.player, false, false);
				},
				logTarget: "player",
				prompt2: "其他角色对你使用伤害牌结算后，你可视为对其使用一张【决斗】",
				check(event, player) {
					return get.effect(event.player, { name: "juedou" }, player, player) > 0;
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					await player.useCard({
						card: get.autoViewAs({ name: "juedou", isCard: true }),
						addCount: false,
						targets: [target],
					});
				},
			},
			target: {
				audio: "wudou",
				usable: 1,
				trigger: {
					global: "useCardToPlayered",
				},
				filter(event, player) {
					return event.player != player && !event.targets?.includes(player) && get.name(event.card) == "juedou";
				},
				check(event, player) {
					return (
						get.effect(player, { name: "juedou" }, event.player, player) >
						event.targets?.reduce((sum, target) => {
							return sum + get.effect(target, { name: "juedou" }, event.player, player);
						}, 0)
					);
				},
				logTarget: "player",
				prompt2: (event, player) => `其他角色使用【决斗】指定目标后，若目标不为你，你可${event.cards?.length ? `获得${get.translation(event.cards)}并` : ""}将目标更改为你`,
				async content(event, trigger, player) {
					const evt = trigger.getParent();
					if (evt.cards?.someInD()) {
						await player.gain({ cards: evt.cards.filterInD(), animate: "gain2" });
					}
					evt.targets = [player];
					evt.triggeredTargets3.length = 0;
					game.log(trigger.card, "的目标改为", player);
				},
			},
		},
	},
	jiandao: {
		audio: 2,
		mod: {
			cardname(card, player) {
				const vcard = get.autoViewAs({ name: card.name });
				if (get.is.damageCard(vcard) && get.type(vcard) == "trick") {
					return "juedou";
				}
			},
		},
		trigger: {
			global: ["useCardAfter"],
			source: "damageSource",
		},
		forced: true,
		filter(event, player) {
			if (event.name == "useCard") {
				return get.is.damageCard(event.card) && event.targets.includes(player);
			}
			return event.card?.name == "juedou" || (player.getAllHistory("sourceDamage").indexOf(event) + 1) % 2 == 0;
		},
		async content(event, trigger, player) {
			if (trigger.name == "useCard") {
				const card = get.cardPile(card => get.is.damageCard(card));
				if (card) {
					player.addSkill(`${event.name}_nocount`);
					await player.gain({
						cards: [card],
						animate: "gain2",
						gaintag: [`${event.name}_nocount`],
					});
				}
			} else {
				if (get.name(trigger.card) == "juedou") {
					player.addTempSkill(`${event.name}_directHit`, { player: "dieAfter" });
				}
				if ((player.getAllHistory("sourceDamage").indexOf(trigger) + 1) % 2 == 0) {
					player.addSkill(`${event.name}_effect`);
					player.addMark(`${event.name}_effect`, 1, false);
					if (!player.hasDiscardableCards(player, "h")) {
						return;
					}
					const result = await player
						.chooseToDiscard({
							prompt: "剑道：请选择要替换为伤害牌的手牌",
							position: "h",
							selectCard: [1, Infinity],
							ai(card) {
								return 2 - get.player().getUseValue(card);
							},
						})
						.forResult();
					const { cards } = result;
					if (cards?.length) {
						const gain = [];
						while (gain.length < cards.length) {
							const card = get.cardPile(card => get.is.damageCard(card) && !gain.includes(card) && !cards.includes(card));
							if (card) {
								gain.push(card);
							} else {
								break;
							}
						}
						if (gain.length) {
							await player.gain({ cards: gain, animate: "gain2" });
						}
					}
				}
			}
		},
		subSkill: {
			nocount: {
				inherit: "nocount",
				mod: {
					cardUsable(card, player) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("jiandao_nocount"))) {
							return Infinity;
						}
					},
				},
				filter(event, player) {
					return (
						event.addCount !== false &&
						player.hasHistory("lose", evt => {
							return (evt.relatedEvent || evt.getParent()) == event && Object.values(evt.gaintag_map).flat().includes("jiandao_nocount");
						})
					);
				},
			},
			directHit: {
				charlotte: true,
				forced: true,
				mark: true,
				priority: 9,
				intro: {
					content: "下次使用【杀】不可响应",
				},
				trigger: {
					player: "useCard",
				},
				filter(event, player) {
					return event.card.name == "sha";
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					trigger.directHit.addArray(game.players);
					game.log(trigger.card, "不可响应");
				},
			},
			effect: {
				charlotte: true,
				onremove: true,
				forced: true,
				inherit: "zf_cardDamage",
				filter(event, player) {
					return event.card.name == "sha" && player.hasMark("jiandao_effect");
				},
				priority: 10,
				num(event, trigger, player) {
					return player.countMark(event.name);
				},
				intro: {
					content: "使用【杀】的伤害+#",
				},
			},
		},
	},
	//史阿
	liren: {
		audio: 2,
		forced: true,
		mod: {
			attackRangeFinal(player, num) {
				return 2;
			},
		},
		trigger: {
			global: ["damageSource", "shaMiss", "eventNeutralized"],
		},
		filter(event, player) {
			if (player.countMark("liren") >= 3) {
				return false;
			}
			if (event.card?.name != "sha") {
				return false;
			}
			if (event.name == "damage") {
				return event.cards?.someInD("od");
			}
			return true;
		},
		intro: {
			content: "本回合已获得#张牌",
		},
		async content(event, trigger, player) {
			player.addTempSkill(event.name + "_clear");
			const count = player.countMark(event.name);
			if (trigger.name == "damage") {
				let cards = trigger.cards.filterInD("od");
				cards = cards.slice(0, Math.min(cards.length, 3 - count));
				if (cards.length) {
					player.addMark(event.name, cards.length, false);
					await player.gain({ cards, animate: "gain2" });
				}
			} else {
				player.addMark(event.name, 1, false);
				await player.draw();
			}
		},
		subSkill: {
			clear: {
				charlotte: true,
				onremove(player, skill) {
					player.clearMark(skill.slice(0, -6), false);
				},
			},
		},
	},
	sejianchu: {
		derivation: ["jige", "liren"],
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		forced: true,
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			return (
				event.getg(player)?.length &&
				event.getParent("phaseDraw", true)?.player !== player &&
				player
					.getAllHistory("gain", evt => evt.getParent("phaseDraw", true)?.player !== player)
					.reduce((sum, evt) => {
						return sum + evt.cards.length;
					}, 0) >= 5
			);
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recover();
			const list = get.info(event.name).derivation;
			await player.addSkills(list[0]);
			player.addSkill([`${event.name}_viewAs`, `${event.name}_die`]);
		},
		subSkill: {
			viewAs: {
				charlotte: true,
				mod: {
					cardname(card, player) {
						if (card.name == "shan") {
							return "sha";
						}
					},
				},
			},
			die: {
				audio: "sejianchu",
				charlotte: true,
				trigger: {
					player: "die",
				},
				forceDie: true,
				filter(event, player) {
					return game.hasPlayer(target => target != player && !target.hasSkill("liren", null, false, false));
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget({
							prompt: `剑出：是否令一名其他角色获得${get.poptip("liren")}？`,
							filterTarget(card, player, target) {
								return target != player && !target.hasSkill("liren", null, false, false);
							},
							ai(target) {
								return get.attitude(get.player(), target) * target.getHp();
							},
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					await target.addSkills("liren");
				},
			},
		},
	},
	//小黑子警觉~
	jige: {
		audio: 2,
		trigger: {
			target: "useCardToTarget",
			source: "damageBegin1",
		},
		filter(event, player) {
			if (event.card?.name != "sha") {
				return false;
			}
			if (event.name == "damage") {
				return event.player != player && player.countDiscardableCards(player, "h", { name: "sha" }) > 0;
			} else {
				const num = get.number(event.card) || 0;
				return (
					player.countCards("h", (card, player) => {
						return get.name(card) == "sha" && (get.number(card) || 0) > num;
					}) > 0
				);
			}
		},
		logTarget(event, player) {
			return event.name == "damage" ? event.player : null;
		},
		async cost(event, trigger, player) {
			if (trigger.name == "damage") {
				event.result = await player
					.chooseBool({
						prompt: get.prompt(event.skill, trigger.player),
						prompt2: "弃置你与其手牌中所有的【杀】，此牌伤害增加你比其多弃置的牌数",
						choice: get.damageEffect(trigger.player, player, player) > 0,
					})
					.forResult();
			} else {
				const num = get.number(trigger.card) || 0;
				event.result = await player
					.chooseCard({
						prompt: get.prompt(event.skill),
						prompt2: `打出一张点数比${num}大的【杀】抵消${get.translation(trigger.card)}（无点数的牌视为点数0）`,
						filterCard(card) {
							const player2 = get.player();
							if ((get.number(card) || 0) <= get.event().num || get.name(card) != "sha") {
								return false;
							}
							const mod2 = game.checkMod(card, player2, "unchanged", "cardEnabled2", player2);
							if (mod2 != "unchanged") {
								return mod2;
							}
							const mod = game.checkMod(card, player2, "unchanged", "cardRespondable", player2);
							if (mod != "unchanged") {
								return mod;
							}
							return true;
						},
						ai(card) {
							const trigger = get.event().getTrigger();
							const player = get.player();
							const sha = trigger.card;
							if (get.effect(player, sha, trigger.player, player) < 0) {
								return 7.5 - get.value(card);
							}
							return 0;
						},
					})
					.set("num", num)
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				const {
					targets: [target],
				} = event;
				const cards = [];
				await game.doAsyncInOrder(
					[player, target],
					async target => {
						let cardsx = target.getCards("sha", { name: "sha" });
						if (cardsx.length) {
							const result = await target.modedDiscard({ cards: cardsx, discarder: player }).forResult();
							cardsx = result.cards.slice();
						} else {
							cardsx = [];
						}
						cards.push(cardsx);
					},
					() => 0
				);
				const num = cards[0].length - cards[1].length;
				if (num > 0) {
					trigger.num += num;
				}
			} else {
				const { cards } = event;
				await player.respond({ cards });
				player.addTempSkill(`${event.name}_neutralize`);
				player.markAuto(`${event.name}_neutralize`, trigger.card);
			}
		},
		subSkill: {
			neutralize: {
				charlotte: true,
				silent: true,
				trigger: {
					target: "shaBegin",
				},
				filter(event, player) {
					return player.getStorage("jige_neutralize").includes(event.card);
				},
				onremove: true,
				async content(event, trigger, player) {
					game.log(trigger.card, "被", player, "抵消");
					trigger.neutralize();
				},
			},
		},
	},
};
