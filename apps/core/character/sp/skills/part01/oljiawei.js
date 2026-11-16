import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oljiawei" | "olqujia" | "old_oljiawei" | "olderu" | "ollinjie">} */
export const groupSkills = {
	//OL杨奉
	oljiawei: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		async content(event, trigger, player) {
			const num = Math.min(
					player.maxHp,
					player.actionHistory.filter(evt => {
						return evt.isMe && !evt.isSkipped;
					}).length - 1
				),
				target = event.target;
			if (num > 0 && target.countDiscardableCards(player, "he")) {
				await player.discardPlayerCard(target, "he", num, true, "allowChooseAll");
			}
			const cards = get.cards(num + 1);
			await game.cardsGotoOrdering(cards);
			if (!cards?.length) {
				return;
			}
			game.log(player, "亮出了", cards);
			player.$throw(cards);
			await game.delayx(3);
			const damages = cards.filter(card => get.is.damageCard(card)),
				nodamages = cards.filter(card => !get.is.damageCard(card));
			if (damages?.length) {
				await player.gain(damages, "gain2");
			}
			if (nodamages?.length) {
				await target.gain(nodamages, "gain2");
			}
			player.addTempSkill(event.name + "_effect");
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					return target.countCards("he");
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				intro: { content: "本回合使用牌无距离限制" },
				mod: { targetInRange: () => true },
			},
		},
	},
	olqujia: {
		audio: 2,
		trigger: {
			player: "phaseAfter",
		},
		filter(event, player) {
			if (player.getStat("kill") > 0) {
				return false;
			}
			return true;
		},
		limited: true,
		skillAnimation: true,
		animationColor: "gray",
		async cost(event, trigger, player) {
			const result = await player
				.chooseControl("额外回合", "出杀次数")
				.set("prompt", get.prompt2(event.skill))
				.set(
					"resultx",
					(() => {
						if (
							Math.random() > 0.5
							/*game.hasPlayer(current => {
								if (current.hp > 1 || get.attitude(player, current) >= 0) {
									return false;
								}
								return player.countCards("h", card => get.tag(card, "damage") && player.canUse(card, current));
							})*/
						) {
							return "额外回合";
						}
						return "出杀次数";
					})()
				)
				.set("ai", () => get.event().resultx)
				.forResult();
			event.result = {
				bool: true,
				cost_data: result.control,
			};
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			if (event.cost_data == "额外回合") {
				const next = player.insertPhase(event.name);
				/*player
					.when({
						player: "phaseEnd",
					})
					.filter(evt => evt == next)
					.step(async (event, trigger, player) => {
						if (player.getStat("kill") > 0) {
							return;
						}
						await player.removeSkills("olqujia");
						const num = Math.min(
							player.maxHp,
							player.actionHistory.filter(evt => {
								return evt.isMe && !evt.isSkipped;
							}).length
						);
						await player.draw(num);
					});*/
			} else {
				const skill = `${event.name}_effect`;
				player.addSkill(skill);
				player.addMark(skill, 1, false);
				const card = get.cardPile(card => card.name == "sha");
				if (card) {
					await player.gain(card, "gain2");
				}
			}
		},
		subSkill: {
			effect: {
				intro: {
					content: "出杀次数+#",
				},
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("olqujia_effect");
						}
					},
				},
			},
		},
	},
	old_oljiawei: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			if (!player.storage.old_oljiawei_targets) {
				return false;
			}
			return player.countCards("h") > 0;
		},
		direct: true,
		async content(event, trigger, player) {
			const next = player.chooseToUse();
			next.set("targets", player.getStorage("old_oljiawei_targets"));
			next.set("openskilldialog", get.prompt2("old_oljiawei"));
			next.set("norestore", true);
			next.set("_backupevent", "old_oljiawei_backup");
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup("old_oljiawei_backup");
			await next;
		},
		group: ["old_oljiawei_check", "old_oljiawei_round"],
		subSkill: {
			round: {
				audio: "old_oljiawei",
				trigger: { global: "damageSource" },
				filter(event, player) {
					return event.getParent(4).name == "old_oljiawei";
				},
				round: 1,
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget()
						.set("prompt", `是否令你${player == _status.currentPhase ? `` : `或${get.translation(_status.currentPhase)}`}将手牌摸至手牌上限？（至多摸至5）`)
						.set("filterTarget", function (_, player, target) {
							return [_status.currentPhase, player].includes(target);
						})
						.set("ai", function (target) {
							if (target.countCards("h") == 5 || target.countCards("h") == target.getHandcardLimit()) {
								return 0;
							}
							if (target.hasSkillTag("nogain")) {
								return 0;
							}
							return get.attitude(get.player(), target);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					await target.drawTo(Math.min(5, target.getHandcardLimit()));
				},
			},
			targets: {
				charlotte: true,
				onremove: true,
			},
			check: {
				trigger: {
					global: "shaMiss",
				},
				silent: true,
				async content(event, trigger, player) {
					player.addTempSkill("old_oljiawei_targets");
					player.markAuto("old_oljiawei_targets", [trigger.target]);
				},
			},
			backup: {
				audio: "old_oljiawei",
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				position: "hs",
				selectCard: [1, Infinity],
				viewAs: {
					name: "juedou",
				},
				filterTarget(card, player, target) {
					return _status.event.targets && _status.event.targets.includes(target) && lib.filter.filterTarget.apply(this, arguments);
				},
				prompt: "将任意张手牌当决斗使用",
				check(card) {
					return 7 - get.value(card);
				},
				allowChooseAll: true,
			},
		},
	},
	//OL袁涣
	olderu: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return player !== target;
		},
		usable: 1,
		async content(event, trigger, player) {
			const { target } = event;
			const cardname = get.inpileVCardList(info => info[0] == "basic" && !info[3]);
			const answer = target.getCards("h", c => get.type(c) == "basic");
			const dialog = [`${get.translation(event.name)}：请猜测${get.translation(get.translation(target))}手牌中的基本牌牌名`, [cardname, "vcard"]];
			const { links } = await player
				.chooseButton(dialog, [0, Infinity], true)
				.set("ai", () => -0.5 + Math.random())
				.forResult();
			let list = cardname.map(c => answer.some(i => get.name(i) === c[2]) === links?.map(j => j[2]).includes(c[2]));
			if (list.includes(true)) {
				await player.recover();
			}
			if (list.includes(false)) {
				const card = answer.filter(c => lib.filter.canBeGained(c, player, target)).randomGet();
				if (card) {
					await player.gain(card, "give");
				}
			}
			if (list.every(c => c === true)) {
				await player.drawTo(player.getHp());
			}
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					return 2 - Math.sign(get.attitude(player, target));
				},
			},
		},
	},
	ollinjie: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			const { source } = event;
			return source?.countDiscardableCards(source, "h") > 0;
		},
		forced: true,
		logTarget: "source",
		async content(event, trigger, player) {
			const { source } = trigger;
			const { cards } = await source.chooseToDiscard(true).forResult();
			if (cards?.length && cards[0].name == "sha") {
				await player.draw();
			}
		},
	},
};
