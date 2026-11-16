import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twliexi" | "twshezhong" | "twkaizeng" | "twyangming">} */
export const groupSkills = {
	//侠典韦
	twliexi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countCards("he");
		},
		direct: true,
		chooseAi: (event, player) => {
			let cards = [],
				wq = []; //把武器牌和其他能弃置的牌分别按value从小到大排序
			player.getCards("he", card => {
				//[价值, id, 是否为武器牌]
				if (!lib.filter.cardDiscardable(card, player)) {
					return false;
				}
				if (get.subtype(card) == "equip1") {
					wq.push([get.value(card, player), card.cardid, true]);
				} else {
					cards.push([get.value(card, player), card.cardid]);
				}
			});
			cards.sort((a, b) => {
				return a[0] - b[0];
			});
			wq.sort((a, b) => {
				return a[0] - b[0];
			});
			let targets = [], //适合目标：[目标, 收益, 牌组]
				damage = get.damageEffect(player, player, event.player);
			game.countPlayer(cur => {
				if (player === cur) {
					return false;
				}
				let eff = get.damageEffect(cur, player, event.player);
				let dui = eff + damage - 2 * (wq.length ? wq[0][0] : cards[0][0]); //对砸
				if (eff <= 0) {
					if (dui > 0) {
						targets.push([cur, dui, [wq.length ? wq[0][1] : cards[0][1]]]);
					} //这都能卖血？！
					return false;
				}
				if (
					cards.length + wq.length <= cur.hp && //牌不够弃且没有武器可砸或者有但是太亏的不选
					(!wq.length || dui <= 0)
				) {
					return false;
				}
				let allcards = cards.concat(wq).sort((a, b) => {
						return a[0] - b[0];
					}),
					can; //所有可弃牌再从小到大排序
				if (allcards.length <= cur.hp) {
					//牌不够弃拿一张武器崩血的
					targets.push([cur, dui, [wq[0][1]]]);
					return false;
				}
				can = eff - allcards.slice(0, cur.hp + 1).reduce((acc, val) => acc + val[0], 0);
				if (!wq.length) {
					//没武器只能凑数砸的
					if (can > 0) {
						targets.push([cur, can, allcards.slice(0, cur.hp + 1).map(i => i[1])]);
					}
					return false;
				}
				let other = [wq[0]]; //拿最便宜的武器补刀
				for (let card of allcards) {
					if (other.length > cur.hp) {
						break;
					}
					if (wq[0][1] === card[1]) {
						continue;
					}
					other.push(card);
				}
				if (can < 2 * eff - other.reduce((acc, val) => acc + val[0], 0)) {
					//换一张武器牌的收益
					can = 2 * eff - other.reduce((acc, val) => acc + val[0], 0);
					allcards = other.map(i => i[1]);
				}
				if (dui > can) {
					can = dui;
					allcards = [wq[0][1]];
				}
				if (can > 0) {
					targets.push([cur, can, allcards]);
				} //这个时候can应该都是正的了，懒得再测了
			});
			if (targets.length) {
				return targets.sort((a, b) => {
					return b[1] - a[1];
				})[0];
			}
			return [null, 0, []];
		},
		content() {
			"step 0";
			player.chooseCardTarget({
				filterCard: lib.filter.cardDiscardable,
				selectCard: [1, Infinity],
				position: "he",
				filterTarget: lib.filter.notMe,
				prompt: get.prompt2("twliexi"),
				aiSelected: lib.skill.twliexi.chooseAi(_status.event, player),
				ai1(card) {
					if (get.event().aiSelected[2].includes(card.cardid)) {
						return 30 - get.value(card);
					}
					return 0;
				},
				ai2(target) {
					if (get.event().aiSelected[0] === target) {
						return 10;
					}
					return 0;
				},
				allowChooseAll: true,
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				var cards = result.cards;
				player.logSkill("twliexi", target);
				player.discard(cards);
				if (cards.length > target.hp) {
					target.damage();
				} else {
					player.damage(target);
				}
				var goon = false;
				for (var card of cards) {
					if (get.subtype(card) == "equip1") {
						goon = true;
						break;
					}
				}
				if (!goon) {
					event.finish();
				}
			} else {
				event.finish();
			}
			"step 2";
			game.delayx();
			target.damage();
		},
	},
	twshezhong: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		content() {
			"step 0";
			var damage = player.getHistory("sourceDamage").length;
			if (damage) {
				player
					.chooseTarget(
						get.prompt("twshezhong"),
						"令至多" + get.cnNumber(damage) + "名其他角色下个摸牌阶段的摸牌数-1",
						[1, damage],
						lib.filter.notMe
					)
					.set("ai", target => {
						return -get.attitude(_status.event.player, target);
					});
			} else {
				event.goto(2);
			}
			"step 1";
			if (result.bool) {
				var targets = result.targets;
				player.logSkill("twshezhong", targets);
				for (var target of targets) {
					target.addSkill("twshezhong_minus");
					target.addMark("twshezhong_minus", 1, false);
				}
			}
			"step 2";
			var targets = [];
			for (var evt of player.getHistory("damage")) {
				if (evt.source && evt.source.isIn()) {
					targets.add(evt.source);
				}
			}
			if (targets.length) {
				player
					.chooseTarget(
						get.prompt("twshezhong"),
						"将手牌摸至一名与一名本回合对你造成过伤害的角色的体力值相同，且至多摸至五张",
						(card, player, target) => {
							return _status.event.targets.includes(target);
						}
					)
					.set("ai", target => {
						return Math.max(0.1, target.hp - _status.event.player.countCards("h"));
					})
					.set("targets", targets);
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("twshezhong", target);
				var num = Math.min(target.hp, 5) - player.countCards("h");
				if (num > 0) {
					player.draw(num);
				}
			}
		},
		subSkill: {
			minus: {
				trigger: { player: "phaseDrawBegin" },
				forced: true,
				onremove: true,
				content() {
					var num = player.countMark("twshezhong_minus");
					trigger.num -= num;
					game.log(player, "的额定摸牌数", "#g-" + num);
					player.removeSkill("twshezhong_minus");
				},
				mark: true,
				intro: {
					content: "额定摸牌数-#",
				},
			},
		},
	},
	//侠鲁肃
	twkaizeng: {
		audio: 2,
		global: "twkaizeng_want",
		refuseInfo: ["不给", "拒绝"],
		subSkill: {
			want: {
				audio: "twkaizeng",
				forceaudio: true,
				enable: "phaseUse",
				charlotte: true,
				prompt: "点击“确定”来寻求施舍",
				filter(event, player) {
					if (player.hasSkill("twkaizeng_used")) {
						return false;
					}
					return game.hasPlayer(current => current != player && current.hasSkill("twkaizeng") && current.countCards("h"));
				},
				chooseButton: {
					dialog(event, player) {
						const targets = game.filterPlayer(current => current != player && current.hasSkill("twkaizeng") && current.countCards("h"));
						return ui.create.dialog(
							"###慨赠###" +
								"选择一种基本牌的牌名或非基本牌的类型，然后令" +
								get.translation(targets) +
								(targets.length > 1 ? "中的一人" : "") +
								"选择是否交给你任意张手牌"
						);
					},
					chooseControl() {
						const list = [];
						const basic = [];
						for (let i = 0; i < lib.inpile.length; i++) {
							const name = lib.inpile[i];
							const type = get.type2(name);
							if (type == "basic") {
								list.push(name);
								basic.push(name);
							} else {
								list.add(type);
							}
						}
						list.push("cancel2");
						return list;
					},
					check(event, player) {
						if (Math.random() < 0.4) {
							const list = get.event().controls.slice();
							list.remove("du");
							return list.randomGet();
						}
						const targets = game.filterPlayer(current => current != player && current.hasSkill("twkaizeng") && current.countCards("h"));
						targets.sort((a, b) => get.attitude(player, b) - get.attitude(player, a));
						const cards = targets[0].getCards("h");
						const list = [];
						for (const card of cards) {
							const type = get.type2(card);
							if (type == "basic") {
								list.add(get.name(card));
							} else {
								list.add(type);
							}
						}
						const need = ["trick", "equip"].randomSort();
						need.addArray(["sha", "jiu"].randomSort());
						for (const type of need) {
							if (list.includes(type)) {
								return type;
							}
						}
						return list.randomGet();
					},
					backup(result, player) {
						return {
							audio: "twkaizeng",
							type: result.control,
							log: false,
							delay: false,
							filterTarget(card, player, target) {
								return target.hasSkill("twkaizeng");
							},
							selectTarget() {
								const player = get.player();
								const targets = game.filterPlayer(
									current => current != player && current.hasSkill("twkaizeng") && current.countCards("h")
								);
								return targets.length > 1 ? 1 : -1;
							},
							prepare(cards, player, targets) {
								targets[0].logSkill("twkaizeng_want", player);
							},
							async content(event, trigger, player) {
								player.addTempSkill("twkaizeng_used", "phaseUseAfter");
								const { target, name } = event;
								const type = lib.skill[name].type;
								const isbasic = lib.card[type];
								const { bool, cards } = await target
									.chooseToGive(
										player,
										`慨赠：是否交给${get.translation(player)}任意张手牌？`,
										`若你以此法：交给其至少两张牌，你摸一张牌；交给其的牌包含${get.translation(type)}${isbasic ? "" : "牌"}，你获得一张不为此牌名或类型的牌`,
										[1, Infinity]
									)
									.set("allowChooseAll", true)
									.set("ai", card => {
										const { player, target, goon, type } = get.event();
										if (!goon) {
											return -get.value(card);
										}
										if (ui.selected.cards.length > player.countCards("h") / 2 && ui.selected.cards.length >= 2) {
											return 0;
										}
										const isbasic = lib.card[type];
										let add = 0;
										if (!ui.selected.cards.some(i => get[isbasic ? "name" : "type2"](i, target) == type)) {
											add += 3;
										}
										if (ui.selected.cards.length < 2) {
											add += 3;
										}
										return get.value(card, target) - get.value(card, player) + add;
									})
									.set("type", type)
									.set("goon", get.attitude(target, player) > 0)
									.forResult();
								if (bool) {
									if (cards.length > 1) {
										await target.draw();
									}
									const fn = isbasic ? "name" : "type2";
									if (cards.some(card => get[fn](card, player) == type)) {
										const card = get.cardPile(cardx => get[fn](cardx, target) != type);
										if (card) {
											await target.gain(card, "gain2");
										}
									}
									await game.delayx();
								} else {
									const refuseInfo = lib.skill.twkaizeng.refuseInfo.slice();
									if (get.attitude(target, player) < 0) {
										refuseInfo.push("没门");
									}
									target.chat(refuseInfo.randomGet());
								}
							},
							ai: { result: { target: 1 } },
						};
					},
					prompt: () => "请选择一名有【慨赠】的角色",
				},
				ai: {
					order: 10,
					result: {
						player(player) {
							if (
								game.hasPlayer(
									current =>
										current != player &&
										current.hasSkill("twkaizeng") &&
										current.countCards("h") &&
										get.attitude(player, current) > 0
								)
							) {
								return 1;
							}
							return 0;
						},
					},
				},
			},
			want_backup: {},
			used: { charlotte: true },
		},
		ai: { threaten: 3 },
	},
	twyangming: {
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		getNum: (event, player) =>
			player
				.getHistory("useCard", evt => evt.getParent("phaseUse") == event)
				.map(evt => get.type2(evt.card))
				.toUniqued().length,
		frequent: true,
		filter(event, player) {
			return get.info("twyangming").getNum(event, player);
		},
		async content(event, trigger, player) {
			const num = get.info(event.name).getNum(trigger, player);
			await player.draw(num);
			player.addTempSkill(event.name + "_limit");
			player.addMark(event.name + "_limit", num, false);
			game.log(player, "本回合的手牌上限", "#g+" + num);
		},
		subSkill: {
			limit: {
				charlotte: true,
				onremove: true,
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("twyangming_limit");
					},
				},
				intro: { content: "本回合手牌上限+#" },
			},
		},
	},
};
