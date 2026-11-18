import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhenshan" | "twfenghan" | "twcongji">} */
export const groupSkills = {
	//全琮
	zhenshan: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		filter(event, player) {
			if (event.type == "wuxie" || player.hasSkill("zhenshan_used")) {
				return false;
			}
			const nh = player.countCards("h");
			if (
				!game.hasPlayer(function (current) {
					return current != player && current.countCards("h") < nh;
				})
			) {
				return false;
			}
			for (const i of lib.inpile) {
				if (get.type(i) != "basic") {
					continue;
				}
				const card = { name: i, isCard: true };
				if (event.filterCard(card, player, event)) {
					return true;
				}
				if (i == "sha") {
					for (const j of lib.inpile_nature) {
						card.nature = j;
						if (event.filterCard(card, player, event)) {
							return true;
						}
					}
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				const list = [];
				for (const i of lib.inpile) {
					if (get.type(i) != "basic") {
						continue;
					}
					const card = { name: i, isCard: true };
					if (event.filterCard(card, player, event)) {
						list.push(["基本", "", i]);
					}
					if (i == "sha") {
						for (const j of lib.inpile_nature) {
							card.nature = j;
							if (event.filterCard(card, player, event)) {
								list.push(["基本", "", i, j]);
							}
						}
					}
				}
				return ui.create.dialog("振赡", [list, "vcard"], "hidden");
			},
			check(button) {
				const player = _status.event.player;
				const card = { name: button.link[2], nature: button.link[3] };
				if (card.name == "jiu") {
					return 0;
				}
				if (
					game.hasPlayer(function (current) {
						return get.effect(current, card, player, player) > 0;
					})
				) {
					if (card.name == "sha") {
						const eff = player.getUseValue(card);
						if (eff > 0) {
							return 2.9 + eff / 10;
						}
						return 0;
					} else if (card.name == "tao" || card.name == "shan") {
						return 4;
					}
				}
				return 0;
			},
			backup(links, player) {
				return {
					filterCard: () => false,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
					},
					selectCard: -1,
					log: false,
					async precontent(event, trigger, player) {
						const result = await player
							.chooseTarget({
								prompt: "赈赡：选择一名手牌数小于你的角色交换手牌",
								filterTarget(card, player, target) {
									return target != player && target.countCards("h") < player.countCards("h");
								},
								forced: true,
								ai(target) {
									return get.attitude(get.player(), target) * Math.sqrt(target.countCards("h") + 1);
								}
							})
							.forResult();
						if (result?.bool) {
							player.logSkill("zhenshan", result.targets);
							player.addTempSkill("zhenshan_used");
							await player.swapHandcards(result.targets[0]);
						} else {
							event.result.cancel = true;
						}
						await game.delayx();
					},
				};
			},
			prompt(links, player) {
				return "选择" + get.translation(links[0][3] || "") + "【" + get.translation(links[0][2]) + "】的目标";
			},
		},
		ai: {
			order() {
				const player = _status.event.player;
				const event = _status.event;
				const nh = player.countCards("h");
				if (
					game.hasPlayer(function (current) {
						return get.attitude(player, current) > 0 && current.countCards("h") < nh;
					})
				) {
					if (event.type == "dying") {
						if (event.filterCard({ name: "tao" }, player, event)) {
							return 0.5;
						}
					} else {
						if (event.filterCard({ name: "tao" }, player, event) || event.filterCard({ name: "shan" }, player, event)) {
							return 4;
						}
						if (event.filterCard({ name: "sha" }, player, event)) {
							return 2.9;
						}
					}
				}
				return 0;
			},
			save: true,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (player.getStat().skill.olzhenshan > 0) {
					return false;
				}
				const nh = player.countCards("h");
				return game.hasPlayer(function (current) {
					return current != player && current.countCards("h") < nh;
				});
			},
			result: {
				player(player) {
					if (_status.event.type == "dying") {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
	},
	//吴景
	twfenghan: {
		audio: "liubing",
		trigger: { player: "useCardToPlayered" },
		usable: 1,
		filter(event, player) {
			return (
				event.isFirstTarget &&
				event.targets.length > 0 &&
				(event.card.name == "sha" || (get.type(event.card, null, false) == "trick" && get.tag(event.card, "damage") > 0))
			);
		},
		async cost(event, trigger, player) {
			const num = trigger.targets.length;
			event.result = await player
				.chooseTarget([1, num], get.prompt(event.name.slice(0, -5)), `令至多${get.cnNumber(num)}名角色各摸一张牌`)
				.set("ai", target => {
					return (
						Math.sqrt(5 - Math.min(4, target.countCards("h"))) *
						get.attitude(get.player(), target) *
						(target.hasSkillTag("nogain") ? 0.1 : 1)
					);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await game.asyncDraw(event.targets.sortBySeat());
			await game.delayx();
		},
	},
	twcongji: {
		audio: "heji",
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		direct: true,
		filter(event, player) {
			if (player == _status.currentPhase || event.type != "discard" || event.getlx === false || !game.hasPlayer(current => current != player)) {
				return false;
			}
			var evt = event.getl(player);
			for (var i of evt.cards2) {
				if (get.color(i, player) == "red" && get.position(i, true) == "d") {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			var cards = [],
				cards2 = trigger.getl(player).cards2;
			for (var i of cards2) {
				if (get.color(i, player) == "red" && get.position(i, true) == "d") {
					cards.push(i);
				}
			}
			player
				.chooseButton(["从击：选择任意张牌交给其他角色", cards], [1, cards.length])
				.set(
					"goon",
					game.hasPlayer(function (current) {
						return current != player && get.attitude(player, current) > 0;
					})
				)
				.set("ai", function (button) {
					if (_status.event.goon) {
						return get.value(button.link);
					}
					return button.link.name == "du" ? 1 : 0;
				});
			"step 1";
			if (result.bool) {
				event.cards = result.links;
				player.chooseTarget("选择一名角色获得以下牌：", get.translation(cards), true, lib.filter.notMe).set("ai", function (target) {
					var player = _status.event.player,
						cards = _status.event.getParent().cards;
					if (cards[0].name == "du") {
						return -get.attitude(player, target);
					}
					var att = get.attitude(player, target);
					if (att <= 0) {
						return 0;
					}
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					if (target.hasJudge("lebu")) {
						att /= 4;
					}
					return get.value(cards, target) * att;
				});
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("twcongji", target);
				target.gain(cards, "gain2");
			}
		},
	},
};
