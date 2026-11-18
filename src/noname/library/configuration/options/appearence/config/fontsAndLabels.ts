/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { ui } from "noname";
import { lib } from "noname";

export function createAppearanceFontsAndLabelsOptions() {
	return {
		cardshape: {
			name: "手牌显示",
			intro: "将手牌设置为正方形或长方形",
			init: "default",
			unfrequent: true,
			item: {
				default: "默认",
				oblong: "长方",
			} as Record<string, string>,
			onclick(item) {
				const me = game.me;
				var linked = false;
				if (me && me.isLinked()) {
					linked = true;
				}
				game.saveConfig("cardshape", item);
				if (item == "oblong" && (game.layout == "long" || game.layout == "mobile" || game.layout == "long2" || game.layout == "nova")) {
					ui.arena.classList.add("oblongcard");
					ui.window.classList.add("oblongcard");
				} else {
					ui.arena.classList.remove("oblongcard");
					ui.window.classList.remove("oblongcard");
				}
				if (me && linked) {
					if (get.is.linked2(me)) {
						me.classList.remove("linked");
						me.classList.add("linked2");
					} else {
						me.classList.add("linked");
						me.classList.remove("linked2");
					}
				}
			},
		},
		cardtempname: {
			name: "视为卡牌名称显示",
			intro: "显示强制视为类卡牌（如武魂），包括拆顺对话框内的判定牌（国色）转换等名称的显示方式",
			init: "image",
			unfrequent: true,
			item: {
				default: "纵向",
				horizon: "横向",
				image: "图片",
				off: "禁用",
			} as Record<string, string>,
			onclick(item) {
				game.saveConfig("cardtempname", item);
				if (!game.me || !game.me.getCards) {
					return;
				}
				var hs = game.me.getCards("h");
				for (var i = 0; i < hs.length; i++) {
					const tempName = hs[i]._tempName;
					if (tempName) {
						switch (item) {
							case "default":
							case "horizon":
							case "image":
								ui.create.cardTempName(hs[i]);
								break;
							default:
								tempName.delete();
								delete hs[i]._tempName;
						}
					}
				}
			},
		},
		/*textequip:{
					name:'装备显示',
					init:'image',
					unfrequent:true,
					item:{
						image:'图片',
						text:'文字',
					},
					onclick(item){
						game.saveConfig('textequip',item);
						if(item=='text'&&(game.layout=='long'||game.layout=='mobile')){
							ui.arena.classList.add('textequip');
						}
						else{
							ui.arena.classList.remove('textequip');
						}
					}
				},*/
		buttoncharacter_style: {
			name: "选将样式",
			init: "default",
			item: {
				default: "默认",
				simple: "精简",
				old: "旧版",
			} as Record<string, string>,
			unfrequent: true,
		},
		buttoncharacter_prefix: {
			name: "武将前缀",
			init: "default",
			item: {
				default: "默认",
				simple: "不显示颜色",
				off: "不显示前缀",
			} as Record<string, string>,
			unfrequent: true,
		},
		cursor_style: {
			name: "鼠标指针",
			init: "auto",
			intro: "设置为固定后鼠标指针将不随移动到的区域而变化",
			unfrequent: true,
			item: {
				auto: "自动",
				pointer: "固定",
			} as Record<string, string>,
			onclick(item) {
				game.saveConfig("cursor_style", item);
				if (item == "pointer") {
					ui.window.classList.add("nopointer");
				} else {
					ui.window.classList.remove("nopointer");
				}
			},
		},
		name_font: {
			name: "人名字体",
			init: "xingkai",
			unfrequent: true,
			item: {} as Record<string, string>,
			textMenu: function (node, link) {
				if (link != "default") {
					node.style.fontFamily = link;
				}
				node.style.fontSize = "20px";
			},
			onclick(font) {
				game.saveConfig("name_font", font);
				lib.init.cssstyles();
			},
		},
		identity_font: {
			name: "身份字体",
			init: "huangcao",
			unfrequent: true,
			item: {} as Record<string, string>,
			textMenu: function (node, link) {
				if (link != "default") {
					node.style.fontFamily = link;
				}
				node.style.fontSize = "20px";
			},
			onclick(font) {
				game.saveConfig("identity_font", font);
				lib.init.cssstyles();
			},
		},
		cardtext_font: {
			name: "卡牌字体",
			init: "default",
			unfrequent: true,
			item: {} as Record<string, string>,
			textMenu: function (node, link) {
				if (link != "default") {
					node.style.fontFamily = link;
				}
				node.style.fontSize = "20px";
			},
			onclick(font) {
				game.saveConfig("cardtext_font", font);
				lib.init.cssstyles();
			},
		},
		global_font: {
			name: "界面字体",
			init: "default",
			unfrequent: true,
			item: {} as Record<string, string>,
			textMenu: function (node, link) {
				if (link != "default") {
					node.style.fontFamily = link;
				} else {
					node.style.fontFamily = "'STHeiti','SimHei','Microsoft JhengHei','Microsoft YaHei','WenQuanYi Micro Hei','Suits',Helvetica,Arial,sans-serif";
				}
				node.style.fontSize = "20px";
			},
			onclick(font) {
				game.saveConfig("global_font", font);
				lib.init.cssstyles();
			},
		},
		suits_font: {
			name: "替换花色字体",
			init: true,
			unfrequent: true,
			intro: "使用全角字符的花色替代系统自带的花色（重启游戏后生效）",
			onclick(bool) {
				game.saveConfig("suits_font", bool);
			},
		},
		update: function (config, map) {
			if (lib.config.custom_button) {
				map.custom_button_system_top.show();
				map.custom_button_system_bottom.show();
				map.custom_button_control_top.show();
				map.custom_button_control_bottom.show();
			} else {
				map.custom_button_system_top.hide();
				map.custom_button_system_bottom.hide();
				map.custom_button_control_top.hide();
				map.custom_button_control_bottom.hide();
			}
			if (lib.config.change_skin) {
				map.change_skin_auto.show();
			} else {
				map.change_skin_auto.hide();
			}
			if (lib.config.image_background_random) {
				map.image_background_blur.show();
				map.image_background.hide();
				// map.import_background.hide();
			} else {
				map.image_background.show();
				if (lib.config.image_background == "default") {
					map.image_background_blur.hide();
				} else {
					map.image_background_blur.show();
				}
				// if(lib.config.image_background=='custom'&&lib.db){
				// 	map.import_background.show();
				// }
				// else{
				// 	map.import_background.hide();
				// }
			}
			if (lib.config.layout == "long" || lib.config.layout == "mobile") {
				//map.textequip.show();
				map.cardshape.show();
				map.phonelayout.show();
			} else {
				//map.textequip.hide();
				if (lib.config.layout == "long2" || lib.config.layout == "nova") {
					map.phonelayout.show();
					map.cardshape.show();
				} else {
					map.phonelayout.hide();
					map.cardshape.hide();
				}
			}
			if (lib.config.layout == "long") {
				// map.fewplayer.show();
				map.player_height.show();
			} else {
				// map.fewplayer.hide();
				if (lib.config.layout == "long2") {
					map.player_height.show();
				} else {
					map.player_height.hide();
				}
			}
			if (lib.config.layout == "nova") {
				map.player_height_nova.show();
			} else {
				map.player_height_nova.hide();
			}
			if (lib.config.touchscreen) {
				map.cursor_style.hide();
			} else {
				map.cursor_style.show();
			}
			if (lib.config.border_style == "auto") {
				map.autoborder_count.show();
				map.autoborder_start.show();
			} else {
				map.autoborder_count.hide();
				map.autoborder_start.hide();
			}
		},
	};
}
