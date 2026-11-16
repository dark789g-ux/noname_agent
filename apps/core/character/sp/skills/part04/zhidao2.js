import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhidao2" | "luanzhan" | "xinzhengnan" | "zhengnan" | "wusheng_guansuo" | "dangxian_guansuo" | "zhiman_guansuo" | "xiefang" | "qizhi" | "jinqu" | "jiaozi" | "jiqiao" | "linglong">} */
export const groupSkills = {
	zhidao2: {
		mod: {
			playerEnabled(card, player, target) {
				if (player != target) {
					return false;
				}
			},
		},
	},
	luanzhan: {
		mod: {
			selectTarget(card, player, range) {
				if (!player.storage.luanzhan) {
					return;
				}
				if (range[1] == -1) {
					return;
				}
				if (card.name == "sha") {
					range[1] += player.storage.luanzhan;
				}
				if (get.color(card) == "black" && get.type(card) == "trick") {
					var info = get.info(card);
					if (info.multitarget) {
						return false;
					}
					range[1] += player.storage.luanzhan;
				}
			},
		},
		trigger: { source: "damageSource" },
		audio: 2,
		forced: true,
		mark: true,
		intro: {
			content(storage) {
				return "可以额外指定" + storage + "个目标";
			},
		},
		init(player) {
			player.storage.luanzhan = 0;
		},
		init2(player) {
			player.markSkill("luanzhan");
		},
		content() {
			if (typeof player.storage.luanzhan == "number") {
				player.storage.luanzhan += trigger.num;
			} else {
				player.storage.luanzhan = trigger.num;
			}
			if (player.hasSkill("luanzhan")) {
				player.markSkill("luanzhan");
			}
		},
		group: "luanzhan_cancel",
		subSkill: {
			cancel: {
				audio: "luanzhan",
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					if (!player.storage.luanzhan) {
						return false;
					}
					var check = false;
					var card = event.card;
					if (card.name == "sha") {
						check = true;
					} else if (get.color(card) == "black" && get.type(card) == "trick") {
						var info = get.info(card);
						if (!info.multitarget) {
							check = true;
							if (info.selectTarget == -1) {
								check = false;
							} else if (Array.isArray(info.selectTarget) && info.selectTarget[1] == -1) {
								check = false;
							}
						}
					}
					if (check && event.targets && event.targets.length < player.storage.luanzhan) {
						return true;
					}
					return false;
				},
				content() {
					player.storage.luanzhan = 0;
					player.markSkill("luanzhan");
				},
			},
		},
	},
	xinzhengnan: {
		audio: "zhengnan",
		trigger: { global: "dying" },
		frequent: true,
		filter(event, player) {
			return !player.storage.xinzhengnan || !player.storage.xinzhengnan.includes(event.player);
		},
		content() {
			"step 0";
			if (!player.storage.xinzhengnan) {
				player.storage.xinzhengnan = [];
			}
			player.storage.xinzhengnan.add(trigger.player);
			player.storage.xinzhengnan.sortBySeat();
			player.markSkill("xinzhengnan");
			player.recover();
			var list = [];
			if (!player.hasSkill("new_rewusheng")) {
				list.push("new_rewusheng");
			}
			if (!player.hasSkill("xindangxian")) {
				list.push("xindangxian");
			}
			if (!player.hasSkill("rezhiman")) {
				list.push("rezhiman");
			}
			if (list.length) {
				player.draw();
				event.list = list;
			} else {
				player.draw(3);
				event.finish();
			}
			"step 1";
			if (event.list.length == 1) {
				event._result = { control: event.list[0] };
			} else {
				player
					.chooseControl(event.list)
					.set("prompt", "征南：选择获得下列技能中的一个")
					.set("ai", function () {
						if (event.list.includes("xindangxian")) {
							return "xindangxian";
						}
						return 0;
					});
			}
			"step 2";
			if (result.control == "xindangxian") {
				player.storage.xinfuli = true;
			}
			player.addSkills(result.control);
		},
		ai: { threaten: 2.5 },
		intro: {
			content: "已因$发动过技能",
		},
		derivation: ["new_rewusheng", "xindangxian", "rezhiman"],
	},
	zhengnan: {
		audio: 2,
		trigger: { global: "dieAfter" },
		frequent: true,
		async content(event, trigger, player) {
			await player.draw(3);
			const list = lib.skill.zhengnan.derivation.filter(skill => !player.hasSkill(skill, null, false, false));
			if (list.length > 0) {
				const result =
					list.length > 1
						? await player
								.chooseControl(list)
								.set("prompt", "选择获得一项技能")
								.set("ai", function () {
									const controls = get.event().controls;
									if (controls.includes("oldangxian")) {
										return "oldangxian";
									}
									return controls[0];
								})
								.forResult()
						: { control: list[0] };
				if (result.control) {
					await player.addSkills(result.control);
				}
			}
		},
		ai: { threaten: 2 },
		derivation: ["new_rewusheng", "oldangxian", "rezhiman"],
	},
	wusheng_guansuo: { audio: 1 },
	dangxian_guansuo: { audio: 1 },
	zhiman_guansuo: { audio: 1 },
	xiefang: {
		mod: {
			globalFrom(from, to, distance) {
				return (
					distance -
					game.countPlayer(function (current) {
						return current.hasSex("female");
					})
				);
			},
		},
	},
	qizhi: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!event.targets || !event.isFirstTarget) {
				return false;
			}
			if (_status.currentPhase != player) {
				return false;
			}
			var type = get.type(event.card, "trick");
			if (type != "basic" && type != "trick") {
				return false;
			}
			if (event.noai) {
				return false;
			}
			return game.hasPlayer(function (target) {
				return !event.targets.includes(target) && target.countCards("he") > 0;
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "弃置一名角色的一张牌，然后其摸一张牌", function (card, player, target) {
					return !_status.event.targets.includes(target) && target.countCards("he") > 0;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					if (target == player) {
						return 2;
					}
					if (get.attitude(player, target) <= 0) {
						return 1;
					}
					return 0.5;
				})
				.set("targets", trigger.targets)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.getHistory("custom").push({ [event.name]: true });
			await player.discardPlayerCard(target, true, "he");
			await target.draw();
		},
	},
	jinqu: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		check(event, player) {
			return (
				player.getHistory("custom", function (evt) {
					return evt.qizhi == true;
				}).length >= player.countCards("h")
			);
		},
		prompt(event, player) {
			var num = player.getHistory("custom", function (evt) {
				return evt.qizhi == true;
			}).length;
			return "进趋：是否摸两张牌并将手牌弃置至" + get.cnNumber(num) + "张？";
		},
		content() {
			"step 0";
			player.draw(2);
			"step 1";
			var dh =
				player.countCards("h") -
				player.getHistory("custom", function (evt) {
					return evt.qizhi == true;
				}).length;
			if (dh > 0) {
				player.chooseToDiscard(dh, true, "allowChooseAll");
			}
		},
		ai: { combo: "qizhi" },
	},
	jiaozi: {
		audio: 2,
		trigger: { player: "damageBegin3", source: "damageBegin1" },
		forced: true,
		filter(event, player) {
			return player.isMaxHandcard(true);
		},
		content() {
			trigger.num++;
		},
		ai: { presha: true },
	},
	jiqiao: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			return player.countCards("he", { type: "equip" }) > 0;
		},
		content() {
			"step 0";
			player
				.chooseToDiscard(
					get.prompt2("jiqiao"),
					[1, player.countCards("he", { type: "equip" })],
					"he",
					function (card) {
						return get.type(card) == "equip";
					},
					"allowChooseAll"
				)
				.set("ai", function (card) {
					if (card.name == "bagua") {
						return 10;
					}
					return 7 - get.value(card);
				}).logSkill = "jiqiao";
			"step 1";
			if (result.bool) {
				event.cards = get.cards(2 * result.cards.length);
				player.showCards(event.cards);
			} else {
				event.finish();
			}
			"step 2";
			var gained = [];
			var tothrow = [];
			for (var i = 0; i < event.cards.length; i++) {
				if (get.type(event.cards[i]) != "equip") {
					gained.push(event.cards[i]);
				} else {
					tothrow.push(event.cards[i]);
				}
			}
			player.gain(gained, "gain2");
			game.cardsDiscard(tothrow);
		},
		ai: {
			threaten: 1.5,
		},
	},
	linglong: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "disableEquipAfter", "enableEquipAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter", "phaseBefore"],
		},
		init(player, skill) {
			player.addExtraEquip(skill, "bagua", true, player => !player.getEquips(2).length && lib.card.bagua);
		},
		onremove(player, skill) {
			delete player.storage[skill];
			player.removeExtraEquip(skill);
		},
		forced: true,
		derivation: "reqicai",
		filter(event, player) {
			if (event.name == "disableEquip" || event.name == "enableEquip") {
				if (!event.slots.includes("equip5")) {
					return false;
				}
			} else if (event.name != "phase" && (event.name != "equip" || event.player != player)) {
				var evt = event.getl(player);
				if (!evt || !evt.es || !evt.es.some(i => get.subtypes(i).includes("equip5"))) {
					return false;
				}
			}
			let skills = player.additionalSkills["linglong"];
			return (skills && skills.length > 0) != player.hasEmptySlot(5);
		},
		direct: true,
		content() {
			player.removeAdditionalSkill("linglong");
			if (player.hasEmptySlot(5)) {
				player.addAdditionalSkill("linglong", ["reqicai"]);
			}
		},
		group: "linglong_bagua",
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha" && player.hasEmptySlot(1)) {
					return num + 1;
				}
			},
			maxHandcard(player, num) {
				if (!player.hasEmptySlot(3) || !player.hasEmptySlot(4)) {
					return;
				}
				return num + 1;
			},
			/*targetInRange(card, player, target, now) {
				if (!player.hasEmptySlot(5)) return;
				var type = get.type(card);
				if (type == "trick" || type == "delay") return true;
			},
			canBeDiscarded(card, source, player) {
				if (!player.hasEmptySlot(5)) return;
				if (get.position(card) == "e" && get.subtypes(card).some(slot => slot == "equip2" || slot == "equip5")) return false;
			},
			cardDiscardable:function (card,player){
				if(player.getEquip(5)) return;
				if(get.position(card)=='e') return false;
			},*/
		},
	},
};
