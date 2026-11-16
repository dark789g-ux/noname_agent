import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcyishu" | "dcligong">} */
export const groupSkills = {
	dcyishu: {
		audio: 2,
		trigger: {
			player: ["loseAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		forced: true,
		filter(event, player) {
			var evt = event.getl(player);
			if (!evt || !evt.cards2.length) {
				return false;
			}
			return !player.isPhaseUsing() && player.hasSkill("dchuishu", null, null, false);
		},
		content() {
			"step 0";
			var list = lib.skill.dchuishu.getList(player);
			var min = list[0],
				max = list[0];
			for (var i of list) {
				if (i < min) {
					min = i;
				}
				if (i > max) {
					max = i;
				}
			}
			var exps = ["摸牌数[", "弃牌数[", "目标牌数["];
			var choices_min = [],
				choices_max = [];
			for (var i = 0; i < list.length; i++) {
				if (list[i] == min) {
					choices_min.push(exps[i] + min + "]");
				}
				if (list[i] == max) {
					choices_max.push(exps[i] + max + "]");
				}
			}
			if (choices_min.length == 1 && choices_max.length == 1) {
				event._result = { bool: true, min: choices_min[0], max: choices_max[0] };
			} else {
				if (player.isUnderControl()) {
					game.swapPlayerAuto(player);
				}
				var switchToAuto = function () {
					_status.imchoosing = false;
					event._result = {
						bool: true,
						min: choices_min[0],
						max: choices_max[0],
					};
					if (event.dialog) {
						event.dialog.close();
					}
					if (event.control) {
						event.control.close();
					}
				};
				var chooseButton = function (player, min, max) {
					var event = _status.event;
					player = player || event.player;
					var list = lib.skill.dchuishu.getList(player);
					if (!event._result) {
						event._result = {};
					}
					var dialog = ui.create.dialog("###易数：请选择更改的数值###令〖慧淑〗的一个最小数值+2并令一个最大数值-1", "forcebutton", "hidden");
					event.dialog = dialog;
					dialog.addText("最小值+2");
					var table = document.createElement("div");
					table.classList.add("add-setting");
					table.style.margin = "0";
					table.style.width = "100%";
					table.style.position = "relative";
					for (var i = 0; i < min.length; i++) {
						var td = ui.create.div(".shadowed.reduce_radius.pointerdiv.tdnode");
						td.link = min[i];
						table.appendChild(td);
						td.innerHTML = "<span>" + min[i] + "</span>";
						td.addEventListener(lib.config.touchscreen ? "touchend" : "click", function () {
							if (_status.dragged) {
								return;
							}
							if (_status.justdragged) {
								return;
							}
							_status.tempNoButton = true;
							setTimeout(function () {
								_status.tempNoButton = false;
							}, 500);
							var link = this.link;
							var current = this.parentNode.querySelector(".bluebg");
							if (current) {
								current.classList.remove("bluebg");
							}
							this.classList.add("bluebg");
							event._result.min = link;
						});
					}
					dialog.content.appendChild(table);
					dialog.addText("最大值-1");
					var table2 = document.createElement("div");
					table2.classList.add("add-setting");
					table2.style.margin = "0";
					table2.style.width = "100%";
					table2.style.position = "relative";
					for (var i = 0; i < max.length; i++) {
						var td = ui.create.div(".shadowed.reduce_radius.pointerdiv.tdnode");
						td.link = max[i];
						table2.appendChild(td);
						td.innerHTML = "<span>" + max[i] + "</span>";
						td.addEventListener(lib.config.touchscreen ? "touchend" : "click", function () {
							if (_status.dragged) {
								return;
							}
							if (_status.justdragged) {
								return;
							}
							_status.tempNoButton = true;
							setTimeout(function () {
								_status.tempNoButton = false;
							}, 500);
							var link = this.link;
							var current = this.parentNode.querySelector(".bluebg");
							if (current) {
								current.classList.remove("bluebg");
							}
							this.classList.add("bluebg");
							event._result.max = link;
						});
					}
					dialog.content.appendChild(table2);
					dialog.add("　　");
					event.dialog.open();
					event.switchToAuto = function () {
						event._result = {
							bool: true,
							min: min[0],
							max: max[0],
						};
						event.dialog.close();
						event.control.close();
						game.resume();
						_status.imchoosing = false;
					};
					event.control = ui.create.control("ok", function (link) {
						var result = event._result;
						if (!result.min || !result.max) {
							return;
						}
						result.bool = true;
						event.dialog.close();
						event.control.close();
						game.resume();
						_status.imchoosing = false;
					});
					for (var i = 0; i < event.dialog.buttons.length; i++) {
						event.dialog.buttons[i].classList.add("selectable");
					}
					game.pause();
					game.countChoose();
				};
				if (event.isMine()) {
					chooseButton(player, choices_min, choices_max);
				} else if (event.isOnline()) {
					event.player.send(chooseButton, event.player, choices_min, choices_max);
					event.player.wait();
					game.pause();
				} else {
					switchToAuto();
				}
			}
			"step 1";
			var map = event.result || result;
			if (map.bool) {
				var min = map.min,
					max = map.max;
				min = min.slice(0, min.indexOf("["));
				max = max.slice(0, max.indexOf("["));
				var exps = ["摸牌数", "弃牌数", "目标牌数"];
				var list = lib.skill.dchuishu.getList(player);
				list[exps.indexOf(min)] += 2;
				list[exps.indexOf(max)]--;
				game.log(player, "令", "#g【慧淑】", "中的", "#y" + min, "+2");
				game.log(player, "令", "#g【慧淑】", "中的", "#y" + max, "-1");
				player.storage.dchuishu = list;
			} else {
				event.finish();
			}
			"step 2";
			player.markSkill("dchuishu");
			game.delayx();
		},
		ai: { combo: "dchuishu" },
	},
	dcligong: {
		audio: 2,
		juexingji: true,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			if (!player.hasSkill("dchuishu")) {
				return false;
			}
			var list = lib.skill.dchuishu.getList(player);
			for (var i of list) {
				if (i >= 5) {
					return true;
				}
			}
			return false;
		},
		skillAnimation: true,
		animationColor: "wood",
		content() {
			"step 0";
			player.awakenSkill(event.name);
			player.gainMaxHp();
			player.recover();
			"step 1";
			player.removeSkills("dcyishu");
			"step 2";
			var list;
			if (_status.characterlist) {
				list = [];
				for (var i = 0; i < _status.characterlist.length; i++) {
					var name = _status.characterlist[i];
					if (lib.character[name][1] == "wu" && (lib.character[name][0] == "female" || lib.character[name][0] == "double")) {
						list.push(name);
					}
				}
			} else if (_status.connectMode) {
				list = get.charactersOL(function (i) {
					return lib.character[i][1] != "wu" || (lib.character[i][0] != "female" && lib.character[i][0] != "double");
				});
			} else {
				list = get.gainableCharacters(function (info) {
					return info[1] == "wu" && (info[0] == "female" || info[0] == "double");
				});
			}
			var players = game.players.concat(game.dead);
			for (var i = 0; i < players.length; i++) {
				list.remove(players[i].name);
				list.remove(players[i].name1);
				list.remove(players[i].name2);
			}
			list = list.randomGets(4);
			var skills = [];
			for (var i of list) {
				skills.addArray(
					(lib.character[i][3] || []).filter(function (skill) {
						var info = get.info(skill);
						return info && !info.charlotte;
					})
				);
			}
			if (!list.length || !skills.length) {
				event.result = {
					bool: false,
					skills: [],
				};
				return;
			}
			if (player.isUnderControl()) {
				game.swapPlayerAuto(player);
			}
			var switchToAuto = function () {
				_status.imchoosing = false;
				event._result = {
					bool: true,
					skills: skills.randomGets(2),
				};
				if (event.dialog) {
					event.dialog.close();
				}
				if (event.control) {
					event.control.close();
				}
			};
			var chooseButton = function (list, skills) {
				var event = _status.event;
				if (!event._result) {
					event._result = {};
				}
				event._result.skills = [];
				var rSkill = event._result.skills;
				var dialog = ui.create.dialog("请选择获得至多两个技能", [list, "character"], "hidden");
				event.dialog = dialog;
				var table = document.createElement("div");
				table.classList.add("add-setting");
				table.style.margin = "0";
				table.style.width = "100%";
				table.style.position = "relative";
				for (var i = 0; i < skills.length; i++) {
					var td = ui.create.div(".shadowed.reduce_radius.pointerdiv.tdnode");
					td.link = skills[i];
					table.appendChild(td);
					td.innerHTML = "<span>" + get.translation(skills[i]) + "</span>";
					td.addEventListener(lib.config.touchscreen ? "touchend" : "click", function () {
						if (_status.dragged) {
							return;
						}
						if (_status.justdragged) {
							return;
						}
						_status.tempNoButton = true;
						setTimeout(function () {
							_status.tempNoButton = false;
						}, 500);
						var link = this.link;
						if (!this.classList.contains("bluebg")) {
							if (rSkill.length >= 2) {
								return;
							}
							rSkill.add(link);
							this.classList.add("bluebg");
						} else {
							this.classList.remove("bluebg");
							rSkill.remove(link);
						}
					});
				}
				dialog.content.appendChild(table);
				dialog.add("　　");
				dialog.open();

				event.switchToAuto = function () {
					event.dialog.close();
					event.control.close();
					game.resume();
					_status.imchoosing = false;
				};
				event.control = ui.create.control("ok", function (link) {
					event.dialog.close();
					event.control.close();
					game.resume();
					_status.imchoosing = false;
				});
				for (var i = 0; i < event.dialog.buttons.length; i++) {
					event.dialog.buttons[i].classList.add("selectable");
				}
				game.pause();
				game.countChoose();
			};
			if (event.isMine()) {
				chooseButton(list, skills);
			} else if (event.isOnline()) {
				event.player.send(chooseButton, list, skills);
				event.player.wait();
				game.pause();
			} else {
				switchToAuto();
			}
			"step 3";
			var map = event.result || result;
			if (map.skills && map.skills.length) {
				//player.removeSkill('dchuishu');
				//for(var i of map.skills) player.addSkillLog(i);
				player.changeSkills(map.skills, ["dchuishu"]);
				player.markAuto("zhuSkill_dcligong", map.skills);
			} else {
				player.draw(3);
			}
		},
		ai: {
			combo: "dchuishu",
		},
	},
};
