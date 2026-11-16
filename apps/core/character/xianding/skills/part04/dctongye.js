import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dctongye" | "dcmianyao" | "dcchangqu">} */
export const groupSkills = {
	//新服灭霸
	dctongye: {
		audio: 2,
		trigger: {
			global: ["phaseBefore", "dieAfter"],
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			if (game.countGroup() > 4) {
				return false;
			}
			if (event.name == "die") {
				return true;
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async content(event, trigger, player) {
			player.removeSkill("dctongye_buff");
			player.addSkill("dctongye_buff");
			const num = game.countGroup();
			if (num <= 4) {
				player.addMark("dctongye_handcard", 3, false);
				game.log(player, "手牌上限", "#y+3");
				if (4 - num > 0) {
					player.addMark("dctongye_draw", 4 - num, false);
					game.log(player, "摸牌阶段额定摸牌数", "#y+" + parseFloat(4 - num));
				}
			}
			if (num <= 3) {
				player.addMark("dctongye_range", 3, false);
				game.log(player, "攻击范围", "#y+3");
			}
			if (num <= 2) {
				player.addMark("dctongye_sha", 3, false);
				game.log(player, "使用杀的次数上限", "#y+3");
			}
			if (num <= 1) {
				await player.recover(3);
			}
		},
		subSkill: {
			buff: {
				audio: "dctongye",
				trigger: { player: "phaseDrawBegin2" },
				forced: true,
				filter(event, player) {
					if (!player.hasMark("dctongye_draw")) {
						return false;
					}
					return !event.numFixed;
				},
				content() {
					trigger.num += player.countMark("dctongye_draw");
				},
				charlotte: true,
				onremove: ["dctongye_handcard", "dctongye_range", "dctongye_sha", "dctongye_draw"],
				mark: true,
				marktext: "统",
				intro: {
					content(storage, player) {
						var str = "";
						var hand = player.countMark("dctongye_handcard"),
							range = player.countMark("dctongye_range"),
							sha = player.countMark("dctongye_sha"),
							draw = player.countMark("dctongye_draw");
						if (hand > 0) {
							str += "<li>手牌上限+" + hand + "；";
						}
						if (range > 0) {
							str += "<li>攻击范围+" + range + "；";
						}
						if (sha > 0) {
							str += "<li>使用【杀】的次数上限+" + sha + "；";
						}
						if (draw > 0) {
							str += "<li>摸牌阶段额定摸牌数+" + draw + "。";
						}
						str = str.slice(0, -1) + "。";
						return str;
					},
				},
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("dctongye_handcard");
					},
					attackRange(player, num) {
						return num + player.countMark("dctongye_range");
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("dctongye_sha");
						}
					},
				},
				ai: {
					threaten: 2.6,
				},
			},
		},
	},
	dcmianyao: {
		audio: 2,
		trigger: {
			player: "phaseDrawEnd",
		},
		direct: true,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		content() {
			"step 0";
			player
				.chooseCard("h", get.prompt("dcmianyao"), "展示点数最小的一张牌并随机插入牌堆中，然后于回合结束时摸此牌点数张牌。", function (card, player) {
					var num = get.number(card, player);
					return !player.hasCard(card2 => {
						return card != card2 && get.number(card2, player) < num;
					});
				})
				.set("ai", card => {
					var player = _status.event.player;
					var value = player.getUseValue(card, null, true);
					if (value > 5 && get.number(card) <= 2) {
						return 0;
					}
					return 1 + 1 / Math.max(0.1, value);
				});
			"step 1";
			if (result.bool) {
				player.logSkill("dcmianyao");
				var card = result.cards[0];
				event.card = card;
				player.showCards([card], get.translation(player) + "发动了【免徭】");
			} else {
				event.finish();
			}
			"step 2";
			player.$throw(1, 1000);
			player.lose(card, ui.cardPile).insert_index = function () {
				return ui.cardPile.childNodes[get.rand(0, ui.cardPile.childNodes.length - 1)];
			};
			player.addTempSkill("dcmianyao_draw");
			var num = get.number(card);
			if (num > 0) {
				player.addMark("dcmianyao_draw", num, false);
			}
		},
		subSkill: {
			draw: {
				audio: "dcmianyao",
				trigger: {
					player: "phaseEnd",
				},
				filter(event, player) {
					return player.hasMark("dcmianyao_draw");
				},
				forced: true,
				charlotte: true,
				onremove: true,
				content() {
					player.draw(player.countMark("dcmianyao_draw"));
				},
			},
		},
	},
	dcchangqu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		selectTarget() {
			return [1, game.countPlayer() - 1];
		},
		complexSelect: true,
		complexTarget: true,
		multitarget: true,
		multiline: true,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			var next = player.getNext(),
				prev = player.getPrevious();
			var selected = ui.selected.targets;
			if (!selected.includes(next) && !selected.includes(prev)) {
				return target == next || target == prev;
			}
			for (var i of selected) {
				if (i.getNext() == target || i.getPrevious() == target) {
					return true;
				}
			}
			return false;
		},
		contentBefore() {
			event.getParent()._dcchangqu_targets = targets.slice();
		},
		content() {
			"step 0";
			event.targets = event.getParent()._dcchangqu_targets;
			var current = targets[0];
			current.addMark("dcchangqu_warship");
			current.addMark("dcchangqu_warshipx", 1, false);
			event.num = 0;
			game.delayx();
			"step 1";
			var target = targets.shift();
			event.target = target;
			var num = Math.max(1, event.num);
			var nextPlayer = targets.find(i => {
				return i.isIn();
			});
			if (target.hasMark("dcchangqu_warshipx")) {
				var prompt2 = "是否交给" + get.translation(player) + get.cnNumber(num) + "张手牌？" + (nextPlayer ? "若如此做，将“战舰”移动给" + get.translation(nextPlayer) + "，" : "，") + "否则你下次受到的属性伤害值+" + num;
				target
					.chooseCard(get.translation(player) + "对你发动了【长驱】", prompt2, num)
					.set("ai", card => {
						if (_status.event.att > 0) {
							return 15 - get.value(card);
						}
						if (_status.event.take) {
							return 0;
						}
						return 8.2 - 0.8 * Math.min(5, _status.event.target.hp + _status.event.target.hujia) - get.value(card);
					})
					.set("att", get.attitude(target, player))
					.set("take", function () {
						var base = num;
						var getEffect = function (target, player, num) {
							var natures = ["fire", "thunder", "ice"];
							return (
								natures
									.map(nature => {
										return (get.damageEffect(target, target, player, nature) * Math.sqrt(num)) / Math.min(1.5, 1 + target.countCards("h"));
									})
									.reduce((sum, eff) => {
										return sum + eff;
									}, 0) / natures.length
							);
						};
						var eff = getEffect(player, player, base);
						return targets
							.some((current, ind) => {
								var num = base + ind + 1;
								var effx = getEffect(current, player, num);
								return effx < eff;
							})
							.set("target", target);
					});
			} else {
				event.goto(4);
			}
			"step 2";
			if (result.bool) {
				var cards = result.cards;
				target.give(cards, player);
				event.num++;
			} else {
				target.addSkill("dcchangqu_add");
				target.addMark("dcchangqu_add", Math.max(1, event.num), false);
				target.link(true);
				event.goto(4);
			}
			"step 3";
			var nextPlayer = targets.find(i => {
				return i.isIn();
			});
			if (nextPlayer) {
				target.line(nextPlayer);
				nextPlayer.addMark("dcchangqu_warship", target.countMark("dcchangqu_warship"));
				nextPlayer.addMark("dcchangqu_warshipx", target.countMark("dcchangqu_warshipx"), false);
				event.goto(1);
				game.delayx();
			}
			target.removeMark("dcchangqu_warship", target.countMark("dcchangqu_warship"));
			target.removeMark("dcchangqu_warshipx", target.countMark("dcchangqu_warshipx"), false);
			"step 4";
			var targets = game.players.slice().concat(game.dead);
			targets.forEach(i => {
				delete i.storage.dcchangqu_warshipx;
			});
		},
		ai: {
			order: 10,
			expose: 0.05,
			result: {
				target(player, target) {
					let targets = game.filterPlayer(i => i != player);
					targets.sortBySeat(player);
					let targets2 = targets.slice(0).reverse();
					let sum = 0;
					let maxSum = -Infinity,
						maxIndex = -1;
					let maxSum2 = -Infinity,
						maxIndex2 = -1;
					for (let i = 0; i < targets.length; i++) {
						let current = targets[i];
						let att = -get.attitude(player, current) - 0.1;
						let val = Math.sqrt(i + 1) * att;
						val /= 0.01 + Math.max(3, current.countCards("h") / 2);
						sum += val;
						if (sum > maxSum) {
							maxSum = sum;
							maxIndex = i;
						}
					}
					sum = 0;
					for (let i = 0; i < targets2.length; i++) {
						let current = targets[i];
						let att = -get.attitude(player, current) - 0.1;
						let val = Math.sqrt(i + 1) * att;
						val /= 0.01 + Math.max(3, current.countCards("h") / 2);
						sum += val;
						if (sum > maxSum2) {
							maxSum2 = sum;
							maxIndex2 = i;
						}
					}
					if (maxSum < maxSum2) {
						targets = targets2;
						maxIndex = maxIndex2;
					}
					if (ui.selected.targets.length > maxIndex) {
						return -100 * get.sgnAttitude(player, target);
					}
					if (target == targets[ui.selected.targets.length]) {
						return get.sgnAttitude(player, target);
					}
					return 0;
				},
			},
		},
		subSkill: {
			warship: {
				marktext: "舰",
				intro: {
					name: "战舰",
					name2: "战舰",
					content: "这里停了&艘战舰！不过啥用没有。",
				},
			},
			add: {
				trigger: {
					player: "damageBegin3",
				},
				filter(event, player) {
					return event.hasNature() && player.hasMark("dcchangqu_add");
				},
				forced: true,
				onremove: true,
				charlotte: true,
				content() {
					"step 0";
					trigger.num += player.countMark("dcchangqu_add");
					player.removeSkill("dcchangqu_add");
				},
				marktext: "驱",
				intro: {
					content: "下次受到的属性伤害+#",
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (game.hasNature(card)) {
								return 1 + target.countMark("dcchangqu_add");
							}
						},
					},
				},
			},
		},
	},
};
