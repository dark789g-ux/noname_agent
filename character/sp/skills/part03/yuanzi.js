import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yuanzi" | "liejie" | "luochong" | "aichen">} */
export const groupSkills = {
	//卫兹
	yuanzi: {
		audio: 2,
		trigger: { global: "phaseZhunbeiBegin" },
		logTarget: "player",
		filter(event, player) {
			return player != event.player && event.player.isIn() && player.countCards("h") > 0 && !player.hasSkill("yuanzi_round", null, null, false);
		},
		check(event, player) {
			if (event.player.hasJudge("lebu") || get.attitude(player, event.player) < 2) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return current !== player && current !== event.player && event.player.inRange(current) && get.attitude(event.player, current) < 0;
			});
		},
		content() {
			var cards = player.getCards("h");
			player.give(cards, trigger.player);
			player.addTempSkill("yuanzi_effect");
			player.addTempSkill("yuanzi_round", "roundStart");
		},
		subSkill: {
			effect: {
				charlotte: true,
				audio: "yuanzi",
				trigger: { global: "damageSource" },
				forced: true,
				filter(event, player) {
					var source = event.source;
					return source && source == _status.currentPhase && player.countCards("h") <= source.countCards("h");
				},
				content() {
					player.draw(2);
				},
			},
			round: { charlotte: true },
		},
	},
	liejie: {
		audio: 2,
		trigger: { player: "damageEnd" },
		direct: true,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		content() {
			"step 0";
			var source = trigger.source;
			var prompt2 = "弃置至多三张牌并摸等量的牌";
			if (source) {
				prompt2 += "，若弃置的牌中有红色牌，则弃置" + get.translation(source) + "至多等量的牌";
			}
			var next = player.chooseToDiscard("he", [1, 3], get.prompt("liejie"), prompt2);
			next.set("ai", function (card) {
				return 6 - get.value(card);
			});
			if (source) {
				next.logSkill = ["liejie", source];
			} else {
				next.logSkill = "liejie";
			}
			"step 1";
			if (result.bool) {
				var cards = result.cards;
				player.draw(cards.length);
				if (trigger.source) {
					var num = cards.filter(function (i) {
						return get.color(i, player) == "red";
					}).length;
					if (num > 0) {
						player.discardPlayerCard(trigger.source, "he", [1, num]).set("forceAuto", true);
					}
				}
			}
		},
	},
	//滕芳兰
	luochong: {
		audio: 2,
		trigger: { player: ["phaseZhunbeiBegin", "damageEnd"] },
		filter(event, player) {
			if (event.name == "damage") {
				var history = player.getHistory("damage");
				if (history.indexOf(event) != 0) {
					return false;
				}
			}
			var storage1 = player.storage.luochong_round,
				storage2 = player.getStorage("luochong");
			if (!storage1) {
				storage1 = [[], []];
			}
			for (var i = 0; i < 4; i++) {
				if (
					!storage1[0].includes(i) &&
					!storage2.includes(i) &&
					game.hasPlayer(function (current) {
						return !storage1[1].includes(current) && lib.skill.luochong.filterx[i](current);
					})
				) {
					return true;
				}
			}
			return false;
		},
		filterx: [target => target.isDamaged(), () => true, target => target.countCards("he") > 0, () => true],
		onremove: true,
		async cost(event, trigger, player) {
			let choiceList = ["令一名角色回复1点体力。", "令一名角色失去1点体力。", "令一名角色弃置两张牌。", "令一名角色摸两张牌。"],
				list = [];
			let storage1 = player.getStorage("luochong_round", null),
				storage2 = player.getStorage("luochong");
			if (!storage1) {
				storage1 = [[], []];
			}
			for (let i = 0; i < 4; i++) {
				if (storage2.includes(i)) {
					choiceList[i] = ["deleted", `<span style="text-decoration: line-through; opacity:0.5; ">${choiceList[i]}</span>`];
				} else if (
					storage1[0].includes(i) ||
					!game.hasPlayer(function (current) {
						return !storage1[1].includes(current) && lib.skill.luochong.filterx[i](current);
					})
				) {
					choiceList[i] = ["used", `<span style="opacity:0.5;">${choiceList[i]}</span>`];
				} else {
					choiceList[i] = [i, choiceList[i]];
					list.push(i);
				}
			}
			if (!list.length) {
				return;
			}
			list.push("cancel2");
			let gett = choice => {
				if (choice == "cancel2") {
					return 0.1;
				}
				let max = 0,
					func = [
						target => {
							if (target.isDamaged()) {
								max = Math.max(max, get.recoverEffect(target, player, player));
							}
						},
						target => {
							max = Math.max(max, get.effect(target, { name: "losehp" }, player, player));
						},
						target => {
							let num = target.countDiscardableCards(player, "he");
							if (num > 0) {
								max = Math.max(max, Math.sqrt(Math.min(2, num)) * get.effect(target, { name: "guohe_copy2" }, player, player));
							}
						},
						target => {
							max = Math.max(max, 2 * get.effect(target, { name: "draw" }, player, player));
						},
					][choice];
				game.countPlayer(current => {
					if (!storage1[1].includes(current)) {
						func(current);
					}
				});
				return max;
			};
			const choice = list.sort((a, b) => {
				return gett(b) - gett(a);
			})[0];
			const { bool, targets, links } = await player
				.chooseButtonTarget({
					createDialog: [get.prompt(event.skill), [choiceList, "textbutton"]],
					filterButton(button) {
						return typeof button.link == "number";
					},
					choice: choice,
					targetx: storage1[1],
					complexTarget: true,
					filterTarget(card, player, target) {
						const { targetx: targets } = get.event(),
							buttons = ui.selected.buttons;
						if (!buttons?.length || typeof buttons[0].link != "number") {
							return false;
						}
						const filter = get.info("luochong")?.filterx[buttons[0].link];
						return !targets.includes(target) && filter(target);
					},
					ai1(button) {
						if (button.link == get.event().choice) {
							return 1;
						}
						return 0;
					},
					ai2(target) {
						const buttons = ui.selected.buttons;
						if (!buttons?.length || typeof buttons[0].link != "number") {
							return 0;
						}
						let filter = [
							(player, target) => {
								return get.recoverEffect(target, player, player);
							},
							(player, target) => {
								return get.effect(target, { name: "losehp" }, player, player);
							},
							(player, target) => {
								return get.effect(target, { name: "guohe_copy2" }, player, player) * Math.sqrt(Math.min(2, target.countCards("he")));
							},
							(player, target) => {
								return 2 * get.effect(target, { name: "draw" }, player, player);
							},
						][buttons[0].link];
						return filter(get.player(), target);
					},
				})
				.forResult();
			event.result = {
				bool: bool,
				targets: targets,
				cost_data: links,
			};
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: [index],
			} = event;
			if (player != target) {
				player.addExpose(0.2);
			}
			player.addTempSkill("luochong_round", "roundStart");
			if (!player.getStorage("luochong_round", null)) {
				player.setStorage("luochong_round", [[], []]);
			}
			player.storage.luochong_round[0].push(index);
			player.storage.luochong_round[1].push(target);
			switch (index) {
				case 0:
					await target.recover();
					break;
				case 1:
					await target.loseHp();
					break;
				case 2:
					await target.chooseToDiscard(true, "he", 2);
					break;
				case 3:
					await target.draw(2);
					break;
			}
		},
		subSkill: {
			round: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	aichen: {
		audio: 2,
		trigger: { player: "dying" },
		forced: true,
		filter(event, player) {
			return player.hasSkill("luochong", null, null, false) && player.getStorage("luochong").length < 3;
		},
		content() {
			"step 0";
			//var num=1-player.hp;
			//if(num>0) player.recover(num);
			var list = [];
			var choiceList = ["令一名角色回复1点体力。", "令一名角色失去1点体力。", "令一名角色弃置两张牌。", "令一名角色摸两张牌。"];
			var storage2 = player.getStorage("luochong");
			for (var i = 0; i < 4; i++) {
				if (storage2.includes(i)) {
					choiceList[i] = '<span style="text-decoration: line-through; opacity:0.5; ">' + choiceList[i] + "</span>";
				} else {
					list.push("选项" + get.cnNumber(i + 1, true));
				}
			}
			player
				.chooseControl(list)
				.set("prompt", "哀尘：选择移去一个〖落宠〗的选项")
				.set("choiceList", choiceList)
				.set("ai", function () {
					var controls = _status.event.controls.slice(0);
					var list = ["选项三", "选项四", "选项二", "选项一"];
					for (var i of list) {
						if (controls.includes(i)) {
							return i;
						}
					}
					return 0;
				});
			"step 1";
			var index = ["选项一", "选项二", "选项三", "选项四"].indexOf(result.control);
			player.markAuto("luochong", [index]);
			game.log(player, "移去了", "#g【落宠】", "的", "#y" + ["令一名角色回复1点体力", "令一名角色失去1点体力", "令一名角色弃置两张牌", "令一名角色摸两张牌"][index], "的选项");
		},
		ai: {
			combo: "luochong",
			neg: true,
		},
	},
};
