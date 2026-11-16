import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "fuhan" | "refuhan" | "refanghun" | "fanghun">} */
export const groupSkills = {
	fuhan: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		filter(event, player) {
			return player.storage.fanghun2 > 0;
		},
		prompt(event, player) {
			var num = Math.max(2, player.storage.fanghun2 || 0);
			num = Math.min(num, 8);
			return get.prompt("fuhan") + "（体力上限：" + num + "）";
		},
		check(event, player) {
			var num = Math.max(2, player.storage.fanghun2 || 0);
			if (num == 1) {
				return false;
			}
			if (player.hp <= 1) {
				return true;
			}
			if (num == 2) {
				return false;
			}
			if (num == 3) {
				return player.hp < 3 && player.isMinHp();
			}
			return true;
		},
		async content(event, trigger, player) {
			let num = player.storage.fanghun;
			player.removeMark("fanghun", num);
			player.awakenSkill(event.name);
			num = Math.max(2, player.storage.fanghun2 || 0);
			let list;
			if (_status.characterlist) {
				list = [];
				for (let i = 0; i < _status.characterlist.length; i++) {
					var name = _status.characterlist[i];
					if (lib.character[name][1] == "shu") {
						list.push(name);
					}
				}
			} else if (_status.connectMode) {
				list = get.charactersOL(function (i) {
					return lib.character[i][1] != "shu";
				});
			} else {
				list = get.gainableCharacters(function (info) {
					return info[1] == "shu";
				});
			}
			var players = game.players.concat(game.dead);
			for (let i = 0; i < players.length; i++) {
				list.remove(players[i].name);
				list.remove(players[i].name1);
				list.remove(players[i].name2);
			}
			list.remove("zhaoyun");
			list.remove("re_zhaoyun");
			list.remove("ol_zhaoyun");
			const result = await player
				.chooseButton(true)
				.set("ai", function (button) {
					return get.rank(button.link, true) - lib.character[button.link][2];
				})
				.set("createDialog", ["将武将牌替换为一名角色", [list.randomGets(5), "character"]])
				.forResult();
			if (result?.links?.length) {
				num = Math.min(num, 8);
				await player.reinitCharacter(get.character(player.name2, 3).includes("fuhan") ? player.name2 : player.name1, result.links[0]);
				num = num - player.maxHp;
				await player[num > 0 ? "gainMaxHp" : "loseMaxHp"](Math.abs(num));
				await player.recover();
			}
		},
		ai: {
			combo: "fanghun",
		},
	},
	/*赵元帅扶汉样式美化（星语的任务喵）
	by taofendawang1105
	感谢星语做的联机适配，赞美星语喵！
	2026.2.26 正式改成grid布局*/
	refuhan: {
		audio: "fuhan",
		trigger: { player: "phaseZhunbeiBegin" },
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		filter(event, player) {
			return player.countMark("fanghun") > 0;
		},
		check: () => true,
		async content(event, trigger, player) {
			const num = player.countMark("fanghun");
			if (num) {
				await player.draw(num);
			}
			player.removeMark("fanghun", num);
			player.awakenSkill(event.name);
			let list;
			if (_status.characterlist) {
				list = [];
				for (let i = 0; i < _status.characterlist.length; i++) {
					const name = _status.characterlist[i];
					if (lib.character[name][1] == "shu") {
						list.push(name);
					}
				}
			} else if (_status.connectMode) {
				list = get.charactersOL(function (i) {
					return lib.character[i][1] != "shu";
				});
			} else {
				list = get.gainableCharacters(function (info) {
					return info[1] == "shu";
				});
			}
			const players = game.players.concat(game.dead);
			for (let i = 0; i < players.length; i++) {
				list.remove(players[i].name);
				list.remove(players[i].name1);
				list.remove(players[i].name2);
			}
			list.remove("zhaoyun");
			list.remove("re_zhaoyun");
			list.remove("ol_zhaoyun");
			list = list.randomGets(Math.max(4, game.countPlayer()));
			if (!list.length) {
				return;
			}
			let num2 = 0,
				skillMap = {};
			for (const i of list) {
				const skills = (lib.character[i][3] || []).filter(skill => {
					const info = get.info(skill);
					return info && !info.zhuSkill && !info.limited && !info.juexingji && !info.hiddenSkill && !info.charlotte && !info.dutySkill;
				});
				if (skills.length > num2) {
					num2 = skills.length;
				}
				skillMap[i] = skills;
			}
			if (num2 == 0) {
				return;
			}
			const result = await player
				.chooseButton(
					[
						[["扶汉：请选择获得至多两个技能"], "addNewRow"],
						[
							dialog => {
								const { list, skillMap } = get.event();
								//算出来需要多少列，最多八列
								const num = 8;
								const column = Math.min(list.length, num);
								if (column > 6) {
									dialog.css({
										width: "100%",
										left: 0,
									});
								}
								//重新创建一个容器，不然css之后会导致dialog.content内的其他元素也加入到布局中
								const contentx = ui.create.div(".content", dialog.content);
								contentx.css({
									display: "grid",
									gridTemplateColumns: `repeat(${column}, 1fr)`,
									width: "fit-content",
									margin: "auto",
								});
								//一个一个塞进去
								for (const i of list) {
									const div = ui.create.div(".buttons", contentx);
									const button = ui.create.button(i, "character", div);
									const skills = skillMap[i];
									//让角色和技能按钮水平居中垂直排列
									div.css({
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
									});
									//角色因为不是可选按钮所以需要调整一下透明度
									button.style.setProperty("opacity", "1", "important");
									if (skills.length) {
										//创建技能按钮
										const buttons = ui.create.buttons(
											skills.map(i => [i, get.translation(i)]),
											"tdnodes",
											div
										);
										//丢进可选按钮中
										dialog.buttons = dialog.buttons.concat(buttons);
									} else {
										//鹿鹿的彩蛋
										setTimeout(() => {
											button.setBackground("sunce", "character");
											button.node.name.innerText = "蜀奸";
											button.node.name.dataset.nature = "wood";
										}, 824);
									}
								}
							},
							"handle",
						],
					],
					[1, 2],
					true
				)
				.set("list", list.slice())
				//.set("list2", list.slice().add("refuhan_kongwei"))
				//.set("num2", num2)
				.set("skillMap", skillMap)
				.set("ai", button => {
					const skill = button.link;
					return get.skillRank(skill, "inout");
				})
				.forResult();
			if (result?.links?.length) {
				await player.addSkills(result.links);
				/* game.broadcastAll(function (list) {
					game.expandSkills(list);
					for (const i of list) {
						var info = lib.skill[i];
						if (!info) {
							continue;
						}
						if (!info.audioname2) {
							info.audioname2 = {};
						}
						info.audioname2.dc_zhaoxiang = "fuhan";
					}
				}, result.links); */
			}
			if (player.isMinHp()) {
				await player.recover();
			}
		},
		ai: {
			combo: "refanghun",
		},
	},
	refanghun: {
		mod: {
			aiValue(player, card, num) {
				if (card.name != "sha" && card.name != "shan") {
					return;
				}
				var geti = function () {
					var cards = player.getCards("hs", function (card) {
						return card.name == "sha" || card.name == "shan";
					});
					if (cards.includes(card)) {
						return cards.indexOf(card);
					}
					return cards.length;
				};
				return Math.max(num, [7, 5, 5, 3][Math.min(geti(), 3)]);
			},
		},
		locked: false,
		audio: "fanghun",
		inherit: "fanghun",
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
	},
	fanghun: {
		hiddenCard(player, name) {
			if (!player.storage.fanghun || player.storage.fanghun <= 0) {
				return false;
			}
			if (name == "tao") {
				return player.countCards("hs", "jiu") > 0;
			}
			if (name == "jiu") {
				return player.countCards("hs", "tao") > 0;
			}
			return false;
		},
		audio: 2,
		marktext: "影",
		intro: {
			content: "mark",
			name: "梅影",
		},
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		forced: true,
		locked: false,
		filter(event) {
			return event.card && event.card.name == "sha";
		},
		content() {
			player.addMark("fanghun", trigger.num || 1);
			player.addMark("fanghun2", trigger.num || 1, false);
		},
		derivation: "fanghun_sha",
		group: ["fanghun_sha", "fanghun_draw"],
		subSkill: {
			draw: {
				trigger: { player: ["useCardAfter", "respondAfter"] },
				forced: true,
				popup: false,
				filter(event) {
					return event.skill == "fanghun_sha" || event.skill == "fanghun_shan";
				},
				content() {
					player.draw();
				},
			},
			sha: {
				audio: "fanghun",
				inherit: "ollongdan",
				enable: ["chooseToUse", "chooseToRespond"],
				prompt: "弃置一枚【梅影】标记，将杀当做闪，或将闪当做杀，或将桃当做酒，或将酒当做桃使用或打出",
				filter(event, player) {
					return player.hasMark("fanghun") && get.info("ollongdan").filter(event, player);
				},
				onrespond() {
					return this.onuse.apply(this, arguments);
				},
				onuse(result, player) {
					player.removeMark("fanghun", 1);
				},
				ai: {
					respondSha: true,
					respondShan: true,
					skillTagFilter(player, tag) {
						if (!player.hasMark("fanghun")) {
							return false;
						}
						return get.info("ollongdan").ai.skillTagFilter(player, tag);
					},
					order(item, player) {
						if (!player || !player.storage) {
							player = _status.event.player;
							if (!player || !player.storage) {
								return 0;
							}
							if (
								Object.keys(player.storage).some(i => {
									return typeof i == "string" && i.indexOf("fuhan") != -1;
								})
							) {
								return 4;
							}
							return 1;
						}
						const awakened = Object.keys(player.storage).some(i => typeof i == "string" && i.indexOf("fuhan") != -1);
						if (!awakened || !player.awakenedSkills.some(i => i.indexOf("fuhan"))) {
							if (player.countMark("fanghun") < 2 && player.getHp() > 1) {
								return 0;
							}
						}
						if (_status.event.type == "phase") {
							var max = 0;
							var list = ["sha", "tao", "jiu"];
							var map = { sha: "shan", tao: "jiu", jiu: "tao" };
							for (var i = 0; i < list.length; i++) {
								var name = list[i];
								if (player.countCards("hs", map[name]) > (name == "jiu" ? 1 : 0) && player.getUseValue({ name: name }) > 0) {
									var temp = get.order({ name: name });
									if (temp > max) {
										max = temp;
									}
								}
							}
							if (max > 0) {
								max += awakened ? 0.3 : -0.3;
							}
							return max;
						}
						return awakened ? 4 : 1;
					},
				},
			},
		},
	},
};
