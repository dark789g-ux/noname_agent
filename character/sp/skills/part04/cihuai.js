import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "cihuai" | "jilei" | "jilei2" | "danlao" | "taichen" | "naman" | "xiemu" | "xiemu2" | "oldxiemu" | "spmengjin" | "fenxun_old">} */
export const groupSkills = {
	cihuai: {
		trigger: { player: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			return player.countCards("h", "sha") == 0;
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("cihuai"), function (card, player, target) {
					return player.canUse({ name: "sha", isCard: true }, target);
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.effect(target, { name: "sha", isCard: true }, player, player);
				});
			"step 1";
			if (result.bool) {
				player.logSkill("cihuai");
				player.showHandcards();
				player.useCard({ name: "sha", isCard: true }, result.targets);
			}
		},
		ai: {
			expose: 0.2,
		},
	},
	jilei: {
		trigger: { player: "damageEnd" },
		audio: 2,
		audioname2: { sxrm_caocao: "jilei_sxrm_caocao" },
		filter(event) {
			return event.source && event.source.isIn();
		},
		async cost(event, trigger, player) {
			const types = ["basic", "trick", "equip"].map(i => `caoying_${i}`);
			const { bool, links } = await player
				.chooseButton([get.prompt2(event.skill, trigger.source), [types, "vcard"]])
				.set("ai", button => {
					const type = button.link[2].slice(8),
						{ player, source } = get.event();
					if (get.attitude(player, source) > 0) {
						return 0;
					}
					if (source.getStorage("jilei2").includes(type)) {
						return 0;
					}
					if (
						type == "trick" &&
						source.countCards("h", card => {
							return get.type(card, null, source) == "trick" && source.hasValueTarget(card);
						})
					) {
						return 3;
					}
					return ["equip", "trick", "basic"].indexOf(type);
				})
				.set("source", trigger.source)
				.forResult();
			event.result = {
				bool: bool,
				targets: [trigger.source],
				cost_data: links,
			};
		},
		async content(event, trigger, player) {
			const type = event.cost_data[0][2].slice(8);
			player.popup(get.translation(type) + "牌");
			trigger.source.addTempSkill("jilei2", { player: "phaseBegin" });
			trigger.source.markAuto("jilei2", type);
		},
		ai: {
			maixie_defend: true,
			threaten: 0.7,
		},
	},
	jilei2: {
		charlotte: true,
		intro: {
			content(storage) {
				return "不能使用、打出或弃置" + get.translation(storage) + "牌";
			},
		},
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = [];
			}
		},
		mark: true,
		onremove: true,
		mod: {
			cardDiscardable(card, player) {
				if (player.storage.jilei2.includes(get.type(card, "trick"))) {
					return false;
				}
			},
			cardEnabled(card, player) {
				if (player.storage.jilei2.includes(get.type(card, "trick"))) {
					var hs = player.getCards("h"),
						cards = [card];
					if (Array.isArray(card.cards)) {
						cards.addArray(card.cards);
					}
					for (var i of cards) {
						if (hs.includes(i)) {
							return false;
						}
					}
				}
			},
			cardRespondable(card, player) {
				if (player.storage.jilei2.includes(get.type(card, "trick"))) {
					var hs = player.getCards("h"),
						cards = [card];
					if (Array.isArray(card.cards)) {
						cards.addArray(card.cards);
					}
					for (var i of cards) {
						if (hs.includes(i)) {
							return false;
						}
					}
				}
			},
			cardSavable(card, player) {
				if (player.storage.jilei2.includes(get.type(card, "trick"))) {
					var hs = player.getCards("h"),
						cards = [card];
					if (Array.isArray(card.cards)) {
						cards.addArray(card.cards);
					}
					for (var i of cards) {
						if (hs.includes(i)) {
							return false;
						}
					}
				}
			},
		},
	},
	danlao: {
		audio: 2,
		filter(event, player) {
			return (event.card.name == "sha" || get.type(event.card) == "trick") && event.targets && event.targets.length > 1;
		},
		check(event, player) {
			return event.getParent().excluded.includes(player) || get.tag(event.card, "multineg") || get.effect(player, event.card, event.player, player) <= 0;
		},
		trigger: { target: "useCardToTargeted" },
		content() {
			trigger.getParent().excluded.add(player);
			player.draw();
		},
		ai: {
			effect: {
				target(card) {
					if (get.type(card) != "trick") {
						return;
					}
					if (card.name == "tiesuo") {
						return [0, 0];
					}
					if (card.name == "yihuajiemu") {
						return [0, 1];
					}
					if (get.tag(card, "multineg")) {
						return [0, 2];
					}
				},
			},
		},
	},
	taichen: {
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player.canUse("sha", target);
		},
		content() {
			"step 0";
			player.loseHp();
			"step 1";
			player.useCard({ name: "sha", isCard: true }, target, false);
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					if (player.hp > 2 && player.hp > target.hp && target.countCards("he") < 4) {
						return get.effect(target, { name: "sha" }, player, target);
					}
					return 0;
				},
			},
		},
	},
	naman: {
		audio: 2,
		trigger: { global: "respondAfter" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			if (event.player == player) {
				return false;
			}
			if (event.cards) {
				for (var i = 0; i < event.cards.length; i++) {
					if (get.position(event.cards[i], true) == "o") {
						return true;
					}
				}
			}
			return false;
		},
		frequent: true,
		content() {
			var cards = trigger.cards.slice(0);
			for (var i = 0; i < cards.length; i++) {
				if (get.position(cards[i], true) != "o") {
					cards.splice(i--, 1);
				}
			}
			game.delay(0.5);
			player.gain(cards, "gain2");
		},
	},
	xiemu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h", "sha") > 0;
		},
		filterCard: { name: "sha" },
		check(card) {
			return 6 - get.value(card);
		},
		content() {
			"step 0";
			let list = game
				.filterPlayer(target => {
					const group = target[get.mode() === "guozhan" ? "identity" : "group"];
					return group !== "unkonwn";
				})
				.map(current => current[get.mode() === "guozhan" ? "identity" : "group"])
				.unique();
			if (player.storage.xiemu2) {
				list.removeArray(player.storage.xiemu2);
			}
			var list2 = list.slice(0);
			list2.sort(function (a, b) {
				return lib.skill.xiemu.count(b) - lib.skill.xiemu.count(a);
			});
			player
				.chooseControl(list)
				.set("prompt", "请选择一个势力")
				.set("ai", function () {
					return _status.event.group;
				})
				.set("group", list2[0]);
			"step 1";
			player.popup(result.control + 2, get.groupnature(result.control));
			game.log(player, "选择了", "#g" + get.translation(result.control + 2));
			player.addTempSkill("xiemu2", { player: "phaseBegin" });
			player.storage.xiemu2.add(result.control);
			player.updateMarks("xiemu2");
		},
		ai: {
			order: 1,
			result: { player: 1 },
		},
		count(group) {
			var player = _status.event.player;
			return game.countPlayer(function (current) {
				return current != player && (current[get.mode() === "guozhan" ? "identity" : "group"] == group) == group && get.attitude(current, player) < 0;
			});
		},
	},
	xiemu2: {
		onremove: true,
		mark: true,
		forced: true,
		audio: "xiemu",
		sourceSkill: "xiemu",
		intro: {
			content(storage) {
				return "已指定" + get.translation(storage) + "势力";
			},
		},
		trigger: {
			target: "useCardToTargeted",
		},
		init(player) {
			if (!player.storage.xiemu2) {
				player.storage.xiemu2 = [];
			}
		},
		filter(event, player) {
			if (!player.storage.xiemu2) {
				return false;
			}
			if (get.color(event.card) != "black") {
				return false;
			}
			if (!event.player) {
				return false;
			}
			if (event.player == player || !player.storage.xiemu2.includes(event.player.group)) {
				return false;
			}
			return true;
		},
		content() {
			player.draw(2);
		},
	},
	oldxiemu: {
		audio: "xiemu",
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			if (get.color(event.card) != "black") {
				return false;
			}
			if (!event.player) {
				return false;
			}
			if (event.player == player) {
				return false;
			}
			if (get.mode() != "guozhan") {
				return false;
			}
			return player.countCards("h", "sha") > 0;
		},
		direct: true,
		content() {
			"step 0";
			var next = player.chooseToDiscard("协穆：是否弃置一张杀并摸两张牌？", { name: "sha" });
			next.set("ai", function (card) {
				return 9 - get.value(card);
			});
			next.logSkill = "xiemu";
			"step 1";
			if (result.bool) {
				player.draw(2);
			}
		},
		ai: {
			effect: {
				target_use(card, player, target) {
					if (get.color(card) == "black" && target.countCards("h") > 0) {
						return [1, 0.5];
					}
				},
			},
		},
	},
	spmengjin: {
		trigger: { player: "shaBegin" },
		filter(event, player) {
			return event.target.countCards("he") > 0;
		},
		direct: true,
		content() {
			"step 0";
			var att = get.attitude(player, trigger.target);
			player.choosePlayerCard(get.prompt("spmengjin", trigger.target), "he", trigger.target).ai = function (button) {
				var val = get.buttonValue(button);
				if (att > 0) {
					return -val;
				}
				return val;
			};
			"step 1";
			if (result.bool) {
				trigger.target.discard(result.links);
				player.logSkill("spmengjin", trigger.target);
				trigger.target.addTempSkill("mengjin2", "shaAfter");
			}
		},
		ai: {
			expose: 0.2,
		},
	},
	fenxun_old: {
		audio: 2,
		trigger: { player: "shaBefore" },
		direct: true,
		filter(event, player) {
			return event.targets.length == 1;
		},
		position: "he",
		content() {
			"step 0";
			player.chooseCardTarget({
				filterCard: lib.filter.cardDiscardable,
				filterTarget(card, player, target) {
					var trigger = _status.event.getTrigger();
					return lib.filter.targetEnabled(trigger.card, player, target) && target != trigger.targets[0];
				},
				ai1(card) {
					return 6 - get.value(card);
				},
				ai2(target) {
					var trigger = _status.event.getTrigger();
					var player = _status.event.player;
					return get.effect(target, trigger.card, player, player);
				},
				prompt: get.prompt2("fenxun"),
			});
			"step 1";
			if (result.bool) {
				player.discard(result.cards);
				trigger.targets.push(result.targets[0]);
				player.logSkill("fenxun", result.targets);
			}
		},
	},
};
