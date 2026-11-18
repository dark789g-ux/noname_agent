import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczhidui" | "dcjiesi" | "dcdujun" | "dcjikun">} */
export const groupSkills = {
	//钟毓
	dczhidui: {
		audio: 2,
		init(player) {
			player.addSkill("dczhidui_mark");
		},
		onremove(player) {
			player.removeSkill("dczhidui_mark");
		},
		trigger: { player: "useCard" },
		filter(event, player) {
			const history = game.getAllGlobalHistory("useCard"),
				index = history.indexOf(event);
			return index >= 1;
		},
		async cost(event, trigger, player) {
			const history = game.getAllGlobalHistory("useCard"),
				index = history.indexOf(trigger);
			if (index < 1) {
				return;
			}
			const bool1 = get.cardNameLength(trigger.card) === get.cardNameLength(history[index - 1].card);
			const bool2 = get.type2(trigger.card) === get.type2(history[index - 1].card);
			if (bool1 && bool2) {
				const result = await player
					.chooseControl({
						prompt: get.prompt2(event.skill),
						controls: ["摸两张牌", `令${get.translation(trigger.card)}不计入次数`],
						ai() {
							const { player, controls } = get.event();
							const usable = player.getCardUsable(get.event().getTrigger().card);
							if (usable <= 0) {
								return controls[1];
							}
							return controls[0];
						},
					})
					.forResult();
				if (typeof result?.control == "string") {
					event.result = {
						bool: true,
						cost_data: result.control,
					};
				}
			} else if (!bool1 && !bool2) {
				event.result = {
					bool: true,
					cost_data: "tempBan",
				};
			}
		},
		async content(event, trigger, player) {
			const link = event.cost_data;
			if (link == "摸两张牌") {
				await player.draw({ num: 2 });
			}
			if (link == `令${get.translation(trigger.card)}不计入次数`) {
				if (trigger.addCount !== false) {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				}
			}
			if (link == "tempBan") {
				player.tempBanSkill(event.name);
			}
		},
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object") {
					var history = game.getAllGlobalHistory("useCard");
					if (!history.length) {
						return;
					}
					var evt = history[history.length - 1];
					if (evt?.card && get.cardNameLength(evt.card) == get.cardNameLength(card) && get.type(evt.card) == get.type2(card)) {
						return num + 4;
					}
				}
			},
		},
		subSkill: {
			mark: {
				charlotte: true,
				init(player, skill) {
					const history = game.getAllGlobalHistory("useCard"),
						length = history.length;
					if (!length) {
						return;
					}
					const card = history[length - 1].card;
					player.storage[skill] = card;
					player.markSkill(skill);
					game.broadcastAll(
						function (player, type) {
							if (player.marks.dczhidui_mark) {
								player.marks.dczhidui_mark.firstChild.innerHTML = get.translation(type).slice(0, 1);
							}
						},
						player,
						get.type2(card)
					);
					//player.addTip(skill,get.translation(skill)+`  ${get.translation(get.type2(card))}${get.cardNameLength(card)}`);
				},
				onremove(player, skill) {
					delete player.storage[skill];
					//player.removeTip(skill);
				},
				intro: {
					markcount(storage, player) {
						return get.cardNameLength(storage);
					},
					content(storage, player) {
						let str = "";
						str += `<li>类型：${get.translation(get.type2(storage))}`;
						str += `<br><li>牌名字数：${get.cardNameLength(storage)}`;
						return str;
					},
				},
				silent: true,
				trigger: { global: "useCard1" },
				content() {
					lib.skill[event.name].init(player, event.name);
				},
			},
		},
	},
	dcjiesi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		onChooseToUse(event) {
			if (!game.online && !event.dcjiesi) {
				event.set(
					"dcjiesi",
					["cardPile", "discardPile"]
						.map(pos => Array.from(ui[pos].childNodes))
						.flat()
						.map(card => get.cardNameLength(card))
						.unique()
						.sort()
				);
			}
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("###捷思###", get.translation("dcjiesi_info"));
			},
			chooseControl(event, player) {
				const list = event.dcjiesi.slice();
				list.push("cancel2");
				return list;
			},
			check(event, player) {
				const sortlist = [4, 1, 2, 3, 5];
				const list = event.dcjiesi.slice();
				return (
					list.sort((a, b) => {
						return sortlist.indexOf(a) - sortlist.indexOf(b);
					})[0] - 1
				);
			},
			backup(result, player) {
				return {
					audio: "dcjiesi",
					len: result.control,
					async content(event, trigger, player) {
						const len = get.info(event.name).len;
						const card = get.cardPile(cardx => get.cardNameLength(cardx) == len);
						if (!card) {
							player.chat(`一张${len}字牌都没有？！`);
							return;
						}
						await player.gain(card, "gain2");
						const skill = "dcjiesi_used";
						player.addTempSkill(skill, { player: ["phaseUseAfter", "phaseChange"] });
						const bool = !player.getStorage(skill).some(cardx => cardx.name == card.name);
						player.markAuto(skill, card);
						if (bool) {
							const result = await player
								.chooseToDiscard(`捷思：是否弃置${len}张牌，然后重置此技能？`, len, "he")
								.set("ai", card => (get.event().goon ? 6.5 - get.value(card) : 0))
								.set("goon", player.countCards("he", card => 6 - get.value(card)) >= len)
								.forResult();
							if (result?.bool) {
								delete player.getStat().skill.dcjiesi;
							}
						}
					},
				};
			},
		},
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object") {
					if (get.type(card) == "equip") {
						return num - 3;
					}
				}
			},
		},
		subSkill: {
			backup: {},
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: storage => "获得过的牌名：" + storage.map(card => get.translation(card.name)).unique(),
				},
			},
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
	},
	//夏侯徽
	dcdujun: {
		audio: 2,
		trigger: {
			global: ["damageSource", "damageEnd"],
		},
		filter(event, player, name) {
			const key = name == "damageSource" ? "sourceDamage" : "damage",
				targets = [player, player.storage?.dcdujun],
				target = name == "damageSource" ? event.source : event.player;
			if (target && targets.includes(target)) {
				return target.getHistory(key, evt => evt.num > 0).indexOf(event) == 0;
			}
		},
		prompt2: "摸2张牌，然后可以将这些牌交给一名角色",
		check: () => true,
		//frequent:true,
		async content(event, trigger, player) {
			let { cards } = await player.draw(2).forResult();
			cards = cards.filter(card => get.owner(card) == player);
			if (get.itemtype(cards) != "cards" || !cards.length) {
				return;
			}
			const result = await player
				.chooseTarget(`笃君：可以将${get.translation(cards)}交给一名角色`)
				.set("ai", target => {
					const att = get.sgnAttitude(get.player(), target),
						cards = get.event().cardsx;
					return att * cards.reduce((sum, card) => sum + get.value(card, target), 0);
				})
				.set("cardsx", cards)
				.forResult();
			if (result?.targets?.length) {
				const target = result.targets[0];
				if (player == target) {
					return;
				}
				player.line(target);
				await player.give(cards, target);
			}
		},
		intro: {
			content: "player",
		},
		group: ["dcdujun_init"],
		subSkill: {
			effect: {
				audio: "dcdujun",
				charlotte: true,
				onremove: true,
				intro: {
					markcount: () => 0,
					content: "players",
				},
				trigger: {
					global: "useCard1",
				},
				forced: true,
				filter(event, player) {
					return player.getStorage("dcdujun_effect").includes(event.player);
				},
				async content(event, trigger, player) {
					game.log(player, "不能响应", trigger.card);
					trigger.directHit.add(player);
				},
			},
			init: {
				audio: "dcdujun",
				trigger: {
					player: "enterGame",
					global: "phaseBefore",
				},
				filter(event, player) {
					return (event.name != "phase" || game.phaseNumber == 0) && game.hasPlayer(target => target != player);
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(`笃君：请选择一名其他角色作为你的“夫君”`, true, lib.filter.notMe)
						.set("ai", target => get.attitude(get.player(), target))
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0],
						skill = "dcdujun_effect";
					player.setStorage("dcdujun", target);
					player.addSkill(skill);
					player.markAuto(skill, target);
				},
			},
		},
	},
	dcjikun: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["addToExpansionAfter", "gainAfter", "addJudgeAfter", "loseAsyncAfter", "equipAfter"],
		},
		filter(event, player) {
			return event.dcjikun_count > 0;
		},
		getIndex(event, player) {
			return event.dcjikun_count;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const selected = ui.selected?.targets;
					if (!selected?.length) {
						return get.attitude(get.player(), target);
					}
					return get.effect(target, { name: "shunshou_copy2" }, selected[0], get.player());
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const gainer = event.targets[0],
				targets = game.filterPlayer(target => target.isMaxHandcard()).sortBySeat();
			gainer.line(targets);
			for (const gainee of targets) {
				const card = gainee.getGainableCards(gainer, "he").randomGet();
				await gainer.gain(card, gainee, "giveAuto", "bySelf");
			}
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
				onremove: true,
				silent: true,
				trigger: {
					player: "loseEnd",
					global: ["addToExpansionEnd", "gainEnd", "addJudgeEnd", "loseAsyncEnd", "equipEnd"],
				},
				content() {
					const evt = trigger.getl(player);
					if (!evt?.cards2?.length) {
						return;
					}
					const prev = player.countMark(event.name);
					player.addMark(event.name, evt.cards.length, false);
					const now = player.countMark(event.name);
					const num = Math.floor(now / 5) - Math.floor(prev / 5);
					trigger.set("dcjikun_count", num);
				},
				intro: {
					markcount: storage => storage % 5,
					content: (storage, player) => `<li>已失去${storage}张牌<br><li>当前充能：${storage % 5}/5`,
				},
			},
		},
	},
};
