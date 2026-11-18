import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanqiuxin" | "clanjianyuan" | "clanjiejian" | "clanhuanghan">} */
export const groupSkills = {
	//族王沦
	clanqiuxin: {
		audio: 2,
		enable: "phaseUse",
		filterTarget: lib.filter.notMe,
		usable: 1,
		async content(event, trigger, player) {
			const { target } = event;
			const str = get.translation(player);
			const result = await target
				.chooseControl()
				.set("choiceList", [str + "下次对你使用【杀】后，其视为对你使用任意普通锦囊牌", str + "下次对你使用任意普通锦囊牌后，其视为对你使用【杀】"])
				.set("ai", function () {
					const target = _status.event.player;
					const player = _status.event.target;
					let num1 = get.effect(target, get.autoViewAs({ name: "sha" }, []), player, player);
					if (!player.canUse(get.autoViewAs({ name: "sha" }, []), target)) {
						num1 = 0;
					}
					let num2 = 0;
					for (const name of lib.inpile) {
						if (get.type(name) != "trick") {
							continue;
						}
						if (!player.canUse(get.autoViewAs({ name: name }, []), target)) {
							continue;
						}
						const eff = get.effect(target, get.autoViewAs({ name: name }, []), player, player);
						if (num2 < eff) {
							num2 = eff;
						}
					}
					return num1 >= num2 ? 1 : 0;
				})
				.set("target", player)
				.forResult();

			player.addSkill("clanqiuxin_effect");
			player.markAuto("clanqiuxin_effect", [[target, result.index]]);
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					var cards = player.getCards("hs", card => {
						if (get.name(card, player) != "sha" && get.type(card, null, player) != "trick") {
							return false;
						}
						return player.hasValueTarget(card);
					});
					if (cards.some(card => player.canUse(card, target) && get.effect(target, card, player, player) > 0)) {
						var att = get.attitude(player, target);
						if (att > 0) {
							return 9;
						}
						if (att < 0) {
							return -6;
						}
						return 0;
					} else {
						var att = get.attitude(player, target);
						if (att < 0) {
							return -3;
						}
						if (att > 0) {
							return 1;
						}
						return 2;
					}
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: {
					content(storage, player) {
						var infos = [];
						for (var i = 0; i < storage.length; i++) {
							var list = storage[i];
							var strx = ["【杀】", "任意普通锦囊牌"];
							if (list[1]) {
								strx.reverse();
							}
							infos.add("对" + get.translation(list[0]) + "使用" + strx[0] + "后，视为对其使用" + strx[1]);
						}
						return infos.join("<br>");
					},
				},
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					if (!event.targets || !event.targets.length) {
						return false;
					}
					if (event.card.name == "sha") {
						return event.targets.some(target => {
							return player.getStorage("clanqiuxin_effect").some(list => list[0] == target && list[1] == 0);
						});
					}
					if (get.type(event.card) == "trick") {
						return event.targets.some(target => {
							return player.getStorage("clanqiuxin_effect").some(list => list[0] == target && list[1] == 1);
						});
					}
					return false;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					let matchedList;
					if (trigger.card.name == "sha") {
						matchedList = player.getStorage("clanqiuxin_effect").filter(item => trigger.targets.includes(item[0]) && item[1] == 0);
					}
					if (get.type(trigger.card) == "trick") {
						matchedList = player.getStorage("clanqiuxin_effect").filter(item => trigger.targets.includes(item[0]) && item[1] == 1);
					}
					player.unmarkAuto("clanqiuxin_effect", matchedList);
					const targets = matchedList.map(item => item[0]);

					for (const target of targets) {
						event.target = target;
						const options = [];
						const nameFilter = trigger.card.name == "sha" ? name => get.type(name) == "trick" : name => name == "sha";
						for (const name of lib.inpile) {
							if (name != "sha" && get.type(name) != "trick") {
								continue;
							}
							if (!nameFilter(name)) {
								continue;
							}
							if (!player.canUse(get.autoViewAs({ name: name }, []), target)) {
								continue;
							}
							options.push([get.translation(get.type(name)), "", name]);
						}
						if (!options.length) {
							continue;
						}
						const result = await player
							.chooseButton({
								forced: true,
								createDialog: ["求心：视为对" + get.translation(target) + "使用一张牌", [options, "vcard"]],
							})
							.set("ai", function (button) {
								const player = _status.event.player;
								const target = _status.event.target;
								return get.effect(
									target,
									{
										name: button.link[2],
										nature: button.link[3],
									},
									player,
									player
								);
							})
							.set("target", target)
							.forResult();
						if (result.bool) {
							const card = get.autoViewAs({
								name: result.links?.[0][2],
								nature: result.links?.[0][3],
							});
							await player.useCard({
								card,
								targets: [target],
								addCount: false,
							});
						}
					}

					if (!player.getStorage("clanqiuxin_effect").length) {
						player.removeSkill("clanqiuxin_effect");
					}
				},
			},
		},
	},
	clanjianyuan: {
		inherit: "clanchenya",
		filter(event, player) {
			if (event.type != "player") {
				return false;
			}
			var skill = get.sourceSkillFor(event);
			var info = get.info(skill);
			if (info.charlotte) {
				return false;
			}
			var translation = get.skillInfoTranslation(skill, event.player);
			if (!translation) {
				return false;
			}
			var match = get.plainText(translation).match(/“?出牌阶段限一次/g);
			if (!match || match.every(value => value != "出牌阶段限一次") || !event.player.countCards("he")) {
				return false;
			}
			for (var phase of lib.phaseName) {
				var evt = event.getParent(phase);
				if (evt && evt.name == phase) {
					if (event.player.getHistory("useCard", evtx => evtx.getParent(phase) == evt).length) {
						return true;
					}
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			let num = 0;
			for (const phase of lib.phaseName) {
				const evt = trigger.getParent(phase);
				if (evt && evt.name == phase) {
					num += trigger.player.getHistory("useCard", evtx => evtx.getParent(phase) == evt).length;
				}
			}

			const result = await trigger.player
				.chooseCard("是否重铸任意张牌名字数为" + num + "的牌？", [1, Infinity], "he", (card, player) => _status.event.cards.includes(card) && player.canRecast(card), "allowChooseAll")
				.set("ai", card => {
					const val = get.value(card);
					return 6 - val;
				})
				.set(
					"cards",
					trigger.player.getCards("he", card => {
						return get.cardNameLength(card) == num;
					})
				)
				.forResult();

			if (result.bool) {
				await trigger.player.recast(result.cards);
			}
		},
	},
	//族钟毓
	clanjiejian: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!event.isFirstTarget || get.type(event.card) == "equip") {
				return false;
			}
			return get.cardNameLength(event.card) == player.getHistory("useCard").indexOf(event.getParent()) + 1;
		},
		direct: true,
		locked: false,
		async content(event, trigger, player) {
			const num = get.cardNameLength(trigger.card);
			const result = await player
				.chooseTarget(get.prompt("clanjiejian"), `令一名目标角色摸${get.cnNumber(num)}张牌`, (card, player, target) => {
					return trigger.targets.includes(target);
				})
				.set("ai", target => get.attitude(player, target))
				.forResult();
			if (result.bool) {
				const [target] = result.targets;
				player.logSkill("clanjiejian", target);
				await target.draw(num);
			}
		},
		ai: {
			threaten: 3,
			effect: {
				player_use(card, player, target) {
					if (!target || typeof card !== "object" || player._clanjiejian_mod_temp || get.type(card) === "equip" || get.attitude(player, target) <= 0 || get.cardNameLength(card) !== player.getHistory("useCard").length + 1) {
						return;
					}
					let targets = [target],
						evt = _status.event.getParent("useCard");
					targets.addArray(ui.selected.targets);
					if (evt && evt.card == card) {
						targets.addArray(evt.targets);
					}
					return [1, (0.8 * get.cardNameLength(card)) / targets.length];
				},
			},
		},
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object" && get.type(card) !== "equip") {
					let cs = get.cardNameLength(card) - player.getHistory("useCard").length - 1;
					if (cs < 0) {
						return num;
					}
					if (cs > 0) {
						return num / 3;
					}
					player._clanjiejian_mod_temp = true;
					let bool = game.hasPlayer(target => {
						if (get.attitude(player, target) <= 0 || !player.canUse(card, target, null, true)) {
							return false;
						}
						return get.effect(target, card, player, player) + get.effect(target, { name: "draw" }, player, player) > 0;
					});
					delete player._clanjiejian_mod_temp;
					if (bool) {
						return num + 15;
					}
				}
			},
		},
	},
	clanhuanghan: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			if (!event.card) {
				return false;
			}
			var num = get.cardNameLength(event.card);
			return typeof num == "number" && num > 0;
		},
		check(event, player) {
			let num = get.cardNameLength(event.card) - player.getDamagedHp();
			if (num >= 0) {
				return true;
			}
			if (num < -1) {
				return false;
			}
			if (
				player.hasSkill("clanbaozu", null, false, false) &&
				player.awakenedSkills.includes("clanbaozu") &&
				player.getHistory("useSkill", evt => {
					return evt.skill == "clanhuanghan";
				}).length
			) {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			player.addTempSkill("clanhuanghan_used");
			player.addMark("clanhuanghan_used");
			const num = player.countMark("clanhuanghan_used");
			await player.draw(get.cardNameLength(trigger.card));
			if (player.isDamaged()) {
				await player.chooseToDiscard(player.getDamagedHp(), "he", true);
			}
			if (num > 1 && player.hasSkill("clanbaozu", null, false, false) && player.awakenedSkills.includes("clanbaozu")) {
				player.restoreSkill("clanbaozu");
				player.popup("保族");
				game.log(player, "恢复了技能", "#g【保族】");
			}
		},
		ai: {
			threaten: 3,
			effect: {
				target(card, player, target) {
					if (!lib.translate[card.name] || !get.tag(card, "damage") || player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					let num = get.cardNameLength(card) - target.getDamagedHp();
					if (num > 0) {
						return [1, 0.8 * num + 0.1];
					}
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
};
