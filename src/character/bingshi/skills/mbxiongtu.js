import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mbxiongtu" | "mbxianshuai" | "potzhongao" | "potzhuangshi">} */
export const groupSkills = {
	//孙峻
	mbxiongtu: {
		audio: 4,
		logAudio: index => (typeof index === "number" ? `mbxiongtu${index}.mp3` : 2),
		enable: "phaseUse",
		usable(skill, player) {
			return player.hasSkill(skill + "_double") ? 2 : 1;
		},
		filter(event, player) {
			return game.hasPlayer(target => target.countCards("h") && target != player);
		},
		filterTarget(card, player, target) {
			return target.countCards("h") && target != player;
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await player.choosePlayerCard(`凶图：请展示${get.translation(target)}的一张手牌`, target, "h", true).forResult();
			if (result?.cards?.length) {
				const card = result.cards[0];
				await player.showCards(card, `${get.translation(player)}发动了【${get.translation(event.name)}】`);
				const num = lib.suit.slice(0).removeArray(
					get
						.discarded()
						.map(card => get.suit(card))
						.unique()
				).length;
				const resultx = await player
					.chooseToDiscard({
						prompt: `凶图：取消并弃置${get.translation(card)}或弃置${num}张牌对${get.translation(target)}造成1点伤害`,
						position: "he",
						selectCard: num,
						ai(card) {
							if (get.event().num > 2) {
								return 0;
							}
							return 6 - get.value(card);
						},
					})
					.set("num", num)
					.forResult();
				if (resultx?.bool) {
					player.logSkill("mbxiongtu", [target], null, null, [get.rand(3, 4)]);
					await target.damage();
				} else {
					await target.modedDiscard(card, player);
				}
				player.addTempSkill(event.name + "_effect");
			}
		},
		ai: {
			order: 1,
			result: {
				target: -1,
			},
		},
		subSkill: {
			effect: {
				audio: "mbxiongtu",
				charlotte: true,
				forced: true,
				trigger: {
					source: "damageSource",
				},
				filter(event, player) {
					return event.getParent().name != "mbxiongtu";
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					player.addTempSkill("mbxiongtu_double", "phaseChange");
					await player.draw();
				},
				mark: true,
				intro: {
					content: "下次不因此技能造成伤害后，摸一张牌并改为限两次",
				},
			},
			double: {
				charlotte: true,
			},
		},
	},
	mbxianshuai: {
		audio: 2,
		init(player, skill) {
			player.addSkill(skill + "_record");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_record");
		},
		mod: {
			cardUsable(card, player, num) {
				if (_status.currentPhase != player) {
					return;
				}
				const cards = card.cards;
				if (cards.length == 1) {
					if (player.getCards("h").includes(cards[0]) && !player.getStorage("mbxianshuai_record").includes(get.suit(cards[0], player))) {
						return Infinity;
					}
				}
				return;
			},
		},
		trigger: { player: "useCard1" },
		filter(event, player) {
			if (_status.currentPhase != player) {
				return false;
			}
			return event.mbxianshuai && event.addCount !== false;
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.addCount = false;
			const stat = player.getStat().card,
				name = trigger.card.name;
			if (typeof stat[name] === "number") {
				stat[name]--;
			}
		},
		subSkill: {
			record: {
				init(player, skill) {
					if (_status.currentPhase != player) {
						return;
					}
					const suits = player
						.getHistory("lose", evt => {
							if ((evt.relatedEvent || evt.getParent()).name != "useCard") {
								return false;
							}
							return evt.cards.length == 1 && evt.hs?.length == 1;
						})
						.map(evt => get.suit(evt.getParent()?.card))
						.unique();
					if (suits.length) {
						player.addTempSkill("mbxianshuai_clear");
						player.markAuto(
							skill,
							suits.sort((a, b) => lib.suit.indexOf(a) - lib.suit.indexOf(b))
						);
						player.addTip(skill, `${get.translation(skill)} ${player.getStorage(skill).reduce((str, suit) => (str += get.translation(suit)), "")}`);
					}
				},
				trigger: { player: "useCard0" },
				charlotte: true,
				silent: true,
				filter(event, player) {
					if (_status.currentPhase != player) {
						return false;
					}
					return (
						event.cards.length == 1 &&
						!player.getStorage("mbxianshuai_record").includes(get.suit(event.card)) &&
						player.hasHistory("lose", evt => {
							const evtx = evt.relatedEvent || evt.getParent();
							return evtx == event && evt.hs?.length == 1;
						})
					);
				},
				async content(event, trigger, player) {
					trigger.set("mbxianshuai", true);
					player.addTempSkill("mbxianshuai_clear");
					player.markAuto(event.name, get.suit(trigger.card));
					player.storage[event.name] = player.getStorage(event.name).sort((a, b) => lib.suit.indexOf(a) - lib.suit.indexOf(b));
					player.addTip(event.name, `${get.translation(event.name)} ${player.getStorage(event.name).reduce((str, suit) => (str += get.translation(suit)), "")}`);
				},
				intro: {
					content: "已使用过的花色:$",
				},
			},
			clear: {
				onremove(player, skill) {
					delete player.storage.mbxianshuai_record;
					player.unmarkSkill("mbxianshuai_record");
					player.removeTip("mbxianshuai_record");
				},
				charlotte: true,
			},
		},
	},
	//势魏延
	potzhongao: {
		audio: 5,
		dutySkill: true,
		derivation: ["potkuanggu", "potkuanggu_pot_weiyan_achieve", "kunfen"],
		group: ["potzhongao_start", "potzhongao_achieve", "potzhongao_fail"],
		subSkill: {
			start: {
				audio: "potzhongao1.mp3",
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.addSkills("potkuanggu");
				},
			},
			achieve: {
				audio: ["potzhongao2.mp3", "potzhongao3.mp3"],
				trigger: {
					source: "dieAfter",
				},
				forced: true,
				locked: false,
				skillAnimation: true,
				animationColor: "fire",
				async content(event, trigger, player) {
					player.awakenSkill(event.name.slice(0, -8));
					game.log(player, "成功完成使命");
					player.changeSkin("potzhongao", "pot_weiyan_achieve");
					game.broadcastAll(() => {
						_status.tempMusic = "effect_yinzhanBGM";
						game.playBackgroundMusic();
					});
					player.setStorage("potkuanggu", 1);
					const num1 = player.countMark("potzhuangshi_limit"),
						num2 = player.countMark("potzhuangshi_directHit");
					if (num1 > 0) {
						await player.draw();
					}
					if (num2 > 0) {
						if (!player.isDamaged()) {
							await player.draw();
						} else {
							await player.recover();
						}
					}
				},
			},
			fail: {
				audio: ["potzhongao4.mp3", "potzhongao5.mp3"],
				trigger: {
					player: ["dying", "phaseUseBegin"],
				},
				filter(event, player) {
					return event.name == "dying" || !event.usedZhuangshi;
				},
				lastDo: true,
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					player.awakenSkill(event.name.slice(0, -5));
					game.log(player, "使命失败");
					player.changeSkin("potzhongao", "pot_weiyan_fail");
					game.broadcastAll(() => {
						_status.tempMusic = "effect_tuishouBGM";
						game.playBackgroundMusic();
					});
					await player.changeSkills(["kunfen"], ["potzhuangshi"]);
				},
			},
		},
	},
	potzhuangshi: {
		audio: 2,
		audioname: ["pot_weiyan_achieve"],
		trigger: {
			player: "phaseUseBegin",
		},
		async cost(event, trigger, player) {
			const { bool: bool1, cards } = await player
				.chooseToDiscard(get.prompt(event.skill), [1, Infinity], "h", "allowChooseAll")
				.set("prompt2", "弃置任意张手牌，令你此阶段使用的前等量张牌无距离限制且不可被响应")
				.set("ai", card => {
					const player = get.player();
					let num = Math.floor(player.countCards("h") / 2);
					if (!game.hasPlayer(current => get.attitude(player, current) < 0)) {
						num = 1;
					}
					if (ui.selected.cards.length < num && card.name != "du") {
						if (get.tag(card, "damage")) {
							return 0.1 - ui.selected.cards.length;
						}
						return 7 - get.value(card);
					}
					return 0;
				})
				.set("chooseonly", true)
				.forResult();
			if (bool1 && cards.length) {
				game.broadcastAll(cards => {
					cards.forEach(card => card.addGaintag("potzhuangshi_tag"));
				}, cards);
			}
			const { bool: bool2, numbers } = await player
				.chooseNumbers(get.prompt(event.skill), [
					{
						prompt: "失去任意点体力值，令你此阶段使用的前等量张牌不计入次数限制",
						min: 1,
						max: player.getHp(),
					},
				])
				.set("processAI", () => {
					const player = get.player();
					if (player.hp < 2 || !game.hasPlayer(current => get.attitude(player, current) < 0)) {
						return false;
					}
					let num = Math.min(Math.floor(player.countCards("h") / 2), player.hp - 1);
					return [num];
				})
				.forResult();
			event.result = {
				bool: bool1 || bool2,
				cards: cards,
				cost_data: numbers,
			};
			player.removeGaintag("potzhuangshi_tag");
		},
		async content(event, trigger, player) {
			trigger.set("usedZhuangshi", true);
			const { cards, cost_data: numbers } = event;
			if (cards) {
				const number = cards.length;
				player.addTempSkill("potzhuangshi_directHit", "phaseChange");
				player.addMark("potzhuangshi_directHit", number, false);
				player.addTip("potzhuangshi_directHit", `不可响应 ${number}`);
			}
			if (numbers) {
				const number = numbers[0];
				player.addTempSkill("potzhuangshi_limit", "phaseChange");
				player.addMark("potzhuangshi_limit", number, false);
				player.addTip("potzhuangshi_limit", `不计次数 ${number}`);
			}
			if (cards) {
				await player.modedDiscard(cards);
			}
			if (numbers) {
				const number = numbers[0];
				await player.loseHp(number);
			}
		},
		onremove(player) {
			player.removeSkill("potzhuangshi_directHit");
			player.removeSkill("potzhuangshi_limit");
		},
		subSkill: {
			limit: {
				trigger: {
					player: "useCard0",
				},
				charlotte: true,
				filter(event, player) {
					return player.hasMark("potzhuangshi_limit");
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] == "number") {
							stat[name]--;
						}
					}
					player.removeMark("potzhuangshi_limit", 1, false);
					const num = player.countMark("potzhuangshi_limit");
					if (num > 0) {
						player.addTip("potzhuangshi_limit", `不计次数 ${num}`);
					} else {
						player.removeTip("potzhuangshi_limit");
					}
				},
				onremove(player, skill) {
					player.clearMark(skill, false);
					player.removeTip(skill);
				},
				ai: {
					presha: true,
					skillTagFilter(player, tag, arg) {
						if (!player.hasMark("potzhuangshi_limit")) {
							return false;
						}
					},
				},
			},
			directHit: {
				trigger: {
					player: "useCard0",
				},
				charlotte: true,
				filter(event, player) {
					return player.hasMark("potzhuangshi_directHit");
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.players);
					player.removeMark("potzhuangshi_directHit", 1, false);
					const num = player.countMark("potzhuangshi_directHit");
					if (num > 0) {
						player.addTip("potzhuangshi_directHit", `不可响应 ${num}`);
					} else {
						player.removeTip("potzhuangshi_directHit");
					}
				},
				onremove(player, skill) {
					player.clearMark(skill, false);
					player.removeTip(skill);
				},
				mod: {
					targetInRange(card, player) {
						if (player.hasMark("potzhuangshi_directHit")) {
							return true;
						}
					},
				},
			},
		},
	},
};
