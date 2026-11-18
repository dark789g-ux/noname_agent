import type { IdentityPlayerAI } from "../runtimeTypes.js";
import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createStart() {
	return [
		async (event, trigger, player) => {
			if (!lib.config.new_tutorial) {
				ui.arena.classList.add("only_dialog");
			}
			_status.mode = get.config("identity_mode", undefined);
			if (_status.brawl && _status.brawl.submode) {
				_status.mode = _status.brawl.submode;
			}
			event.replacePile = () => {
				const list = ["shengdong", "qijia", "caomu", "jinchan", "zengbin", "fulei", "qibaodao", "zhungangshuo", "lanyinjia"];
				const map = {
					shunshou: "shengdong",
					jiedao: "qijia",
					bingliang: "caomu",
					wuxie: "jinchan",
					wuzhong: "zengbin",
					wugu: "zengbin",
					shandian: "fulei",
					qinggang: "qibaodao",
					qinglong: "zhungangshuo",
					bagua: "lanyinjia",
				};
				lib.card.list = lib.card.list.filter(cardInfo => list.includes(cardInfo[2]));
				for (const cardInfo of lib.card.list) {
					if (map[name as unknown as string]) {
						cardInfo[2] = map[name as unknown as string];
						cardInfo._replaced = true;
					}
				}
			};
		},
		async (event, trigger, player) => {
			const playback = localStorage.getItem(lib.configprefix + "playback");
			if (playback) {
				ui.create.me();
				ui.arena.style.display = "none";
				ui.system.style.display = "none";
				_status.playback = playback;
				localStorage.removeItem(lib.configprefix + "playback");
				game.getDB("video", parseInt(playback), function (video) {
					if (video) {
						game.playVideoContent(video.video);
					} else {
						alert("播放失败：找不到录像");
						game.reload();
					}
				});
				event.finish();
			} else if (!_status.connectMode) {
				if (_status.mode == "zhong") {
					if (get.config("zhong_card", undefined)) {
						event.replacePile();
					}
					game.prepareArena(8);
				} else if (_status.mode == "purple") {
					game.prepareArena(8);
				} else {
					game.prepareArena();
				}
				if (!lib.config.new_tutorial) {
					game.delay();
				}
			}
		},
		async (event, trigger, player) => {
			if (lib.config.new_tutorial) {
				if (!_status.connectMode) {
					game.showChangeLog();
				}
				return;
			}

			_status.new_tutorial = true;
			lib.init.onfree();
			game.saveConfig("version", lib.version);

			await game.promises.saveConfig("new_tutorial", true);
			ui.create.dialog("欢迎来到无名杀，是否进入新手向导？");
			ui.dialog.add('<div class="text center">跳过后，你可以在选项-其它中重置新手向导');
			ui.auto.hide();

			const { promise, resolve } = Promise.withResolvers();

			ui.create.control("跳过向导", () => resolve(true));
			ui.create.control("继续", () => resolve(false));

			const skip_tutorial = await promise;

			if (!skip_tutorial) {
				await tutorial();
			}

			clear();
			ui.auto.show();
			ui.arena.classList.remove("only_dialog");

			async function tutorial() {
				if (!lib.config.phonelayout) {
					clear();
					ui.create.dialog("如果你在使用手机，可能会觉得按钮有点小" + "，将布局改成移动可以使按钮变大");
					ui.dialog.add('<div class="text center">你可以在选项-外观-布局中更改此设置');
					ui.create.control("使用移动布局", () => {
						if (lib.config.phonelayout) {
							(ui.control.firstChild!.firstChild! as HTMLElement).innerHTML = "使用移动布局";
							game.saveConfig("phonelayout", false);
							lib.init.layout("mobile");
						} else {
							(ui.control.firstChild!.firstChild! as HTMLElement).innerHTML = "使用默认布局";
							game.saveConfig("phonelayout", true);
							lib.init.layout("mobile");
						}
					});
					await new Promise(resolve => ui.create.control("继续", resolve));
				}

				if (lib.config.touchscreen) {
					clear();
					ui.create.dialog("触屏模式中，下划可以显示菜单，上划可以切换托管，双指单击可以暂停");
					ui.dialog.add('<div class="text center">你可以在选项-通用-中更改手势设置');
					await new Promise(resolve => ui.create.control("继续", resolve));
				}

				clear();
				ui.window.classList.add("noclick_important");
				ui.click.configMenu();
				ui.control.classList.add("noclick_click_important");
				ui.control.style.top = "calc(100% - 105px)";
				await new Promise(resolve => ui.create.control("在菜单中，可以进行各项设置", resolve));
				ui.click.menuTab("选项");
				await new Promise(resolve => ui.controls[0].replace("如果你感到游戏较卡，可以开启流畅模式", resolve));
				await new Promise(resolve => ui.controls[0].replace("在技能一栏中，可以设置自动发动或双将禁配的技能", resolve));
				ui.click.menuTab("武将");
				await new Promise(resolve => ui.controls[0].replace("在武将或卡牌一栏中，单击武将/卡牌可以将其禁用", resolve));
				ui.click.menuTab("其它");
				await new Promise(resolve => ui.controls[0].replace("在其它的关于一栏中，可以检查更新和下载素材", resolve));
				await new Promise(resolve => ui.controls[0].replace("在控制/命令一栏中，可以执行一些常见的操作/输入游戏命令", resolve));
				await new Promise(resolve => ui.controls[0].replace("在录像一栏中，可以管理游戏录像", resolve));
				ui.click.configMenu();
				ui.window.classList.remove("noclick_important");
				ui.control.classList.remove("noclick_click_important");
				ui.control.style.top = "";

				clear();
				ui.create.dialog("如果还有问题，欢迎来到无名杀仓库交流");
				ui.dialog.add(html`
					<div class="text center">
						无名杀仓库地址: https://github.com/libnoname/noname
						<br />
						提交BUG/发表意见: https://github.com/libnoname/noname/issues
						<br />
						讨论/提问/吹水: https://github.com/libnoname/noname/discussions
					</div>
				`);
				await new Promise(resolve => ui.create.control("完成", resolve));
			}

			function clear() {
				ui.dialog.close();
				while (ui.controls.length) {
					ui.controls[0].close();
				}
			}
		},
		async (event, trigger, player) => {
			if (typeof _status.new_tutorial == "function") {
				_status.new_tutorial();
			}
			delete _status.new_tutorial;
			if (_status.connectMode) {
				game.waitForPlayer(() => {
					if (lib.configOL.identity_mode == "zhong" || lib.configOL.identity_mode == "purple") {
						lib.configOL.number = 8;
					}
				});
			}
		},
		async (event, trigger, player) => {
			const yearLimitCheck = () => {
				const next = game.createEvent("year_limit_pop", false);
				next.setContent(async (event, trigger, player) => {
					const str = get.cnNumber(game.shuffleNumber + 1, true);
					game.me!.$fullscreenpop(`第${str}年`, "thunder");
					game.log("游戏进入了", `#y第${str}年`);
					if (game.shuffleNumber + 1 < game.countPlayer2()) {
						return;
					} else {
						await game.delay(2);
					}
					game.me!.$fullscreenpop("年份已到", "metal");
					game.log("年份已到，主忠方判定为胜利");
					await game.delay(2);
					game.over(game.me!.identity == "zhu" || game.me!.identity == "zhong" || game.me!.identity == "mingzhong" || (game.me!.identity == "commoner" && game.me!.isIn()));
				});
			};
			if (_status.connectMode) {
				_status.mode = lib.configOL.identity_mode;
				if (_status.mode == "zhong") {
					lib.configOL.number = 8;
					if (lib.configOL.zhong_card) {
						event.replacePile();
					}
				} else if (_status.mode == "purple") {
					lib.configOL.number = 8;
				} else if (_status.mode == "normal") {
					if (lib.configOL.enable_commoner || lib.configOL.double_nei) {
						const identity = lib.configOL.enable_commoner ? "commoner" : "nei";
						for (const list of lib.config.mode_config.identity.identity.slice(1)) {
							let toReplace;
							if (list.filter(role => role == "nei").length >= 2) {
								toReplace = "nei";
							} else if (list.filter(role => role == "zhong").length > list.filter(role => role == "fan").length / 2) {
								toReplace = "zhong";
							} else {
								toReplace = "fan";
							}
							list.remove(toReplace);
							list.push(identity);
						}
						game.broadcast(identityList => (lib.config.mode_config.identity.identity = identityList), lib.config.mode_config.identity.identity);
					}
				}
				if (lib.configOL.number < 2) {
					lib.configOL.number = 2;
				}
				if (_status.mode != "purple" && lib.configOL.enable_year_limit) {
					lib.onwash.push(yearLimitCheck);
				}
				game.randomMapOL();
			} else {
				if (_status.mode == "normal" && (get.config("enable_commoner", undefined) || get.config("double_nei", undefined))) {
					const identity = get.config("enable_commoner", undefined) ? "commoner" : "nei";
					for (const list of lib.config.mode_config.identity.identity.slice(1)) {
						let toReplace;
						if (list.filter(role => role == "nei").length >= 2) {
							toReplace = "nei";
						} else if (list.filter(role => role == "zhong").length > list.filter(role => role == "fan").length / 2) {
							toReplace = "zhong";
						} else {
							toReplace = "fan";
						}
						list.remove(toReplace);
						list.push(identity);
					}
				}
				if (_status.mode != "purple" && get.config("enable_year_limit", undefined)) {
					lib.onwash.push(yearLimitCheck);
				}
				for (const current of game.players) {
					current.getId();
				}
				if (_status.brawl && _status.brawl.chooseCharacterBefore) {
					_status.brawl.chooseCharacterBefore();
				}
				game.chooseCharacter();
			}
		},
		async (event, trigger, player) => {
			if (ui.coin) {
				_status.coinCoeff = get.coinCoeff([game.me!.name]);
			}
			if (game.players.length == 2) {
				game.showIdentity!(true);
				const map = {};
				for (const id in lib.playerOL) {
					map[id] = lib.playerOL[id].identity;
				}
				game.broadcast(map => {
					for (const id in map) {
						lib.playerOL[id].identity = map[id];
						lib.playerOL[id].setIdentity();
						lib.playerOL[id].ai.shown = 1;
					}
				}, map);
			} else {
				for (const current of game.players) {
					(current.ai as IdentityPlayerAI).shown = 0;
				}
			}
			const stratagemMode = _status.mode == "stratagem";
			if (stratagemMode) {
				let beginner;
				if (_status.cheat_seat) {
					const seat = _status.cheat_seat.link;
					beginner = seat == 0 ? game.me : game.players[game.players.length - seat];
					if (!beginner) {
						beginner = game.me;
					}
					delete _status.cheat_seat;
				} else {
					beginner = game.players[Math.floor(Math.random() * game.players.length)];
				}
				event.beginner = beginner;

				const stratagemBroadcast = () => {
					_status.stratagemFuryMax = 3;
					ui.css.stratagemCardStyle = lib.init.sheet([".card.stratagem-fury-glow:before{", "opacity:0.2;", "box-shadow:rgba(0,0,0,0.2) 0 0 0 1px,rgb(255,109,12) 0 0 5px,rgb(255,0,0) 0 0 10px;", "background-color:yellow;", "-webkit-filter:blur(5px);", "filter:blur(5px);", "}"].join(""));
				};
				game.broadcastAll(stratagemBroadcast);
				if (_status.connectMode && !_status.postReconnect.stratagemReinit) {
					_status.postReconnect.stratagemReinit = [stratagemBroadcast, {}];
				}
				for (const current of game.players) {
					if (current.identity == "zhu") {
						current.addSkill("stratagem_monarchy");
					}
					if (current.identity == "fan") {
						current.addSkill("stratagem_revitalization");
					}
				}
			}
			if (game.zhu == game.me && game.zhu.identity != "zhu" && _status.brawl && _status.brawl.identityShown) {
				delete (game as { zhu?: Player }).zhu;
			} else {
				if (!stratagemMode) {
					(game.zhu.ai as IdentityPlayerAI).shown = 1;
				}
				if (game.zhu2) {
					game.zhong = game.zhu;
					game.zhu = game.zhu2;
					delete game.zhu2;
					if (game.zhong.sex == "male" && game.zhong.maxHp! <= 4) {
						game.zhong.addSkill("dongcha");
					} else {
						game.zhong.addSkill("sheshen");
					}
				}
				let enhance_zhu: boolean | string = !["zhong", "stratagem", "purple"].includes(_status.mode!),
					skill;
				if (enhance_zhu) {
					if (_status.connectMode) {
						enhance_zhu = lib.configOL.enhance_zhu;
					} else {
						enhance_zhu = get.config("enhance_zhu", undefined);
					}
				}
				if (enhance_zhu === "sixiang") {
					skill = "sixiang_" + ["zhuque", "xuanwu", "qinglong", "baihu"].randomGet();
				} else if (enhance_zhu === "specific" && get.population("fan") >= 3) {
					switch (game.zhu.name) {
						case "key_yuri":
							skill = "buqu";
							break;
						case "liubei":
							skill = "jizhen";
							break;
						case "dongzhuo":
							skill = "hengzheng";
							break;
						case "sunquan":
							skill = "batu"; // 英雄杀技能
							break;
						case "sp_zhangjiao":
							skill = "tiangong";
							break;
						case "liushan":
							skill = "shengxi";
							break;
						/** 玩点论杀技能 */
						case "sunce":
							skill = "ciqiu";
							break;
						case "re_sunben":
							skill = "ciqiu";
							break;
						case "yuanshao":
							skill = "geju";
							break;
						case "re_caocao":
							skill = "dangping"; // 古剑奇谭技能
							break;
						case "caopi":
							skill = "junxing";
							break;
						case "liuxie":
							skill = "moukui";
							break;
						default:
							skill = "tianming";
							break;
					}
				}
				if (skill) {
					game.broadcastAll(
						(player, skill) => {
							player.addSkill(skill);
							player.storage.enhance_zhu = skill;
						},
						game.zhu,
						skill
					);
				}
				let enable_mingcha;
				if (_status.connectMode) {
					enable_mingcha = lib.configOL.enable_mingcha;
				} else {
					enable_mingcha = get.config("enable_mingcha", undefined);
				}
				if (enable_mingcha) {
					game.broadcastAll(player => {
						player.addSkill("identity_mingcha");
					}, game.zhu);
				}
			}
			game.syncState();
			event.trigger("gameStart");

			const players = get.players(lib.sort.position);
			const info: any[] = [];
			for (const [index, current] of players.entries()) {
				const ifo: { name?: string; name2?: string; identity: string; nickname: string; translate?: unknown; isCamouflaged?: boolean } = {
					name: current.name1,
					name2: current.name2,
					identity: current.identity,
					nickname: current.node.nameol.innerHTML,
				};
				if (stratagemMode) {
					ifo.translate = lib.translate[game.players[index].name!];
					ifo.isCamouflaged = (current.ai as IdentityPlayerAI).stratagemCamouflage;
				}
				info.push(ifo);
			}
			_status.videoInited = true;
			game.addVideo("init", null, info);
			if (stratagemMode) {
				game.addVideo("arrangeLib", null, {
					skill: {
						stratagem_fury: {
							mark: true,
							marktext: "🔥",
							intro: {
								name: "怒气",
								content: "当前怒气值：#",
							},
						},
					},
				});
				for (const current of game.players) {
					//game.addVideo('markSkill', current, ['stratagem_fury']);
					(current.ai as IdentityPlayerAI).shown = 0;
				}
				game.stratagemCamouflage();
			}
		},
		async (event, trigger, player) => {
			if (_status.mode != "stratagem") {
				event.beginner = _status.firstAct2 || game.zhong || game.zhu || _status.firstAct || game.me;
			}
			game.gameDraw(event.beginner, player => {
				if (_status.mode == "purple" && player.seatNum > 5) {
					return 5;
				}
				return 4;
			});
			if (_status.connectMode && lib.configOL.change_card) {
				game.replaceHandcards(game.players.slice(0));
			}
		},
		async (event, trigger, player) => {
			game.phaseLoop(event.beginner);
		},
	];
}
