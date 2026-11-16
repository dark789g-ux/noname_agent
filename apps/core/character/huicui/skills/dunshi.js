import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dunshi">} */
export const groupSkills = {
	//管宁
	dunshi: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		usable: 1,
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = [["sha", "shan", "tao", "jiu"], 0];
			}
		},
		hiddenCard(player, name) {
			if (player.storage.dunshi && player.storage.dunshi[0].includes(name) && !player.getStat("skill").dunshi) {
				return true;
			}
			return false;
		},
		marktext: "席",
		mark: true,
		intro: {
			markcount(storage) {
				return storage[1];
			},
			content(storage, player) {
				if (!storage) {
					return;
				}
				var str = "<li>";
				if (!storage[0].length) {
					str += "已无可用牌";
				} else {
					str += "剩余可用牌：";
					str += get.translation(storage[0]);
				}
				str += "<br><li>“席”标记数量：";
				str += storage[1];
				return str;
			},
		},
		filter(event, player) {
			if (event.type == "wuxie") {
				return false;
			}
			var storage = player.storage.dunshi;
			if (!storage || !storage[0].length) {
				return false;
			}
			for (var i of storage[0]) {
				var card = { name: i, isCard: true };
				if (event.filterCard(card, player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				var storage = player.storage.dunshi;
				for (var i of storage[0]) {
					list.push(["基本", "", i]);
				}
				return ui.create.dialog("遁世", [list, "vcard"], "hidden");
			},
			filter(button, player) {
				var evt = _status.event.getParent();
				return evt.filterCard({ name: button.link[2], isCard: true }, player, evt);
			},
			check(button) {
				var card = { name: button.link[2] },
					player = _status.event.player;
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				if (card.name == "jiu") {
					return 0;
				}
				if (card.name == "sha" && player.hasSkill("jiu")) {
					return 0;
				}
				return player.getUseValue(card, null, true);
			},
			backup(links, player) {
				return {
					audio: "dunshi",
					filterCard() {
						return false;
					},
					popname: true,
					viewAs: {
						name: links[0][2],
						isCard: true,
					},
					selectCard: -1,
					async precontent(event, trigger, player) {
						player.addTempSkill("dunshi_damage");
						player.storage.dunshi_damage = event.result.card.name;
					},
				};
			},
			prompt(links, player) {
				return "选择【" + get.translation(links[0][2]) + "】的目标";
			},
		},
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				var storage = player.storage.dunshi;
				if (!storage || !storage[0].length) {
					return false;
				}
				if (player.getStat("skill").dunshi) {
					return false;
				}
				switch (tag) {
					case "respondSha":
						return (_status.event.type != "phase" || player == game.me || player.isUnderControl() || player.isOnline()) && storage[0].includes("sha");
					case "respondShan":
						return storage[0].includes("shan");
					case "save":
						if (arg == player && storage[0].includes("jiu")) {
							return true;
						}
						return storage[0].includes("tao");
				}
			},
			order: 2,
			result: {
				player(player) {
					if (_status.event.type == "dying") {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		initList() {
			var list,
				skills = [],
				banned = [],
				bannedInfo = ["游戏开始时"];
			if (get.mode() == "guozhan") {
				list = [];
				for (var i in lib.characterPack.mode_guozhan) {
					list.push(i);
				}
			} else if (_status.connectMode) {
				list = get.charactersOL();
			} else {
				list = [];
				for (var i in lib.character) {
					if (lib.filter.characterDisabled2(i) || lib.filter.characterDisabled(i)) {
						continue;
					}
					list.push(i);
				}
			}
			for (var i of list) {
				if (i.indexOf("gz_jun") == 0) {
					continue;
				}
				for (var j of lib.character[i][3]) {
					var skill = lib.skill[j];
					if (!skill || skill.zhuSkill || banned.includes(j)) {
						continue;
					}
					if (skill.ai && (skill.ai.combo || skill.ai.neg)) {
						continue;
					}
					const infox = get.skillInfoTranslation(j);
					if (bannedInfo.some(item => infox.includes(item))) {
						continue;
					}
					const info = get.plainText(get.translation(j));
					if ("仁/义/礼/智/信".split("/").some(item => info.includes(item))) {
						skills.add(j);
					}
				}
			}
			_status.dunshi_list = skills;
		},
		subSkill: {
			backup: { audio: "dunshi" },
			damage: {
				audio: "dunshi",
				trigger: { global: "damageBegin2" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return event.source == _status.currentPhase;
				},
				onremove: true,
				logTarget: "source",
				async content(event, trigger, player) {
					const cardname = player.storage.dunshi_damage;
					player.removeSkill("dunshi_damage");
					const target = trigger.source;
					const card = get.translation(trigger.source),
						card2 = get.translation(cardname),
						card3 = get.translation(trigger.player);
					const list = ["防止即将对" + card3 + "造成的伤害，并令" + card + "获得一个技能名中包含“仁/义/礼/智/信”的技能", "从〖遁世〗中删除【" + card2 + "】并获得一枚“席”", "减1点体力上限，然后摸等同于“席”数的牌"];
					const result = await player
						.chooseButton([
							"遁世：请选择两项",
							[
								list.map((item, i) => {
									return [i, item];
								}),
								"textbutton",
							],
						])
						.set("forced", true)
						.set("selectButton", 2)
						.set("ai", function (button) {
							var player = _status.event.player;
							switch (button.link) {
								case 0:
									if (get.attitude(player, _status.currentPhase) > 0) {
										return 3;
									}
									return 0;
								case 1:
									return 1;
								case 2:
									var num = player.storage.dunshi[1];
									for (var i of ui.selected.buttons) {
										if (i.link == 1) {
											num++;
										}
									}
									if (num > 0 && player.isDamaged()) {
										return 2;
									}
									return 0;
							}
						})
						.forResult();
					const links = result.links.sort();
					for (var i of links) {
						game.log(player, "选择了", "#g【遁世】", "的", "#y选项" + get.cnNumber(i + 1, true));
					}
					if (links.includes(0)) {
						trigger.cancel();
						if (!_status.dunshi_list) {
							lib.skill.dunshi.initList();
						}
						var skills = _status.dunshi_list
							.filter(function (i) {
								return !target.hasSkill(i, null, null, false);
							})
							.randomGets(3);
						if (skills.length) {
							const videoId = lib.status.videoId++;
							var func = function (skills, id, target) {
								var dialog = ui.create.dialog("forcebutton");
								dialog.videoId = id;
								dialog.add("令" + get.translation(target) + "获得一个技能");
								for (var i = 0; i < skills.length; i++) {
									dialog.add('<div class="popup pointerdiv" style="width:80%;display:inline-block"><div class="skill">【' + get.translation(skills[i]) + "】</div><div>" + lib.translate[skills[i] + "_info"] + "</div></div>");
								}
								dialog.addText(" <br> ");
							};
							if (player.isOnline()) {
								player.send(func, skills, videoId, target);
							} else if (player == game.me) {
								func(skills, videoId, target);
							}
							const controlResult = await player
								.chooseControl(skills)
								.set("ai", function () {
									var controls = _status.event.controls;
									if (controls.includes("cslilu")) {
										return "cslilu";
									}
									if (controls.includes("zhichi")) {
										return "zhichi";
									}
									return controls[0];
								})
								.forResult();
							game.broadcastAll("closeDialog", videoId);
							target.addSkills(controlResult.control);
						}
					}
					var storage = player.storage.dunshi;
					if (links.includes(1)) {
						storage[0].remove(cardname);
						storage[1]++;
						player.markSkill("dunshi");
					}
					if (links.includes(2)) {
						player.loseMaxHp();
						if (storage[1] > 0) {
							await player.draw(storage[1]);
						}
					}
				},
			},
		},
	},
};
