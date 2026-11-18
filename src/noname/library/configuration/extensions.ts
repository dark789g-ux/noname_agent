/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { importBossCharacters } from "./importBoss.js";
import { game } from "noname";
import { ui } from "noname";
import { lib } from "noname";

export function createExtensionMenu() {
	return {
		cardpile: {
			enable: {
				name: "开启",
				init: false,
				restart: true,
			},
			intro: {
				name: "将杀闪等牌在牌堆中的比例维持在与军争牌堆相同，防止开启扩展包后被过多地稀释",
				clear: true,
				nopointer: true,
			},
			sha: {
				name: "杀",
				init: "1",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			huosha: {
				name: "火杀",
				init: "1",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			leisha: {
				name: "雷杀",
				init: "1",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			shan: {
				name: "闪",
				init: "1",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			tao: {
				name: "桃",
				init: "0",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			jiu: {
				name: "酒",
				init: "0",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			wuxie: {
				name: "无懈可击",
				init: "0.5",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			nanman: {
				name: "南蛮入侵",
				init: "0",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			wanjian: {
				name: "万箭齐发",
				init: "0",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			guohe: {
				name: "过河拆桥",
				init: "0",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			shunshou: {
				name: "顺手牵羊",
				init: "0",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			tiesuo: {
				name: "铁索连环",
				init: "0",
				item: {
					1: "补充全部",
					0.5: "补充一半",
					0: "不补充",
				} as Record<string, string>,
			},
			hide: {
				name: "隐藏此扩展",
				clear: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
					if (this.firstChild.innerHTML == "隐藏此扩展") {
						this.firstChild.innerHTML = "此扩展将在重启后隐藏";
						lib.config.hiddenPlayPack.add("cardpile");
						if (!lib.config.prompt_hidepack) {
							alert("隐藏的扩展包可通过选项-其它-重置隐藏内容恢复");
							game.saveConfig("prompt_hidepack", true);
						}
					} else {
						this.firstChild.innerHTML = "隐藏此扩展";
						lib.config.hiddenPlayPack.remove("cardpile");
					}
					game.saveConfig("hiddenPlayPack", lib.config.hiddenPlayPack);
				},
			},
		},
		boss: {
			enable: {
				name: "开启",
				init: false,
				restart: true,
				onswitch: function (bool) {
					if (bool) {
						var storage = { boss: {}, versus: {}, translate: {} };
						var loadversus = function () {
							game.loadModeAsync("versus", function (mode) {
								for (var i in mode.translate) {
									storage.translate[i] = mode.translate[i];
								}
								for (var i in mode.jiangeboss) {
									if (mode.jiangeboss[i].isBossAllowed) {
										storage.versus[i] = mode.jiangeboss[i];
									}
								}
								localStorage.setItem("boss_storage_playpackconfig", JSON.stringify(storage));
							});
						};
						game.loadModeAsync("boss", function (mode) {
							importBossCharacters(mode, storage, loadversus);
						});
					} else {
						localStorage.removeItem("boss_storage_playpackconfig");
					}
				},
			},
			intro: {
				name: "将剑阁和挑战模式的武将添加到其它模式",
				clear: true,
				nopointer: true,
			},
			enableai: {
				name: "随机选将可用",
				init: false,
			},
			hide: {
				name: "隐藏此扩展",
				clear: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
					if (this.firstChild.innerHTML == "隐藏此扩展") {
						this.firstChild.innerHTML = "此扩展将在重启后隐藏";
						lib.config.hiddenPlayPack.add("boss");
						if (!lib.config.prompt_hidepack) {
							alert("隐藏的扩展包可通过选项-其它-重置隐藏内容恢复");
							game.saveConfig("prompt_hidepack", true);
						}
					} else {
						this.firstChild.innerHTML = "隐藏此扩展";
						lib.config.hiddenPlayPack.remove("boss");
					}
					game.saveConfig("hiddenPlayPack", lib.config.hiddenPlayPack);
				},
			},
		},
		coin: {
			enable: {
				name: "开启",
				init: false,
				restart: true,
				onclick(bool) {
					if (bool) {
						lib.config.plays.add("coin");
					} else {
						lib.config.plays.remove("coin");
					}
					game.saveConfig("plays", lib.config.plays);
				},
			},
			intro: {
				name: "每完成一次对局，可获得一定数量的金币；金币可用于购买游戏特效",
				clear: true,
				nopointer: true,
			},
			display: {
				name: "金币显示",
				init: "text",
				item: {
					symbol: "符号",
					text: "文字",
				} as Record<string, string>,
				onclick(item) {
					game.saveConfig("coin_display_playpackconfig", item);
					if (game.changeCoin) {
						game.changeCoin(0);
					}
				},
			},
			canvas: {
				name: "特效置顶",
				init: false,
				onclick(bool) {
					game.saveConfig("coin_canvas_playpackconfig", bool);
					if (bool) {
						ui.window.classList.add("canvas_top");
					} else {
						ui.window.classList.remove("canvas_top");
					}
				},
			},
			hide: {
				name: "隐藏此扩展",
				clear: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
					if (this.firstChild.innerHTML == "隐藏此扩展") {
						this.firstChild.innerHTML = "此扩展将在重启后隐藏";
						lib.config.hiddenPlayPack.add("coin");
						if (!lib.config.prompt_hidepack) {
							alert("隐藏的扩展包可通过选项-其它-重置隐藏内容恢复");
							game.saveConfig("prompt_hidepack", true);
						}
					} else {
						this.firstChild.innerHTML = "隐藏此扩展";
						lib.config.hiddenPlayPack.remove("coin");
					}
					game.saveConfig("hiddenPlayPack", lib.config.hiddenPlayPack);
				},
			},
		},
	};
}
