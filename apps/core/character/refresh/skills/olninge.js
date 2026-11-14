import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const olningeSkills = {
	olninge: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			if (player != event.player && player != event.source) {
				return false;
			}
			return event.player.getHistory("damage").indexOf(event) == 1;
		},
		logTarget: "player",
		forced: true,
		async content(event, trigger, player) {
			await player.draw();
			await player.discardPlayerCard(trigger.player, true, "ej");
		},
	},
	//群太史慈
	rejixu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hp > 0 && player.countCards("h") > 0;
		},
		filterTarget: lib.filter.notMe,
		selectTarget() {
			return [1, _status.event.player.hp];
		},
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const { targets } = event;
			if (!event.caicuolist) {
				event.caicuolist = [];
			}
			for (const target of targets) {
				const result = await target
					.chooseBool("是否押杀？")
					.set("ai", function () {
						const evt = _status.event.getParent(),
							player = get.player();
						if (get.attitude(player, evt.player) > 0) {
							return evt.player.countCards("h", "sha") ? false : true;
						}
						if (
							evt.player.hasKnownCards(target, c => {
								return c.name == "sha";
							})
						) {
							return true;
						}
						return Math.random() < evt.player.countCards("h") / 4;
					})
					.forResult();
				if (!result) {
					continue;
				}
				if (result.bool) {
					target.chat("有杀");
					game.log(target, "认为", player, "#g有杀");
					if (!player.countCards("h", "sha")) {
						event.caicuolist.add(target);
					}
				} else {
					target.chat("没杀");
					game.log(target, "认为", player, "#y没有杀");
					if (player.countCards("h", "sha")) {
						event.caicuolist.add(target);
					}
				}
			}
			player.popup(player.countCards("h", "sha") ? "有杀" : "没杀");
			game.log(player, player.countCards("h", "sha") ? "有杀" : "没杀");
			if (event.caicuolist.length > 0) {
				if (player.countCards("h", "sha")) {
					player.markAuto("rejixu_sha", event.caicuolist);
					player.addTempSkill("rejixu_sha", "phaseUseAfter");
				} else {
					for (const target of event.caicuolist) {
						if (target.countDiscardableCards(player, "he") > 0) {
							player.line(target);
							await player.discardPlayerCard(true, "he", target);
						}
					}
				}
				await player.draw(event.caicuolist.length);
			}
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) + 0.6;
			},
			result: {
				target(player, target) {
					if (player.countCards("h", "sha")) {
						return get.effect(target, { name: "sha" }, player, target);
					} else {
						return get.effect(target, { name: "guohe_copy2" }, player, target);
					}
				},
			},
			expose: 0.4,
		},
		subSkill: {
			sha: {
				audio: "rejixu",
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.getStorage("rejixu_sha").length;
						}
					},
				},
				charlotte: true,
				onremove: true,
				trigger: { player: "useCard2" },
				filter(event, player) {
					if (event.card.name != "sha") {
						return false;
					}
					for (var target of player.getStorage("rejixu_sha")) {
						if (event.targets.includes(target) || !target.isIn()) {
							return false;
						}
						if (lib.filter.targetEnabled2(event.card, player, target)) {
							return true;
						}
					}
					return false;
				},
				prompt: "是否发动【击虚】？",
				prompt2(event, player) {
					var list = player.getStorage("rejixu_sha").filter(function (target) {
						if (event.targets.includes(target) || !target.isIn()) {
							return false;
						}
						return lib.filter.targetEnabled2(event.card, player, target);
					});
					return "令" + get.translation(list) + "也成为" + get.translation(event.card) + "的目标";
				},
				logTarget(event, player) {
					return player.getStorage("rejixu_sha").filter(function (target) {
						if (event.targets.includes(target) || !target.isIn()) {
							return false;
						}
						return lib.filter.targetEnabled2(event.card, player, target);
					});
				},
				check(event, player) {
					var eff = 0;
					var list = player.getStorage("rejixu_sha").filter(function (target) {
						if (event.targets.includes(target) || !target.isIn()) {
							return false;
						}
						return lib.filter.targetEnabled2(event.card, player, target);
					});
					for (var i of list) {
						eff += get.effect(i, event.card, player, player);
					}
					return eff > 0;
				},
				async content(event, trigger, player) {
					const list = player.getStorage("rejixu_sha").filter(target => {
						if (trigger.targets.includes(target) || !target.isIn()) {
							return false;
						}
						return lib.filter.targetEnabled2(trigger.card, player, target);
					});
					if (list.length > 0) {
						trigger.targets.addArray(list);
						game.log(list, "也成为了", trigger.card, "的目标");
					}
				},
			},
		},
	},
	//界刘封
	rexiansi: {
		inherit: "xiansi",
		audio: "xiansi",
		audioname: ["re_liufeng"],
		group: ["rexiansi2", "xiansix"],
	},
	rexiansi2: {
		enable: "chooseToUse",
		sourceSkill: "rexiansi",
		filter(event, player) {
			return player.getExpansions("xiansi").length > Math.max(0, player.hp) && event.filterCard({ name: "sha", isCard: true }, player, event);
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("陷嗣", player.getExpansions("xiansi"), "hidden");
			},
			backup(links, player) {
				return {
					viewAs: { name: "sha", isCard: true },
					filterCard: () => false,
					selectCard: -1,
					card: links[0],
					log: false,
					async precontent(event, trigger, player) {
						player.logSkill("rexiansi");
						await player.loseToDiscardpile(lib.skill.rexiansi2_backup.card);
					},
				};
			},
			prompt: () => "请选择【杀】的目标",
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) + 0.6;
			},
			result: { player: 1 },
		},
	},
	//界荀彧
	oljieming: {
		audio: 2,
		audioname2: { sxrm_caocao: "oljieming_sxrm_caocao" },
		trigger: { player: ["damageEnd", "die"] },
		forceDie: true,
		filter(event, player) {
			if (event.name == "die") {
				return true;
			}
			return player.isIn() && event.num > 0;
		},
		getIndex(event) {
			return event.num || 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.maxHp > 0;
				})
				.set("ai", target => {
					const player = get.player();
					let att = get.attitude(player, target);
					let draw = Math.min(5, target.maxHp) - target.countCards("h");
					if (draw >= 0) {
						if (target.hasSkillTag("nogain")) {
							att /= 6;
						}
						if (att > 2) {
							return Math.sqrt(draw + 1) * att;
						}
						return att / 3;
					}
					if (draw < -1) {
						if (target.hasSkillTag("nogain")) {
							att *= 6;
						}
						if (att < -2) {
							return -Math.sqrt(1 - draw) * att;
						}
					}
					return 0;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			await target.draw(Math.min(5, target.maxHp));
			let num = target.countCards("h") - Math.min(5, target.maxHp);
			if (num > 0) {
				await target.chooseToDiscard("h", true, num, "allowChooseAll");
			}
		},
		ai: {
			expose: 0.2,
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "damage") && target.hp > 1) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						var max = 0;
						var players = game.filterPlayer();
						for (var i = 0; i < players.length; i++) {
							if (get.attitude(target, players[i]) > 0) {
								max = Math.max(Math.min(5, players[i].hp) - players[i].countCards("h"), max);
							}
						}
						switch (max) {
							case 0:
								return 2;
							case 1:
								return 1.5;
							case 2:
								return [1, 2];
							default:
								return [0, max];
						}
					}
					if ((card.name == "tao" || card.name == "caoyao") && target.hp > 1 && target.countCards("h") <= target.hp) {
						return [0, 0];
					}
				},
			},
		},
	},
	//OL华雄
	shizhan: {
		selectionSpec: true,
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filterTarget(card, player, target) {
			return target != player && target.canUse("juedou", player);
		},
		async content(event, trigger, player) {
			await event.target.useCard({ name: "juedou", isCard: true }, player, "noai");
		},
		ai: {
			order: 2,
			result: {
				player(player, target) {
					return get.effect(player, { name: "juedou", isCard: true }, target, player);
				},
			},
		},
	},
	//刘谌
	rezhanjue: {
		audio: 2,
		enable: "phaseUse",
		filterCard(card) {
			return !card.hasGaintag("reqinwang");
		},
		selectCard: -1,
		position: "h",
		filter(event, player) {
			var stat = player.getStat().skill;
			if (stat.rezhanjue_draw && stat.rezhanjue_draw >= 3) {
				return false;
			}
			var hs = player.getCards("h", function (card) {
				return !card.hasGaintag("reqinwang");
			});
			if (!hs.length) {
				return false;
			}
			for (var i = 0; i < hs.length; i++) {
				var mod2 = game.checkMod(hs[i], player, "unchanged", "cardEnabled2", player);
				if (mod2 === false) {
					return false;
				}
			}
			return event.filterCard(get.autoViewAs({ name: "juedou" }, hs));
		},
		viewAs: { name: "juedou" },
		onuse(links, player) {
			player.addTempSkill("rezhanjue_effect", "phaseUseEnd");
		},
		ai: {
			order(item, player) {
				if (player.countCards("h") > 1) {
					return 0.8;
				}
				return 8;
			},
			tag: {
				respond: 2,
				respondSha: 2,
				damage: 1,
			},
			result: {
				player(player, target) {
					let td = get.damageEffect(target, player, target);
					if (!td) {
						return 0;
					}
					let hs = player.getCards("h"),
						val = hs.reduce((acc, i) => acc - get.value(i, player), 0) / 6 + 1;
					if (td > 0) {
						return val;
					}
					if (
						player.hasSkillTag("directHit_ai", true, {
							target: target,
							card: get.autoViewAs({ name: "juedou" }, hs),
						})
					) {
						return val;
					}
					let pd = get.damageEffect(player, target, player),
						att = get.attitude(player, target);
					if (att > 0 && get.damageEffect(target, player, player) > pd) {
						return val;
					}
					let ts = target.mayHaveSha(player, "respond", null, "count");
					if (ts < 1 && ts * 8 < Math.pow(player.hp, 2)) {
						return val;
					}
					let damage = pd / get.attitude(player, player),
						ps = player.mayHaveSha(player, "respond", hs, "count");
					if (att > 0) {
						if (ts < 1) {
							return val;
						}
						return val + damage + 1;
					}
					if (pd >= 0) {
						return val + damage + 1;
					}
					if (ts - ps + Math.exp(0.8 - player.hp) < 1) {
						return val - ts;
					}
					return val + damage + 1 - ts;
				},
				target(player, target) {
					let td = get.damageEffect(target, player, target) / get.attitude(target, target);
					if (!td) {
						return 0;
					}
					let hs = player.getCards("h");
					if (
						td > 0 ||
						player.hasSkillTag("directHit_ai", true, {
							target: target,
							card: get.autoViewAs({ name: "juedou" }, hs),
						})
					) {
						return td + 1;
					}
					let pd = get.damageEffect(player, target, player),
						att = get.attitude(player, target);
					if (att > 0) {
						return td + 1;
					}
					let ts = target.mayHaveSha(player, "respond", null, "count"),
						ps = player.mayHaveSha(player, "respond", hs, "count");
					if (ts < 1) {
						return td + 1;
					}
					if (pd >= 0) {
						return 0;
					}
					if (ts - ps < 1) {
						return td + 1 - ts;
					}
					return -ts;
				},
			},
			nokeep: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "nokeep") {
					return (
						(!arg || (arg.card && get.name(arg.card) === "tao")) &&
						player.isPhaseUsing() &&
						get.skillCount("rezhanjue_draw", player) < 3 &&
						player.hasCard(card => {
							return get.name(card) !== "tao" && !card.hasGaintag("reqinwang");
						}, "h")
					);
				}
			},
		},
	},
};
