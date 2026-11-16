import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczhongtao" | "dcjizhan">} */
export const groupSkills = {
	//威马超
	dczhongtao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog(`###众讨###出牌阶段限一次，你可以选择至多${Math.min(4, player.getDamagedHp() + 1)}种花色，然后随机获得弃牌堆中你选择花色的各一张牌。`, [lib.suit.map(suit => "lukai_" + suit), "vcard"]);
			},
			check(button) {
				return Math.random();
			},
			select() {
				const player = get.player();
				return [1, 1 + player.getDamagedHp()];
			},
			backup(links) {
				return {
					audio: "dczhongtao",
					suits: links.map(list => list[2].slice(6)),
					async content(event, trigger, player) {
						const suits = get.info(event.name).suits;
						const cards = [];
						for (const suit of suits) {
							const card = lib.skill.dczhongtao.getCard(
								card => get.suit(card) == suit,
								cards.some(j => get.position(j) == "j"),
								cards.some(e => get.position(e) == "e"),
								player
							);
							if (card) {
								cards.push(card);
							}
						}
						if (cards.length) {
							await player.gain(cards, "gain2");
						} else {
							player.chat("牌堆我对你的爱像叮咚鸡");
						}
					},
				};
			},
		},
		/*珪珪：拿牌优先级应该是
		优先拿判定区 然后装备区 弃牌堆 最后是牌堆
		然后判定区和装备区最多各拿一张
		装备区副类别可能细分还有优先级 就不重要了
		然后弃牌堆优先
		最后才是牌堆*/
		getCard(filter, noj, noe, player) {
			let curs = game.filterPlayer(() => true).sortBySeat();
			//优先拿自己的
			curs.sortBySeat(player);
			//判定区
			if (noj != true) {
				for (let i = 0; i < curs.length; i++) {
					const jx = curs[i].getCards("j");
					for (let j = 0; j < jx.length; j++) {
						if (filter(jx[j])) {
							return jx[j];
						}
					}
				}
			}
			//装备区
			if (noe != true) {
				for (let i = 0; i < curs.length; i++) {
					const ex = curs[i].getCards("e");
					for (let j = 0; j < ex.length; j++) {
						if (filter(ex[j])) {
							return ex[j];
						}
					}
				}
			}
			//弃牌堆
			const card1 = get.discardPile(filter, "random");
			if (card1) {
				return card1;
			}
			//牌堆
			const card2 = get.cardPile2(filter, "random");
			if (card2) {
				return card2;
			}
			return null;
		},
		//珪珪：刷新的部分是众讨本身的效果而不是拿牌后的buff
		group: "dczhongtao_reset",
		subSkill: {
			backup: {},
			reset: {
				audio: "dczhongtao",
				forced: true,
				locked: false,
				popup: false,
				onremove: true,
				intro: {
					content: "已使用了 $",
				},
				trigger: { player: ["useCardAfter", "phaseAfter"] },
				filter(event, player) {
					if (event.name == "useCard") {
						return _status.currentPhase == player;
					}
					return true;
				},
				async content(event, trigger, player) {
					if (event.triggername == "phaseAfter") {
						player.setStorage(event.name, [], true);
						return;
					}
					player.markAuto(event.name, get.type2(trigger.card));
					if (player.getStorage(event.name).length >= 3) {
						player.setStorage(event.name, [], true);
						if (player.getStat().skill.dczhongtao > 0) {
							player.getStat().skill.dczhongtao--;
							player.popup("众讨");
							game.log(player, "重置了", "#g【众讨】");
						}
					}
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
	dcjizhan: {
		audio: 2,
		comboSkill: true,
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object") {
					const evt = lib.skill.dcjianying.getLastUsed(player);
					if (evt?.card && get.type(evt.card) == "equip" && !evt.dcjizhan && get.color(card, player) == "black") {
						return num + 10;
					}
				}
			},
		},
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			if (get.color(event.card) != "black") {
				return false;
			}
			const evt = lib.skill.dcjianying.getLastUsed(player, event);
			if (!evt || !evt.card || evt.dcjizhan) {
				return false;
			}
			return get.type(evt.card) == "equip";
		},
		locked: false,
		async cost(event, trigger, player) {
			const num = player.getHistory("useSkill", evt => evt.skill == event.skill).length + 1;
			const result = await player
				.chooseButtonTarget({
					createDialog: [
						get.prompt2(event.skill),
						[
							[
								["discard", `弃置其他角色共计至多${num}张牌`],
								["damage", `对一名其他角色造成${num}点伤害，然后此技能本回合失效`],
							],
							"textbutton",
						],
					],
					filterButton(button) {
						const player = get.player();
						if (button.link == "discard") {
							return game.hasPlayer(target => target.countDiscardableCards(player, "he"));
						}
						return true;
					},
					filterTarget(card, player, target) {
						const selected = ui.selected.buttons;
						if (!selected.length || target == player) {
							return false;
						}
						if (selected[0].link == "discard") {
							return false;
						}
						return true;
					},
					selectTarget() {
						const selected = ui.selected.buttons;
						if (!selected.length) {
							return false;
						}
						if (selected[0].link == "discard") {
							return -1;
						}
						return 1;
					},
					num: num,
					ai1(button) {
						const player = get.player();
						if (button.link == "discard") {
							const list = game
								.filterPlayer(target => target.countDiscardableCards(player, "he"))
								.map(target => {
									const num = get.effect(target, { name: "guohe_copy2" }, player, player);
									return num ? num : 0;
								})
								.sort((a, b) => b - a);
							return list.slice(0, Math.min(get.event().num, list.length)).reduce((eff, num) => eff + num, 0);
						}
						return Math.max(...game.filterPlayer().map(target => get.damageEffect(target, player, player) * get.event().num));
					},
					ai2(target) {
						const selected = ui.selected.buttons;
						const player = get.player();
						if (selected[0].link == "discard") {
							return get.effect(target, { name: "guohe_copy2" }, player, player);
						}
						return get.damageEffect(target, player, player) * get.event().num;
					},
				})
				.forResult();
			if (result?.links?.length) {
				event.result = {
					bool: true,
					targets: result.targets ?? [],
					cost_data: result.links[0],
				};
			}
		},
		async content(event, trigger, player) {
			trigger.set(event.name, true);
			const choice = event.cost_data;
			let num = player.getHistory("useSkill", evt => evt.skill == event.name).length;
			if (choice == "discard") {
				if (_status.connectMode) {
					game.broadcastAll(function () {
						_status.noclearcountdown = true;
					});
				}
				const lose_list = [];
				while (num > 0) {
					const result = await player
						.chooseTarget("###极斩###", `弃置任意名其他角色累计至多${num}张牌`, (card, player, target) => {
							return target.countDiscardableCards(player, "he") && target != player;
						})
						.set("ai", target => {
							const player = _status.event.player,
								discarded = _status.event.lose_list.find(item => item[0] == target);
							if (discarded) {
								if (target == player) {
									return 0;
								}
								const num = discarded[1].length;
								if (num > 1 && player.hp + player.hujia > 2) {
									return 0;
								}
							}
							if (target == player) {
								if (ui.cardPile.childNodes.length > 80 && player.hasCard(card => get.value(card) < 8)) {
									return 20;
								}
								return 0;
							}
							return get.effect(target, { name: "guohe_copy2" }, player, player);
						})
						.set("lose_list", lose_list)
						.forResult();
					if (result.bool) {
						const target = result.targets[0];
						const { cards } = await player
							.choosePlayerCard(target, true, "he", [1, num], `选择弃置${get.translation(target)}的牌`)
							.set("filterButton", button => {
								const card = button.link,
									target = _status.event.target,
									player = get.player();
								return lib.filter.canBeDiscarded(card, player, target, "dcjizhan");
							})
							.set("lose_list", lose_list)
							.set("ai", button => {
								if (ui.selected.buttons.length > 0) {
									return false;
								}
								var val = get.buttonValue(button);
								if (get.attitude(_status.event.player, _status.event.target) > 0) {
									return -val;
								}
								return val;
							})
							.forResult();
						num -= cards.length;
						const index = lose_list.find(item => item[0] == target);
						if (!index) {
							lose_list.push([target, cards]);
						} else {
							index[1].addArray(cards);
						}
						await target.modedDiscard(cards, player);
					} else {
						break;
					}
				}
				if (_status.connectMode) {
					game.broadcastAll(function () {
						delete _status.noclearcountdown;
						game.stopCountChoose();
					});
				}
			} else {
				await event.targets[0].damage(num);
				player.tempBanSkill(event.name);
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
				init(player, skill) {
					const evt = lib.skill.dcjianying.getLastUsed(player);
					if (evt?.card && get.type(evt.card) == "equip" && !evt.dcjizhan) {
						player.addTip(skill, "极斩 可连击");
					}
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				charlotte: true,
				trigger: {
					player: ["useCard1", "useCardAfter"],
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (event.triggername == "useCard1") {
						if (get.type(trigger.card) == "equip") {
							player.addTip(event.name, "极斩 可连击");
						} else {
							player.removeTip(event.name);
						}
					} else if (trigger.dcjizhan) {
						player.removeTip(event.name);
					}
				},
			},
		},
	},
};
