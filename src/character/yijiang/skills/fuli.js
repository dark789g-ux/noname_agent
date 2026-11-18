import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "fuli" | "qianxi" | "qianxi2" | "zhiman" | "sanyao" | "olsanyao" | "rezhiman" | "resanyao">} */
export const groupSkills = {
	fuli: {
		skillAnimation: true,
		animationColor: "soil",
		audio: 2,
		limited: true,
		enable: "chooseToUse",
		filter(event, player) {
			if (event.type != "dying") {
				return false;
			}
			if (player != event.dying) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recoverTo(game.countGroup());
			await player.turnOver();
		},
		ai: {
			save: true,
			skillTagFilter(player, arg, target) {
				return player == target && player.storage.fuli != true;
			},
			result: {
				player: 10,
			},
			threaten(player, target) {
				if (!target.storage.fuli) {
					return 0.9;
				}
			},
		},
	},
	qianxi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		preHidden: true,
		async content(event, trigger, player) {
			await player.draw();
			let result = await player
				.chooseToDiscard({
					position: "he",
					forced: true,
					ai(card) {
						const player = get.player();
						if (get.color(card, player)) {
							return 7 - get.value(card, player);
						}
						return 4 - get.value(card, player);
					},
				})
				.forResult();
			if (!result.bool || !result.cards?.length) {
				return;
			}
			const color = get.color(result.cards[0], result.cards[0].original === "h" ? player : false);
			result = await player
				.chooseTarget({
					filterTarget(card, player, target) {
						return player !== target && get.distance(player, target) <= 1;
					},
					forced: true,
					ai(target) {
						return -get.attitude(_status.event.player, target);
					},
				})
				.forResult();
			if (result.bool && result.targets?.length) {
				result.targets[0].storage.qianxi2 = color;
				player.line(result.targets, "green");
				result.targets[0].addTempSkill("qianxi2");
				result.targets[0].markSkill("qianxi2");
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (tag !== "directHit_ai" || !arg.target.hasSkill("qianxi2")) {
					return false;
				}
				if (arg.card.name == "sha") {
					return (
						arg.target.storage.qianxi2 == "red" &&
						(!arg.target.hasSkillTag(
							"freeShan",
							false,
							{
								player: player,
								card: arg.card,
								type: "use",
							},
							true
						) ||
							player.hasSkillTag("unequip", false, {
								name: arg.card ? arg.card.name : null,
								target: arg.target,
								card: arg.card,
							}) ||
							player.hasSkillTag("unequip_ai", false, {
								name: arg.card ? arg.card.name : null,
								target: arg.target,
								card: arg.card,
							}))
					);
				}
				return arg.target.storage.qianxi2 == "black";
			},
		},
	},
	qianxi2: {
		//trigger:{global:'phaseAfter'},
		forced: true,
		mark: true,
		audio: false,
		sourceSkill: "qianxi",
		async content(event, trigger, player) {
			player.removeSkill("qianxi2");
			delete player.storage.qianxi2;
		},
		mod: {
			cardEnabled2(card, player) {
				if (get.color(card) == player.storage.qianxi2 && get.position(card) == "h") {
					return false;
				}
			},
		},
		intro: {
			content(color) {
				return "不能使用或打出" + get.translation(color) + "的手牌";
			},
		},
	},
	zhiman: {
		audio: 2,
		audioname2: {
			guansuo: "zhiman_guansuo",
			gz_guansuo: "zhiman_guansuo",
		},
		trigger: { source: "damageBegin2" },
		check(event, player) {
			if (get.damageEffect(event.player, player, player) < 0) {
				return true;
			}
			var att = get.attitude(player, event.player);
			if (att > 0 && event.player.countCards("j")) {
				return true;
			}
			if (event.num > 1) {
				if (att < 0) {
					return false;
				}
				if (att > 0) {
					return true;
				}
			}
			var cards = event.player.getGainableCards(player, "e");
			for (var i = 0; i < cards.length; i++) {
				if (get.equipValue(cards[i]) >= 6) {
					return true;
				}
			}
			return false;
		},
		filter(event, player) {
			return player != event.player;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			if (trigger.player.countGainableCards(player, "ej")) {
				player.gainPlayerCard(trigger.player, "ej", true);
			}
			trigger.cancel();
		},
	},
	sanyao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target.isMaxHp();
		},
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		check(card) {
			return 7 - get.value(card);
		},
		position: "he",
		filterCard: true,
		async content(event, trigger, player) {
			const { target } = event;
			target.damage("nocard");
		},
		ai: {
			result: {
				target(player, target) {
					if (target.countCards("j") && get.attitude(player, target) > 0) {
						return 1;
					}
					if (target.countCards("e")) {
						return -1;
					}
					return get.damageEffect(target, player);
				},
			},
			order: 7,
		},
	},
	olsanyao: {
		enable: "phaseUse",
		audio: "sanyao",
		filter(event, player) {
			return player.countCards("he") > 0 && player.getStorage("olsanyao_used").length < 2;
		},
		chooseButton: {
			dialog(event, player) {
				var list = ["选择手牌数最多的一名角色", "选择体力值最大的一名角色"];
				var choiceList = ui.create.dialog("散谣：请选择一项", "forcebutton", "hidden");
				choiceList.add([
					list.map((item, i) => {
						return [i, item];
					}),
					"textbutton",
				]);
				return choiceList;
			},
			filter(button, player) {
				return !player.getStorage("olsanyao_used").includes(button.link);
			},
			check(button) {
				var player = _status.event.player;
				if (
					game.hasPlayer(
						[
							function (target) {
								var num = target.countCards("h");
								return (
									!game.hasPlayer(function (current) {
										return current != target && current.countCards("h") > num;
									}) && get.effect(target, "sanyao", player, player) > 0
								);
							},
							function (target) {
								var num = target.hp;
								return (
									!game.hasPlayer(function (current) {
										return current != target && current.hp > num;
									}) && get.effect(target, "sanyao", player, player) > 0
								);
							},
						][button.link]
					)
				) {
					return 1 + button.link;
				}
				return 0;
			},
			backup(links) {
				return {
					audio: "sanyao",
					filterTarget: [
						function (card, player, target) {
							var num = target.countCards("h");
							return !game.hasPlayer(function (current) {
								return current != target && current.countCards("h") > num;
							});
						},
						function (card, player, target) {
							return !game.hasPlayer(function (current) {
								return current != target && current.hp > target.hp;
							});
						},
					][links[0]],
					index: links[0],
					filterCard: true,
					check(card) {
						return 7 - get.value(card);
					},
					position: "he",
					async content(event, trigger, player) {
						const { target } = event;
						player.addTempSkill("olsanyao_used", "phaseUseAfter");
						player.markAuto("olsanyao_used", lib.skill[event.name].index);
						target.damage("nocard");
					},
					ai: lib.skill.sanyao.ai,
				};
			},
			prompt() {
				return "请选择【散谣】的目标";
			},
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	rezhiman: {
		audio: "zhiman",
		audioname: ["re_masu"],
		audioname2: {
			dc_guansuo: "zhiman_guansuo",
			guansuo: "zhiman_guansuo",
			re_baosanniang: "zhiman_re_baosanniang",
		},
		trigger: { source: "damageBegin2" },
		filter(event, player) {
			return player != event.player;
		},
		check(event, player) {
			if (get.damageEffect(event.player, player, player) < 0) {
				return true;
			}
			var att = get.attitude(player, event.player);
			if (att > 0 && event.player.countCards("j")) {
				return true;
			}
			if (event.num > 1) {
				if (att < 0) {
					return false;
				}
				if (att > 0) {
					return true;
				}
			}
			var cards = event.player.getGainableCards(player, "he");
			for (var i = 0; i < cards.length; i++) {
				if (get.equipValue(cards[i]) >= 6) {
					return true;
				}
			}
			return false;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			if (trigger.player.countGainableCards(player, "hej")) {
				player.gainPlayerCard(trigger.player, "hej", true);
			}
			trigger.cancel();
		},
	},
	resanyao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		selectCard() {
			var player = _status.event.player;
			return [
				Math.max(1, ui.selected.targets.length),
				game.countPlayer(function (target) {
					return (
						target != player &&
						!game.hasPlayer(function (current) {
							return current != player && current.hp > target.hp;
						})
					);
				}),
			];
		},
		selectTarget() {
			return ui.selected.cards.length;
		},
		filterTarget(card, player, target) {
			return (
				target != player &&
				!game.hasPlayer(function (current) {
					return current != player && current.hp > target.hp;
				})
			);
		},
		check(card) {
			var player = _status.event.player;
			if (
				game.countPlayer(function (target) {
					return (
						target != player &&
						!game.hasPlayer(function (current) {
							return current != player && current.hp > target.hp;
						}) &&
						get.effect(target, "sanyao", player, player) > 0
					);
				}) <= ui.selected.cards.length
			) {
				return 0;
			}
			return 7 - get.value(card);
		},
		position: "he",
		filterCard: lib.filter.cardDiscardable,
		allowChooseAll: true,
		async content(event, trigger, player) {
			const { target } = event;
			target.damage("nocard");
		},
		ai: {
			result: {
				target(player, target) {
					var disbool = false;
					if (player.hasSkill("rezhiman")) {
						if (target.countCards("j") && get.attitude(player, target) > 0) {
							return 1;
						}
						if (
							target.countCards("he", function (card) {
								return card.name == "tengjia" || get.value(card) > 0;
							})
						) {
							disbool = true;
						}
					}
					var damage = get.damageEffect(target, player);
					if (disbool && get.attitude(player, target) < 0) {
						return Math.min(-1, damage);
					}
					return damage;
				},
			},
			order: 7,
		},
	},
};
