import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "kuiji" | "pytianjiang" | "pytianjiang_move" | "pyzhuren" | "pyzhuren_heart">} */
export const groupSkills = {
	kuiji: {
		audio: 2,
		usable: 1,
		enable: "phaseUse",
		filter(event, player) {
			if (player.hasJudge("bingliang")) {
				return false;
			}
			return (
				player.countCards("hes", function (card) {
					return get.color(card) == "black" && get.type(card) == "basic";
				}) > 0
			);
		},
		position: "hes",
		discard: false,
		lose: false,
		delay: false,
		prepare(cards, player) {
			player.$give(cards, player, false);
		},
		filterCard(card, player, event) {
			const bingliang = get.autoViewAs({ name: "bingliang", cards: [card] }, [card]);
			return get.color(card) == "black" && get.type(card) == "basic" && player.canAddJudge(bingliang);
		},
		selectTarget: -1,
		filterTarget(card, player, target) {
			return player == target;
		},
		check(card) {
			return 9 - get.value(card);
		},
		// onuse:function(links,player){
		// 	var next=game.createEvent('kuiji_content',false,_status.event.getParent());
		// 	next.player=player;
		// 	next.setContent(lib.skill.kuiji.kuiji_content);
		// },
		// kuiji_content:function(){
		content() {
			"step 0";
			player.addJudge({ name: "bingliang" }, cards);
			player.draw();
			"step 1";
			var next = player.chooseTarget().set("ai", function (target) {
				let player = _status.event.player;
				if (
					target.hasSkillTag(
						"filterDamage",
						null,
						{
							player: player,
						},
						true
					)
				) {
					return get.damageEffect(target, player, player);
				}
				return 2 * get.damageEffect(target, player, player);
			});
			if (!["identity", "guozhan"].includes(get.mode())) {
				next.set("prompt", "选择一名体力值最大的敌方角色，对其造成2点伤害");
				next.set("filterTarget", function (card, player, target) {
					return (
						target.isEnemyOf(player) &&
						!game.hasPlayer(function (current) {
							return current.isEnemyOf(player) && current.hp > target.hp;
						})
					);
				});
			} else {
				next.set("prompt", "选择一名除你外体力值最大的角色，对其造成2点伤害");
				next.set("filterTarget", function (card, player, target) {
					return (
						player != target &&
						!game.hasPlayer(function (current) {
							return current != player && current.hp > target.hp;
						})
					);
				});
			}
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target);
				target.damage(2);
			}
		},
		ai: {
			result: {
				target(player, target) {
					let es;
					if (["identity", "guozhan"].includes(get.mode())) {
						es = game.hasPlayer(i => {
							return (
								i != player &&
								!game.hasPlayer(j => {
									return player !== j && j.hp > i.hp;
								}) &&
								get.attitude(player, i) < 0
							);
						});
					} else {
						es = game.hasPlayer(i => {
							return (
								i.isEnemyOf(player) &&
								!game.hasPlayer(j => {
									return j.hp > i.hp && j.isEnemyOf(player);
								}) &&
								get.attitude(player, i) < 0
							);
						});
					}
					if (es) {
						return 2;
					}
					return -1.5;
				},
			},
			order: 12,
		},
		group: "kuiji_dying",
		subSkill: {
			dying: {
				trigger: { global: "dying" },
				filter(event, player) {
					let evt = event.getParent(2);
					return evt && evt.name == "kuiji";
				},
				locked: true,
				direct: true,
				content() {
					"step 0";
					var list;
					if (["identity", "guozhan"].includes(get.mode())) {
						list = game
							.filterPlayer(current => {
								return (
									current !== trigger.player &&
									!game.hasPlayer(i => {
										return trigger.player !== i && i.hp < current.hp;
									})
								);
							})
							.filter(i => i.isDamaged());
					} else {
						list = game
							.filterPlayer(current => {
								return (
									current.isFriendOf(player) &&
									!game.hasPlayer(i => {
										return i.hp < current.hp && i.isFriendOf(player);
									})
								);
							})
							.filter(i => i.isDamaged());
					}
					if (list.length > 1) {
						player
							.chooseTarget(
								"溃击：选择一名角色回复1点体力",
								(card, player, target) => {
									return _status.event.list.includes(target);
								},
								true
							)
							.set("list", list)
							.set("ai", target => {
								return get.recoverEffect(target, player, _status.event.player);
							});
					} else if (list.length) {
						event._result = { bool: true, targets: list };
					} else {
						event._result = { bool: false };
					}
					"step 1";
					if (result.bool) {
						let target = result.targets[0];
						player.logSkill("kuiji", target);
						target.recover();
					}
				},
			},
		},
	},
	//蒲元
	pytianjiang: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		content() {
			"step 0";
			var i = 0;
			var list = [];
			while (i++ < 2) {
				var card = get.cardPile(
					function (card) {
						if (get.type(card) != "equip") {
							return false;
						}
						return list.length == 0 || get.subtype(card) != get.subtype(list[0]);
					},
					false,
					"random"
				);
				if (card) {
					list.push(card);
				}
			}
			if (!list.length) {
				event.finish();
				return;
			}
			event.list = list;
			player.gain(event.list, "gain2");
			"step 1";
			game.delay(1);
			var card = event.list.shift();
			if (player.getCards("h").includes(card)) {
				player.$give(card, player, false);
				player.equip(card);
			}
			if (event.list.length) {
				event.redo();
			}
		},
		group: "pytianjiang_move",
	},
	pytianjiang_move: {
		audio: "pytianjiang",
		prompt: "将装备区里的一张牌移动至其他角色的装备区",
		enable: "phaseUse",
		position: "e",
		sourceSkill: "pytianjiang",
		filter(event, player) {
			return player.countCards("e") > 0;
		},
		check() {
			return 1;
		},
		filterCard: true,
		filterTarget(event, player, target) {
			return target != player && target.canEquip(ui.selected.cards[0], true);
		},
		prepare: "give",
		discard: false,
		lose: false,
		content() {
			"step 0";
			target.equip(cards[0]);
			"step 1";
			if (cards[0].name.indexOf("pyzhuren_") == 0 && !player.getCards("e").includes(cards[0])) {
				player.draw(2);
			}
		},
		ai: {
			order: (item, player) => {
				if (player.hasCard(i => get.subtype(i) === "equip1", "h")) {
					return 11;
				}
				return 1;
			},
			expose: 0.2,
			result: {
				target(player, target) {
					if (ui.selected.cards.length) {
						let card = ui.selected.cards[0],
							tv = get.value(card, target),
							sub = get.subtype(card);
						if (sub === "equip1") {
							let ev = Infinity,
								te = target.getEquips(1);
							if (!te.length) {
								return tv;
							}
							te.forEach(i => {
								ev = Math.min(ev, get.value(i));
							});
							if (card.name.indexOf("pyzhuren_") == 0) {
								return 2 + tv - ev;
							}
							return tv - ev;
						}
						if (target.hasCard(i => get.subtype(i) === sub, "he")) {
							return 0;
						}
						let pv = get.value(card, player);
						if (pv > 0 && Math.abs(tv) <= pv) {
							return 0;
						}
						return tv;
					}
					return 0;
				},
			},
		},
	},
	pyzhuren: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		selectCard: 1,
		check(card) {
			var player = _status.event.player;
			var name = "pyzhuren_" + card[card.name == "shandian" ? "name" : "suit"];
			if (!lib.card[name] || (_status.pyzhuren && _status.pyzhuren[name])) {
				if (!player.countCards("h", "sha")) {
					return 4 - get.value(card);
				}
				return 0;
			}
			return 7 - get.value(card);
		},
		content() {
			//player.addSkill('pyzhuren_destroy');
			if (!_status.pyzhuren) {
				_status.pyzhuren = {};
			}
			var rand = 0.85;
			var num = get.number(cards[0]);
			if (num > 4) {
				rand = 0.9;
			}
			if (num > 8) {
				rand = 0.95;
			}
			if (num > 12 || cards[0].name == "shandian" || get.isLuckyStar(player)) {
				rand = 1;
			}
			var name = "pyzhuren_" + cards[0][cards[0].name == "shandian" ? "name" : "suit"];
			if (!lib.card[name] || _status.pyzhuren[name] || Math.random() > rand) {
				player.popup("杯具");
				game.log(player, "锻造失败");
				var card = get.cardPile(function (card) {
					return card.name == "sha";
				});
				if (card) {
					player.gain(card, "gain2");
				}
			} else {
				_status.pyzhuren[name] = true;
				var card = game.createCard(name, cards[0].name == "shandian" ? "spade" : cards[0].suit, 1);
				card.destroyed = "discardPile";
				player.gain(card, "gain2");
			}
		},
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
	},
	pyzhuren_heart: {
		audio: true,
		trigger: { source: "damageSource" },
		usable: 1,
		equipSkill: true,
		filter(event, player) {
			return event.getParent().name == "sha";
		},
		content() {
			"step 0";
			player.judge(function (card) {
				var player = _status.event.getParent("pyzhuren_heart").player;
				if (player.isHealthy() && get.color(card) == "red") {
					return 0;
				}
				return 2;
			});
			"step 1";
			switch (result.color) {
				case "red":
					player.recover();
					break;
				case "black":
					player.draw(2);
					break;
				default:
					break;
			}
		},
		ai: {
			equipValue(card, player) {
				if (player.isDamaged()) {
					return 4.5;
				}
				return 6;
			},
			basic: {
				equipValue: 4.5,
			},
		},
	},
};
