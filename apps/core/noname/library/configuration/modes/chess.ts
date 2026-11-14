/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";

export function createModeChess() {
	return {
		name: "战棋",
		config: {
			chess_mode: {
				name: "游戏模式",
				init: "combat",
				item: {
					combat: "自由",
					three: "统率",
					leader: "君主",
				} as Record<string, string>,
				restart: true,
				frequent: true,
			},
			update: function (config, map) {
				if (config.chess_mode == "leader") {
					map.chess_leader_save.show();
					map.chess_leader_clear.show();
					map.chess_leader_allcharacter.show();
					map.chess_character.hide();
				} else {
					map.chess_leader_save.hide();
					map.chess_leader_clear.hide();
					map.chess_leader_allcharacter.hide();
					map.chess_character.show();
				}
				if (config.chess_mode == "combat") {
					// map.battle_number.show();
					// map.chess_ordered.show();
					map.free_choose.show();
					map.change_choice.show();
				} else {
					// map.battle_number.hide();
					// map.chess_ordered.hide();
					map.free_choose.hide();
					map.change_choice.hide();
				}
			},
			chess_leader_save: {
				name: "选择历程",
				init: "save1",
				item: {
					save1: "一",
					save2: "二",
					save3: "三",
					save4: "四",
					save5: "五",
				} as Record<string, string>,
				restart: true,
				frequent: true,
			},
			chess_leader_allcharacter: {
				name: "启用全部角色",
				init: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					if (confirm("调整该设置将清除所有进度，是否继续？")) {
						for (var i = 1; i < 6; i++) {
							game.save("save" + i, null, "chess");
						}
						game.saveConfig("chess_leader_allcharacter", bool, "chess");
						if (get.mode() == "chess") {
							game.reload();
						}
						return;
					} else {
						this.classList.toggle("on");
					}
				},
			},
			chess_leader_clear: {
				name: "清除进度",
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
					var node = this;
					if (node._clearing) {
						for (var i = 1; i < 6; i++) {
							game.save("save" + i, null, "chess");
						}
						game.reload();
						return;
					}
					node._clearing = true;
					node.firstChild.innerHTML = "单击以确认 (3)";
					setTimeout(function () {
						node.firstChild.innerHTML = "单击以确认 (2)";
						setTimeout(function () {
							node.firstChild.innerHTML = "单击以确认 (1)";
							setTimeout(function () {
								node.firstChild.innerHTML = "清除进度";
								delete node._clearing;
							}, 1000);
						}, 1000);
					}, 1000);
				},
				clear: true,
				frequent: true,
			},
			// chess_treasure:{
			// 	name:'战场机关',
			// 	init:'0',
			// 	frequent:true,
			// 	item:{
			// 		'0':'关闭',
			// 		'0.1':'较少出现',
			// 		'0.2':'偶尔出现',
			// 		'0.333':'时常出现',
			// 		'0.5':'频繁出现',
			// 	}
			// },
			chess_obstacle: {
				name: "随机路障",
				init: "0.2",
				item: {
					0: "关闭",
					0.2: "少量",
					0.333: "中量",
					0.5: "大量",
				} as Record<string, string>,
				frequent: true,
			},
			show_range: {
				name: "显示卡牌范围",
				init: true,
			},
			show_distance: {
				name: "显示距离",
				init: true,
			},
			chess_character: {
				name: "战棋武将",
				init: true,
				frequent: true,
			},
			chess_card: {
				name: "战棋卡牌",
				init: true,
				frequent: true,
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
			chessscroll_speed: {
				name: "边缘滚动速度",
				init: "20",
				intro: "鼠标移至屏幕边缘时自动滚屏",
				item: {
					0: "不滚动",
					10: "10格/秒",
					20: "20格/秒",
					30: "30格/秒",
				} as Record<string, string>,
			},
		},
	};
}
