import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const relinglongSkills = {
	relinglong: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "disableEquipAfter", "enableEquipAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter", "phaseBefore"],
		},
		init(player, skill) {
			player.addExtraEquip(skill, "bagua", true, player => player.hasEmptySlot(2) && lib.card.bagua);
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
			var skills = player.additionalSkills["relinglong"];
			return (skills && skills.length > 0) != player.hasEmptySlot(5);
		},
		direct: true,
		async content(event, trigger, player) {
			player.removeAdditionalSkill("relinglong");
			if (player.hasEmptySlot(5)) {
				player.addAdditionalSkill("relinglong", ["reqicai"]);
			}
		},
		group: ["linglong_bagua", "relinglong_directhit"],
		mod: {
			maxHandcard(player, num) {
				if (!player.hasEmptySlot(3) || !player.hasEmptySlot(4)) {
					return;
				}
				return num + 2;
			},
		},
		subSkill: {
			directhit: {
				audio: "relinglong",
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					if (event.card.name != "sha" && get.type(event.card, null, false) != "trick") {
						return false;
					}
					for (var i = 2; i < 6; i++) {
						if (!player.hasEmptySlot(i)) {
							return false;
						}
					}
					return true;
				},
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.players);
					game.log(trigger.card, "不可被响应");
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (!arg || !arg.card || !arg.target || (arg.card.name != "sha" && get.type(arg.card, null, false) != "trick")) {
							return false;
						}
						for (var i = 2; i < 6; i++) {
							if (!player.hasEmptySlot(i)) {
								return false;
							}
						}
						return true;
					},
				},
			},
		},
	},
	//张松
	rexiantu: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			return event.player != player;
		},
		logTarget: "player",
		check(event, player) {
			if (get.attitude(_status.event.player, event.player) < 1) {
				return false;
			}
			return player.hp > 1 || player.hasCard(card => (get.name(card) === "tao" || get.name(card) === "jiu") && lib.filter.cardEnabled(card, player), "hs");
		},
		async content(event, trigger, player) {
			if (get.mode() !== "identity" || player.identity !== "nei") {
				player.addExpose(0.2);
			}
			await player.draw(2);
			if (!player.countCards("he")) {
				return;
			}
			const result = await player
				.chooseCard(2, "he", true, "交给" + get.translation(trigger.player) + "两张牌")
				.set("ai", function (card) {
					if (ui.selected.cards.length && card.name == ui.selected.cards[0].name) {
						return -1;
					}
					if (get.tag(card, "damage")) {
						return 1;
					}
					if (get.type(card) == "equip") {
						return 1;
					}
					return 0;
				})
				.forResult();
			if (result?.cards?.length) {
				const target = trigger.player;
				await player.give(result.cards, target);
				target.addTempSkill("rexiantu_check", "phaseUseAfter");
				target.markAuto("rexiantu_check", [player]);
			}
		},
		ai: {
			threaten(player, target) {
				return (
					1 +
					game.countPlayer(current => {
						if (current != target && get.attitude(target, current) > 0) {
							return 0.5;
						}
						return 0;
					})
				);
			},
			expose: 0.3,
		},
		subSkill: {
			check: {
				charlotte: true,
				trigger: { player: "phaseUseEnd" },
				forced: true,
				popup: false,
				onremove: true,
				filter(event, player) {
					return !player.getHistory("sourceDamage", evt => {
						return evt.getParent("phaseUse") == event;
					}).length;
				},
				async content(event, trigger, player) {
					var targets = player.getStorage("rexiantu_check");
					targets.sortBySeat();
					for (var i of targets) {
						if (i.isIn()) {
							await i.loseHp();
						}
					}
					player.removeSkill("rexiantu_check");
				},
			},
		},
	},
	//新服公孙瓒
	dcyicong: {
		trigger: {
			player: ["changeHp"],
		},
		audio: 2,
		forced: true,
		filter(event, player) {
			return get.sgn(player.getDamagedHp() - 1.5) != get.sgn(player.getDamagedHp() - 1.5 + event.num);
		},
		async content(_) {},
		mod: {
			globalFrom(from, to, current) {
				return current - 1;
			},
			globalTo(from, to, current) {
				if (to.getDamagedHp() >= 2) {
					return current + 1;
				}
			},
		},
		ai: {
			threaten: 0.8,
		},
	},
	//朱治
	reanguo: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target } = event;
			let draw, recover, equip;
			if (target.isMinHandcard()) {
				await target.draw();
				draw = true;
			}
			if (target.isMinHp() && target.isDamaged()) {
				await target.recover();
				recover = true;
			}
			if (target.isMinEquip()) {
				const cardx = get.cardPile(
					function (card) {
						return get.type(card) == "equip" && target.hasUseTarget(card);
					},
					false,
					"random"
				);
				if (cardx) {
					await target.chooseUseTarget(cardx, "nothrow", "nopopup", true);
					equip = true;
				}
			}
			game.updateRoundNumber();

			if (!draw && player.isMinHandcard()) {
				await player.draw();
				draw = true;
			}
			if (!recover && player.isMinHp() && player.isDamaged()) {
				await player.recover();
				recover = true;
			}
			if (!equip && player.isMinEquip()) {
				const cardx = get.cardPile(function (card) {
					return get.type(card) == "equip" && player.hasUseTarget(card);
				});
				if (cardx) {
					await player.chooseUseTarget(cardx, "nothrow", "nopopup", true);
					equip = true;
				}
			}

			if (draw && recover && equip) {
				const result = await player
					.chooseCard("安国：是否重铸任意张牌？", [1, Infinity], lib.filter.cardRecastable, "he", "allowChooseAll")
					.set("ai", card => {
						return 6 - get.value(card);
					})
					.forResult();
				if (result?.bool) {
					await player.recast(result.cards);
				}
			}
		},
		ai: {
			threaten: 1.65,
			order: 9,
			result: {
				player(player, target) {
					if (get.attitude(player, target) <= 0) {
						if (target.isMinHandcard() || target.isMinEquip() || target.isMinHp()) {
							return -1;
						}
					}
					let num = 0;
					if (player.isMinHandcard() || target.isMinHandcard()) {
						num++;
					}
					if (player.isMinEquip() || target.isMinEquip()) {
						num++;
					}
					if ((player.isMinHp() && player.isDamaged()) || (target.isMinHp() && target.isDamaged())) {
						num += 2.1;
					}
					return num;
				},
			},
		},
	},
	//颜良文丑
	olshuangxiong: {
		audio: 2,
		trigger: { player: "phaseDrawEnd" },
		filter: (event, player) => player.countCards("he") > 0,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard("he", get.prompt("olshuangxiong"), "弃置一张牌，然后你本回合内可以将一张与此牌颜色不同的牌当做【决斗】使用", "chooseonly")
				.set("ai", function (card) {
					let player = _status.event.player;
					if (!_status.event.goon || player.skipList.includes("phaseUse")) {
						return -get.value(card);
					}
					let color = get.color(card),
						effect = 0,
						cards = player.getCards("hes"),
						sha = false;
					for (const cardx of cards) {
						if (cardx == card || get.color(cardx) == color) {
							continue;
						}
						const cardy = get.autoViewAs({ name: "juedou" }, [cardx]),
							eff1 = player.getUseValue(cardy);
						if (get.position(cardx) == "e") {
							let eff2 = get.value(cardx);
							if (eff1 > eff2) {
								effect += eff1 - eff2;
							}
							continue;
						} else if (get.name(cardx) == "sha") {
							if (sha) {
								effect += eff1;
								continue;
							} else {
								sha = true;
							}
						}
						let eff2 = player.getUseValue(cardx, null, true);
						if (eff1 > eff2) {
							effect += eff1 - eff2;
						}
					}
					return effect - get.value(card);
				})
				.set("goon", player.hasValueTarget({ name: "juedou" }) && !player.hasSkill("olshuangxiong_effect"))
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event,
				color = get.color(cards[0], player);
			await player.modedDiscard(cards);
			player.markAuto("olshuangxiong_effect", [color]);
			player.addTempSkill("olshuangxiong_effect");
		},
		group: "olshuangxiong_jianxiong",
		subSkill: {
			effect: {
				audio: "olshuangxiong",
				enable: "chooseToUse",
				viewAs: { name: "juedou" },
				position: "hes",
				viewAsFilter(player) {
					return player.hasCard(card => lib.skill.olshuangxiong_effect.filterCard(card, player), "hes");
				},
				filterCard(card, player) {
					const color = get.color(card),
						colors = player.getStorage("olshuangxiong_effect");
					for (const i of colors) {
						if (color != i) {
							return true;
						}
					}
					return false;
				},
				prompt() {
					const colors = _status.event.player.getStorage("olshuangxiong_effect");
					let str = "将一张颜色";
					for (let i = 0; i < colors.length; i++) {
						if (i > 0) {
							str += "或";
						}
						str += "不为";
						str += get.translation(colors[i]);
					}
					str += "的牌当做【决斗】使用";
					return str;
				},
				check(card) {
					const player = _status.event.player;
					if (get.position(card) == "e") {
						const raw = get.value(card);
						const eff = player.getUseValue(get.autoViewAs({ name: "juedou" }, [card]));
						return eff - raw;
					}
					const raw = player.getUseValue(card, null, true);
					const eff = player.getUseValue(get.autoViewAs({ name: "juedou" }, [card]));
					return eff - raw;
				},
				onremove: true,
				charlotte: true,
				ai: { order: 7 },
			},
			jianxiong: {
				audio: "olshuangxiong",
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				locked: false,
				filter(event, player) {
					return player.hasHistory("damage", function (evt) {
						//Disable Umi Kato's chaofan
						return evt.card && evt.cards && evt.cards.some(card => get.position(card, true));
					});
				},
				async content(event, trigger, player) {
					const cards = [];
					player.getHistory("damage", function (evt) {
						if (evt.card && evt.cards) {
							cards.addArray(evt.cards.filterInD("d"));
						}
					});
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				},
			},
		},
	},
	//新李典
	xinwangxi: {
		audio: "wangxi",
		inherit: "wangxi",
		async content(event, trigger, player) {
			const target = get.info(event.name).logTarget(trigger, player);
			await player.draw(2);
			if (player.countCards("he") && target.isIn()) {
				await player.chooseToGive(target, "he", true);
			}
		},
	},
	//OL界火诸葛
	olhuoji: {
		audio: "rehuoji",
		audioname: ["ol_sp_zhugeliang", "ol_pangtong"],
		trigger: { player: "huogongBegin" },
		forced: true,
		locked: false,
		popup: false,
		group: "olhuoji_viewAs",
		async content(event, trigger, player) {
			trigger.set("chooseToShow", async (event, player, target) => {
				const { showPosition = "h" } = event;
				const cards = target.getCards(showPosition).randomGets(1);
				return { bool: true, cards: cards };
			});
			trigger.set("filterDiscard", card => {
				const { cards2 } = get.event().getParent("huogong", true);
				return get.color(card) == get.color(cards2[0]);
			});
		},
		async huogongContent(event, trigger, player) {
			const { target } = event;
			if (target.countCards("h") == 0) {
				return;
			}
			const cards = target.getCards("h").randomGets(1),
				card = cards[0];
			await target.showCards(cards).setContent(function () {});
			event.dialog = ui.create.dialog(get.translation(target) + "展示的手牌", cards);
			event.videoId = lib.status.videoId++;

			game.broadcast("createDialog", event.videoId, get.translation(target) + "展示的手牌", cards);
			game.addVideo("cardDialog", null, [get.translation(target) + "展示的手牌", get.cardsInfo(cards), event.videoId]);
			game.log(target, "展示了", card);
			const result = await player
				.chooseToDiscard({ color: get.color(card) }, "h", function (card) {
					var evt = _status.event.getParent();
					if (get.damageEffect(evt.target, evt.player, evt.player, "fire") > 0) {
						return 7 - get.value(card, evt.player);
					}
					return -1;
				})
				.set("prompt", false)
				.forResult();
			//game.delay(2);
			if (result?.bool) {
				await target.damage("fire");
			} else {
				target.addTempSkill("huogong2");
			}
			event.dialog.close();
			game.addVideo("cardDialog", null, event.videoId);
			game.broadcast("closeDialog", event.videoId);
		},
		subSkill: { viewAs: { inherit: "rehuoji", audio: "rehuoji" } },
	},
};
