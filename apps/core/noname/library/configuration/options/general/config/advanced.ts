/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";
import dedent from "dedent";
import { lib } from "noname";
import { refreshExtensionSourceMenu } from "@/library/configuration/menuBridge.js";

export function createGeneralAdvancedOptions() {
	return {
		hoveration: {
			name: "悬停菜单弹出时间",
			unfrequent: true,
			intro: "鼠标移至目标到弹出菜单的时间间隔",
			init: "1000",
			item: {
				500: "0.5秒",
				700: "0.7秒",
				1000: "1秒",
				1500: "1.5秒",
				2500: "2.5秒",
			} as Record<string, string>,
		},
		doubleclick_intro: {
			name: "双击显示武将资料",
			init: true,
			unfrequent: true,
			intro: "双击武将头像后显示其资料卡",
		},
		choose_all_button: {
			name: "启用全选/反选按钮",
			init: true,
			unfrequent: true,
			intro: "在选择大量的牌时提供全选/反选功能<br><br>对于部分技能可能会因为其主动限制或者存在复杂的选择情况而失效",
		},
		clear_FavoriteCharacter: {
			name: "清除已收藏武将",
			clear: true,
			unfrequent: true,
			onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
				if (this.innerHTML == "<span>确认清除</span>") {
					game.saveConfig("favouriteCharacter", [], true);
					alert("已清除所有收藏武将");
				} else {
					this.innerHTML = "<span>确认清除</span>";
					var that = this;
					setTimeout(function () {
						that.innerHTML = "<span>清除已收藏武将</span>";
					}, 1000);
				}
			},
		},
		clear_BanCharacter: {
			name: "清除已禁用武将",
			clear: true,
			unfrequent: true,
			onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
				if (this.innerHTML == "<span>确认清除</span>") {
					if (confirm("点击确定清除全模式禁用武将，否则清除当前模式禁用武将")) {
						lib.config.all.mode.forEach(mode => game.saveConfig(`${mode}_banned`, [], mode));
						alert("全模式禁用武将已清除！");
						return;
					}
					game.saveConfig(`${get.mode()}_banned`, [], true);
					alert(`${lib.mode[get.mode()]?.name ?? "本"}模式禁用武将已清除！`);
				} else {
					this.innerHTML = "<span>确认清除</span>";
					var that = this;
					setTimeout(function () {
						that.innerHTML = "<span>清除已禁用武将</span>";
					}, 1000);
				}
			},
		},
		clear_RecentCharacter: {
			name: "清除最近使用武将",
			clear: true,
			unfrequent: true,
			onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode) {
				if (this.innerHTML == "<span>确认清除</span>") {
					if (confirm("点击确定清除全模式最近选将记录，否则清除当前模式最近选将记录")) {
						lib.config.all.mode.forEach(mode => game.saveConfig("recentCharacter", [], mode));
						alert("全模式最近选将记录已清除！");
						return;
					}
					game.saveConfig("recentCharacter", [], true);
					alert(`${lib.mode[get.mode()]?.name ?? "本"}模式最近选将记录已清除！`);
				} else {
					this.innerHTML = "<span>确认清除</span>";
					var that = this;
					setTimeout(function () {
						that.innerHTML = "<span>清除最近使用武将</span>";
					}, 1000);
				}
			},
		},
		video: {
			name: "保存录像",
			init: "20",
			intro: "游戏结束后保存录像在最大条数，超过后将从最早的录像开始删除（已收藏的录像不计入条数）",
			item: {
				0: "关闭",
				5: "五局",
				10: "十局",
				20: "二十局",
				50: "五十局",
				10000: "无限",
			} as Record<string, string>,
			unfrequent: true,
		},
		video_default_play_speed: {
			name: "默认录像播放速度",
			init: "1x",
			intro: "设置播放游戏录像时默认的播放速度",
			item: {
				"0.25x": "0.25倍速",
				"0.5x": "0.5倍速",
				"1x": "原速",
				"1.5x": "1.5倍速",
				"2x": "2倍速",
				"4x": "4倍速",
			} as Record<string, string>,
			unfrequent: true,
		},
		max_loadtime: {
			name: "最长载入时间",
			intro: "设置游戏从启动到完成载入所需的最长时间，超过此时间未完成载入会报错，若设备较慢或安装了较多扩展可适当延长此时间",
			init: "5000",
			unfrequent: true,
			item: {
				5000: "5秒",
				10000: "10秒",
				20000: "20秒",
				60000: "60秒",
			} as Record<string, string>,
			onclick(item) {
				game.saveConfig("max_loadtime", item);
				if (item === "5000") {
					localStorage.removeItem(lib.configprefix + "loadtime");
				} else {
					localStorage.setItem(lib.configprefix + "loadtime", item);
				}
			},
		},
		mousewheel: {
			name: "滚轮控制手牌",
			init: true,
			unfrequent: true,
			intro: "开启后滚轮可使手牌横向滚动，在mac等可横向滚动的设备上建议关闭",
			onclick(bool) {
				game.saveConfig("mousewheel", bool);
				if (lib.config.touchscreen) {
					return;
				}
				if (lib.config.mousewheel) {
					ui.handcards1Container.onmousewheel = ui.click.mousewheel;
					ui.handcards2Container.onmousewheel = ui.click.mousewheel;
				} else {
					ui.handcards1Container.onmousewheel = undefined;
					ui.handcards2Container.onmousewheel = undefined;
				}
			},
		},
		auto_check_update: {
			name: "自动检查游戏更新",
			intro: "进入游戏时检查更新",
			init: false,
			unfrequent: true,
		},
		lucky_star: {
			name: "幸运星模式",
			intro: "在涉及随机数等的技能中，必定得到效果最好的结果。（联机模式无效）",
			init: false,
			unfrequent: true,
		},
		dev: {
			name: "开发者模式",
			intro: "开启后可使用浏览器控制台控制游戏，同时可更新到开发版",
			init: false,
			onclick(bool) {
				game.saveConfig("dev", bool);
				if (_status.connectMode) {
					return;
				}
				if (bool) {
					window.noname_shijianInterfaces?.showDebugButton?.();
					lib.cheat.i();
				} else {
					window.noname_shijianInterfaces?.hideDebugButton?.();
					delete window.cheat;
					delete window.game;
					delete window.ui;
					delete window.get;
					delete window.nonameAI;
					delete window.lib;
					delete window._status;
				}
			},
			unfrequent: true,
		},
		extension_auto_import: {
			name: "自动导入扩展",
			intro: dedent`
						开启后无名杀会自动导入扩展目录下的扩展（以此法导入的扩展默认关闭）
						<br />
						※ 如果你的运行环境不支持文件操作，则该选项无效
						<br />
						※ 鉴于不同平台下文件操作的性能区别，开启后可能会降低加载速度
					`,
			init: false,
			async onclick(bool) {
				await game.promises.saveConfig("extension_auto_import", bool);
			},
			unfrequent: true,
		},
		fuck_sojson: {
			name: "检测加密扩展",
			init: false,
			unfrequent: true,
		},
		update_link: {
			name: "更新地址",
			init: "coding",
			unfrequent: true,
			item: {
				coding: "URC",
				github: "GitHub",
			} as Record<string, string>,
			onclick(item) {
				game.saveConfig("update_link", item);
				lib.updateURL = lib.updateURLS[item] || lib.updateURLS.coding;
			},
		},
		extension_source: {
			name: "获取扩展地址",
			init: "GitHub Proxy",
			unfrequent: true,
			item: {} as Record<string, string>,
			intro: () => `获取在线扩展时的地址。当前地址：${document.createElement("br").outerHTML}${lib.config.extension_sources[lib.config.extension_source]}`,
		},
		extension_create: {
			name: "添加获取扩展地址",
			clear: true,
			unfrequent: true,
			onclick() {
				game.prompt("请输入地址名称", function (str) {
					if (str) {
						var map = lib.config.extension_sources;
						game.prompt("请输入" + str + "的地址", function (str2) {
							if (str2) {
								delete map[str];
								map[str] = str2;
								game.saveConfig("extension_sources", map);
								game.saveConfig("extension_source", str);
								var item = lib.configMenu.general.config.extension_source.item;
								delete item[str];
								item[str] = str;
								refreshExtensionSourceMenu();
								alert("已添加扩展地址：" + str);
							}
						});
					}
				});
			},
		},
		extension_delete: {
			name: "删除当前扩展地址",
			clear: true,
			unfrequent: true,
			onclick() {
				var bool = false,
					map = lib.config.extension_sources,
					i = "";
				for (i in map) {
					if (i != lib.config.extension_source) {
						bool = true;
						break;
					}
				}
				if (!bool) {
					alert("不能删除最后一个扩展地址！");
					return;
				}
				var name = lib.config.extension_source;
				game.saveConfig("extension_source", i);
				delete map[name];
				game.saveConfig("extension_sources", map);
				delete lib.configMenu.general.config.extension_source.item[name];
				refreshExtensionSourceMenu();
				alert("已删除扩展地址：" + name);
			},
		},
	};
}
