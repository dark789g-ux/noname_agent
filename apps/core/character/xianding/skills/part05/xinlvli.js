import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinlvli" | "lvli" | "lvli2" | "lvli3" | "lvli4" | "lvli5" | "lvli6" | "choujue" | "beishui" | "qingjiao">} */
export const groupSkills = {
	//文鸯
	xinlvli: {
		audio: "lvli",
		trigger: { player: "damageEnd", source: "damageSource" },
		filter(event, player, name) {
			if (name == "damageEnd" && !player.storage.beishui) {
				return false;
			}
			if (player.hp == player.countCards("h")) {
				return false;
			}
			if (player.hp < player.countCards("h") && player.isHealthy()) {
				return false;
			}
			return true;
		},
		usable(skill, player) {
			let num = 1;
			if (player.storage.choujue && player === _status.currentPhase) {
				num++;
			}
			return num;
		},
		async content(event, trigger, player) {
			const num = player.hp - player.countCards("h");
			if (num > 0) {
				await player.draw(num);
			} else {
				await player.recover(-num);
			}
		},
		//group:'lvli3',
	},
	lvli: {
		audio: 2,
		init(player, skill) {
			player.storage[skill] = 0;
		},
		enable: "chooseToUse",
		filter(event, player) {
			if (player.storage.lvli > 1) {
				return false;
			}
			if (player.storage.lvli > 0 && (player != _status.currentPhase || !player.storage.choujue)) {
				return false;
			}
			return event.type != "wuxie" && event.type != "respondShan";
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i = 0; i < lib.inpile.length; i++) {
					var name = lib.inpile[i];
					if (name == "wuxie") {
						continue;
					}
					if (name == "sha") {
						list.push(["基本", "", "sha"]);
						list.push(["基本", "", "sha", "fire"]);
						list.push(["基本", "", "sha", "thunder"]);
					} else if (get.type(name) == "trick") {
						list.push(["锦囊", "", name]);
					} else if (get.type(name) == "basic") {
						list.push(["基本", "", name]);
					}
				}
				return ui.create.dialog(event.lvli6 ? get.prompt("lvli") : "膂力", [list, "vcard"]);
			},
			filter(button, player) {
				var evt = _status.event.getParent();
				if (evt && typeof evt.filterCard == "function") {
					return evt.filterCard({ name: button.link[2] }, player, evt);
				}
				return lib.filter.filterCard({ name: button.link[2], isCard: true }, player, _status.event.getParent());
			},
			check(button) {
				var player = _status.event.player;
				if (player.countCards("h", button.link[2])) {
					return 0;
				}
				if (_status.event.getParent().type != "phase" && !_status.event.getParent().lvli6) {
					return 1;
				}
				return player.getUseValue({ name: button.link[2], isCard: true });
			},
			backup(links, player) {
				return {
					filterCard() {
						return false;
					},
					audio: "lvli",
					selectCard: -1,
					check(card) {
						return 1;
					},
					viewAs: { name: links[0][2], nature: links[0][3], isCard: true },
				};
			},
			prompt(links, player) {
				return "请选择" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "的目标";
			},
		},
		ai: {
			order: 4,
			result: {
				player: 1,
			},
			threaten: 2.9,
			fireAttack: true,
		},
		group: ["lvli2", "lvli3", "lvli4", "lvli5", "lvli6"],
	},
	lvli2: {
		trigger: { player: ["useCardBefore", "respondBefore"] },
		forced: true,
		popup: false,
		priority: 35,
		sourceSkill: "lvli",
		filter(event, player) {
			return event.skill == "lvli_backup" || event.skill == "lvli5" || event.skill == "lvli4";
		},
		content() {
			"step 0";
			player.logSkill("lvli");
			player.storage.lvli++;
			player.popup(trigger.card.name, trigger.name == "useCard" ? "metal" : "wood");
			"step 1";
			var random = 0.5 + player.countCards("e") * 0.1;
			if (get.isLuckyStar(player)) {
				random = 1;
			}
			if (random >= Math.random()) {
				player.popup("洗具");
			} else {
				player.popup("杯具");
				trigger.cancel();
				if (!trigger.getParent().lvli6) {
					trigger.getParent().goto(0);
				}
				game.broadcastAll(
					function (str) {
						var dialog = ui.create.dialog(str);
						dialog.classList.add("center");
						setTimeout(function () {
							dialog.close();
						}, 1000);
					},
					get.translation(player) + "声明的" + get.translation(trigger.card.name) + "并没有生效"
				);
				game.log("然而什么都没有发生");
				game.delay(2);
			}
		},
	},
	lvli3: {
		trigger: { global: "phaseBefore" },
		forced: true,
		silent: true,
		popup: false,
		sourceSkill: "lvli",
		content() {
			player.storage.lvli = 0;
		},
	},
	lvli4: {
		log: false,
		enable: "chooseToUse",
		sourceSkill: "lvli",
		viewAsFilter(player) {
			if (player.storage.lvli > 1) {
				return false;
			}
			if (player.storage.lvli > 0 && (player != _status.currentPhase || !player.storage.choujue)) {
				return false;
			}
			return true;
		},
		filterCard() {
			return false;
		},
		selectCard: -1,
		viewAs: {
			name: "shan",
			isCard: true,
		},
		ai: {
			skillTagFilter(player) {
				if (player.storage.lvli > 1) {
					return false;
				}
				if (player.storage.lvli > 0 && (player != _status.currentPhase || !player.storage.choujue)) {
					return false;
				}
				return true;
			},
			threaten: 1.5,
			respondShan: true,
		},
	},
	lvli5: {
		log: false,
		enable: "chooseToUse",
		sourceSkill: "lvli",
		viewAsFilter(player) {
			if (player.storage.lvli > 1) {
				return false;
			}
			if (player.storage.lvli > 0 && (player != _status.currentPhase || !player.storage.choujue)) {
				return false;
			}
			return true;
		},
		filterCard() {
			return false;
		},
		selectCard: -1,
		viewAs: {
			name: "wuxie",
			isCard: true,
		},
	},
	lvli6: {
		trigger: { player: "damageEnd" },
		direct: true,
		sourceSkill: "lvli",
		filter(event, player) {
			if (!player.storage.beishui) {
				return false;
			}
			if (player.storage.lvli > 1) {
				return false;
			}
			if (player.storage.lvli > 0 && (player != _status.currentPhase || !player.storage.choujue)) {
				return false;
			}
			return true;
		},
		content() {
			var next = player.chooseToUse();
			next.set("norestore", true);
			next.set("_backupevent", "lvli");
			next.backup("lvli");
			next.set("lvli6", true);
		},
	},
	choujue: {
		derivation: ["beishui", "qingjiao"],
		trigger: { global: "phaseAfter" },
		audio: 2,
		skillAnimation: true,
		animationColor: "water",
		juexingji: true,
		forced: true,
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = false;
			}
		},
		filter(event, player) {
			if (player.storage.choujue) {
				return false;
			}
			return Math.abs(player.hp - player.countCards("h")) >= 3;
		},
		content() {
			player.awakenSkill(event.name);
			player.storage.choujue = true;
			player.loseMaxHp();
			player.addSkills("beishui");
		},
	},
	beishui: {
		trigger: { player: "phaseZhunbeiBegin" },
		audio: 2,
		skillAnimation: "epic",
		animationColor: "thunder",
		juexingji: true,
		forced: true,
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = false;
			}
		},
		filter(event, player) {
			if (player.storage.beishui) {
				return false;
			}
			return Math.min(player.hp, player.countCards("h")) < 2;
		},
		content() {
			player.awakenSkill(event.name);
			player.storage.beishui = true;
			player.loseMaxHp();
			player.addSkills("qingjiao");
		},
	},
	qingjiao: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			// /-?
			// if (!ui.cardPile.hasChildNodes() && !ui.discardPile.hasChildNodes()) {
			// }
			var hs = player.getCards("h");
			if (!hs.length) {
				return false;
			}
			for (var i of hs) {
				if (!lib.filter.cardDiscardable(i, player, "qingjiao")) {
					return false;
				}
			}
			return true;
		},
		//check:function(event,player){
		//	return player.countCards('h')<=player.hp;
		//},
		content() {
			"step 0";
			player.chooseToDiscard(true, "h", player.countCards("h"));
			"step 1";
			var evt = trigger.getParent();
			if (evt && evt.getParent && !evt.qingjiao) {
				evt.qingjiao = true;
				var next = game.createEvent("qingjiao_discard", false, evt.getParent());
				next.player = player;
				next.setContent(function () {
					var hs = player.getCards("he");
					if (hs.length) {
						player.discard(hs);
					}
				});
			}
			"step 2";
			var list = [];
			var typelist = [];
			var getType = function (card) {
				var sub = get.subtype(card);
				if (sub) {
					return sub;
				}
				return card.name;
			};
			for (var i = 0; i < ui.cardPile.childElementCount; i++) {
				var node = ui.cardPile.childNodes[i];
				var typex = getType(node);
				if (!typelist.includes(typex)) {
					list.push(node);
					typelist.push(typex);
					if (list.length >= 8) {
						break;
					}
				}
			}
			if (list.length < 8) {
				for (var i = 0; i < ui.discardPile.childElementCount; i++) {
					var node = ui.discardPile.childNodes[i];
					var typex = getType(node);
					if (!typelist.includes(typex)) {
						list.push(node);
						typelist.push(typex);
						if (list.length >= 8) {
							break;
						}
					}
				}
			}
			player.gain(list, "gain2");
		},
	},
};
