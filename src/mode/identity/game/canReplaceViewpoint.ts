import type { IdentityPlayerAI } from "../runtimeTypes.js";
import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createIdentityStateMethods() {
	return {
		/**
		 * 是否能在菜单中切换角色（换人）
		 *
		 * @returns {boolean}
		 */
		canReplaceViewpoint() {
			return true;
		},

		// 联机相关
		/**
		 * 联机中获取当前所有玩家的状态对象
		 */
		getState() {
			const state = {};
			for (const id in lib.playerOL) {
				const player = lib.playerOL[id];
				state[id] = { identity: player.identity };
				if (player == game.zhu) {
					state[id].zhu = true;
				}
				if (player == game.zhong) {
					state[id].zhong = true;
				}
				if (player.isZhu) {
					state[id].isZhu = true;
				}
				if (player.special_identity) {
					state[id].special_identity = player.special_identity;
				}
				state[id].shown = (player.ai as IdentityPlayerAI).shown;
				//state[i].group=player.group;
			}
			return state;
		},

		/**
		 * 联机中通过状态对象更新场上玩家的状态
		 */
		updateState(state) {
			for (const id in state) {
				const player = lib.playerOL[id];
				if (player) {
					player.identity = state[id].identity;
					if (state[id].identity == "rZhu" || state[id].identity == "bZhu") {
						game[state[id].identity] = player;
					}
					if (state[id].special_identity) {
						player.special_identity = state[id].special_identity;
						if (player.node.dieidentity) {
							player.node.dieidentity.innerHTML = get.translation(state[id].special_identity);
							(player.node.identity.firstChild! as HTMLElement).innerHTML = get.translation(state[id].special_identity + "_bg");
						}
					}
					if (state[id].zhu) {
						game.zhu = player;
					}
					if (state[id].isZhu) {
						player.isZhu = true;
					}
					if (state[id].zhong) {
						game.zhong = player;
					}
					(player.ai as IdentityPlayerAI).shown = state[id].shown;
					//player.group=state[i].group;
					//player.node.name.dataset.nature=get.groupnature(player.group);
				}
			}
		},

		/**
		 * 给“房间信息”界面填充身份模式的联机房间配置
		 */
		getRoomInfo(uiintro) {
			uiintro.add('<div class="text chat">游戏模式：' + (lib.configOL.identity_mode == "zhong" ? "明忠" : "标准"));
			uiintro.add('<div class="text chat">双将模式：' + (lib.configOL.double_character ? "开启" : "关闭"));
			if (lib.configOL.identity_mode != "zhong") {
				if (lib.configOL.identity_mode == "stratagem") {
					uiintro.add('<div class="text chat">首轮强化：' + (lib.configOL.round_one_use_fury ? "开启" : "关闭"));
				} else if (lib.configOL.identity_mode != "purple") {
					uiintro.add('<div class="text chat">双内奸：' + (lib.configOL.double_nei ? "开启" : "关闭"));
					if (lib.configOL.identity_mode != "stratagem") {
						uiintro.add(
							`<div class="text chat">加强主公：${(() => {
								switch (lib.configOL.enhance_zhu) {
									case "sixiang":
										return "四象标记";
									case "specific":
										return "专属技能";
									default:
										return "关闭";
								}
							})()}`
						);
						uiintro.add('<div class="text chat">平民身份：' + (lib.configOL.enable_commoner ? "开启" : "关闭"));
					}
					uiintro.add('<div class="text chat">年机制：' + (lib.configOL.enable_year_limit ? "开启" : "关闭"));
				}
			} else {
				uiintro.add('<div class="text chat">卡牌替换：' + (lib.configOL.zhong_card ? "开启" : "关闭"));
			}
			let last = uiintro.add('<div class="text chat">出牌时限：' + lib.configOL.choose_timeout + "秒");
			if (lib.configOL.banned.length) {
				last = uiintro.add('<div class="text chat">禁用武将：' + get.translation(lib.configOL.banned));
			}
			if (lib.configOL.bannedcards.length) {
				last = uiintro.add('<div class="text chat">禁用卡牌：' + get.translation(lib.configOL.bannedcards));
			}
			last.style.paddingBottom = "8px";
		},

		/**
		 * 获取某角色可能的身份对象
		 *
		 * @param {Player} player
		 */
		getIdentityList(player) {
			if (player.identityShown) {
				return;
			}
			if (player == game.me) {
				return;
			}
			if (_status.mode == "purple") {
				if (_status.yeconfirm && ["rNei", "bNei"].includes(game.me!.identity) && ["rNei", "bNei"].includes(player.identity)) {
					return;
				}
				if (player.identity.slice(0, 1) == "r") {
					return {
						cai2: "猜",
						rZhong: "忠",
						rNei: "内",
						rYe: "野",
					};
				}
				return {
					cai: "猜",
					bZhong: "忠",
					bNei: "内",
					bYe: "野",
				};
			} else if (_status.mode == "zhong") {
				if (player.fanfixed) {
					return;
				}
				if (game.zhu && game.zhu.isZhu) {
					return {
						fan: "反",
						zhong: "忠",
						nei: "内",
						cai: "猜",
					};
				} else {
					return {
						fan: "反",
						zhong: "忠",
						nei: "内",
						zhu: "主",
						cai: "猜",
					};
				}
			} else if (_status.mode == "stratagem") {
				if ((game.zhu && game.zhu.isZhu && game.zhu.identityShown) || game.me!.identity == "zhu") {
					return {
						fan: "反",
						zhong: "忠",
						nei: "内",
						enemy: "敌",
						friend: "友",
						cai: "猜",
					};
				} else {
					return {
						fan: "反",
						zhong: "忠",
						nei: "内",
						zhu: "主",
						enemy: "敌",
						friend: "友",
						cai: "猜",
					};
				}
			} else {
				if (get.config("enable_commoner", undefined)) {
					return {
						fan: "反",
						zhong: "忠",
						nei: "内",
						commoner: "民",
						cai: "猜",
					};
				} else {
					return {
						fan: "反",
						zhong: "忠",
						nei: "内",
						cai: "猜",
					};
				}
			}
		},

		/**
		 * 将`game.getIdentityList`返回对象的身份名变完整
		 *
		 * @param {object} list
		 * @returns {void}
		 */
		getIdentityList2(list) {
			for (let i in list) {
				switch (i) {
					case "fan":
						list[i] = "反贼";
						break;
					case "zhong":
						list[i] = "忠臣";
						break;
					case "nei":
						list[i] = "内奸";
						break;
					case "commoner":
						list[i] = "平民";
						break;
					case "zhu":
						list[i] = "主公";
						break;
					case "enemy":
						list[i] = "敌方";
						break;
					case "friend":
						list[i] = "友方";
						break;
					case "cai":
					case "cai2":
						list[i] = "未知";
						break;
					case "rZhong":
					case "bZhong":
						list[i] = "前锋";
						break;
					case "rNei":
					case "bNei":
						list[i] = "细作";
						break;
					case "rYe":
					case "bYe":
						list[i] = "野心家";
						break;
				}
			}
		},

		/**
		 * 获取当前局势生成的录像名字
		 *
		 * @returns {[playerName: string, gameName: string]}
		 */
		getVideoName() {
			let str = get.translation(game.me!.name);
			if (game.me!.name2) {
				str += "/" + get.translation(game.me!.name2);
			}
			let str2 = "";
			if (game.identityVideoName) {
				str2 = game.identityVideoName;
			} else {
				switch (_status.mode) {
					case "purple":
						str2 = "3v3v2 - " + (game.me!.identity.indexOf("r") == 0 ? "暖色" : "冷色") + lib.translate[game.me!.identity + "2"];
						break;
					case "zhong":
						str2 = "忠胆英杰 - " + lib.translate[game.me!.identity + "2"];
						break;
					case "stratagem":
						str2 = get.cnNumber(get.playerNumber()) + "人谋攻" + "-" + lib.translate[game.me!.identity + "2"];
						break;
					default:
						str2 = get.cnNumber(get.playerNumber()) + "人" + get.translation(lib.config.mode) + " - " + lib.translate[game.me!.identity + "2"];
				}
			}
			return [str, str2];
		},

		/**
		 * 为当前对局增加战绩记录
		 *
		 * @param {Boolean} bool - 当前对局是否胜利
		 */
		async addRecord(bool) {
			if (typeof bool == "boolean") {
				const data = lib.config.gameRecord.identity.data;

				let identity = game.me!.identity;
				if (identity === "mingzhong") {
					identity = "zhong";
				}
				if (!data[identity]) {
					data[identity] = [0, 0];
				}
				if (bool) {
					data[identity][0]++;
				} else {
					data[identity][1]++;
				}
				const identities = ["zhu", "zhong", "nei", "fan", "commoner"];
				let str = "";
				for (const identity of identities) {
					if (data[identity]) {
						str += lib.translate[identity + "2"] + "：" + data[identity][0] + "胜" + " " + data[identity][1] + "负<br>";
					}
				}
				lib.config.gameRecord.identity.str = str;
				await game.promises.saveConfig("gameRecord", lib.config.gameRecord);
			}
		},

		/**
		 * 公开并刷新所有玩家的身份显示。
		 *
		 * 会取消身份标记上的猜测状态，将每名玩家标记为已亮明身份，
		 * 同步其身份文案与特殊身份背景，并把主公玩家标记为 `isZhu`。
		 * 若当前存在点击猜身份的临时节点，也会一并删除并清空状态。
		 *
		 * @param {boolean} [me] - 兼容旧逻辑的保留参数，目前不会影响显示范围。
		 */
		showIdentity(me) {
			for (const player of game.players) {
				// if(me===false&&player==game.me) continue;
				player.node.identity.classList.remove("guessing");
				player.identityShown = true;
				(player.ai as IdentityPlayerAI).shown = 1;
				player.setIdentity(player.identity);
				if (player.special_identity) {
					(player.node.identity.firstChild! as HTMLElement).innerHTML = get.translation(`${player.special_identity}_bg`);
				}
				if (player.identity == "zhu") {
					player.isZhu = true;
				}
			}
			if (!_status.clickingidentity) {
				return;
			}
			for (const identityNode of _status.clickingidentity[1]) {
				identityNode.delete();
				identityNode.style.transform = "";
			}
			delete _status.clickingidentity;
		},
	};
}
