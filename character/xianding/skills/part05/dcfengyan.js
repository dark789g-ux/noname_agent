import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcfengyan" | "dcfudao" | "dchuishu">} */
export const groupSkills = {
	//丁尚涴
	dcfengyan: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		chooseButton: {
			dialog(event, player) {
				var dialog = ui.create.dialog("讽言：请选择一项", "hidden");
				dialog.add([
					[
						["gain", "令一名体力值不大于你的其他角色交给你一张手牌"],
						["sha", "视为对一名手牌数不大于你的其他角色使用一张【杀】"],
					],
					"textbutton",
				]);
				return dialog;
			},
			filter(button, player) {
				return !player.getStorage("dcfengyan_used").includes(button.link);
			},
			check(button) {
				var player = _status.event.player;
				if (
					button.link == "gain" &&
					game.hasPlayer(function (current) {
						return lib.skill.dcfengyan_gain.filterTarget(null, player, current) && get.effect(current, "dcfengyan_gain", player, player) > 0;
					})
				) {
					return 4;
				}
				if (
					button.link == "sha" &&
					game.hasPlayer(function (current) {
						return lib.skill.dcfengyan_sha.filterTarget(null, player, current) && get.effect(current, "dcfengyan_sha", player, player) > 0;
					})
				) {
					return 4;
				}
				return 2;
			},
			backup(links) {
				return get.copy(lib.skill["dcfengyan_" + links[0]]);
			},
			prompt(links) {
				if (links[0] == "gain") {
					return "令一名体力值不大于你的其他角色交给你一张手牌";
				}
				return "视为对一名手牌数不大于你的其他角色使用【杀】";
			},
		},
		ai: {
			order: 10,
			threaten: 1.7,
			result: { player: 1 },
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			backup: { audio: "dcfengyan" },
			gain: {
				audio: "dcfengyan",
				filterTarget(card, player, target) {
					return target != player && target.hp <= player.hp && target.countCards("h") > 0;
				},
				filterCard: () => false,
				selectCard: -1,
				content() {
					"step 0";
					player.addTempSkill("dcfengyan_used", "phaseUseAfter");
					player.markAuto("dcfengyan_used", "gain");
					target.chooseCard("h", true, "交给" + get.translation(player) + "一张牌");
					"step 1";
					if (result.bool) {
						target.give(result.cards, player);
					}
				},
				ai: {
					tag: {
						loseCard: 1,
						gain: 1,
					},
					result: {
						player: 0.1,
						target: -1,
					},
				},
			},
			sha: {
				audio: "dcfengyan",
				filterTarget(card, player, target) {
					return target != player && target.countCards("h") <= player.countCards("h") && player.canUse("sha", target, false);
				},
				filterCard: () => false,
				selectCard: -1,
				content() {
					player.addTempSkill("dcfengyan_used", "phaseUseAfter");
					player.markAuto("dcfengyan_used", "sha");
					player.useCard(
						{
							name: "sha",
							isCard: true,
						},
						target,
						false
					);
				},
				ai: {
					result: {
						player(player, target) {
							return get.effect(
								target,
								{
									name: "sha",
									isCard: true,
								},
								player,
								player
							);
						},
					},
				},
			},
		},
	},
	dcfudao: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && game.hasPlayer(current => current != player);
		},
		content() {
			"step 0";
			player.chooseTarget(true, lib.filter.notMe, "抚悼：请选择一名“继子”", "你或“继子”每回合首次使用牌指定对方为目标后各摸两张牌；杀死你或“继子”的角色称为“决裂”。你或“继子”对“决裂”造成的伤害+1。“决裂”对你使用牌后，其本回合内不能再使用牌。").set("ai", function (target) {
				return get.attitude(_status.event.player, target);
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("dcfudao", target);
				game.log(target, "成为了", player, "的继子");
				player.addSkill("dcfudao_effect");
				target.addSkill("dcfudao_effect");
				player.markAuto("dcfudao_effect", [target]);
				target.markAuto("dcfudao_effect", [player]);
			}
		},
		group: "dcfudao_refuse",
		subSkill: {
			effect: {
				trigger: { player: "useCardToPlayered" },
				forced: true,
				charlotte: true,
				usable: 1,
				filter(event, player) {
					var target = event.target;
					if (player == target || !target.isIn()) {
						return false;
					}
					return player.getStorage("dcfudao_effect").includes(target);
				},
				logTarget: "target",
				content() {
					"step 0";
					var list = [player, trigger.target];
					list.sortBySeat();
					game.asyncDraw(list, 2);
					"step 1";
					game.delayx();
				},
				marktext: "继",
				intro: { content: "已和$成为继母子关系" },
				group: ["dcfudao_revenge", "dcfudao_deadmark"],
			},
			deadmark: {
				trigger: { player: "dieBegin" },
				forced: true,
				popup: false,
				lastDo: true,
				silent: true,
				filter(event, player) {
					return get.itemtype(event.source) == "player";
				},
				content() {
					trigger.source.markAuto("dcfudao_deadmark", [player]);
				},
				marktext: "裂",
				intro: {
					name: "决裂",
					content: "你害死了$！",
				},
			},
			revenge: {
				trigger: { source: "damageBegin1" },
				forced: true,
				filter(event, player) {
					var storage1 = event.player.getStorage("dcfudao_deadmark"),
						storage2 = player.getStorage("dcfudao_effect");
					for (var i of storage1) {
						if (storage2.includes(i)) {
							return true;
						}
					}
					return false;
				},
				content() {
					trigger.num++;
				},
				logTarget: "player",
			},
			refuse: {
				trigger: { target: "useCardToTargeted" },
				forced: true,
				filter(event, player) {
					var storage1 = event.player.getStorage("dcfudao_deadmark"),
						storage2 = player.getStorage("dcfudao_effect");
					return storage1.some(i => storage2.includes(i)) && get.color(event.card) == "black";
				},
				content() {
					trigger.player.addTempSkill("dcfudao_blocker");
				},
				logTarget: "player",
			},
			blocker: {
				charlotte: true,
				mod: {
					cardEnabled: () => false,
					cardSavable: () => false,
				},
			},
		},
	},
	//全惠解
	dchuishu: {
		audio: 2,
		getList(player) {
			if (!player.storage.dchuishu) {
				return [3, 1, 2];
			}
			return player.storage.dchuishu.slice(0);
		},
		trigger: { player: "phaseDrawEnd" },
		content() {
			"step 0";
			var list = lib.skill.dchuishu.getList(player);
			event.list = list;
			player.draw(list[0]);
			"step 1";
			player.addTempSkill("dchuishu_effect");
			player.chooseToDiscard("h", true, event.list[1]);
		},
		onremove: true,
		mark: true,
		intro: {
			markcount(storage, player) {
				var list = lib.skill.dchuishu.getList(player);
				return Math.max.apply(Math, list);
			},
			content(storage, player) {
				var list = lib.skill.dchuishu.getList(player);
				return "摸牌阶段结束时，你可以摸[" + list[0] + "]张牌。若如此做：你弃置[" + list[1] + "]张手牌，且当你于本回合内弃置第[" + list[2] + "]+1张牌后，你从弃牌堆中获得[" + list[2] + "]张非基本牌。";
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				audio: "dchuishu",
				trigger: {
					player: "loseAfter",
					global: "loseAsyncAfter",
				},
				filter(event, player) {
					var num = lib.skill.dchuishu.getList(player)[2];
					if (typeof num != "number") {
						return false;
					}
					if (event.type != "discard" || event.getlx === false) {
						return false;
					}
					var evt = event.getl(player);
					if (evt.cards2.length == 0) {
						return false;
					}
					var prev = 0,
						goon = true;
					player.getHistory("lose", function (evt) {
						if (!goon || evt.type != "discard") {
							return false;
						}
						prev += evt.cards2.length;
						if (evt == event || event.getParent() == event) {
							goon = false;
							return false;
						}
					});
					return prev > num && prev <= num + evt.cards2.length;
				},
				forced: true,
				popup: false,
				firstDo: true,
				content() {
					var num = lib.skill.dchuishu.getList(player)[2];
					var cards = [];
					for (var i = 0; i < num; i++) {
						var card = get.discardPile(function (card) {
							return get.type(card) != "basic" && !cards.includes(card);
						}, "random");
						if (card) {
							cards.push(card);
						} else {
							break;
						}
					}
					if (cards.length) {
						player.gain(cards, "gain2");
					}
				},
			},
		},
	},
};
