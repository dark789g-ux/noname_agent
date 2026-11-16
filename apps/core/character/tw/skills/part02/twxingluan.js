import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twxingluan">} */
export const groupSkills = {
	//樊稠
	twxingluan: {
		audio: "xinfu_xingluan",
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		content() {
			"step 0";
			event.cards = game.cardsGotoOrdering(get.cards(6)).cards;
			event.list = [];
			event.videoId = lib.status.videoId++;
			game.broadcastAll(
				function (player, id, cards) {
					var str;
					if (player == game.me && !_status.auto) {
						str = "兴乱：选择分配一种类别的牌";
					} else {
						str = "兴乱";
					}
					var dialog = ui.create.dialog(str, cards);
					dialog.videoId = id;
				},
				player,
				event.videoId,
				event.cards
			);
			event.time = get.utc();
			game.addVideo("showCards", player, ["兴乱", get.cardsInfo(event.cards)]);
			game.addVideo("delay", null, 2);
			"step 1";
			var list = ["basic", "trick", "equip"].filter(type => cards.some(card => get.type2(card) == type));
			let fs = game
					.filterPlayer(i => get.attitude(_status.event.player, i) > 0)
					.sort((a, b) => {
						if (a === player) {
							//尽量把player往前放
							if (a.hp < b.hp) {
								return 1;
							}
							return -1;
						}
						if (b === player) {
							if (b.hp < a.hp) {
								return -1;
							}
							return 1;
						}
						return b.hp - a.hp;
					}),
				es = game.filterPlayer(i => get.attitude(_status.event.player, i) < 0).sort((a, b) => a.hp - b.hp),
				types = list
					.map(type => {
						let num = 0;
						for (let i of event.cards) {
							if (get.type2(i) == type) {
								num++;
							}
						}
						return [type, num];
					})
					.sort((a, b) => b[1] - a[1]);
			event.tempCache = {
				max: -Infinity,
				tars: [],
			};
			for (let idx = 0; idx < types.length; idx++) {
				let f,
					e,
					temp = 0,
					tars = [],
					type = types[idx][1];
				if (es.length * 3 >= type) {
					//都分给敌人
					e = -type;
					while (temp < es.length && temp < type) {
						e += 10 / (2 + es[temp].hp);
						tars.push(es[temp]);
						temp++;
					}
					if (e > event.tempCache.max) {
						event.tempCache.type = types[idx][0];
						event.tempCache.max = e;
						event.tempCache.tars = tars.slice(0);
						delete event.tempCache.more;
					}
				}
				if (fs.length * 3 >= type) {
					//都分给队友
					tars = [];
					f = type - 10 / (2 + fs[0].hp);
					temp = type - Math.max(3, type); //让血厚的尽可能多拿
					if (temp) {
						if (fs.length < 3) {
							tars.push(fs[1]);
							if (temp >= 3) {
								f -= 10 / (2 + fs[1].hp);
							}
						} else {
							if (player !== fs[0]) {
								tars.push(player);
								temp -= Math.max(2, temp);
							}
							if (temp) {
								tars.addArray(
									fs
										.filter(i => fs[0] !== i && player !== i)
										.sort((a, b) => {
											return get.attitude(_status.event.player, b) - get.attitude(_status.event.player, a);
										})
										.slice(temp < 3 ? -1 : -2)
								);
							}
						}
					}
					if (f > event.tempCache.max) {
						event.tempCache.type = types[idx][0];
						event.tempCache.max = f;
						event.tempCache.more = fs[0];
						event.tempCache.tars = tars.slice(0);
					}
				}
			}
			player
				.chooseControl(list)
				.set("ai", function () {
					return _status.event.type;
				})
				.set("type", event.tempCache.type);
			"step 2";
			game.broadcastAll("closeDialog", event.videoId);
			event.cardsx = [];
			var type = result.control;
			for (var j of cards) {
				if (type == get.type2(j)) {
					event.cardsx.push(j);
				}
			}
			var time = 1000 - (get.utc() - event.time);
			if (time > 0) {
				game.delay(0, time);
			}
			player.$gain2(event.cardsx, false);
			game.delayx();
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			event.given_map = {};
			event.num = 0;
			"step 3";
			if (event.cardsx.length > 1) {
				player
					.chooseCardButton("兴乱：请选择要分配的牌", true, event.cardsx, [1, Math.min(3, event.cardsx.length)])
					.set("ai", function (button) {
						if (ui.selected.buttons.length == 0) {
							return get.buttonValue(button);
						}
						return 0;
					});
			} else if (event.cardsx.length == 1) {
				event._result = { links: event.cardsx.slice(0), bool: true };
			} else {
				event.goto(6);
			}
			"step 4";
			if (result.bool) {
				var cards = result.links;
				event.togive = cards.slice(0);
				player
					.chooseTarget("选择获得" + get.translation(cards) + "的角色", event.cardsx.length == 1, (card, player, target) => {
						var map = _status.event.getParent().given_map;
						var togive = _status.event.getParent().togive;
						return (map[target.playerid] || []).length + togive.length <= 3;
					})
					.set("ai", function (target) {
						let targets = _status.event.targets,
							att = get.attitude(_status.event.player, target);
						if (targets.length) {
							if (targets.includes(target)) {
								return Math.max(1, att * _status.event.value);
							}
							return 0;
						}
						return att * _status.event.value;
					})
					.set(
						"value",
						cards.reduce((p, c) => p + get.value(c, player, "raw"), 0)
					)
					.set("more", event.tempCache.more)
					.set(
						"targets",
						(function () {
							let arr = [],
								arr2 = [];
							if (event.tempCache.more && (event.given_map[event.tempCache.more.playerid] || []).length + cards.length <= 3) {
								return [event.tempCache.more];
							}
							for (let cur of event.tempCache.tars) {
								let map = (event.given_map[cur.playerid] || []).length;
								if (map + cards.length <= 3) {
									if (map) {
										arr2.push(cur);
									} else {
										arr.push(cur);
									}
								}
							}
							if (arr.length) {
								return arr;
							}
							return arr2;
						})()
					);
			}
			"step 5";
			if (result.bool) {
				event.cardsx.removeArray(event.togive);
				if (result.targets.length) {
					var id = result.targets[0].playerid,
						map = event.given_map;
					if (!map[id]) {
						map[id] = [];
					}
					map[id].addArray(event.togive);
				}
				if (event.cardsx.length > 0) {
					event.goto(3);
				}
			} else {
				event.goto(3);
			}
			"step 6";
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			var list = [];
			for (var i in event.given_map) {
				var source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				if (player == source) {
					event.num += event.given_map[i].length;
				}
				player.line(source, "green");
				game.log(source, "获得了", event.given_map[i]);
				list.push([source, event.given_map[i]]);
			}
			game.loseAsync({
				gain_list: list,
				giver: player,
				animate: "gain2",
			}).setContent("gaincardMultiple");
			"step 7";
			var list = [];
			for (var i in event.given_map) {
				var source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				if (event.given_map[i].length >= num) {
					list.push(source);
				}
			}
			list.sortBySeat();
			player.line(list);
			for (var i of list) {
				i.loseHp();
			}
		},
	},
};
