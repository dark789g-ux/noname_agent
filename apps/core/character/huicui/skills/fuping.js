import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "fuping" | "weilie">} */
export const groupSkills = {
	//夏侯令女
	fuping: {
		audio: 2,
		hiddenCard(player, name) {
			var list = player.getStorage("fuping").slice(0);
			list.removeArray(player.getStorage("fuping_round"));
			return list.includes(name) && player.hasCard(card => get.type(card) != "basic", "ehs");
		},
		enable: "chooseToUse",
		locked: false,
		filter(event, player) {
			var list = player.getStorage("fuping").slice(0);
			list.removeArray(player.getStorage("fuping_round"));
			if (!list.length) {
				return false;
			}
			if (!player.hasCard(card => get.type(card) != "basic", "ehs")) {
				return false;
			}
			for (var i of list) {
				var type = get.type2(i, false);
				if ((type == "basic" || type == "trick") && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = player.getStorage("fuping").slice(0);
				list.removeArray(player.getStorage("fuping_round"));
				var list2 = [];
				for (var i of list) {
					var type = get.type2(i, false);
					if ((type == "basic" || type == "trick") && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
						list2.push([type, "", i]);
					}
				}
				return ui.create.dialog("浮萍", [list2, "vcard"]);
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				return _status.event.player.getUseValue({ name: button.link[2] }, null, true);
			},
			backup(links, player) {
				return {
					audio: "fuping",
					filterCard: card => get.type(card) != "basic",
					position: "he",
					popname: true,
					viewAs: {
						name: links[0][2],
					},
					check(card) {
						return 8 - get.value(card);
					},
					async precontent(event, trigger, player) {
						player.addTempSkill("fuping_round");
						player.markAuto("fuping_round", [event.result.card.name]);
					},
				};
			},
			prompt(links, player) {
				return "将一张非基本牌当做【" + get.translation(links[0][2]) + "】使用";
			},
		},
		ai: {
			order: 8,
			result: { player: 1 },
			respondSha: true,
			skillTagFilter(player) {
				var list = player.getStorage("fuping").slice(0);
				list.removeArray(player.getStorage("fuping_round"));
				return list.includes("sha");
			},
		},
		mod: {
			targetInRange(card, player, target) {
				if (!player.hasEnabledSlot()) {
					return true;
				}
			},
		},
		marktext: "萍",
		intro: { content: "已记录$" },
		group: "fuping_mark",
		subSkill: {
			mark: {
				audio: "fuping",
				trigger: { global: "useCardAfter" },
				filter(event, player) {
					return player != event.player && event.targets.includes(player) && player.hasEnabledSlot() && !player.getStorage("fuping").includes(event.card.name);
				},
				logTarget: "player",
				prompt2: event => "废除一个装备栏并记录【" + get.translation(event.card.name) + "】",
				check(event, player) {
					var list = ["tao", "juedou", "guohe", "shunshou", "wuzhong", "xietianzi", "yuanjiao", "wanjian", "nanman", "huoshaolianying", "chuqibuyi", "zhujinqiyuan", "lebu", "bingliang"];
					if (!list.includes(event.card.name)) {
						return false;
					}
					if (["nanman", "wanjian"].includes(event.card.name) && !player.hasValueTarget({ name: event.card.name })) {
						return false;
					}
					var list = [3, 5, 4, 1, 2];
					for (var i of list) {
						if (player.hasEnabledSlot(i)) {
							var card = player.getEquip(i);
							if (!card || player.hasEmptySlot(i)) {
								return true;
							}
							if (get.value(card, player) <= 0) {
								return true;
							}
						}
					}
					return false;
				},
				async content(event, trigger, player) {
					player.markAuto("fuping", [trigger.card.name]);
					game.log(player, "记录了", "#y" + get.translation(trigger.card.name));
					player.chooseToDisable().set("ai", function (event, player, list) {
						var list = [3, 5, 4, 1, 2];
						for (var i of list) {
							if (player.hasEnabledSlot(i)) {
								var card = player.getEquip(i);
								if (!card || player.hasEmptySlot(i)) {
									return "equip" + i;
								}
								if (get.value(card, player) <= 0) {
									return "equip" + i;
								}
							}
						}
						return list.randomGet();
					});
				},
			},
			backup: { audio: "fuping" },
			round: { charlotte: true, onremove: true },
		},
	},
	weilie: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countMark("weilie_used") <= player.getStorage("fuping").length + 1 && player.countCards("he") > 0 && game.hasPlayer(current => current.isDamaged());
		},
		filterCard: true,
		position: "he",
		filterTarget: (card, player, target) => target.isDamaged(),
		check(card) {
			return 8 - get.value(card);
		},
		async content(event, trigger, player) {
			const { target, name } = event;
			player.addSkill(name + "_used");
			player.addMark(name + "_used", 1, false);
			await target.recover();
			if (target.isDamaged()) {
				await target.draw(2);
			}
		},
		onremove: true,
		ai: {
			order: 1,
			result: {
				player(player, target) {
					var eff = get.recoverEffect(target, player, player);
					if (target.getDamagedHp() > 1) {
						eff += get.effect(target, { name: "draw" }, player, player);
					}
					return eff;
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "本局游戏已发动#次【炜烈】" },
			},
		},
	},
};
