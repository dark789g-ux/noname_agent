import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbranji" | "kunfenx" | "kunfen_ol_sb_jiangwei" | "zhaxiang_ol_sb_jiangwei" | "oljiangchi" | "olqiaoshui" | "olxuanfeng">} */
export const groupSkills = {
	olsbranji: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		prompt2(event, player) {
			var str = "获得技能";
			var num = lib.skill.olsbranji.getNum(player);
			if (num >= player.getHp()) {
				str += "【困奋】";
			}
			if (num == player.getHp()) {
				str += "和";
			}
			if (num <= player.getHp()) {
				str += "【诈降】";
			}
			str += "，然后";
			var num1 = player.countCards("h") - player.getHandcardLimit();
			if (num1 || player.isDamaged()) {
				if (num1) {
					str += num1 < 0 ? "摸" + get.cnNumber(-num1) + "张牌" : "弃置" + get.cnNumber(num1) + "张牌";
				}
				if (num1 && player.isDamaged()) {
					str += "或";
				}
				if (player.isDamaged()) {
					str += "回复" + player.getDamagedHp() + "点体力";
				}
				str += "，最后";
			}
			str += "你不能回复体力直到你杀死角色。";
			return str;
		},
		check(event, player) {
			var num = lib.skill.olsbranji.getNum(player);
			if (num == player.getHp()) {
				return true;
			}
			return player.getHandcardLimit() - player.countCards("h") >= 3 || player.getDamagedHp() >= 2;
		},
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			var num = lib.skill.olsbranji.getNum(player);
			const skills = [];
			if (num >= player.getHp()) {
				skills.push("kunfen");
				player.storage.kunfen = true;
			}
			if (num <= player.getHp()) {
				skills.push("zhaxiang");
			}
			player.addSkills(skills);
			if (player.countCards("h") != player.getHandcardLimit() || player.isDamaged()) {
				var result,
					num1 = player.countCards("h") - player.getHandcardLimit();
				if (!num1) {
					result = { index: 1 };
				} else if (player.isHealthy()) {
					result = { index: 0 };
				} else {
					result = await player
						.chooseControl("手牌数", "体力值")
						.set("choiceList", [num1 < 0 ? "摸" + get.cnNumber(-num1) + "张牌" : "弃置" + get.cnNumber(num1) + "张牌", "回复" + player.getDamagedHp() + "点体力"])
						.set("ai", () => {
							var player = _status.event.player;
							var list = _status.event.list;
							var num1 = get.effect(player, { name: "draw" }, player, player);
							var num2 = get.recoverEffect(player, player, player);
							return num1 * list[0] > num2 * list[1] ? 0 : 1;
						})
						.set("list", [-num1, player.getDamagedHp()])
						.forResult();
				}
				if (result.index == 0) {
					if (num1 < 0) {
						await player.drawTo(player.getHandcardLimit());
					} else {
						await player.chooseToDiscard(num1, "h", true, "allowChooseAll");
					}
				} else {
					await player.recover(player.maxHp - player.hp);
				}
			}
			player.addSkill("olsbranji_norecover");
			player.when({ source: "dieAfter" }).step(async () => player.removeSkill("olsbranji_norecover"));
		},
		derivation: ["kunfenx", "zhaxiang"],
		getList(event) {
			return event.getParent().phaseList.map(list => list.split("|")[0]);
		},
		getNum(player) {
			return player
				.getHistory("useCard", evt => {
					return lib.phaseName.some(name => {
						return evt.getParent(name).name == name;
					});
				})
				.reduce((list, evt) => {
					return list.add(evt.getParent(lib.phaseName.find(name => evt.getParent(name).name == name)));
				}, []).length;
		},
		subSkill: {
			norecover: {
				audio: "olsbranji",
				charlotte: true,
				mark: true,
				intro: { content: "不能回复体力" },
				trigger: { player: "recoverBefore" },
				forced: true,
				firstDo: true,
				content() {
					trigger.cancel();
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (get.tag(card, "recover")) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
		},
	},
	kunfenx: {
		audio: "kunfen",
		audioname2: { ol_sb_jiangwei: "kunfen_ol_sb_jiangwei" },
	},
	kunfen_ol_sb_jiangwei: { audio: 1 },
	zhaxiang_ol_sb_jiangwei: { audio: 1 },
	//界曹彰
	oljiangchi: {
		audio: "rejiangchi",
		trigger: { player: "phaseDrawEnd" },
		direct: true,
		logAudio: index => (typeof index === "number" ? "rejiangchi" + index + ".mp3" : 2),
		async content(event, trigger, player) {
			var choiceList = ["摸一张牌，本回合使用【杀】的次数上限-1，且【杀】不计入手牌上限。", "重铸一张牌，本回合使用【杀】无距离限制，且使用【杀】的次数上限+1。"],
				list = ["cancel2"];
			if (player.countCards("he", card => player.canRecast(card))) {
				list.unshift("重铸，+1");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			list.unshift("摸牌，-1");
			var result = await player
				.chooseControl(list)
				.set("ai", () => {
					var player = _status.event.player;
					var controls = _status.event.controls.slice();
					if (controls.includes("重铸，+1") && player.countCards("hs", card => get.name(card) == "sha" && player.hasValueTarget(card)) >= 2) {
						return "重铸，+1";
					}
					return "摸牌，-1";
				})
				.set("choiceList", choiceList)
				.set("prompt", get.prompt("oljiangchi"))
				.forResult();
			if (result.control != "cancel2") {
				player.logSkill("oljiangchi", null, null, null, [result.control == "摸牌，-1" ? 1 : 2]);
				if (result.control == "摸牌，-1") {
					player.draw();
					player.addTempSkill("oljiangchi_less");
					player.addMark("oljiangchi_less", 1, false);
				} else {
					var result2 = await player.chooseCard("he", "将驰：请重铸一张牌", true, (card, player) => player.canRecast(card)).forResult();
					if (result2.bool) {
						player.recast(result2.cards);
						player.addTempSkill("oljiangchi_more");
						player.addMark("oljiangchi_more", 1, false);
					}
				}
			}
		},
		subSkill: {
			less: {
				charlotte: true,
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num - player.countMark("oljiangchi_less");
						}
					},
					ignoredHandcard(card, player) {
						if (card.name == "sha") {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.name == "sha") {
							return false;
						}
					},
				},
			},
			more: {
				charlotte: true,
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("oljiangchi_more");
						}
					},
					targetInRange(card, player) {
						if (card.name == "sha") {
							return true;
						}
					},
				},
			},
		},
	},
	//界简雍
	olqiaoshui: {
		audio: "reqiaoshui",
		inherit: "reqiaoshui",
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const target = event.target;
			const result = await player.chooseToCompare(target).forResult();
			if (result.bool) {
				player.addTempSkill("olqiaoshui_target", { player: "phaseUseAfter" });
			} else {
				player.addTempSkill("qiaoshui2");
				player.addTempSkill("olqiaoshui_used");
				player.tempBanSkill("olqiaoshui");
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				mark: true,
				marktext: '<span style="text-decoration: line-through;">说</span>',
				intro: { content: "被迫闭嘴" },
			},
			target: {
				audio: "olqiaoshui",
				inherit: "qiaoshui3",
				sourceSkill: "olqiaoshui",
			},
		},
	},
	//界凌统
	olxuanfeng: {
		audio: "xuanfeng",
		audioname: ["boss_lvbu3", "re_lingtong"],
		trigger: {
			player: ["loseAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			const evt = event.getl(player);
			return evt && (evt.es.length || evt.cards2.length > 1) && game.hasPlayer(current => current != player && current.countDiscardableCards(player, "he"));
		},
		getIndex: () => 2,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "弃置一名其他角色的一张牌", (card, player, target) => {
					if (player == target) {
						return false;
					}
					return target.countDiscardableCards(player, "he");
				})
				.set("ai", target => {
					const player = get.event().player;
					return get.effect(target, { name: "guohe_copy2" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.discardPlayerCard(target, "he", true);
		},
		ai: {
			reverseEquip: true,
			noe: true,
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						return [1, 3];
					}
				},
			},
		},
	},
};
