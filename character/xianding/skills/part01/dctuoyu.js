import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dctuoyu" | "dcxianjin">} */
export const groupSkills = {
	//神邓艾
	dctuoyu: {
		audio: 2,
		trigger: { player: ["phaseUseBegin", "phaseUseEnd"] },
		filter(event, player) {
			return player.countCards("h") > 0 && player.getStorage("dctuoyu").length > 0;
		},
		forced: true,
		async content(event, trigger, player) {
			var hs = player.getCards("h"),
				tags = ["dctuoyu_fengtian", "dctuoyu_qingqu", "dctuoyu_junshan"];
			var storage = player.getStorage("dctuoyu");
			var list = [
				["未分配手牌", []],
				[get.translation(tags[0] + "_tag") + '<div class="text center">伤害/回复值+1</div>', []],
				[get.translation(tags[1] + "_tag") + '<div class="text center">无次数和距离限制</div>', []],
				[get.translation(tags[2] + "_tag") + '<div class="text center">不可被响应</div>', []],
			];
			for (var card of hs) {
				var added = false;
				for (var i = 0; i < tags.length; i++) {
					if (card.hasGaintag(tags[i] + "_tag")) {
						added = true;
						list[i + 1][1].push(card);
						break;
					}
				}
				if (!added) {
					list[0][1].push(card);
				}
			}
			for (var i = 0; i < tags.length; i++) {
				if (!storage.includes(tags[i])) {
					list[i + 1][0] = get.translation(tags[i] + "_tag") + '<div class="text center">尚未激活</div>';
				}
			}
			list = [list[0], list.slice(1)];
			var next = player.chooseToMove_new("拓域：请分配你的手牌", true);
			next.set("list", list);
			next.set("filterMove", function (from, to, moved) {
				var player = _status.event.player;
				var storage = player.getStorage("dctuoyu"),
					tags = ["dctuoyu_fengtian", "dctuoyu_qingqu", "dctuoyu_junshan"];
				if (typeof to == "number") {
					if (to == 0) {
						return true;
					}
					return storage.includes(tags[to - 1]) && moved[to].length < 5;
				}
				return true;
			});
			next.set("processAI", function () {
				var player = _status.event.player;
				var storage = player.getStorage("dctuoyu"),
					tags = ["dctuoyu_fengtian", "dctuoyu_qingqu", "dctuoyu_junshan"];
				var moved = [[], [], [], []];
				var isEmpty = function (to) {
					return storage.includes(tags[to - 1]) && moved[to].length < 5;
				};
				var hs = player.getCards("h");
				var hs2 = hs.slice(0);
				var usable = player.getCardUsable("sha");
				var addTo = function (card, to) {
					if (isEmpty(to)) {
						hs2.remove(card);
						moved[to].push(card);
						if (get.name(card) == "sha" && to != 2) {
							usable--;
						}
					}
				};
				var hasRuanshizi = game.hasPlayer(function (target) {
					return target != player && player.canUse("sha", target, null, true) && !target.mayHaveShan(player, "use") && get.attitude(player, target) < 0 && get.effect(target, { name: "sha" }, player, player) > 0;
				});
				for (var card of hs) {
					var name = get.name(card);
					if (name == "tao" || name == "jiu") {
						addTo(card, 1);
					} else if (name == "sha") {
						if (hasRuanshizi && isEmpty(1) && usable > 0) {
							addTo(card, 1);
						} else if (isEmpty(3) && usable > 0) {
							addTo(card, 3);
						} else {
							addTo(card, 2);
						}
					} else if (get.type(name) == "trick") {
						if (isEmpty(1) && get.tag(card, "damage") > 0 && player.hasUseTarget(card)) {
							addTo(card, 1);
						} else {
							addTo(card, 3);
						}
					}
				}
				moved[0].addArray(hs2);
				return moved;
			});
			var result = await next.forResult();
			if (result.bool) {
				game.broadcastAll(
					function (moved, player) {
						if (player == game.me) {
							const cards = moved.flat(1).reverse();
							game.addVideo("lose", game.me, [get.cardsInfo(cards), [], [], []]);
							for (var i = 0; i < cards.length; i++) {
								cards[i].goto(ui.special);
							}
							game.me.directgain(cards, false);
						}
						var tags = ["dctuoyu_fengtian", "dctuoyu_qingqu", "dctuoyu_junshan"];
						var map = {};
						for (var i = 0; i < moved.length; i++) {
							for (var card of moved[i]) {
								for (var j = 0; j < tags.length; j++) {
									const tag = `${tags[j]}_tag`;
									const glowClass = `dctuoyu-${tags[j].replace("dctuoyu_", "")}-glow`;
									if (!map[tag]) {
										map[tag] = [[], []];
									}
									if (i == j + 1) {
										map[tag][0].add(card);
										if (!card.hasGaintag(tag)) {
											card.addGaintag(tag);
											card.classList.add(glowClass);
										}
									} else {
										if (card.hasGaintag(tag)) {
											map[tag][1].add(card);
											card.removeGaintag(tag);
											card.classList.remove(glowClass);
										}
									}
								}
							}
						}
						for (const tag in map) {
							if (map[tag][0].length) {
								game.addVideo("addGaintag", player, [get.cardsInfo(map[tag][0]), tag]);
								for (const card of map[tag][0]) {
									const glowClass = `dctuoyu-${tag.replace("_tag", "").replace("dctuoyu_", "")}-glow`;
									card.classList.add(glowClass);
								}
								game.addVideo("skill", player, ["dctuoyu", [true, get.cardsInfo(map[tag][0]), tag]]);
							}
							if (map[tag][1].length) {
								game.addVideo("removeGaintag", player, [tag, get.cardsInfo(map[tag][1])]);
								for (const card of map[tag][1]) {
									const glowClass = `dctuoyu-${tag.replace("_tag", "").replace("dctuoyu_", "")}-glow`;
									card.classList.remove(glowClass);
								}
								game.addVideo("skill", player, ["dctuoyu", [false, get.cardsInfo(map[tag][1]), tag]]);
							}
						}
						game.addVideo("delay", null, 1);
					},
					result.moved,
					player
				);
			}
		},
		video(player, info) {
			const glowClass = `dctuoyu-${info[2].replace("_tag", "").replace("dctuoyu_", "")}-glow`;
			for (const cardid of info[1]) {
				for (const card of player.getCards("h")) {
					if (card.cardid === cardid[4]) {
						card.classList[info[0] ? "add" : "remove"](glowClass);
					}
				}
			}
		},
		init(player) {
			game.broadcastAll(player => {
				const observer = new MutationObserver(mutationsList => {
					const tags = ["dctuoyu_fengtian", "dctuoyu_qingqu", "dctuoyu_junshan"];
					for (const mutation of mutationsList) {
						if (mutation.type === "childList") {
							for (const card of mutation.addedNodes) {
								if (card.nodeType === Node.ELEMENT_NODE && get.itemtype(card) === "card") {
									for (let i = 0; i < tags.length; i++) {
										const glowClass = `dctuoyu-${tags[i].replace("dctuoyu_", "")}-glow`;
										if (card.hasGaintag(tags[i] + "_tag") && !card.classList.contains(glowClass)) {
											//添加样式+录像
											game.broadcastAll(
												(player, card, glowClass, tag) => {
													card.classList.add(glowClass);
													game.addVideo("skill", player, ["dctuoyu", [true, [get.cardInfo(card)], tag]]);
												},
												player,
												card,
												glowClass,
												tags[i]
											);
										}
									}
								}
							}
							for (const card of mutation.removedNodes) {
								if (card.nodeType === Node.ELEMENT_NODE && get.itemtype(card) === "card") {
									for (let i = 0; i < tags.length; i++) {
										const glowClass = `dctuoyu-${tags[i].replace("dctuoyu_", "")}-glow`;
										if (card.classList.contains(glowClass)) {
											//移除样式+录像
											game.broadcastAll(
												(player, card, glowClass, tag) => {
													card.classList.remove(glowClass);
													game.addVideo("skill", player, ["dctuoyu", [false, [get.cardInfo(card)], tag]]);
												},
												player,
												card,
												glowClass,
												tags[i]
											);
										}
									}
								}
							}
						}
					}
				});
				const config = { childList: true };
				observer.observe(player.node.handcards1, config);
				observer.observe(player.node.handcards2, config);
				player._dctuoyu_observer = observer;
			}, player);
		},
		onremove(player) {
			game.broadcastAll(player => {
				if (player._dctuoyu_observer) {
					player._dctuoyu_observer.disconnect();
					delete player._dctuoyu_observer;
				}
				const tags = ["dctuoyu_fengtian", "dctuoyu_qingqu", "dctuoyu_junshan"];
				for (const card of player.getCards("h")) {
					for (let i = 0; i < tags.length; i++) {
						const tag = tags[i] + "_tag";
						if (card.hasGaintag(tag)) {
							//移除标记+录像
							card.removeGaintag(tag);
							game.addVideo("removeGaintag", player, [tag, [get.cardInfo(card)]]);
							const glowClass = `dctuoyu-${tags[i].replace("dctuoyu_", "")}-glow`;
							//移除样式+录像
							card.classList.add(glowClass);
							game.addVideo("skill", player, ["dctuoyu", [true, [get.cardInfo(card)], tags[i]]]);
						}
					}
				}
			}, player);
		},
		intro: { content: "已激活的副区域：$" },
		group: "dctuoyu_effect",
		subSkill: {
			effect: {
				mod: {
					targetInRange(card, player, target) {
						if (get.suit(card) == "unsure") {
							return true;
						}
						if (!card.cards) {
							return;
						}
						for (var i of card.cards) {
							if (i.hasGaintag("dctuoyu_qingqu_tag")) {
								return true;
							}
						}
					},
					cardUsable(card, player, num) {
						if (get.suit(card) == "unsure") {
							return Infinity;
						}
						if (!card.cards) {
							return;
						}
						for (var i of card.cards) {
							if (i.hasGaintag("dctuoyu_qingqu_tag")) {
								return Infinity;
							}
						}
					},
				},
				audio: "dctuoyu",
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					return player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx !== event) {
							return false;
						}
						return Object.values(evt.gaintag_map).flat().containsSome("dctuoyu_fengtian_tag", "dctuoyu_qingqu_tag", "dctuoyu_junshan_tag");
					});
				},
				async content(event, trigger, player) {
					const tags = ["dctuoyu_fengtian_tag", "dctuoyu_qingqu_tag", "dctuoyu_junshan_tag"];
					player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx != trigger) {
							return false;
						}
						for (const i in evt.gaintag_map) {
							tags.removeArray(evt.gaintag_map[i]);
						}
						return tags.length == 0;
					});
					const card = trigger.card;
					if (!tags.includes("dctuoyu_fengtian_tag")) {
						if (get.tag(card, "damage") > 0 || get.tag(card, "recover") > 0) {
							trigger.baseDamage++;
							game.log(card, "的伤害值/回复值+1");
						}
					}
					if (!tags.includes("dctuoyu_qingqu_tag")) {
						if (trigger.addCount !== false) {
							trigger.addCount = false;
							let stat = player.getStat("card");
							if (stat[card.name] && stat[card.name] > 0) {
								stat[card.name]--;
							}
							game.log(card, "不计入次数限制");
						}
					}
					if (!tags.includes("dctuoyu_junshan_tag")) {
						game.log(card, "不可被响应");
						trigger.directHit.addArray(game.filterPlayer());
					}
				},
			},
		},
		ai: { combo: "dcxianjin" },
	},
	dcxianjin: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player, name) {
			let history = game.getAllGlobalHistory("everything", evt => {
				if (evt.name !== "damage" || !evt.player.getAllHistory("damage").includes(evt)) {
					//这里是为了筛选掉被防止和取消的伤害事件
					return false;
				}
				return evt.player === player || evt.source === player;
			});
			history = history
				.map(evt => {
					let list = [];
					if (evt.source === player) {
						list.push([evt, "damageSource"]);
					}
					if (evt.player === player) {
						list.push([evt, "damageEnd"]);
					}
					return list;
				})
				.flat();
			let list = history.find(lit => lit[0] === event && lit[1] === name);
			return list && history.indexOf(list) % 2 === 1;
		},
		forced: true,
		async content(event, trigger, player) {
			let tags = ["dctuoyu_fengtian", "dctuoyu_qingqu", "dctuoyu_junshan"];
			tags.removeArray(player.getStorage("dctuoyu"));
			if (tags.length > 0) {
				const control =
					tags.length === 1
						? tags[0]
						: (
								await player
									.chooseControl(tags)
									.set(
										"choiceList",
										tags.map(tag => {
											return `${get.translation(`${tag}_tag`)}：${
												{
													dctuoyu_fengtian: "伤害/回复值+1",
													dctuoyu_qingqu: "无次数和距离限制",
													dctuoyu_junshan: "不可被响应",
												}[tag]
											}`;
										})
									)
									.set("displayIndex", false)
									.set("prompt", "险峻：选择激活一个副区域标签")
									.forResult()
							).control;
				game.log(player, "激活了副区域", "#y" + get.translation(control));
				player.markAuto("dctuoyu", [control]);
				player.popup(get.translation(control + "_tag"));
			}
			await player.draw(player.isMaxHandcard() ? 1 : player.getStorage("dctuoyu").length);
		},
		ai: {
			effect: {
				player(card, player, target) {
					if (!get.tag(card, "damage") || player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					let history = game.getAllGlobalHistory("everything", evt => {
						if (evt.name !== "damage" || !evt.player.getAllHistory("damage").includes(evt)) {
							//这里是为了筛选掉被防止和取消的伤害事件
							return false;
						}
						return evt.player === player || evt.source === player;
					});
					if (
						history.reduce((sum, evt) => {
							if (evt.source === player) {
								sum++;
							}
							if (evt.player === player) {
								sum++;
							}
							return sum;
						}, 0) %
							2 ===
						0
					) {
						return;
					}
					if (player.isMaxHandcard()) {
						return [1, 1];
					}
					return [1, Math.min(3, 1 + player.getStorage("dctuoyu").length)];
				},
			},
		},
	},
};
