import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dbquedi" | "dbzhuifeng" | "dbchongjian" | "dbchoujue">} */
export const groupSkills = {
	//文鸯
	dbquedi: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		usable(skill, player) {
			return 1 + player.countMark("dbchoujue_add");
		},
		filter(event, player) {
			const { card, targets, target } = event;
			return (
				["sha", "juedou"].includes(card.name) &&
				targets.length == 1 &&
				(target.countGainableCards(player, "h") > 0 ||
					player.hasCard(card => {
						return _status.connectMode || (get.type(card, null, player) == "basic" && lib.filter.cardDiscardable(card, player, "dbquedi"));
					}, "h"))
			);
		},
		async cost(event, trigger, player) {
			const { target } = trigger;
			const list = [];
			if (target.countGainableCards(player, "h") > 0) {
				list.push("选项一");
			}
			if (player.hasCard(card => get.type(card, null, player) == "basic" && lib.filter.cardDiscardable(card, player, "dbquedi"), "h")) {
				list.push("选项二");
			}
			list.push("背水！");
			list.push("cancel2");
			const { control } = await player
				.chooseControl(list)
				.set("choiceList", [`获得${get.translation(target)}的一张手牌`, `弃置一张基本牌并令${get.translation(trigger.card)}伤害+1`, "背水！减1点体力上限并执行所有选项"])
				.set("prompt", get.prompt(event.skill, target))
				.set("ai", () => {
					const evt = _status.event.getTrigger(),
						player = evt.player,
						target = evt.target,
						card = evt.card;
					if (get.attitude(player, target) > 0) {
						return "cancel2";
					}
					const bool1 = target.countGainableCards(player, "h") > 0;
					const bool2 =
						player.hasCard(cardx => {
							return get.type(cardx, null, player) == "basic" && lib.filter.cardDiscardable(cardx, player, "dbquedi") && get.value(card, player) < 5;
						}, "h") &&
						!target.hasSkillTag("filterDamage", null, {
							player: player,
							card: card,
						});
					if (bool1 && bool2 && (target.hp <= 2 || (player.isDamaged() && player.maxHp > 3))) {
						return "背水！";
					}
					if (bool1) {
						return "选项一";
					}
					if (bool2) {
						return "选项二";
					}
					return "cancel2";
				})
				.forResult();
			event.result = {
				bool: control != "cancel2",
				cost_data: control,
			};
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const { cost_data: control } = event,
				{ target } = trigger;
			if (["选项一", "背水！"].includes(control) && target.countGainableCards(player, "h") > 0) {
				await player.gainPlayerCard(target, true, "h");
			}
			if (["选项二", "背水！"].includes(control) && player.hasCard(card => get.type(card, null, player) == "basic" && lib.filter.cardDiscardable(card, player, "dbquedi"), "h")) {
				const { bool } = await player.chooseToDiscard("h", "弃置一张基本牌", { type: "basic" }).forResult();
				if (bool) {
					trigger.getParent().baseDamage++;
				}
			}
			if (control == "背水！") {
				await player.loseMaxHp();
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (tag !== "directHit_ai" || !arg || !arg.card || !arg.target || (arg.card.name != "sha" && arg.card.name != "juedou")) {
					return false;
				}
				if (player.storage.counttrigger?.dbquedi > 0) {
					return false;
				}
				if (
					arg.target.countCards("h") == 1 &&
					(arg.card.name != "sha" ||
						!arg.target.hasSkillTag("freeShan", false, {
							player: player,
							card: arg.card,
							type: "use",
						}) ||
						player.hasSkillTag("unequip", false, {
							name: arg.card ? arg.card.name : null,
							target: arg.target,
							card: arg.card,
						}) ||
						player.hasSkillTag("unequip_ai", false, {
							name: arg.card ? arg.card.name : null,
							target: arg.target,
							card: arg.card,
						}))
				) {
					return true;
				}
				return false;
			},
		},
	},
	dbzhuifeng: {
		audio: 2,
		groupSkill: "wei",
		enable: "chooseToUse",
		usable: 2,
		viewAsFilter(player) {
			return player.group == "wei" && player.hp > 0;
		},
		viewAs: { name: "juedou", isCard: true },
		filterCard: () => false,
		selectCard: -1,
		log: false,
		precontent() {
			"step 0";
			player.logSkill("dbzhuifeng");
			player.loseHp();
			event.forceDie = true;
			"step 1";
			//特殊处理
			if (player.isDead()) {
				player.useResult(event.result, event.getParent()).forceDie = true;
			}
		},
		ai: {
			order() {
				return get.order({ name: "juedou" }) - 0.5;
			},
		},
		group: "dbzhuifeng_self",
		subSkill: {
			self: {
				audio: "dbzhuifeng",
				trigger: { player: "damageBegin2" },
				forced: true,
				filter(event, player) {
					var evt = event.getParent();
					return evt.skill == "dbzhuifeng" && evt.player == player;
				},
				content() {
					trigger.cancel();
					player.tempBanSkill("dbzhuifeng", { player: "phaseUseEnd" });
				},
			},
		},
	},
	dbchongjian: {
		audio: 2,
		groupSkill: "wu",
		hiddenCard(player, name) {
			if (
				player.group == "wu" &&
				(name == "sha" || name == "jiu") &&
				player.hasCard(function (card) {
					return get.type(card) == "equip";
				}, "hes")
			) {
				return true;
			}
			return false;
		},
		enable: "chooseToUse",
		filter(event, player) {
			return (
				player.group == "wu" &&
				player.hasCard(function (card) {
					return get.type(card) == "equip";
				}, "hes") &&
				(event.filterCard({ name: "sha" }, player, event) || event.filterCard({ name: "jiu" }, player, event))
			);
		},
		locked: false,
		mod: {
			targetInRange(card) {
				if (card.storage && card.storage.dbchongjian) {
					return true;
				}
			},
		},
		chooseButton: {
			dialog() {
				var list = [];
				list.push(["基本", "", "sha"]);
				for (var i of lib.inpile_nature) {
					list.push(["基本", "", "sha", i]);
				}
				list.push(["基本", "", "jiu"]);
				return ui.create.dialog("冲坚", [list, "vcard"]);
			},
			filter(button, player) {
				var evt = _status.event.getParent();
				return evt.filterCard({ name: button.link[2], nature: button.link[3], isCard: true }, player, evt);
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				var player = _status.event.player;
				if (
					button.link[2] == "jiu" &&
					(player.hasCard(function (card) {
						return get.name(card) == "sha";
					}, "hs") ||
						player.countCards("hes", function (card) {
							if (get.type(card) != "equip") {
								return false;
							}
							if (get.position(card) == "e") {
								if (player.hasSkillTag("noe")) {
									return 10 - get.value(card) > 0;
								}
								var sub = get.subtype(card);
								if (
									player.hasCard(function (card) {
										return get.subtype(card) == sub && player.canUse(card, player) && get.effect(player, card, player, player) > 0;
									}, "hs")
								) {
									return 10 - get.value(card) > 0;
								}
							}
							return 5 - get.value(card) > 0;
						}) > 1)
				) {
					return player.getUseValue({ name: "jiu" }) * 4;
				}
				return player.getUseValue({ name: button.link[2], nature: button.link[3] }, false);
			},
			backup(links, player) {
				return {
					audio: "dbchongjian",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						//isCard:true,
						storage: { dbchongjian: true },
					},
					filterCard: { type: "equip" },
					position: "hes",
					popname: true,
					precontent() {
						player.addTempSkill("dbchongjian_effect");
					},
					check(card) {
						var player = _status.event.player;
						if (get.position(card) == "e") {
							if (player.hasSkillTag("noe")) {
								return 10 - get.value(card);
							}
							var sub = get.subtype(card);
							if (
								player.hasCard(function (card) {
									return get.subtype(card) == sub && player.canUse(card, player) && get.effect(player, card, player, player) > 0;
								}, "hs")
							) {
								return 10 - get.value(card);
							}
						}
						return 5 - get.value(card);
					},
				};
			},
			prompt(links) {
				return "将一张装备牌当做" + (links[0][3] ? get.translation(links[0][3]) : "") + "【" + get.translation(links[0][2]) + "】使用";
			},
		},
		ai: {
			respondSha: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond") {
					return false;
				}
				return player.group == "wu" && player.hasCard({ type: "equip" }, "hes");
			},
			order(item, player) {
				if (_status.event.type != "phase") {
					return 1;
				}
				var player = _status.event.player;
				if (
					player.hasCard(function (card) {
						if (get.value(card, player) < 0) {
							return true;
						}
						var sub = get.subtype(card);
						return (
							player.hasCard(function (card) {
								return get.subtype(card) == sub && player.canUse(card, player) && get.effect(player, card, player, player) > 0;
							}, "hs") > 0
						);
					}, "e")
				) {
					return 10;
				}
				if (
					player.countCards("hs", "sha") ||
					player.countCards("he", function (card) {
						return get.type(card) == "equip" && get.value(card, player) < 5;
					}) > 1
				) {
					return get.order({ name: "jiu" }) - 0.1;
				}
				return get.order({ name: "sha" }) - 0.1;
			},
			result: { player: 1 },
		},
		subSkill: {
			effect: {
				audio: "dbchongjian",
				charlotte: true,
				mod: {
					targetInRange(card) {
						if (card.storage && card.storage.dbchongjian) {
							return true;
						}
					},
				},
				trigger: { source: "damageSource" },
				forced: true,
				logTarget: "player",
				filter(event, player) {
					return event.parent.skill == "dbchongjian_backup" && event.card.name == "sha" && event.getParent().name == "sha" && event.player.countGainableCards(player, "e") > 0;
				},
				content() {
					player.gainPlayerCard(trigger.player, "e", true, trigger.num);
				},
				ai: {
					unequip: true,
					skillTagFilter(player, tag, arg) {
						if (tag == "unequip") {
							if (player.group != "wu" || !arg || !arg.card || !arg.card.storage || !arg.card.storage.dbchongjian) {
								return false;
							}
							return true;
						}
					},
				},
			},
		},
	},
	dbchoujue: {
		audio: 2,
		trigger: { source: "dieAfter" },
		forced: true,
		async content(event, trigger, player) {
			await player.gainMaxHp();
			await player.draw(2);
			player.addTempSkill(event.name + "_add");
			player.addMark(event.name + "_add", 1, false);
		},
		subSkill: {
			add: {
				charlotte: true,
				onremove: true,
				mark: true,
				intro: {
					markcount: (storage, player) => storage || 0,
					content: (storage, player) => "本回合〖却敌〗可发动次数+" + (storage || 0),
				},
			},
		},
	},
};
