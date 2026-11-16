import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcchaozhen" | "dclianjie" | "dcjiangxian">} */
export const groupSkills = {
	//武皇甫嵩
	//nnd怎么这么耐改
	dcchaozhen: {
		audio: 2,
		trigger: { player: ["phaseZhunbeiBegin", "dying"] },
		async cost(event, trigger, player) {
			const list = ["场上", "牌堆", "cancel2"];
			if (
				!game.hasPlayer(function (current) {
					return current.countCards("ej");
				})
			) {
				list.remove("场上");
			}
			const { control } = await player
				.chooseControl(list, () => {
					const player = _status.event.player;
					let cards = game
						.filterPlayer()
						.reduce((arr, current) => {
							if (current.countCards("ej")) {
								arr.addArray(current.getCards("ej"));
							}
							return arr;
						}, [])
						.sort((a, b) => get.number(a, false) - get.number(b, false));
					if (!cards.length) {
						return "牌堆";
					}
					if (player.hp < 1 && get.number(cards[0], false) > 1) {
						return "牌堆";
					}
					cards = cards.filter(card => get.number(card, false) == get.number(cards[0], false));
					let valueCards = cards.filter(card => {
						let owner = get.owner(card);
						if (!owner) {
							return false;
						}
						let att = get.attitude(player, owner);
						if (get.position(card) == "j" && (card.viewAs || card.name) == "xumou_jsrg") {
							att *= -1;
						}
						if (get.position(card) == "e" && get.equipValue(card, owner) > 0) {
							att *= -1;
						}
						return att > 0;
					});
					if (valueCards.length * 2 >= cards.length) {
						return "场上";
					}
					return "牌堆";
				})
				.set("prompt", get.prompt2(event.skill))
				.forResult();
			event.result = {
				bool: control != "cancel2",
				cost_data: control,
			};
		},
		async content(event, trigger, player) {
			const control = event.cost_data;
			var num = 1,
				card;

			if (control == "场上") {
				let cards = game
					.filterPlayer()
					.reduce((arr, current) => {
						if (current.countCards("ej")) {
							arr.addArray(current.getCards("ej"));
						}
						return arr;
					}, [])
					.sort((a, b) => get.number(a, false) - get.number(b, false));
				num = get.number(cards[0], false);
				card = cards.filter(card => get.number(card, false) == num).randomGet();
			} else {
				while (num < 14) {
					let cardx = get.cardPile2(card => get.number(card, false) == num);
					if (cardx) {
						card = cardx;
						break;
					} else {
						num++;
					}
				}
			}
			if (card) {
				await player.gain(card, get.owner(card) ? "give" : "gain2");
				if (num == 1) {
					//谁tm再提这个构思结算问题，我*****
					player.tempBanSkill("dcchaozhen");
					await player.recover();
				}
			}
		},
	},
	dclianjie: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
		},
		locked: false,
		filter(event, player) {
			if (
				!game.hasPlayer(current => {
					return current.countCards("h") && !player.getStorage("dclianjie_used").includes(current);
				}) ||
				!player.hasHistory("lose", evt => {
					if ((evt.relatedEvent || evt.getParent()) != event.getParent()) {
						return false;
					}
					return event.cards?.some(card => (evt.hs || []).includes(card));
				}) ||
				!player.countCards("h")
			) {
				return false;
			}
			const num = get.number(event.card, player);
			if (typeof num !== "number" || player.hasCard(card => get.number(card, player) < num, "h")) {
				return false;
			}
			return event.isFirstTarget;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.name.slice(0, -5)), (card, player, target) => {
					return target.countCards("h") && !player.getStorage("dclianjie_used").includes(target);
				})
				//.set("drawed", player.getStorage("dclianjie_used").includes(get.number(trigger.card, player) || 0))
				.set("ai", target => {
					const player = get.player();
					const eff1 = get.effect(target, { name: "guohe_copy2" }, player, player);
					const eff2 = get.effect(target, { name: "draw" }, player, player);
					if (player == target) {
						return eff2 * (1 + player.maxHp - player.countCards("h"));
					} // && !get.event().drawed
					return eff1;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const num = get.number(trigger.card, player) || 0;
			const target = event.targets[0];
			const cards = target.getCards("h"),
				minNumber = cards.map(card => get.number(card)).sort((a, b) => a - b)[0];
			player.addTempSkill("dclianjie_used");
			player.markAuto("dclianjie_used", target);
			const toLose = cards.filter(card => get.number(card) === minNumber);
			if (target != player || toLose.length <= 1) {
				await target.lose(toLose.randomGet(), ui.cardPile);
			} else {
				const result = await player
					.chooseCard("h", card => get.event().toLose?.includes(card), true)
					.set("toLose", toLose)
					.set("ai", card => 10 - get.value(card))
					.forResult();
				if (result.bool) {
					await player.lose(result.cards[0], ui.cardPile);
				}
			}
			game.broadcastAll(function (player) {
				var cardx = ui.create.card();
				cardx.classList.add("infohidden");
				cardx.classList.add("infoflip");
				player.$throw(cardx, 1000, "nobroadcast");
			}, target);
			await game.delayx();
			if (player.countCards("h") >= player.maxHp) {
				return;
			}
			const result = (await player.drawTo(player.maxHp).forResult()).cards;
			if (result) {
				player.addGaintag(result, "dclianjie");
			}
		},
		mod: {
			aiOrder(player, card, num) {
				var number = get.number(card, player);
				if (player.countCards("h") < player.maxHp) {
					return num + number / 10;
				} /*else if (!player.getStorage("dclianjie_used").includes(number)) {
					return num - 0.5;
				}*/
			},
		},
		init(player) {
			player.addSkill("dclianjie_effect");
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("dclianjie");
				},
				trigger: {
					player: "useCard1",
				},
				filter(event, player) {
					return (
						event.addCount !== false &&
						player.hasHistory("lose", evt => {
							if (evt.getParent() != event) {
								return false;
							}
							return Object.values(evt.gaintag_map).flat().includes("dclianjie");
						})
					);
				},
				async cost(event, trigger, player) {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				},
				mod: {
					targetInRange(card, player, target) {
						if (get.suit(card) == "unsure") {
							return true;
						}
						if (!card.cards) {
							return;
						}
						for (var i of card.cards) {
							if (i.hasGaintag("dclianjie")) {
								return true;
							}
						}
					},
					cardUsable(card, player, num) {
						if (get.suit(card) == "unsure") {
							return Infinity;
						}
						if (!card.cards) {
							return;
						}
						for (var i of card.cards) {
							if (i.hasGaintag("dclianjie")) {
								return Infinity;
							}
						}
					},
				},
			},
			used: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeGaintag("dclianjie");
				},
				intro: {
					//${get.translation(storage).replace("13", "K").replace("12", "Q").replace("11", "J").replace("1", "A")}
					content: "已放置：$",
				},
			},
		},
	},
	dcjiangxian: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.addTempSkill(event.name + "_effect");
			const evtx = event.getParent("phase", true, true);
			player
				.when({ global: "phaseAfter" })
				.filter((evt, player) => {
					return evt == evtx && ["dcchaozhen", "dclianjie"].some(skill => player.hasSkill(skill, null, null, false));
				})
				.step(async () => {
					const { bool, links } = await player
						.chooseButton(
							[
								"将贤：请选择一项",
								[
									[
										["dcchaozhen", "失去〖朝镇〗"],
										["dclianjie", "失去〖连捷〗"],
									],
									"textbutton",
								],
							],
							true
						)
						.set("filterButton", button => {
							const player = get.player();
							return player.hasSkill(button.link, null, null, false);
						})
						.set("ai", button => {
							if (button.link == "dcchaozhen" && player.getHp() > 2) {
								return 1.1;
							}
							return 1;
						})
						.forResult();
					if (bool) {
						await player.removeSkills(links);
					}
				});
		},
		subSkill: {
			effect: {
				audio: "dcjiangxian",
				charlotte: true,
				mark: true,
				intro: {
					//content: "本回合因使用〖连捷〗摸的牌造成的伤害+1，回合结束后失去〖连捷〗或〖朝镇〗",
					content: "本回合因使用〖连捷〗摸的牌造成的伤害+X（X为你本回合造成伤害的次数且至多为5），回合结束后失去〖连捷〗或〖朝镇〗",
				},
				trigger: {
					source: "damageBegin1",
				},
				filter(event, player) {
					if (
						!player.hasHistory("lose", evt => {
							let gaintag = false;
							if ((evt.relatedEvent || evt.getParent()) != event.getParent("useCard")) {
								return false;
							}
							for (var i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("dclianjie")) {
									gaintag = true;
								}
							}
							return gaintag && event.cards.some(card => (evt.hs || []).includes(card));
						})
					) {
						return false;
					}
					//return true;
					return player.getHistory("sourceDamage").length > 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.num += Math.min(5, player.getHistory("sourceDamage").length);
				},
			},
		},
		ai: {
			order: 9,
			threaten: 2.9,
			result: {
				player(player) {
					if (!game.hasPlayer(current => get.attitude(player, current) < 0)) {
						return 0;
					}
					return player.countCards("h", card => card.hasGaintag("dclianjie") && player.hasUseTarget(card)) > 2 ? 4 : 0;
				},
			},
			combo: "dclianjie",
		},
	},
};
