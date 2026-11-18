import type { IdentityPlayerAI } from "../runtimeTypes.js";
import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createStratagemAndIdentitySkills() {
	return {
		// 谋攻模式
		stratagem_gain: {
			trigger: {
				player: ["phaseBegin", "damageEnd"],
			},
			charlotte: true,
			ruleSkill: true,
			silent: true,
			async content(_event, trigger, player) {
				player.changeFury(trigger.name === "damage" ? trigger.num : 1, true);
			},
		},

		stratagem_insight: {
			trigger: {
				source: "damageSource",
				global: "loseHpEnd",
			},
			charlotte: true,
			ruleSkill: true,
			prompt2(event) {
				return `消耗1点怒气，洞察${get.translation(event.player)}的身份`;
			},
			filter(event, player) {
				if (!player.storage.stratagem_fury) {
					return false;
				}
				const target = event.player;
				if (target === player || !target.isIn() || target.identityShown) {
					return false;
				}
				let source = event.source;
				if (event.name === "loseHp") {
					const trigger = event.getParent()?._trigger;
					if (trigger != null) {
						source = trigger.source;
					}
				}
				return player === source;
			},
			check(event, player) {
				const storage = player.storage;
				const zhibi = storage.zhibi;
				if (zhibi?.includes(event.player)) {
					return false;
				}
				const stratagemExpose = storage.stratagem_expose;
				if (stratagemExpose?.includes(event.player)) {
					return false;
				}
				if (get.population("zhong") === 0 && player.identity === "fan") {
					return false;
				}
				return Math.abs(get.attitude(player, event.player)) <= 1;
			},
			logTarget: "player",
			async content(_event, trigger, player) {
				player.changeFury(-1, true);
				player.insightInto(trigger.player);
			},
		},

		stratagem_monarchy: {
			trigger: {
				player: ["dying", "phaseZhunbeiBegin"],
				global: "dieAfter",
			},
			charlotte: true,
			ruleSkill: true,
			priority: 100,
			firstDo: true,
			unique: true,
			silent: true,
			popup: false,
			filter(_event, player, name) {
				if (player.storage.stratagem_monarchy || player.identity !== "zhu") {
					return false;
				}
				if (name === "dieAfter") {
					return game.dead.length >= Math.max(Math.round(get.population(undefined) / 3), 2);
				}
				return name === "dying" || game.roundNumber >= Math.max(Math.round(get.population(undefined) / 2), 3);
			},
			async content(event, _trigger, player) {
				if (event.triggername == "dying") {
					await game.delayx();
				}
				player.storage.stratagem_monarchy = true;
				game.broadcastAll(clientPlayer => {
					if (!game.zhu) {
						game.zhu = clientPlayer;
					}
					clientPlayer.identityShown = true;
					clientPlayer.ai.shown = 1;
					clientPlayer.setIdentity();
					clientPlayer.isZhu = true;
					clientPlayer.node.identity.classList.remove("guessing");
					const config = lib.config;
					if (config.animation && !config.low_performance) {
						clientPlayer.$legend();
					}
					const clickingIdentity = _status.clickingidentity;
					if (!clickingIdentity || clickingIdentity[0] != clientPlayer) {
						return;
					}
					clickingIdentity[1].forEach(element => {
						element.delete();
						element.style.transform = "";
					});
					delete _status.clickingidentity;
				}, player);
				game.addVideo("showIdentity", player, "zhu");
				player.playerfocus(1000);
				await game.delay(2);
				await event.trigger("zhuUpdate");
				await player.recover();
				await player.draw();
				const skills = player.getStockSkills(true, true).filter(stockSkill => {
					if (player.hasSkill(stockSkill)) {
						return false;
					}
					const info = get.info(stockSkill);
					if (!info?.zhuSkill) {
						return false;
					}
					return true;
				});
				if (skills.length) {
					await player.addSkills(skills);
				}
			},
		},

		stratagem_revitalization: {
			trigger: {
				player: "dying",
			},
			charlotte: true,
			ruleSkill: true,
			unique: true,
			silent: true,
			filter(_event, player) {
				const storage = player.storage;
				return !storage.stratagem_revitalization && (player.ai as IdentityPlayerAI).stratagemCamouflage && game.dead.length < Math.max(Math.round(get.population(undefined) / 6), 1) && storage.stratagem_fury >= 2;
			},
			async content(_event, _trigger, player) {
				await game.delayx();
				player.storage.stratagem_revitalization = true;
				game.broadcastAll(clientPlayer => {
					clientPlayer.identityShown = true;
					clientPlayer.ai.shown = 1;
					clientPlayer.setIdentity();
					clientPlayer.node.identity.classList.remove("guessing");
					if (lib.config.animation && !lib.config.low_performance) {
						clientPlayer.$thunder();
					}
				}, player);
				game.addVideo("showIdentity", player, "fan");
				player.playerfocus(800);
				await game.delay(2);
				player.changeFury(-player.storage.stratagem_fury, true);
				await player.discard(player.getCards("hej"));
				await player.link(false);
				await player.turnOver(false);
				await player.recover(2 - player.hp);
				await player.draw(3);
			},
		},

		stratagem_expose: {
			trigger: {
				player: "useCard",
			},
			forced: true,
			silent: true,
			popup: false,
			filter(event, player) {
				const targets = event.targets;
				if (targets.length !== 1) {
					return false;
				}
				const target = targets[0];
				return (
					target === player &&
					(target.identityShown ||
						player.storage.zhibi.includes(target) ||
						game.hasPlayer2(current => {
							if (!current.identityShown) {
								return false;
							}
							const storage = current.storage;
							return (storage.stratagem_revitalization || storage.stratagem_monarchy) && storage.stratagem_expose.includes(target);
						}))
				);
			},
			async content(_event, trigger, player) {
				const storage = trigger.targets[0].storage;
				storage.stratagem_expose ??= [];
				storage.stratagem_expose.add(player);
			},
		},

		// 3v3v2
		yexinbilu: {
			enable: "phaseUse" as const,
			charlotte: true,
			ruleSkill: true,
			skillAnimation: "legend" as const,
			animationColor: "thunder" as const,
			filter(event, player) {
				return player.identity === "rYe" || player.identity === "bYe";
			},
			async content(_event, _trigger, player) {
				game.removeGlobalSkill("yexinbilu");
				await player.yexinbilu();
			},
			ai: {
				order: 10,
				result: {
					player(player) {
						return 1 - game.countPlayer(current => current !== player && (current.identity === "rYe" || current.identity === "bYe") && (current === game.me || current.isOnline()));
					},
				},
			},
		},

		// 特殊身份
		identity_junshi: {
			name: "军师",
			trigger: {
				player: "phaseZhunbeiBegin",
			},
			charlotte: true,
			silent: true,
			async content(event, trigger, player) {
				const cards = get.cards(3);
				await game.cardsGotoOrdering(cards);
				const result = (await player
					.chooseToMove({
						prompt: "观星：点击或拖动将牌移动到牌堆顶或牌堆底",
						list: [["牌堆顶", cards], ["牌堆底"]],
						processAI(list) {
							const player = get.player();
							const cards = list[0][1];
							const judges = player!.getCards("j");

							const top: any[] = [];
							let stopped = false;
							if (!player!.hasWuxie()) {
								for (const card of judges) {
									const judge = get.judge(card);
									cards.sort((a, b) => judge(b) - judge(a));
									if (judge(cards[0]) < 0) {
										stopped = true;
										break;
									} else {
										top.unshift(cards.shift());
									}
								}
							}
							if (!stopped) {
								cards.sort((a, b) => get.value(b, player, undefined) - get.value(a, player, undefined));
								while (cards.length) {
									if (get.value(cards[0], player, undefined) <= 5) {
										break;
									}
									top.unshift(cards.shift());
								}
							}
							const bottom = cards;
							return [top, bottom];
						},
					})
					.forResult()) as Result;

				const top = result.moved[0];
				const bottom = result.moved[1];
				top.reverse();
				await game.cardsGotoPile(top.concat(bottom), ["top_cards", top], (event, card) => {
					if (event.top_cards.includes(card)) {
						return ui.cardPile.firstChild;
					}
					return null;
				});
				player.popup(get.cnNumber(top.length) + "上" + get.cnNumber(bottom.length) + "下");
				game.log(player, "将" + get.cnNumber(top.length) + "张牌置于牌堆顶");
				game.updateRoundNumber();
				await game.delayx();
			},
			mark: true,
			intro: {
				content: "准备阶段开始时，可以观看牌堆顶的三张牌，然后将这些牌以任意顺序置于牌堆顶或牌堆底",
			},
		},

		identity_dajiang: {
			name: "大将",
			charlotte: true,
			mark: true,
			intro: {
				content: "手牌上限+1",
			},
			mod: {
				maxHandcard(player, num) {
					return num + 1;
				},
			},
		},

		identity_zeishou: {
			name: "贼首",
			charlotte: true,
			mark: true,
			intro: {
				content: "手牌上限-1",
			},
			mod: {
				maxHandcard(player, num) {
					return num - 1;
				},
			},
		},

		// 四象标记
		sixiang_zhuque: {
			enable: "phaseUse" as const,
			charlotte: true,
			prompt: "弃置一张非基本牌，对一名角色造成1点伤害",
			filter(event, player) {
				return player.hasCard(card => get.type(card, null, player) !== "basic", "he");
			},
			filterCard(card, player) {
				return get.type(card, null, player) !== "basic";
			},
			position: "he",
			filterTarget: true,
			check(card) {
				return 7 - get.value(card, undefined, undefined);
			},
			async content(event, _trigger, player) {
				player.removeSkill("sixiang_zhuque");
				player.addTempSkill("sixiang_zhuque_cancel", "phaseUseEnd");
				await event.target.damage("nocard");
			},
			group: "sixiang_remove",
			mark: true,
			markimage: "image/mode/identity/mark/sixiang_zhuque.jpg",
			intro: {
				content: "出牌阶段，你可以弃置一张非基本牌，对一名角色造成1点伤害，以此法杀死反贼不执行奖惩。",
			},
			ai: {
				order: 0.6,
				result: {
					player(player, target) {
						if (ui.selected.cards.length) {
							return -get.value(ui.selected.cards[0], player, undefined);
						}
					},
					target(player, target) {
						return get.damageEffect(target, player, target, undefined);
					},
				},
			},
			subSkill: {
				cancel: {
					trigger: {
						global: ["drawBegin", "discardBegin"],
					},
					filter(event, player) {
						const evt = event.getParent();
						if (!evt?.player) {
							return false;
						}
						return evt.name === "die" && evt.player.identity === "fan" && event.getParent(4).name === "sixiang_zhuque";
					},
					charlotte: true,
					forceDie: true,
					silent: true,
					async content(_event, trigger) {
						trigger.cancel();
					},
				},
			},
		},

		sixiang_xuanwu: {
			enable: "chooseToUse" as const,
			charlotte: true,
			prompt: "将一张牌当【桃】使用",
			filter(event, player) {
				return player.hasCard(true, "hes");
			},
			viewAs: {
				name: "tao",
			},
			filterCard: true,
			position: "hes",
			check(card) {
				if (get.tag(card, "recover", undefined, undefined)) {
					return 0;
				}
				return 9 - get.value(card, undefined, undefined);
			},
			async precontent(_event, _trigger, player) {
				player.removeSkill("sixiang_xuanwu");
			},
			group: "sixiang_remove",
			mark: true,
			markimage: "image/mode/identity/mark/sixiang_xuanwu.jpg",
			intro: {
				content: "你可以将一张牌当【桃】使用。",
			},
		},
	};
}
