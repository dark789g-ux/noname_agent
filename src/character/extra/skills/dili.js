import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const diliSkills = {
	dili: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			if (player.storage.dili) {
				return false;
			}
			if (event.name != "phase") {
				return true;
			}
			if (game.phaseNumber == 0) {
				return true;
			}
			//让神山识能够获得东吴命运线
			return player.name == "key_shiki";
		},
		async content(event, trigger, player) {
			player.storage.dili = true;
			const skill = ["dili_shengzhi", "dili_chigang", "dili_qionglan", "dili_quandao", "dili_jiaohui", "dili_yuanlv"].randomGet();
			player.addSkill(skill);
			game.log(player, '解锁了<span style="font-family: yuanli">东吴命运线</span>：', "#g【" + get.translation(skill) + "】");
		},
		derivation: ["dili_shengzhi", "dili_chigang", "dili_qionglan", "dili_quandao", "dili_jiaohui", "dili_yuanlv", "gzyinghun", "hongde", "rebingyi", "xinfu_guanwei", "bizheng", "xinanguo", "shelie", "wengua", "rebotu", "rezhiheng", "jiexun", "reanxu", "xiashu", "rejieyin", "oldimeng", "xinfu_guanchao", "drlt_jueyan", "lanjiang"],
		subSkill: {
			shengzhi: {
				audio: 2,
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					var num = get.number(event.card);
					if (typeof num != "number") {
						return false;
					}
					if (num <= 1) {
						return false;
					}
					for (var i = 2; i <= Math.sqrt(num); i++) {
						if (num % i == 0) {
							return false;
						}
					}
					if (!player.storage.yuheng) {
						return false;
					}
					var list = ["gzyinghun", "hongde", "rebingyi"];
					for (var i of list) {
						if (!player.storage.yuheng.includes(i)) {
							return false;
						}
					}
					return true;
				},
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.filterPlayer(current => current != player));
				},
				init(player, skill) {
					player.markAuto("yuheng_current", ["gzyinghun", "hongde", "rebingyi"]);
				},
				mark: true,
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (arg && arg.card) {
							var num = get.number(arg.card);
							if (typeof num != "number") {
								return false;
							}
							if (num <= 1) {
								return false;
							}
							for (var i = 2; i <= Math.sqrt(num); i++) {
								if (num % i == 0) {
									return false;
								}
							}
							return true;
						}
						return false;
					},
				},
				intro: {
					name: "命运线：圣质",
					content(storage, player) {
						var finished = [],
							unfinished = ["gzyinghun", "hongde", "rebingyi"];
						if (player.storage.yuheng) {
							for (var i = 0; i < unfinished.length; i++) {
								if (player.storage.yuheng.includes(unfinished[i])) {
									finished.push(unfinished[i]);
									unfinished.splice(i--, 1);
								}
							}
						}
						var str = "";
						if (unfinished.length) {
							str += "<li>未获得：" + get.translation(unfinished) + "<br>";
						}
						if (finished.length) {
							str += "<li>已获得过：" + get.translation(finished) + "<br>";
						}
						str += "<li>锁定技。若你因〖驭衡〗获得过〖英魂〗〖弘德〗〖秉壹〗，则当你使用点数为质数的牌时，此牌不可被响应。";
						return str;
					},
				},
			},
			chigang: {
				audio: 2,
				trigger: { player: "phaseChange" },
				forced: true,
				filter(event, player) {
					if (!player.storage.yuheng?.length) {
						return false;
					}
					const list = ["xinfu_guanwei", "bizheng", "xinanguo"];
					if (list.some(skill => !player.storage.yuheng.includes(skill))) {
						return false;
					}
					return event.phaseList[event.num].indexOf("phaseJudge") != -1;
				},
				async content(event, trigger, player) {
					trigger.phaseList[trigger.num] = `phaseDraw|${event.name}`;
					await game.delayx();
				},
				init(player, skill) {
					player.markAuto("yuheng_current", ["xinfu_guanwei", "bizheng", "xinanguo"]);
				},
				ai: {
					effect: {
						target(card) {
							if (get.type(card) == "delay") {
								return "zeroplayertarget";
							}
						},
					},
				},
				mark: true,
				intro: {
					name: "命运线：持纲",
					content(storage, player) {
						var finished = [],
							unfinished = ["xinfu_guanwei", "bizheng", "xinanguo"];
						if (player.storage.yuheng) {
							for (var i = 0; i < unfinished.length; i++) {
								if (player.storage.yuheng.includes(unfinished[i])) {
									finished.push(unfinished[i]);
									unfinished.splice(i--, 1);
								}
							}
						}
						var str = "";
						if (unfinished.length) {
							str += "<li>未获得：" + get.translation(unfinished) + "<br>";
						}
						if (finished.length) {
							str += "<li>已获得过：" + get.translation(finished) + "<br>";
						}
						str += "<li>锁定技。若你因〖驭衡〗获得过〖观微〗〖弼政〗〖安国〗，则当你的判定阶段开始前，你跳过此阶段并获得一个额外的摸牌阶段。";
						return str;
					},
				},
			},
			qionglan: {
				audio: 2,
				init(player, skill) {
					player.markAuto("yuheng_current", ["shelie", "wengua", "rebotu"]);
				},
				trigger: { player: "useSkillAfter" },
				forced: true,
				limited: true,
				filter(event, player) {
					if (!player.storage.yuheng || event.skill != "yuheng") {
						return false;
					}
					var list = ["shelie", "wengua", "rebotu"];
					for (var i of list) {
						if (!player.storage.yuheng.includes(i)) {
							return false;
						}
					}
					return true;
				},
				async content(event, trigger, player) {
					player.awakenSkill(event.name);
					const list = ["dili_shengzhi", "dili_chigang", "dili_quandao", "dili_jiaohui", "dili_yuanlv"];
					const list2 = list.randomRemove(2);
					if (list2.includes("dili_quandao") && list2.includes("dili_jiaohui")) {
						list2.randomRemove(1);
						list2.push(list.randomGet());
					}
					for (const skill of list2) {
						player.addSkill(skill);
						game.log(player, '解锁了<span style="font-family: yuanli">东吴命运线</span>：', "#g【" + get.translation(skill) + "】");
					}
				},
				mark: true,
				intro: {
					name: "命运线：穹览",
					content(storage, player) {
						var finished = [],
							unfinished = ["shelie", "wengua", "rebotu"];
						if (player.storage.yuheng) {
							for (var i = 0; i < unfinished.length; i++) {
								if (player.storage.yuheng.includes(unfinished[i])) {
									finished.push(unfinished[i]);
									unfinished.splice(i--, 1);
								}
							}
						}
						var str = "";
						if (unfinished.length) {
							str += "<li>未获得：" + get.translation(unfinished) + "<br>";
						}
						if (finished.length) {
							str += "<li>已获得过：" + get.translation(finished) + "<br>";
						}
						str += '<li>锁定技，限定技。若你因〖驭衡〗获得过〖涉猎〗〖问卦〗〖博图〗，则当你发动的〖驭衡〗结算结束后，你随机获得两条其他<span style="font-family: yuanli">东吴命运线</span>。';
						return str;
					},
				},
			},
			quandao: {
				audio: 2,
				mod: {
					cardname(card, player) {
						if (player.storage.yuheng && typeof get.strNumber(card.number, false) === "string") {
							var list = ["rezhiheng", "jiexun", "reanxu"];
							for (var i of list) {
								if (!player.storage.yuheng.includes(i)) {
									return;
								}
							}
							return "tiaojiyanmei";
						}
					},
				},
				init(player, skill) {
					player.markAuto("yuheng_current", ["rezhiheng", "jiexun", "reanxu"]);
				},
				mark: true,
				intro: {
					name: "命运线：权道",
					content(storage, player) {
						var finished = [],
							unfinished = ["rezhiheng", "jiexun", "reanxu"];
						if (player.storage.yuheng) {
							for (var i = 0; i < unfinished.length; i++) {
								if (player.storage.yuheng.includes(unfinished[i])) {
									finished.push(unfinished[i]);
									unfinished.splice(i--, 1);
								}
							}
						}
						var str = "";
						if (unfinished.length) {
							str += "<li>未获得：" + get.translation(unfinished) + "<br>";
						}
						if (finished.length) {
							str += "<li>已获得过：" + get.translation(finished) + "<br>";
						}
						str += "<li>锁定技。若你因〖驭衡〗获得过〖制衡〗〖诫训〗〖安恤〗，则你手牌区内点数为字母的牌的牌名视为【调剂盐梅】。";
						return str;
					},
				},
			},
			jiaohui: {
				audio: 2,
				mod: {
					cardname(card, player) {
						if (player.countCards("h") == 1 && player.storage.yuheng) {
							var list = ["xiashu", "rejieyin", "oldimeng"];
							for (var i of list) {
								if (!player.storage.yuheng.includes(i)) {
									return;
								}
							}
							return "yuanjiao";
						}
					},
				},
				init(player, skill) {
					player.markAuto("yuheng_current", ["xiashu", "rejieyin", "oldimeng"]);
				},
				mark: true,
				intro: {
					name: "命运线：交辉",
					content(storage, player) {
						var finished = [],
							unfinished = ["xiashu", "rejieyin", "oldimeng"];
						if (player.storage.yuheng) {
							for (var i = 0; i < unfinished.length; i++) {
								if (player.storage.yuheng.includes(unfinished[i])) {
									finished.push(unfinished[i]);
									unfinished.splice(i--, 1);
								}
							}
						}
						var str = "";
						if (unfinished.length) {
							str += "<li>未获得：" + get.translation(unfinished) + "<br>";
						}
						if (finished.length) {
							str += "<li>已获得过：" + get.translation(finished) + "<br>";
						}
						str += "<li>锁定技。若你因〖驭衡〗获得过〖下书〗〖结姻〗〖缔盟〗，且你的手牌数为1，则此牌的牌名视为【远交近攻】。";
						return str;
					},
				},
			},
			yuanlv: {
				audio: 2,
				init(player, skill) {
					_status.changandajian_cardcolor = 0;
					player.markAuto("yuheng_current", ["xinfu_guanchao", "drlt_jueyan", "lanjiang"]);
				},
				trigger: { player: "useCardToTargeted" },
				forced: true,
				filter(event, player) {
					if (get.type(event.card, null, false) != "equip" || player != event.target || event.card.name.indexOf("changandajian_equip") == 0) {
						return false;
					}
					if (!player.storage.yuheng) {
						return false;
					}
					var list = ["xinfu_guanchao", "drlt_jueyan", "lanjiang"];
					for (var i of list) {
						if (!player.storage.yuheng.includes(i)) {
							return false;
						}
					}
					var type = get.subtype(event.card);
					if (lib.card["changandajian_" + type] && player.hasEquipableSlot(type)) {
						return true;
					}
					return false;
				},
				async content(event, trigger, player) {
					const cards = trigger.cards.filterInD();
					if (cards.length > 0) {
						await game.cardsDiscard(cards);
					}
					const type = get.subtype(trigger.card);
					const card = game.createCard("changandajian_" + type, _status.changandajian_cardcolor++ % 2 ? "spade" : "heart", 10);
					await player.useCard(card, player);
				},
				mark: true,
				intro: {
					name: "命运线：渊虑",
					content(storage, player) {
						var finished = [],
							unfinished = ["xinfu_guanchao", "drlt_jueyan", "lanjiang"];
						if (player.storage.yuheng) {
							for (var i = 0; i < unfinished.length; i++) {
								if (player.storage.yuheng.includes(unfinished[i])) {
									finished.push(unfinished[i]);
									unfinished.splice(i--, 1);
								}
							}
						}
						var str = "";
						if (unfinished.length) {
							str += "<li>未获得：" + get.translation(unfinished) + "<br>";
						}
						if (finished.length) {
							str += "<li>已获得过：" + get.translation(finished) + "<br>";
						}
						str += "<li>锁定技。若你因〖驭衡〗获得过〖观潮〗〖决堰〗〖澜疆〗，则当你成为自己使用的装备牌的目标后，你将此牌置于弃牌堆，然后使用一张与此装备牌副类别相同的【长安大舰】。";
						return str;
					},
				},
			},
		},
		ai: {
			combo: "yuheng",
		},
	},
};
