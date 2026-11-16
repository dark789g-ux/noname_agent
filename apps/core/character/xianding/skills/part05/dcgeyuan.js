import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcgeyuan" | "dcjieshu" | "dcgusuan" | "dckaiji" | "dcpingxi">} */
export const groupSkills = {
	//刘徽
	dcgeyuan: {
		audio: 2,
		trigger: {
			global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter", "equipAfter"],
		},
		forced: true,
		filter(event, player) {
			var cards = event.getd();
			for (var i of cards) {
				if (lib.skill.dcgeyuan.filterNumber(player, get.number(i, false))) {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			event.cards = trigger.getd();
			"step 1";
			var card = false;
			for (var i of cards) {
				if (lib.skill.dcgeyuan.filterNumber(player, get.number(i, false))) {
					card = i;
					cards.remove(card);
					break;
				}
			}
			if (card) {
				var number = get.number(card, false);
				game.log(player, "将", "#y" + get.strNumber(number), "记录为", "#g“圆环之弧”");
				player.markAuto("dcgeyuan_homura", [number]);
				player.markSkill("dcgeyuan");
				if (player.getStorage("dcgeyuan").length > player.getStorage("dcgeyuan_homura").length) {
					if (cards.length > 0) {
						event.redo();
					} else {
						event.finish();
					}
				} else if (player.storage.dcgusuan) {
					event.goto(5);
				}
			} else {
				event.finish();
			}
			"step 2";
			var list = player.getStorage("dcgeyuan_homura");
			var num1 = list[0],
				num2 = list[list.length - 1];
			event.cards2 = [];
			var lose_list = [],
				players = game.filterPlayer();
			for (var current of players) {
				var cards = current.getCards("ej", function (card) {
					var num = get.number(card);
					return num == num1 || num == num2;
				});
				if (cards.length > 0) {
					current.$throw(cards);
					lose_list.push([current, cards]);
					event.cards2.addArray(cards);
				}
			}
			if (lose_list.length) {
				event.lose_list = lose_list;
				game.loseAsync({
					lose_list: lose_list,
				}).setContent("chooseToCompareLose");
			}
			"step 3";
			var list = player.getStorage("dcgeyuan_homura");
			var num1 = list[0],
				num2 = list[list.length - 1];
			var cards = event.cards2;
			for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
				var card = ui.cardPile.childNodes[i];
				var number = get.number(card, false);
				if (number == num1 || number == num2) {
					cards.push(card);
				}
			}
			if (cards.length > 0) {
				if (event.lose_list) {
					game.delayx();
				}
				player.gain(cards, "gain2");
			}
			"step 4";
			var list = player.getStorage("dcgeyuan_homura");
			var num1 = list[0],
				num2 = list[list.length - 1];
			player.storage.dcgeyuan_homura = [];
			game.log(player, "清空了", "#g“圆环之弧”");
			player.markSkill("dcgeyuan");
			if (player.getStorage("dcgeyuan").length > 3) {
				player.unmarkAuto("dcgeyuan", [num1, num2]);
				game.log(player, "从", "#g“圆环之理”", "中移除了", "#y" + get.strNumber(num1), "和", "#y" + get.strNumber(num2));
			}
			event.finish();
			"step 5";
			player.chooseTarget("割圆：你可以选择至多三名角色", "第一名角色摸三张牌，第二名角色弃置四张牌，第三名角色将所有手牌与牌堆底的牌交换", [1, 3]);
			"step 6";
			if (result.bool) {
				var targets = result.targets;
				event.targets = targets;
				player.line(targets);
				targets[0].draw(3);
				if (targets.length < 2) {
					event.goto(4);
				}
			} else {
				event.goto(4);
			}
			"step 7";
			if (targets[1].countCards("he") > 0) {
				targets[1].chooseToDiscard("he", true, 4);
			}
			if (targets.length < 3) {
				event.goto(4);
			}
			"step 8";
			var target = targets[2];
			var cards = get.bottomCards(5);
			game.cardsGotoOrdering(cards);
			var hs = target.getCards("h");
			if (hs.length > 0) {
				target.lose(hs, ui.cardPile);
			}
			target.gain(cards, "draw");
			event.goto(4);
		},
		group: "dcgeyuan_kyubey",
		filterNumber(player, num) {
			var list1 = player.getStorage("dcgeyuan");
			var list2 = player.getStorage("dcgeyuan_homura");
			if (!list1.includes(num)) {
				return false;
			}
			if (!list2.length) {
				return true;
			}
			if (list2.includes(num)) {
				return false;
			}
			var madoka = list1.indexOf(num);
			for (var i of list2) {
				var homura = list1.indexOf(i);
				var dist = Math.abs(madoka - homura);
				if (dist == 1 || dist == list1.length - 1) {
					return true;
				}
			}
			return false;
		},
		subSkill: {
			kyubey: {
				audio: "dcgeyuan",
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				forced: true,
				filter(event, player) {
					return (event.name != "phase" || game.phaseNumber == 0) && !player.storage.dcgusuan;
				},
				content() {
					var list = [];
					for (var i = 1; i <= 13; i++) {
						list.push(i);
					}
					list.randomSort();
					player.storage.dcgeyuan = list;
					player.markSkill("dcgeyuan");
					var str = "#y";
					for (var i = 0; i < 13; i++) {
						str += get.strNumber(list[i]);
						if (i != 12) {
							str += ",";
						}
					}
					game.log(player, "将", "#y“圆环之理”", "赋值为", str);
				},
			},
		},
		intro: {
			name: "圆环之理",
			markcount(storage, player) {
				if (!player.storage.dcgeyuan || !player.getStorage("dcgeyuan_homura").length) {
					return 0;
				}
				var list = player.storage.dcgeyuan.filter(i => lib.skill.dcgeyuan.filterNumber(player, i));
				if (!list.length) {
					return 0;
				}
				list = list.map(num => {
					if (num == 10) {
						return "X";
					}
					return get.strNumber(num);
				});
				return list.reduce((str, num) => {
					return str + num;
				}, "");
			},
			mark(dialog, storage, player) {
				dialog.content.style["overflow-x"] = "visible";
				var list = storage;
				if (!storage || !storage.length) {
					return "（圆环之理尚不存在）";
				}
				var list2 = player.getStorage("dcgeyuan_homura");
				var core = document.createElement("div");
				core.style.width = "0";
				var centerX = -15,
					centerY = 80,
					radius = 80;
				var radian = (Math.PI * 2) / list.length;
				var fulllist = ["Ａ", "２", "３", "４", "５", "６", "７", "８", "９", "10", "Ｊ", "Ｑ", "Ｋ"];
				for (var i = 0; i < list.length; i++) {
					var td = document.createElement("div");
					var color = "";
					if (list2[0] == list[i]) {
						color = ' class="yellowtext"';
					} else if (list2.includes(list[i])) {
						color = ' class="greentext"';
					}
					td.innerHTML = "<span" + color + ">[" + fulllist[list[i] - 1] + "]</span>";
					td.style.position = "absolute";
					core.appendChild(td);
					td.style.left = centerX + radius * Math.sin(radian * i) + "px";
					td.style.top = centerY - radius * Math.cos(radian * i) + "px";
				}
				dialog.content.appendChild(core);
			},
		},
	},
	dcjieshu: {
		audio: 2,
		trigger: { player: ["useCard", "respond"] },
		forced: true,
		filter(event, player) {
			var num = get.number(event.card, false);
			if (typeof num != "number") {
				return false;
			}
			return lib.skill.dcgeyuan.filterNumber(player, num);
		},
		content() {
			player.draw();
		},
		mod: {
			ignoredHandcard(card, player) {
				if (!player.getStorage("dcgeyuan").includes(get.number(card))) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && !player.getStorage("dcgeyuan").includes(get.number(card))) {
					return false;
				}
			},
		},
		ai: {
			combo: "dcgeyuan",
		},
	},
	dcgusuan: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "soil",
		filter(event, player) {
			return player.getStorage("dcgeyuan").length == 3;
		},
		content() {
			player.awakenSkill(event.name);
			player.storage.dcgusuan = true;
			player.loseMaxHp();
		},
		ai: { combo: "dcgeyuan" },
		derivation: "dcgeyuan_magica",
	},
	//王昶
	dckaiji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (player.maxHp <= 0) {
				return false;
			}
			if (!player.storage.dckaiji) {
				return true;
			}
			return player.hasCard(card => lib.filter.cardDiscardable(card, player, "phaseUse"), "he");
		},
		filterCard(card, player) {
			if (!player.storage.dckaiji) {
				return false;
			}
			return true;
		},
		position: "he",
		selectCard() {
			var player = _status.event.player;
			return player.storage.dckaiji ? [1, player.maxHp] : -1;
		},
		check(card) {
			var player = _status.event.player;
			if (!player.hasSkill("dcpingxi")) {
				if (ui.selected.cards.length) {
					return 0;
				}
				if (player.needsToDiscard()) {
					return 12 - get.value(card);
				}
				return 2 * player.hp + 1.5 - get.value(card);
			}
			var num = lib.skill.dcpingxi.getNum() + ui.selected.cards.length;
			if (
				num <
				game.countPlayer(function (current) {
					if (current == player || current.countCards("he") == 0) {
						return false;
					}
					return get.effect(current, { name: "guohe_copy2" }, player, player) + get.effect(current, { name: "sha" }, player, player) > 0;
				})
			) {
				if (
					get.position(card) == "h" &&
					player.needsToDiscard(0, (i, player) => {
						return !ui.selected.cards.includes(i) && !player.canIgnoreHandcard(i);
					})
				) {
					return 7 + 1 / Math.max(1, get.value(card));
				}
				return 7 - get.value(card);
			}
			return 0;
		},
		allowChooseAll: true,
		content() {
			player.changeZhuanhuanji("dckaiji");
			if (!cards.length) {
				player.draw(Math.min(player.maxHp, 5));
			}
		},
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content: storage => "转换技。出牌阶段限一次，你可以" + (storage ? "弃置至多X张牌" : "摸X张牌") + "（X为你的体力上限且至多为5）。",
		},
		ai: {
			threaten: 1.6,
			order(item, player) {
				if (player.storage.dckaiji) {
					return 0.1;
				}
				return 8;
			},
			result: { player: 1 },
		},
	},
	dcpingxi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		getNum() {
			let num = 0;
			game.getGlobalHistory("cardMove", function (evt) {
				if (evt.name == "lose" && evt.type == "discard") {
					num += evt.cards2.length;
				}
			});
			return num;
		},
		filter(event, player) {
			return lib.skill.dcpingxi.getNum() > 0 && game.hasPlayer(current => current != player);
		},
		async cost(event, trigger, player) {
			const num = get.info(event.skill).getNum();
			event.result = await player
				.chooseTarget([1, num], lib.filter.notMe, get.prompt(event.skill), `选择至多${get.cnNumber(num)}名其他角色。弃置这些角色的各一张牌，然后视为对这些角色各使用一张【杀】`)
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "guohe_copy2" }, player, player) + get.effect(target, { name: "sha" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			for (const target of event.targets.sortBySeat()) {
				if (!target.isIn() || !target.countDiscardableCards(player, "he")) {
					continue;
				}
				await player.discardPlayerCard(target, "he", true);
			}
			const sha = get.autoViewAs({ name: "sha", isCard: true });
			for (const target of event.targets.sortBySeat()) {
				if (!target.isIn() || !player.canUse(sha, target, false)) {
					continue;
				}
				await player.useCard(sha, target, false);
			}
		},
	},
};
