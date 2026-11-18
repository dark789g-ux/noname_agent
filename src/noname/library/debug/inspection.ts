import { game } from "noname";
import { ui } from "noname";
import { lib } from "noname";

export function createCheatInspection() {
	return {
		/**
		 * 游戏设置变更为固定数据(不更改扩展设置)
		 */
		cfg() {
			const mode = lib.config.all.mode.slice(0);
			mode.remove("connect");
			mode.remove("brawl");
			const banned = ["shen_guanyu", "shen_caocao", "caopi", "re_daqiao", "caorui", "daqiao", "lingcao", "liuzan", "lusu", "luxun", "yanwen", "zhouyu", "ns_wangyue", "gw_yenaifa", "old_caozhen", "swd_jiangziya", "xuhuang", "maliang", "guojia", "simayi", "swd_kangnalishi", "hs_siwangzhiyi", "hs_nozdormu", "old_zhuzhi"];
			const bannedcards = ["zengbin"];
			const favs = ["hs_tuoqi", "hs_siwangxianzhi", "hs_xukongzhiying", "hs_hsjiasha", "gjqt_xieyi", "gjqt_yunwuyue", "gjqt_beiluo", "gjqt_cenying", "shen_lvmeng", "shen_zhaoyun", "shen_zhugeliang", "ow_ana", "chenlin", "ns_guanlu", "hs_guldan", "swd_guyue", "pal_jiangyunfan", "mtg_jiesi", "swd_lanyin", "pal_liumengli", "swd_muyun", "pal_nangonghuang", "swd_muyue", "pal_murongziying", "swd_qiner", "pal_shenqishuang", "hs_taisi", "wangji", "pal_xingxuan", "xunyou", "hs_yelise", "pal_yuejinzhao", "pal_yueqi", "gjqt_yuewuyi", "swd_yuxiaoxue", "ow_zhaliya", "zhangchunhua", "hs_zhihuanhua", "swd_zhiyin", "old_zhonghui", "gjqt_bailitusu", "hs_barnes", "ow_dva", "swd_hengai", "pal_jushifang", "hs_kazhakusi", "hs_lafamu", "ow_liekong", "hs_lreno", "pal_mingxiu", "swd_murongshi", "gw_oudimu", "gjqt_ouyangshaogong", "hs_pyros", "qinmi", "gw_sanhanya", "hs_selajin", "swd_shuwaner", "swd_situqiang", "hs_xialikeer", "pal_xuejian", "swd_yuchiyanhong", "swd_yuwentuo", "swd_zhaoyun", "zhugeliang", "gw_aigeleisi", "gw_aimin", "gjqt_aruan", "hs_aya", "swd_cheyun", "swd_chenjingchou", "gw_diandian", "swd_huzhongxian", "hs_jinglinglong", "hs_kaituozhe", "hs_kalimosi", "gw_linjing", "ow_luxiao", "re_luxun", "hs_morgl", "swd_sikongyu", "hs_sthrall", "sunquan", "sunshangxiang", "gw_yioufeisisp", "gw_yisilinni", "hs_yogg", "hs_ysera", "pal_yuntianhe", "zhugejin", "zhugeke", "gw_zhuoertan", "hs_anduin", "swd_anka", "ow_banzang", "ow_chanyata", "diaochan", "swd_duguningke", "sp_diaochan", "hetaihou", "ns_huamulan", "swd_huanglei", "swd_huanyuanzhi", "re_huatuo", "gw_huoge", "pal_jiangcheng", "yj_jushou", "swd_kendi", "yxs_libai", "mtg_lilianna", "xin_liru", "liuxie", "pal_lixiaoyao", "pal_longkui", "ns_nanhua", "swd_qi", "swd_septem", "gw_shasixiwusi", "ow_tianshi", "swd_weida", "gjqt_xiayize", "swd_xiyan", "hs_xsylvanas", "hs_yelinlonghou", "ow_yuanshi", "zuoci"];
			const vintage = ["tianjian", "shuiyun", "zhuyue", "zhimeng", "poyun", "qianfang", "xfenxin", "danqing", "ywuhun", "tianwu", "xuelu", "shahun", "yuling", "duhun", "liaoyuan", "touxi", "wangchen", "poyue", "kunlunjing", "huanhun", "yunchou", "tuzhen", "cyqiaoxie", "mufeng", "duanyi", "guozao", "yaotong", "pozhen", "tanlin", "susheng", "jikong", "shouyin", "jilve", "hxunzhi", "huodan", "shanxian", "ziyu", "kuoyin", "feiren", "zihui", "jidong", "baoxue", "aqianghua", "maoding", "bfengshi", "zhongdun", "pingzhang", "maichong", "guozai", "jingxiang", "yuelu", "liechao", "fengnu", "hanshuang", "enze", "malymowang", "xshixin", "qingzun"];
			const favmodes = ["versus|three", "versus|four", "versus|two", "chess|combat"];
			for (let i = 0; i < mode.length; i++) {
				game.saveConfig(mode[i] + "_banned", banned);
				game.saveConfig(mode[i] + "_bannedcards", bannedcards);
			}
			const characters = lib.config.all.characters.slice(0);
			characters.remove("standard");
			characters.remove("old");
			game.saveConfig("favouriteCharacter", favs);
			game.saveConfig("favouriteMode", favmodes);
			game.saveConfig("theme", "simple");
			game.saveConfig("player_border", "slim");
			game.saveConfig("cards", lib.config.all.cards);
			game.saveConfig("characters", characters);
			game.saveConfig("change_skin", false);
			game.saveConfig("show_splash", "off");
			game.saveConfig("show_favourite", false);
			game.saveConfig("animation", false);
			game.saveConfig("hover_all", false);
			game.saveConfig("asset_version", "v1.9");
			// game.saveConfig('characters',lib.config.all.characters);
			// game.saveConfig('cards',lib.config.all.cards);
			game.saveConfig("plays", ["cardpile"]);
			game.saveConfig("skip_shan", false);
			game.saveConfig("tao_enemy", true);
			game.saveConfig("layout", "long2");
			game.saveConfig("hp_style", "ol");
			game.saveConfig("background_music", "music_off");
			game.saveConfig("background_audio", false);
			game.saveConfig("background_speak", false);
			game.saveConfig("show_volumn", false);
			game.saveConfig("show_replay", true);
			game.saveConfig("autostyle", true);
			game.saveConfig("debug", true);
			game.saveConfig("dev", true);
			if (!lib.device) {
				game.saveConfig("sync_speed", false);
			}
			game.reload();
		},
		/**
		 * 移除旁观时的手牌暗置效果
		 */
		o() {
			ui.arena.classList.remove("observe");
		},
		/**
		 * 向牌堆顶添加牌(即创建一些卡牌添加到牌堆里)
		 * @param  { ...string } list 卡牌名称数字
		 */
		pt(...list: string[]) {
			while (list.length) {
				const name = list.pop();
				if (name === undefined) {
					throw new TypeError("A card name is required when adding to the draw pile");
				}
				const card = lib.cheat.gn(name);
				if (card) {
					ui.cardPile.insertBefore(card, ui.cardPile.firstChild);
				}
			}
		},
		/**
		 * 将卡牌的样式在simple和default之间切换
		 *
		 * 有参数时改为获得指定的牌
		 *
		 * @param { ...string } args
		 */
		q(...args: string[]) {
			// if(lib.config.layout!='mobile') lib.init.layout('mobile');
			if (args.length == 0) {
				if (ui.css.card_style) {
					ui.css.card_style.remove();
				}
				if (lib.config.card_style != "simple") {
					lib.config.card_style = "simple";
					ui.css.card_style = lib.init.css(lib.assetURL + "theme/style/card", "simple");
				} else {
					lib.config.card_style = "default";
					ui.css.card_style = lib.init.css(lib.assetURL + "theme/style/card", "default");
				}
			} else {
				for (let i = 0; i < args.length; i++) {
					lib.cheat.g(args[i]);
				}
			}
			ui.arena.classList.remove("selecting");
			ui.arena.classList.remove("tempnoe");
		},
	};
}
