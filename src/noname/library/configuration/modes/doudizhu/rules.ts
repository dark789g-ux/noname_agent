/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";
import { lib } from "noname";

export function createModeDoudizhuConfigGroup() {
	return {
		config: {
			update: function (config, map) {
				if (config.doudizhu_mode == "online") {
					map.change_card.hide();
					map.edit_character.show();
					map.reset_character.show();
				} else {
					map.change_card.show();
					map.edit_character.hide();
					map.reset_character.hide();
				}
				if (config.doudizhu_mode !== "normal") {
					if (config.doudizhu_mode === "kaihei") {
						map.choice_zhu.show();
						map.choice_fan.show();
					} else {
						map.choice_zhu.hide();
						map.choice_fan.hide();
					}
					map.double_character.hide();
					map.free_choose.hide();
					map.change_identity.hide();
					map.change_choice.hide();
					map.continue_game.hide();
					map.dierestart.hide();
					map.revive.hide();
					map.enhance_dizhu.hide();
					map.enhance_nongmin.hide();
					map.feiyang_version.hide();
				} else {
					map.double_character.show();
					map.choice_zhu.show();
					map.choice_fan.show();
					map.free_choose.show();
					map.change_identity.show();
					map.change_choice.show();
					map.continue_game.show();
					map.dierestart.show();
					map.revive.show();
					map.enhance_dizhu.show();
					map.enhance_nongmin.show();
					map.feiyang_version.show();
				}
				if (config.double_character && config.doudizhu_mode == "normal") {
					map.double_hp.show();
				} else {
					map.double_hp.hide();
				}
			},
			doudizhu_mode: {
				name: "游戏模式",
				init: "normal",
				item: {
					normal: "休闲",
					kaihei: "开黑",
					huanle: "欢乐",
					binglin: "兵临",
					online: "智斗",
				} as Record<string, string>,
				restart: true,
				frequent: true,
			},
			double_character: {
				name: "双将模式",
				init: false,
				frequent: true,
				restart: true,
			},
			double_hp: {
				name: "双将体力上限",
				init: "pingjun",
				item: {
					hejiansan: "和减三",
					pingjun: "平均值",
					zuidazhi: "最大值",
					zuixiaozhi: "最小值",
					zonghe: "相加",
				} as Record<string, string>,
				restart: true,
			},
			choice_zhu: {
				name: "地主候选武将数",
				init: 5,
				input: true,
				restart: true,
				onblur(e) {
					let text = e.target,
						num = Number(text.innerText);
					if (isNaN(num) || num < 1) {
						num = 1;
					} else if (!Number.isInteger(num)) {
						num = Math.round(num);
					}
					text.innerText = num;
					game.saveConfig("choice_zhu", num, "doudizhu");
				},
			},
			choice_fan: {
				name: "农民候选武将数",
				init: 3,
				input: true,
				restart: true,
				onblur(e) {
					let text = e.target,
						num = Number(text.innerText);
					if (isNaN(num) || num < 1) {
						num = 1;
					} else if (!Number.isInteger(num)) {
						num = Math.round(num);
					}
					text.innerText = num;
					game.saveConfig("choice_fan", num, "doudizhu");
				},
			},
			free_choose: {
				name: "自由选将",
				init: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					game.saveConfig("free_choose", bool, this._link.config.mode);
					if (get.mode() != this._link.config.mode || (!_status.event.getParent().showConfig && !_status.event.showConfig)) {
						return;
					}
					if (!ui.cheat2 && get.config("free_choose")) {
						ui.create.cheat2?.();
					} else if (ui.cheat2 && !get.config("free_choose")) {
						ui.cheat2.close();
						delete ui.cheat2;
					}
				},
			},
			change_identity: {
				name: "自由选择身份和座位",
				init: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					game.saveConfig("change_identity", bool, this._link.config.mode);
					if (!_status.event.getParent().showConfig && !_status.event.showConfig) {
						return;
					}
					var dialog;
					if (ui.cheat2 && ui.cheat2.backup) {
						dialog = ui.cheat2.backup;
					} else {
						dialog = _status.event.dialog;
					}
					if (!_status.brawl || !_status.brawl.noAddSetting) {
						if (!dialog.querySelector("table") && get.config("change_identity")) {
							_status.event.getParent().addSetting(dialog);
						} else {
							_status.event.getParent().removeSetting(dialog);
						}
					}
					ui.update();
				},
			},
			change_choice: {
				name: "开启换将卡",
				init: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					game.saveConfig("change_choice", bool, this._link.config.mode);
					if (!_status.event.getParent().showConfig && !_status.event.showConfig) {
						return;
					}
					if (!ui.cheat && get.config("change_choice")) {
						ui.create.cheat?.();
					} else if (ui.cheat && !get.config("change_choice")) {
						ui.cheat.close();
						delete ui.cheat;
					}
				},
			},
			change_card: {
				name: "开启手气卡",
				init: "disabled",
				item: {
					disabled: "禁用",
					once: "一次",
					twice: "两次",
					unlimited: "无限",
				} as Record<string, string>,
			},
			continue_game: {
				name: "显示再战",
				init: false,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					game.saveConfig("continue_game", bool, this._link.config.mode);
					if (get.config("continue_game")) {
						if (!ui.continue_game && _status.over && !_status.brawl && !game.no_continue_game) {
							ui.continue_game = ui.create.control("再战", game.reloadCurrent);
						}
					} else if (ui.continue_game) {
						ui.continue_game.close();
						delete ui.continue_game;
					}
				},
				intro: "游戏结束后可选择用相同的武将再进行一局游戏",
			},
			dierestart: {
				name: "死亡后显示重来",
				init: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					game.saveConfig("dierestart", bool, this._link.config.mode);
					if (get.config("dierestart")) {
						if (!ui.restart && game.getMe().isDead() && !_status.connectMode) {
							ui.restart = ui.create.control("restart", game.reload);
						}
					} else if (ui.restart) {
						ui.restart.close();
						delete ui.restart;
					}
				},
			},
			revive: {
				name: "死亡后显示复活",
				init: false,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					game.saveConfig("revive", bool, this._link.config.mode);
					if (get.config("revive")) {
						if (!ui.revive && game.getMe().isDead()) {
							ui.revive = ui.create.control("revive", ui.click.dierevive);
						}
					} else if (ui.revive) {
						ui.revive.close();
						delete ui.revive;
					}
				},
			},
			enhance_dizhu: {
				name: "加强地主",
				init: "disabled",
				restart: true,
				item: {
					disabled: "禁用",
					yinfu: "获得〖殷富〗",
					kaihei: "获得〖强易〗",
					qiangyi: "获得削弱〖强易〗",
					oldshiqiang: "获得〖恃强〗",
					shiqiang: "获得削弱〖恃强〗",
				} as Record<string, string>,
			},
			enhance_nongmin: {
				name: "农民遗产",
				init: "mobile",
				restart: true,
				item: {
					online: "OL版本",
					mobile: "手杀版本",
					decade: "十周年版本",
				} as Record<string, string>,
			},
			feiyang_version: {
				name: "〖飞扬〗版本",
				init: "online",
				restart: true,
				item: {
					online: "OL版本",
					mobile: "手杀版本",
					decade: "十周年版本",
				} as Record<string, string>,
			},
			edit_character: {
				name: "编辑将池",
				intro: "这里是智斗三国模式的武将将池。<br/>您可以在这里编辑对武将将池进行编辑，然后点击“保存”按钮即可保存。<br/>将池中的Key势力武将，仅同时在没有被禁用的情况下，才会出现在选将框中。<br/>而非Key势力的武将，只要所在的武将包没有被隐藏，即可出现在选将框中。<br/>该将池为单机模式/联机模式通用将池。在这里编辑后，即使进入联机模式，也依然会生效。<br/>但联机模式本身禁用的武将（如神貂蝉）不会出现在联机模式的选将框中。",
				clear: true,
				onclick() {
					if (get.mode() != "doudizhu") {
						alert("请进入斗地主模式，然后再编辑将池");
						return;
					}
					var map = get.config("character_online") || lib.characterOnline;
					ui.create.editor({
						language: "json",
						value: JSON.stringify(map, null, 2),
						saveInput: result => {
							const character = JSON.parse(result);
							if (!get.is.object(character)) {
								throw new Error("代码格式有错误，请对比示例代码仔细检查");
							}
							var groups: string[] = [];
							for (var i in character) {
								if (!Array.isArray(character[i])) {
									throw new Error("请严格按照格式填写，不要写入不为数组的数据");
								}
								if (character[i].length >= 3) {
									groups.push(i);
								}
							}
							if (groups.length < 3) {
								throw new Error("请保证至少写入了3个势力，且每个势力至少有3个武将");
							}
							game.saveConfig("character_online", character, "doudizhu");
						},
					});
				},
			},
			reset_character: {
				name: "重置将池",
				intro: "将智斗三国模式下的将池重置为默认将池",
				clear: true,
				onclick() {
					if (confirm("该操作不可撤销！是否清除智斗三国模式的自定义将池，并将其重置为默认将池？")) {
						game.saveConfig("character_online", null, "doudizhu");
						alert("将池已重置");
					}
				},
			},
		},
	};
}
