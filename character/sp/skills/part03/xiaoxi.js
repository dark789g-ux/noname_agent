import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xiaoxi" | "spmouzhu" | "spyanhuo" | "spniluan" | "spweiwu" | "tuogu" | "retuogu" | "shanzhuan" | "olxingshen">} */
export const groupSkills = {
	//曹爽，韩遂，何进
	xiaoxi: {
		audio: 2,
		audioname: ["machao", "hansui", "pangde"],
		trigger: {
			player: "enterGame",
			global: "phaseBefore",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		direct: true,
		content() {
			player.chooseUseTarget("sha", get.prompt("xiaoxi"), "视为使用一张【杀】").logSkill = "xiaoxi";
		},
	},
	spmouzhu: {
		enable: "phaseUse",
		audio: "mouzhu",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.spmouzhu.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			if (!target.countCards("h")) {
				return false;
			}
			return player != target && (target.hp == player.hp || get.distance(player, target) == 1);
		},
		selectTarget: [1, Infinity],
		async content(event, trigger, player) {
			const target = event.target;
			if (!player.isIn() || !target.countGainableCards(player, "h")) {
				return;
			}
			await target.chooseToGive(player, "h", true);
			if (!player.isIn() || player.countCards("h") <= target.countCards("h")) {
				return;
			}
			let list = ["sha", "juedou"].filter(name => target.canUse(get.autoViewAs({ name }, []), player, false)),
				result;
			if (!list.length) {
				return;
			} else if (list.length == 1) {
				result = { control: list[0] };
			} else {
				result = await target
					.chooseControl(list)
					.set("prompt", "对" + get.translation(player) + "使用一张【杀】或【决斗】。")
					.set("ai", function (event, player) {
						const target = event.player;
						return get.effect(player, { name: "sha" }, target, target) >= get.effect(player, { name: "juedou" }, target, target) ? "sha" : "juedou";
					})
					.forResult();
			}
			if (result?.control) {
				await target.useCard({ name: result.control, isCard: true }, player, "noai");
			}
		},
		ai: {
			order: 7,
			result: {
				target: -1.2,
				player(player, target) {
					if (ui.selected.targets.length) {
						return 0;
					}
					if (target.countCards("h") - player.countCards("h") > 1) {
						return 1;
					}
					if (get.damageEffect(target, player, player, player) > 0) {
						return 1;
					}
					if (player.hp > 3 || (player.countCards("h", "sha") && player.countCards("h", "shan"))) {
						return 0;
					}
					if (player.hp > 2) {
						return -1.1;
					}
					return -2;
				},
			},
		},
	},
	spyanhuo: {
		audio: "yanhuo",
		trigger: { player: "die" },
		forceDie: true,
		skillAnimation: true,
		animationColor: "soil",
		content() {
			player.line(game.players, "green");
			game.addGlobalSkill("spyanhuo_damage");
			game.broadcastAll(() => {
				if (!_status.yanhuo) {
					_status.yanhuo = 0;
				}
				_status.yanhuo++;
			});
		},
		subSkill: {
			damage: {
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					return event.card.name == "sha";
				},
				content() {
					trigger.baseDamage += _status.yanhuo || 0;
				},
			},
		},
	},
	spniluan: {
		enable: "phaseUse",
		audio: "niluan",
		viewAs: { name: "sha" },
		check(card) {
			return 5.1 - get.value(card);
		},
		filterCard: { color: "black" },
		position: "hes",
		viewAsFilter(player) {
			return player.countCards("hes", lib.skill.spniluan.filterCard) > 0;
		},
		group: "spniluan_clear",
		subSkill: {
			clear: {
				trigger: { player: "useCardAfter" },
				forced: true,
				silent: true,
				charlotte: true,
				filter(event, player) {
					return event.skill == "spniluan" && event.addCount !== false && player.getHistory("sourceDamage", card => card.card == event.card).length == 0;
				},
				content() {
					trigger.addCount = false;
					if (player.stat[player.stat.length - 1].card.sha > 0) {
						player.stat[player.stat.length - 1].card.sha--;
					}
				},
			},
		},
	},
	spweiwu: {
		audio: 2,
		locked: false,
		enable: "phaseUse",
		usable: 1,
		viewAs: {
			name: "shunshou",
			storage: { spweiwu: true },
		},
		filterCard: { color: "red" },
		position: "hes",
		check(card) {
			return 7 - get.value(card);
		},
		mod: {
			targetInRange(card) {
				if (card.storage && card.storage.spweiwu) {
					return true;
				}
			},
		},
	},
	tuogu: {
		audio: 2,
		trigger: { global: "die" },
		filter(event, player) {
			return (
				event.player.getStockSkills("仲村由理", "天下第一").filter(function (skill) {
					var info = get.info(skill);
					return info && !info.juexingji && !info.hiddenSkill && !info.zhuSkill && !info.charlotte && !info.limited && !info.dutySkill;
				}).length > 0
			);
		},
		logTarget: "player",
		skillAnimation: true,
		limited: true,
		animationColor: "thunder",
		content() {
			"step 0";
			player.awakenSkill(event.name);
			var list = trigger.player.getStockSkills("仲村由理", "天下第一").filter(function (skill) {
				var info = get.info(skill);
				return info && !info.juexingji && !info.hiddenSkill && !info.zhuSkill && !info.charlotte && !info.limited && !info.dutySkill;
			});
			if (list.length == 1) {
				event._result = { control: list[0] };
			} else {
				trigger.player
					.chooseControl(list)
					.set("prompt", "选择令" + get.translation(player) + "获得一个技能")
					.set("forceDie", true)
					.set("ai", function () {
						return list.randomGet();
					});
			}
			"step 1";
			player.addSkills(result.control);
			game.broadcastAll(function (skill) {
				var list = [skill];
				game.expandSkills(list);
				for (var i of list) {
					var info = lib.skill[i];
					if (!info) {
						continue;
					}
					if (!info.audioname2) {
						info.audioname2 = {};
					}
					info.audioname2.caoshuang = "tuogu";
				}
			}, result.control);
		},
	},
	retuogu: {
		audio: "tuogu",
		trigger: { global: "die" },
		filter(event, player) {
			return (
				event.player.getStockSkills("仲村由理", "天下第一").filter(function (skill) {
					var info = get.info(skill);
					return info && !info.juexingji && !info.hiddenSkill && !info.zhuSkill && !info.charlotte && !info.limited && !info.dutySkill;
				}).length > 0
			);
		},
		logTarget: "player",
		check(event, player) {
			var list = event.player.getStockSkills("仲村由理", "天下第一").filter(function (skill) {
				var info = get.info(skill);
				return info && !info.juexingji && !info.hiddenSkill && !info.zhuSkill && !info.charlotte && !info.limited && !info.dutySkill;
			});
			var negSkill = list.some(function (skill) {
				return get.skillRank(skill, "inout") <= 0;
			});
			var att = get.sgnAttitude(event.player, player);
			if (!player.storage.retuogu) {
				if (negSkill && att < 0) {
					return false;
				}
				return true;
			}
			list.sort(function (a, b) {
				return att * (get.skillRank(b, "inout") - get.skillRank(a, "inout"));
			})[0];
			return get.skillRank(list[0], "inout") >= get.skillRank(player.storage.retuogu, "inout");
		},
		content() {
			"step 0";
			var list = trigger.player.getStockSkills("仲村由理", "天下第一").filter(function (skill) {
				var info = get.info(skill);
				return info && !info.juexingji && !info.hiddenSkill && !info.zhuSkill && !info.charlotte && !info.limited && !info.dutySkill;
			});
			if (list.length == 1) {
				event._result = { control: list[0] };
			} else {
				trigger.player
					.chooseControl(list)
					.set("prompt", "选择令" + get.translation(player) + "获得一个技能")
					.set("forceDie", true)
					.set("ai", function () {
						var att = get.sgnAttitude(_status.event.getTrigger().player, player);
						if (att == 0) {
							return list.randomGet();
						}
						var listx = list
							.map(function (skill) {
								return [skill, get.skillRank(skill, "inout")];
							})
							.sort(function (a, b) {
								return att * (b[1] - a[1]);
							})
							.slice(0, 2);
						var listx2 = [0];
						if (Math.abs(listx[0][1] - listx[1][1]) <= 0.5 && Math.sign(listx[0][1]) == Math.sign(listx[1][1])) {
							listx2.push(1);
						}
						return listx[listx2.randomGet()][0];
					});
			}
			"step 1";
			if (player.storage.retuogu) {
				player.removeSkill(player.storage.retuogu);
			}
			player.storage.retuogu = result.control;
			player.markSkill("retuogu");
			player.addSkills(result.control);
			game.broadcastAll(function (skill) {
				var list = [skill];
				game.expandSkills(list);
				for (var i of list) {
					var info = lib.skill[i];
					if (!info) {
						continue;
					}
					if (!info.audioname2) {
						info.audioname2 = {};
					}
					info.audioname2.caoshuang = "tuogu";
				}
			}, result.control);
		},
		mark: true,
		intro: { content: "当前托孤技能：$" },
	},
	shanzhuan: {
		trigger: { source: "damageSource" },
		audio: 2,
		direct: true,
		filter(event, player) {
			return player != event.player && !event.player.isDisabledJudge() && event.player.countCards("he") && !event.player.countCards("j", card => get.type(card.viewAs || card.name) == "delay");
		},
		content() {
			"step 0";
			player.choosePlayerCard(trigger.player, "he", get.prompt("shanzhuan", trigger.player)).set("ai", function (card) {
				if (get.attitude(_status.event.player, _status.event.target) >= 0) {
					return 0;
				}
				return get.buttonValue(card);
			});
			"step 1";
			if (result.bool) {
				player.logSkill("shanzhuan", trigger.player);
				var card = result.cards[0];
				trigger.player.$throw(card);
				game.delayx();
				if (get.type(card, null, false) == "delay") {
					trigger.player.addJudge(card);
				} else {
					trigger.player.addJudge({ name: get.color(card, false) == "red" ? "lebu" : "bingliang" }, result.cards);
				}
			}
		},
		group: "shanzhuan_draw",
		subfrequent: ["draw"],
		subSkill: {
			draw: {
				audio: "shanzhuan",
				trigger: { player: "phaseJieshuBegin" },
				frequent: true,
				prompt: "是否发动【擅专】摸一张牌？",
				filter(event, player) {
					return !player.getHistory("sourceDamage").length;
				},
				content() {
					player.draw();
				},
			},
		},
	},
	olxingshen: {
		trigger: { player: "damageEnd" },
		frequent: true,
		audio: "xingshen",
		async content(event, trigger, player) {
			const next = player.draw();
			if (get.isLuckyStar(player) || Math.random() < 0.5) {
				next.num = 2;
			}
			const num = player.countMark("olxingshen");
			if (num < 6) {
				player.addMark("olxingshen", Math.min(6 - num, player.getDamagedHp()), false);
			}
			await next;
		},
		intro: {
			content: "下一次发动〖严教〗时多展示X张牌",
		},
	},
};
