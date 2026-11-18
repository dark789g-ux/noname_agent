import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "ol_zhenjun" | "ol_yizhong" | "olzhengbing" | "olsbqianfu" | "olsbyushi" | "olsbfenchao">} */
export const groupSkills = {
	//界于禁
	ol_zhenjun: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(current => current.countDiscardableCards(player, "he"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("filterTarget", (_, player, target) => target.countDiscardableCards(player, "he"))
				.set("ai", target => -get.attitude(get.player(), target) * (target.countCards("e") + 1))
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await player.discardPlayerCard(true, target, "he", Math.max(target.countCards("h") - target.hp, 1), "allowChooseAll").forResult();
			if (result?.bool && result.cards?.length) {
				const num = result.cards.filter(card => get.type(card) != "equip").length;
				if (num == 0) {
					return;
				}
				let resultx;
				if (num > player.countDiscardableCards(player, "he")) {
					resultx = { bool: false, cards: [] };
				} else {
					let prompt = `弃置${get.cnNumber(num)}张牌，或令${get.translation(target)}于你结束阶段摸${get.cnNumber(num)}张牌`;
					resultx = await player
						.chooseToDiscard(prompt, num, "he", "allowChooseAll")
						.set("ai", card => {
							const event = get.event();
							const phase = event.getTrigger().getParent("phase");
							if (phase?.name == "phase" && phase.phaseList?.length) {
								const phaseJieshu = phase.phaseList.find((v, i) => i > phase.num && v.startsWith("phaseJieshu"));
								if (!phaseJieshu) {
									return 0;
								}
							}
							return 6 - get.value(card);
						})
						.forResult();
				}
				if (!resultx?.bool) {
					target
						.when({ global: "phaseJieshuBegin" })
						.filter(evt => {
							return evt.player == player;
						})
						.step(async function (event, trigger, player) {
							await player.draw(num);
						});
				}
			}
		},
	},
	ol_yizhong: {
		audio: 2,
		trigger: {
			player: "useCard",
			target: "useCardToBefore",
		},
		forced: true,
		filter(event, player) {
			if (event.card.name != "sha" || get.color(event.card) != "black") {
				return false;
			}
			if (event.player == player) {
				const num = player.countCards("h");
				return event.targets.some(target => target.countCards("h") <= num);
			}
			return event.player.getHp() >= player.getHp();
		},
		logTarget(event, player) {
			if (event.player == player) {
				const num = player.countCards("h");
				return event.targets.filter(target => target.countCards("h") <= num).sortBySeat(_status.currentPhase);
			}
			return null;
		},
		async content(event, trigger, player) {
			if (trigger.player == player) {
				trigger.directHit.addArray(event.targets);
				game.log(event.targets, "不可响应", trigger.card);
			} else {
				trigger.cancel();
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return arg?.card?.name == "sha" && get.color(arg?.card, player) == "black" && arg?.target?.countCards("h") < player.countCards("h");
			},
			effect: {
				target(card, player, target) {
					if (card.name != "sha" && get.color(card) != "black") {
						return;
					}
					if (player.getHp() > target.getHp()) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	//闪张辽
	olzhengbing: {
		audio: "jsrgzhengbing",
		enable: "phaseUse",
		usable: 3,
		filter(event, player) {
			return player.group == "qun" && player.countCards("he");
		},
		filterCard: lib.filter.cardRecastable,
		check(card) {
			var player = _status.event.player,
				val = 5 + ["shan", "tao"].includes(get.name(card)) * 1.5;
			if (player.needsToDiscard() > 2 && get.name(card) == "sha" && player.countCards("hs", "sha") > 1) {
				val += 0.5;
			}
			return val - get.value(card);
		},
		position: "he",
		groupSkill: "qun",
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards, name } = event;
			await player.recast(cards);
			let type;
			switch (get.name(cards[0])) {
				case "sha":
					type = "sha";
					player.addSkill("olzhengbing_sha");
					player.addMark("olzhengbing_sha", 1, false);
					break;
				case "shan":
					type = "shan";
					await player.draw();
					break;
				case "tao":
				case "jiu":
					type = "tao/jiu";
					player.addTempSkill("olzhengbing_dianjun", { global: ["phaseAfter", "phaseBeforeStart"] });
					break;
			}
			if (type) {
				player.getHistory("custom").push({ skill: name, type });
			}
			if (
				player
					.getAllHistory("custom", evt => {
						return evt.skill == name;
					})
					.map(evt => evt.type)
					.toUniqued().length >= 3
			) {
				await player.changeGroup("wei");
			}
		},
		ai: {
			order: 7,
			result: { player: 1 },
		},
		subSkill: {
			dianjun: {
				audio: "jsrgzhengbing",
				charlotte: true,
				trigger: { player: "phaseEnd" },
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.phaseList.splice(trigger.num, 0, `phaseUse|${event.name}`);
				},
			},
			sha: {
				charlotte: true,
				onremove: true,
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("olzhengbing_sha");
					},
				},
				intro: {
					content: "手牌上限+#",
				},
			},
		},
	},
	//谋许攸
	olsbqianfu: {
		audio: 2,
		zhuanhuanji: true,
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				if (!storage) {
					return `转换技，出牌阶段，你可以将一张黑色牌当【过河拆桥】使用。结算后，你可将因此弃置的牌置于牌堆顶。`;
				}
				return `转换技，出牌阶段，你可以将一张红色牌当【火攻】使用。结算后，你可将因此弃置的牌置于牌堆顶。`;
			},
		},
		group: "olsbqianfu_put",
		enable: "phaseUse",
		filter(event, player) {
			const bool = player.storage.olsbqianfu;
			return player.countCards("hes", card => get.color(card, player) == (!bool ? "black" : "red")) && event.filterCard(get.autoViewAs({ name: !bool ? "guohe" : "huogong" }, "unsure"), player, event) && (player.hasSkill("olsbqianfu_remove") ? !player.getStorage("olsbqianfu_used").includes(!bool ? "guohe" : "huogong") : true);
		},
		filterCard(card, player) {
			return get.color(card, player) === (!player.storage[get.event().skill] ? "black" : "red");
		},
		position: "hes",
		check(card) {
			return 7 - get.value(card);
		},
		viewAs(cards, player) {
			const filter = get.event()._backup.filterCard;
			const viewAs = { name: !player.storage[get.event().skill] ? "guohe" : "huogong" };
			if (!filter(get.autoViewAs(viewAs, "unsure"))) {
				return null;
			}
			return viewAs;
		},
		prompt(event) {
			const name = !event.player.storage[event.skill] ? "guohe" : "huogong";
			const color = !event.player.storage[event.skill] ? "black" : "red";
			return `将一张${get.translation(color)}牌当作${get.translation(name)}使用`;
		},
		async precontent(event, trigger, player) {
			player.changeZhuanhuanji(event.name.slice(4));
			if (player.hasSkill(event.name.slice(4) + "_remove")) {
				player.addTempSkill(event.name.slice(4) + "_used", "phaseChange");
				player.markAuto(event.name.slice(4) + "_used", event.result.card.name);
			}
		},
		ai: {
			order: 6,
			result: {
				player: 1,
			},
		},
		subSkill: {
			put: {
				audio: "olsbqianfu",
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.skill == "olsbqianfu" && get.info("olsbqianfu_put").getCards(event).length;
				},
				getCards(event) {
					const cards = game.players.reduce((list, target) => {
						const history = target.getHistory("lose", evt => {
							return evt.type == "discard" && evt.getlx !== false && evt.getParent(4) === event;
						});
						if (!history.length) {
							return list;
						}
						return list.addArray(history.reduce((listx, evt) => [...listx, ...evt.cards], []));
					}, []);
					return cards.filterInD("d");
				},
				prompt2(event, player) {
					return `将${get.translation(get.info("olsbqianfu_put").getCards(event))}置于牌堆顶`;
				},
				async content(event, trigger, player) {
					const cards = get.info("olsbqianfu_put").getCards(trigger);
					game.log(player, "将", cards, "置于牌堆顶");
					await game.cardsGotoPile(cards, "insert");
				},
			},
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已转化：$",
				},
			},
			remove: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (player.countCards("h")) {
						return false;
					}
					var evt = event.getl(player);
					return evt && evt.hs && evt.hs.length;
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					await player.removeSkills("olsbqianfu");
				},
			},
		},
	},
	olsbyushi: {
		audio: 2,
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		getSkills(target) {
			return target.getSkills(null, false, false).filter(skill => get.is.zhuanhuanji(skill, target));
		},
		async cost(event, trigger, player) {
			const next = player.chooseTarget(get.prompt2(event.skill)).set("ai", target => {
				const bool = !!get.info("olsbyushi").getSkills(target).length;
				const att = get.attitude(get.player(), target);
				if (!bool) {
					return att;
				}
				return false;
			});
			next.set(
				"targetprompt2",
				next.targetprompt2.concat([
					target => {
						if (!target?.isIn() || !target.classList.contains("selectable")) {
							return;
						}
						return get.info("olsbyushi").getSkills(target).length ? "有转换技" : "无转换技";
					},
				])
			);
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			const skills = get.info("olsbyushi").getSkills(target);
			if (!skills.length) {
				target.addSkill("olsbqianfu_remove");
				await target.addSkills("olsbqianfu");
			} else {
				const result = await player.chooseButton([`驭势：选择变更${get.translation(target)}一个技能的状态`, [skills, "skill"]], true).forResult();
				if (result?.links?.length) {
					const skill = result.links[0];
					game.log(target, "的", "#g【" + get.translation(skill) + "】", "发生了状态变更");
					target.popup(skill, "wood");
					target.changeZhuanhuanji(skill);
				}
			}
		},
		group: ["olsbyushi_draw"],
		subSkill: {
			draw: {
				audio: "olsbyushi",
				forced: true,
				locked: false,
				trigger: { global: "changeZhuanhuanji" },
				filter(event, player) {
					const index = game.getRoundHistory("everything", evt => evt.name == "changeZhuanhuanji").indexOf(event);
					return index >= 0 && index < player.maxHp;
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
		},
	},
	olsbfenchao: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => get.attitude(get.player(), target))
				.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			player.awakenSkill(event.name);
			let cards = Array.from(ui.discardPile.childNodes).filter(card => get.is.damageCard(card));
			if (cards.length > game.players.length) {
				cards = cards.randomGets(game.players.length);
			}
			target.addSkill(event.name + "_fire");
			if (cards.length) {
				const next = target.gain(cards, "gain2");
				next.gaintag.add(event.name + "_fire");
				await next;
			}
		},
		subSkill: {
			fire: {
				charlotte: true,
				forced: true,
				trigger: {
					global: "damageBegin1",
				},
				filter(event, player) {
					return (
						event.card &&
						player.hasHistory("lose", evt => {
							const evtx = evt.relatedEvent || evt.getParent();
							if (evtx.card !== event.card) {
								return false;
							}
							return Object.values(evt.gaintag_map).flat().includes("olsbfenchao_fire");
						})
					);
				},
				async content(event, trigger, player) {
					game.setNature(trigger, "fire");
				},
			},
		},
	},
};
