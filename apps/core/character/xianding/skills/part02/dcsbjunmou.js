import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbjunmou" | "dcsbzhanyan">} */
export const groupSkills = {
	//谋陆逊
	dcsbjunmou: {
		audio: 2,
		group: "dcsbjunmou_change",
		audioname: ["dc_sb_luxun_shadow"],
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			player.changeSkin({ characterName: "dc_sb_luxun" }, "dc_sb_luxun" + (player.storage[skill] ? "_shadow" : ""));
		},
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				if (!storage) {
					return `一张牌结算结束后，若此牌的目标包括你，你可以选择一张手牌，此牌视为无距离次数限制的火【杀】并摸一张牌（你可额外摸一张牌并令此技能本阶段失效）。`;
				}
				return `一张牌结算结束后，若此牌的目标包括你，你可以选择一张手牌，令你此颜色的当前手牌不计入手牌上限并可横置一名角色（你可额外横置一名角色并令此技能本阶段失效）。`;
			},
		},
		trigger: {
			global: ["useCardAfter"],
		},
		filter(event, player) {
			return event.targets?.includes(player);
		},
		async cost(event, trigger, player) {
			let prompt2;
			if (player.getStorage(event.skill, false)) {
				prompt2 = "你可选择一张手牌，令你此颜色的当前手牌不计入手牌上限并可横置一名角色";
			} else {
				prompt2 = "你可选择一张手牌，令此牌视为无距离次数限制的火【杀】并摸一张牌";
			}
			event.result = await player
				.chooseCard(get.prompt(event.skill), prompt2, "h")
				.set("ai", () => Math.random())
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards, name } = event;
			player.changeZhuanhuanji(name);
			if (player.getStorage(name, false)) {
				const skill = `${name}_sha`;
				player.addSkill(skill);
				player.addGaintag(cards, skill);
				const result = await player
					.chooseControl("一张", "两张")
					.set("prompt", "###隽谋：摸一张牌###你可摸两张牌并令此技能本阶段失效")
					.set("ai", () => get.rand(0, 1))
					.forResult();
				if (result?.control) {
					await player.draw(result.index + 1);
					if (result.index) {
						player.tempBanSkill(name, { global: "phaseAnyAfter" });
					}
				}
			} else {
				const skill = `${name}_limit`;
				player.addSkill(skill);
				const cards2 = player.getCards("h", card => get.color(card) == get.color(cards[0]) && !card.hasGaintag(skill));
				if (cards2.length) {
					player.addGaintag(cards2, skill);
				}
				const targets = game.filterPlayer(current => !current.isLinked());
				if (!targets?.length) {
					return;
				}
				const result = await player
					.chooseTarget(
						"###隽谋：是否横置一名角色？###你可横置两名角色并令此技能本阶段失效",
						(card, player, target) => {
							return get.event().isLinked.includes(target);
						},
						[1, 2]
					)
					.set("ai", target => {
						if (ui.selected.targets.length) {
							return 0;
						}
						return get.effect(target, { name: "tiesuo" }, get.player(), get.player());
					})
					.set("isLinked", targets)
					.forResult();
				if (result?.bool && result?.targets?.length) {
					player.line(result.targets, "yellow");
					const func = async target => {
						await target.link(true);
					};
					await game.doAsyncInOrder(result.targets, func);
					if (result.targets.length > 1) {
						player.tempBanSkill(name, { global: "phaseAnyAfter" });
					}
				}
			}
		},
		subSkill: {
			sha: {
				mod: {
					cardname(card, player, name) {
						if (get.itemtype(card) == "card" && card.hasGaintag("dcsbjunmou_sha")) {
							return "sha";
						}
					},
					cardnature(card, player, nature) {
						if (get.itemtype(card) == "card" && card.hasGaintag("dcsbjunmou_sha")) {
							return "fire";
						}
					},
					targetInRange(card, player) {
						if (card.cards?.length !== 1 || !card.isCard) {
							return;
						}
						if (card.cards[0].hasGaintag("dcsbjunmou_sha")) {
							return true;
						}
					},
					cardUsable(card, player, num) {
						if (card.cards?.length !== 1 || !card.isCard) {
							return;
						}
						if (card.cards[0].hasGaintag("dcsbjunmou_sha")) {
							return Infinity;
						}
					},
				},
				charlotte: true,
				firstDo: true,
				trigger: {
					player: "useCard1",
				},
				filter(event, player) {
					return (
						event.addCount !== false &&
						event.card.isCard &&
						event.cards?.length == 1 &&
						player.hasHistory("lose", evt => {
							if ((evt.relatedEvent || evt.getParent()) !== event) {
								return false;
							}
							return evt.hs.length == 1 && Object.values(evt.gaintag_map).flat().includes("dcsbjunmou_sha");
						})
					);
				},
				async cost(event, trigger, player) {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] == "number") {
						stat[name]--;
					}
					game.log(trigger.card, "不计入次数");
				},
			},
			limit: {
				name: "<span style='text-shadow:rgba(0, 183, 255, 1) 0 0 2px, rgba(0, 183, 255, 1) 0 0 2px, rgba(0, 183, 255, 1) 0 0 2px, rgba(0, 183, 255, 1) 0 0 2px, black 0 0 1px'>隽谋</span>",
				onremove: true,
				charlotte: true,
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("dcsbjunmou_limit")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name === "phaseDiscard" && card.hasGaintag("dcsbjunmou_limit")) {
							return false;
						}
					},
				},
			},
			change: {
				audio: "dcsbjunmou",
				audioname: ["dc_sb_luxun_shadow"],
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				prompt2(event, player) {
					return "切换【隽谋】为状态" + (player.storage.dcsbjunmou ? "阳" : "阴");
				},
				check: () => Math.random() > 0.5,
				content() {
					player.changeZhuanhuanji("dcsbjunmou");
				},
			},
		},
	},
	dcsbzhanyan: {
		audio: 2,
		audioname: ["dc_sb_luxun_shadow"],
		limited: true,
		enable: "phaseUse",
		skillAnimation: true,
		animationColor: "wood",
		filter(event, player) {
			return game.hasPlayer(target => target.isLinked() && target != player);
		},
		filterTarget(card, player, target) {
			return target.isLinked() && target != player;
		},
		selectTarget: [1, Infinity],
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.addTempSkill(event.name + "_draw");
			let { targets } = event;
			await player.recover(targets.length);
			while (true) {
				targets = event.targets.filter(target => target.isIn() && target.countCards("h"));
				if (!targets.length) {
					break;
				}
				const showEvent = player
					.chooseCardOL(targets, "绽炎：请选择要展示的牌", true)
					.set("ai", function (card) {
						return Math.random();
					})
					.set("source", player);
				showEvent.aiCard = function (target) {
					const hs = target.getCards("h");
					return { bool: true, cards: [hs.randomGet()] };
				};
				showEvent._args.remove("glow_result");
				const result = await showEvent.forResult();
				const cards = [];
				for (var i = 0; i < targets.length; i++) {
					cards.push(result[i].cards[0]);
				}
				const suits = cards.map(card => get.suit(card)).unique();
				const next = player
					.showCards(cards, `${get.translation(player)} 发动了【${get.translation(event.name)}】`, false)
					.set("multipleShow", true)
					.set("customButton", button => {
						const target = get.owner(button.link);
						if (target) {
							const div = button.querySelector(".info");
							div.innerHTML = "<span style = 'font-weight:bold'>" + get.translation(get.suit(button.link, target)) + target.getName() + "</span>";
						}
					})
					.set("delay_time", targets.length * 2)
					.set("closeDialog", false);
				await next;
				const id = next.videoId;

				const update = function (id, suits) {
					const dialog = get.idDialog(id);
					if (dialog) {
						const div = dialog.querySelector(".caption");
						div.innerHTML = `绽炎：你可以弃置任意张花色为<span style = "font-weight:bold;font-size: 150%">${get.translation(suits)}</span>的牌对所选角色造成1点火焰伤害`;
						ui.update();
					}
				};
				if (player == game.me) {
					update(id, suits);
				} else if (player.isOnline()) {
					player.send(update, id, suits);
				}
				const nextx = player.chooseCardTarget({
					prompt: false,
					dialog: get.idDialog(id),
					filterCard(card) {
						if (!get.event().suits.includes(get.suit(card, get.player()))) {
							return false;
						}
						return lib.filter.cardDiscardable.apply(this, arguments);
					},
					selectCard: [1, Infinity],
					filterTarget(card, player, target) {
						const selected = ui.selected.cards;
						if (!selected.length) {
							return false;
						}
						const suits = selected.map(card => get.suit(card, player)).unique();
						return suits.includes(get.suit(get.event().cards[get.event().targets.indexOf(target)], target));
					},
					//complexTarget: true,
					selectTarget: -1,
					suits: suits,
					cards: cards,
					targets: targets,
					position: "he",
					ai1(card) {
						return 10 - get.value(card);
					},
					ai2(target) {
						return 1;
					},
				});
				nextx.set(
					"targetprompt2",
					nextx.targetprompt2.concat([
						target => {
							const evt = get.event();
							if (!target.isIn() || !evt.filterTarget(null, get.player(), target)) {
								return;
							}
							const card = evt.cards[evt.targets.indexOf(target)];
							if (!card) {
								return;
							}
							const suit = get.suit(card, target);
							const color = get.color(card, target);
							const str = get.translation(suit);
							return `<span style = "color:${color};font-weight:bold;font-size: 200%">${str}</span>`;
						},
					])
				);
				const resultx = await nextx.forResult();
				game.broadcastAll("closeDialog", id);
				if (resultx?.cards?.length && resultx.targets?.length) {
					const damage = resultx.targets;
					await player.discard(resultx.cards);
					player.line(damage, "fire");
					const damaged = [];
					await game.doAsyncInOrder(damage, async target => {
						const next = target.damage("fire");
						await next;
						damaged.addArray(targets.filter(i => i.hasHistory("damage", evt => evt == next || (!evt.notLink() && evt.getTrigger() == next))));
					});
					if (damaged.length != event.targets.length) {
						targets.forEach(target => {
							if (!damaged.includes(target)) {
								target.chat("☝🤓唉，没打着");
								target.throwEmotion(player, ["egg", "shoe"].randomGet());
							}
						});
						break;
					}
				} else {
					targets.forEach(target => {
						target.chat("☝🤓唉，没打着");
						target.throwEmotion(player, ["egg", "shoe"].randomGet());
					});
					break;
				}
			}
			player.removeSkill(event.name + "_draw");
		},
		subSkill: {
			draw: {
				audio: "dcsbzhanyan",
				charlotte: true,
				forced: true,
				trigger: {
					player: "loseAfter",
					global: ["gainAfter", "loseAsyncAfter", "addJudgeAfter", "addToExpansionAfter", "equipAfter"],
				},
				filter(event, player) {
					return event.getl?.(player)?.cards2?.length;
				},
				async content(event, trigger, player) {
					await player.draw(trigger.getl?.(player)?.cards2?.length);
				},
			},
		},
		ai: {
			order: 1,
			result: {
				target: -1,
			},
		},
	},
};
