import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "wuling" | "youyi" | "yuli">} */
export const groupSkills = {
	//神华佗
	wuling: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.wuling.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return !target.hasSkill("wuling_wuqinxi");
		},
		usable: 2,
		prompt: "选择一名角色，向其传授“五禽戏”",
		group: "wuling_die",
		async content(event, trigger, player) {
			const { target } = event;

			target.addAdditionalSkill(`wuling_${player.playerid}`, "wuling_wuqinxi");

			const next = player.chooseToMove(`五灵：调整向${get.translation(target)}传授的“五禽戏”顺序`);

			const cards = [lib.skill.wuling.wuqinxi, createCard];
			next.set("list", [["", cards]]);
			next.set("processAI", processAI);

			const result = await next.forResult();
			const sortedWuqinxi = result.moved[0].map(card => card[2]);
			game.log(target, "习得的五禽戏顺序为", "#g" + sortedWuqinxi.join("、"));
			sortedWuqinxi.unshift(sortedWuqinxi[0]);
			target.storage.wuling_wuqinxi = sortedWuqinxi;
			lib.skill.wuling.updateMark(target);

			return;

			function createCard(item, type, position, noclick, node) {
				node = ui.create.buttonPresets.vcard(lib.skill.wuling.wuqinxiMap2[item][0], type, position, noclick);
				node.node.range.innerHTML = lib.skill.wuling.wuqinxiMap2[item][1];
				node.node.range.style.bottom = "2.5px";
				node.node.range.style.width = "100%";
				node.node.range.style.right = "0%";
				node.node.range.style.textAlign = "center";
				node._link = node.link = [null, null, item];
				node._customintro = [node => `五禽戏：${node.link[2]}`, node => lib.skill.wuling.wuqinxiMap[lib.skill.wuling.wuqinxi.indexOf(node.link[2])].slice(2)];
				return node;
			}

			function processAI() {
				const event = get.event().getParent();
				const { player, target } = event;

				const spirits = [];
				let nextPlayer = player;
				do {
					nextPlayer = nextPlayer.getNext();
					if (get.attitude(player, nextPlayer) < 0) {
						spirits.add("熊");
						break;
					}
				} while (nextPlayer != target);

				if (!spirits.length) {
					spirits.add("猿");
				}

				const effectOk = get.recoverEffect(target, player, player) > 0;
				const hasBadCards = target.hasCard(card => {
					const vcard = {
						name: card.viewAs || card.name,
						cards: [card],
					};
					return get.effect(target, vcard, target, target) < -1;
				}, "j");

				if (effectOk || hasBadCards) {
					spirits.add("鹿");
				}

				const others = lib.skill.wuling.wuqinxi.slice().removeArray(spirits);
				do {
					others.randomSort();
				} while (others.length > 1 && others[0] == "鹿");
				return [spirits.concat(others).map(i => ["", "", i])];
			}
		},
		wuqinxi: ["虎", "鹿", "熊", "猿", "鹤"],
		wuqinxiMap: ["虎：当你使用指定唯一目标的牌对目标角色造成伤害时，此伤害+1。", "鹿：①当你获得此效果时，你回复1点体力并弃置判定区的所有牌。②你不能成为延时锦囊牌的目标。", "熊：每回合限一次，当你受到伤害时，此伤害-1。", "猿：当你获得此效果时，你选择一名其他角色，获得其装备区里的一张牌。", "鹤：当你获得此效果时，你摸三张牌。"],
		wuqinxiMap2: {
			虎: ["wuqinxi_hu", "用牌加伤"],
			鹿: ["wuqinxi_lu", "弃判定回血"],
			熊: ["wuqinxi_xiong", "减伤"],
			猿: ["wuqinxi_yuan", "偷装备牌"],
			鹤: ["wuqinxi_he", "摸三张牌"],
		},
		updateMark(player) {
			var wuqinxi = player.storage.wuling_wuqinxi;
			if (!wuqinxi) {
				return;
			}
			var prevMark = wuqinxi.shift();
			// wuqinxi.push(prevMark);
			var curMark = wuqinxi[0];
			if (!curMark) {
				for (var skill in player.additionalSkills) {
					if (!skill.startsWith("wuling_")) {
						continue;
					}
					player.removeAdditionalSkill(skill);
				}
				game.log(player, "完成了五禽戏的操练");
				return;
			}
			game.log(player, "获得了", "#g【" + curMark + "】", "标记");
			player.markSkill("wuling_wuqinxi");
			game.broadcastAll(
				function (player, curMark) {
					if (player.marks.wuling_wuqinxi) {
						player.marks.wuling_wuqinxi.firstChild.innerHTML = curMark;
					}
				},
				player,
				curMark
			);
			var next = game.createEvent("wuling_change");
			next.player = player;
			next.setContent("emptyEvent");
		},
		ai: {
			order: 7,
			threaten: 5,
			result: { target: 1 },
		},
		derivation: "wuling_wuqinxi",
		subSkill: {
			wuqinxi: {
				nopop: true,
				charlotte: true,
				intro: {
					markcount: () => 0,
					mark(dialog, storage) {
						const wuqinxiMap = lib.skill.wuling.wuqinxiMap;
						const str = `<li>当前效果：${storage[0]}<br><li>${wuqinxiMap.find(str => storage[0] == str[0]).slice(2)}<br>`;
						dialog.addText(str, false);
						const str2 = '<div class="text center">“五禽戏”顺序：<br>' + storage.join(" ") + "</div>";
						dialog.addText(str2);
						if (storage.length > 1) {
							const str3 = `<div class="text" style="font-size:10px; ">[下一效果] ${wuqinxiMap.find(str => storage[1] == str[0])}<br></div>`;
							dialog.add(str3);
						}
					},
				},
				mod: {
					targetEnabled(card, player, target) {
						if (get.type(card) == "delay" && target.storage.wuling_wuqinxi && target.storage.wuling_wuqinxi[0] == "鹿") {
							return false;
						}
					},
				},
				trigger: {
					source: "damageBegin1",
					player: ["phaseZhunbeiBegin", "damageBegin4", "wuling_change"],
				},
				filter(event, player, name) {
					const wuqinxi = player.storage.wuling_wuqinxi && player.storage.wuling_wuqinxi[0];
					if (!wuqinxi) {
						return false;
					}
					if (event.name == "phaseZhunbei") {
						return true;
					}
					switch (name) {
						case "damageBegin1":
							if (wuqinxi != "虎" || !event.card) {
								return false;
							}
							var evt = event.getParent("useCard");
							return evt?.targets.length == 1 && evt.targets.includes(event.player);
						case "damageBegin4":
							return wuqinxi == "熊" && !player.hasSkill("wuling_xiong");
						default:
							switch (wuqinxi) {
								case "鹿":
									return player.isDamaged() || player.countCards("j") > 0;
								case "鹤":
									return true;
								case "猿":
									return game.hasPlayer(target => target != player && target.countGainableCards(player, "e") > 0);
								default:
									return false;
							}
					}
				},
				forced: true,
				onremove: true,
				async content(event, trigger, player) {
					var wuqinxi = player.storage.wuling_wuqinxi[0];
					if (trigger.name == "phaseZhunbei") {
						lib.skill.wuling.updateMark(player);
						return;
					}
					var name = event.triggername;
					switch (name) {
						case "damageBegin1":
							player.line(trigger.player);
							trigger.num++;
							break;
						case "damageBegin4":
							player.addTempSkill("wuling_xiong");
							trigger.num--;
							break;
						default:
							switch (wuqinxi) {
								case "鹿":
									await player.recover();
									await player.discard(player.getCards("j"), player);
									break;
								case "鹤":
									await player.draw(3);
									break;
								case "猿": {
									const { targets } = await player
										.chooseTarget("五禽戏：获得一名其他角色装备区里的一张装备牌", function (card, player, target) {
											return target != player && target.countGainableCards(player, "e");
										})
										.set("ai", function (target) {
											var player = _status.event.player;
											var att = get.attitude(player, target),
												eff = 0;
											target.getCards("e", function (card) {
												var val = get.value(card, target);
												eff = Math.max(eff, -val * att);
											});
											return eff;
										})
										.forResult();
									if (targets?.length) {
										player.line(targets, "green");
										await player.gainPlayerCard(targets[0], "e", true);
									}
									break;
								}
							}
							break;
					}
				},
				ai: {
					effect: {
						target(card, player, target) {
							const wuqinxi = target.storage.wuling_wuqinxi;
							if (!wuqinxi || !wuqinxi.length) {
								return;
							}
							const curWuqinxi = wuqinxi[0];
							const nextWuqinxi = wuqinxi[1];
							if (nextWuqinxi == "鹿" && get.type(card) == "delay") {
								return "zerotarget";
							}
							if (curWuqinxi != "熊" || player.hasSkill("wuling_xiong")) {
								return;
							}
							if (player.hasSkillTag("jueqing", false, target)) {
								return;
							}
							var num = get.tag(card, "damage");
							if (num) {
								if (num > 1) {
									return 0.5;
								}
								return 0;
							}
						},
					},
				},
			},
			xiong: { charlotte: true },
			die: {
				trigger: { player: "die" },
				filter(event, player) {
					return game.hasPlayer(current => current.additionalSkills[`wuling_${player.playerid}`]);
				},
				forced: true,
				locked: false,
				forceDie: true,
				async content(event, trigger, player) {
					const targets = game.filterPlayer(current => {
						return Reflect.has(current.additionalSkills, `wuling_${player.playerid}`);
					});
					player.line(targets);
					targets.forEach(current => current.removeAdditionalSkill(`wuling_${player.playerid}`));
				},
			},
		},
	},
	youyi: {
		init(player) {
			player.storage.renku = true;
		},
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return _status.renku.length > 0;
		},
		prompt: "将仁区所有牌置入弃牌堆，令所有角色各回复1点体力",
		async content(event, trigger, player) {
			const cards = _status.renku.slice();
			const next = game.cardsDiscard(cards);
			next.fromRenku = true;
			await next;
			player.$throw(cards, 1000);
			game.log(cards, "从仁库进入了弃牌堆");
			const targets = game.filterPlayer(() => true);
			player.line(targets);
			await Promise.all(targets.map(target => target.recover()));
		},
		ai: {
			order(item, player) {
				return get.order({ name: "taoyuan" }, player);
			},
			result: {
				player(player) {
					return Math.max(
						0,
						game.filterPlayer().reduce((num, target) => num + get.recoverEffect(target, player, player), 0)
					);
				},
			},
		},
		group: "youyi_put",
		subSkill: {
			put: {
				audio: "youyi",
				trigger: { player: "phaseDiscardEnd" },
				filter(event, player) {
					return lib.skill.twlijian.getCards(event).length;
				},
				prompt2(event, player) {
					return "将" + get.translation(lib.skill.twlijian.getCards(event)) + "置入仁区";
				},
				async content(event, trigger, player) {
					const cards = lib.skill.twlijian.getCards(trigger);
					game.log(player, "将", cards, "置于了仁库");
					game.cardsGotoSpecial(cards, "toRenku");
				},
			},
		},
	},
	// 手杀神马超
	yuli: {
		audio: 6,
		trigger: {
			source: "damageBegin1",
			player: "damageBegin4",
		},
		filter(event, player, name) {
			return name == "damageBegin1" || event.hasNature("thunder");
		},
		forced: true,
		direct: true,
		logAudio(event) {
			if (typeof event == "number") {
				return `yuli${event}.mp3`;
			}
			return 2;
		},
		async content(event, trigger, player) {
			switch (event.triggername) {
				case "damageBegin1":
					if (!trigger.hasNature("thunder")) {
						player.logSkill("yuli");
						game.setNature(trigger, "thunder");
					} else {
						player.logSkill("yuli", null, null, null, [get.rand(3, 4)]);
						trigger.num++;
					}
					updateState(player, "atk");
					break;
				case "damageBegin4":
					player.logSkill("yuli", null, null, null, [get.rand(5, 6)]);
					trigger.cancel();
					await player.draw(trigger.num);
					updateState(player, "def");
					break;
			}

			return;

			/**
			 * 重置【寂灭】
			 *
			 * @param {Player} player
			 * @param {"atk" | "def"} type
			 */
			function updateState(player, type) {
				if (!player.awakenedSkills.includes("jimie")) {
					return;
				}
				switch (type) {
					case "atk":
						player.markAuto("yuli", ["atk"]) /* StateType.atk */;
						game.log(player, "触发了", "#g【驭雳】", "的第一项");
						break;
					case "def":
						player.markAuto("yuli", ["def"]) /* StateType.def */;
						game.log(player, "触发了", "#g【驭雳】", "的第二项");
						break;
				}
				if (["atk", "def"].every(item => player.getStorage("yuli").includes(item)) && player.hasSkill("jimie", null, false, false)) {
					player.logSkill("jimie", null, null, null, [get.rand(3, 4)]);
					player.refreshSkill("jimie");
					player.setStorage("yuli", [], true);
				}
			}
		},
		onremove: true,
		intro: {
			content(storage = [], player) {
				if (!storage?.length) {
					return "尚未触发【驭雳】的任一项";
				}
				let str = "已触发【驭雳】的";
				if (storage.includes("atk")) {
					str += "第一项";
					if (storage.includes("def")) {
						str += "和";
					}
				}
				if (storage.includes("def")) {
					str += "第二项";
				}
				return str;
			},
		},
		ai: {
			nothunder: true,
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "thunderDamage")) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
};
