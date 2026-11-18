import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const reshuangxiongSkills = {
	reshuangxiong: {
		audio: "shuangxiong",
		audioname: ["re_yanwen"],
		group: ["reshuangxiong_judge", "reshuangxiong_gain"],
		subSkill: {
			judge: {
				audio: "reshuangxiong",
				logAudio: () => 1,
				trigger: { player: "phaseDrawBegin1" },
				check(event, player) {
					if (player.countCards("h") > player.hp) {
						return true;
					}
					if (player.countCards("h") > 3) {
						return true;
					}
					return false;
				},
				filter(event, player) {
					return !event.numFixed;
				},
				prompt2() {
					return "放弃摸牌，然后亮出牌堆顶的两张牌并选择获得其中的一张。本回合内可以将与此牌颜色不同的一张手牌当做【决斗】使用";
				},
				async content(event, trigger, player) {
					// step 0
					trigger.changeToZero();
					event.cards = get.cards(2);
					event.videoId = lib.status.videoId++;
					game.broadcastAll(
						function (player, id, cards) {
							const str = player == game.me && !_status.auto ? "【双雄】选择获得其中一张牌" : "双雄";
							const dialog = ui.create.dialog(str, cards);
							dialog.videoId = id;
						},
						player,
						event.videoId,
						event.cards
					);
					event.time = get.utc();
					game.addVideo("showCards", player, ["双雄", get.cardsInfo(event.cards)]);
					game.addVideo("delay", null, 2);

					// step 1
					const result = await player
						.chooseButton([1, 1], true)
						.set("dialog", event.videoId)
						.set("ai", function (button) {
							const playerx = _status.event.player;
							const color = get.color(button.link);
							let value = get.value(button.link, playerx);
							if (playerx.countCards("h", { color: color }) > playerx.countCards("h", ["red", "black"].remove(color)[0])) {
								value += 5;
							}
							return value;
						})
						.forResult();

					// step 2
					if (result.bool && result.links) {
						const cards2 = [];
						for (const link of result.links) {
							cards2.push(link);
							event.cards.remove(link);
						}
						await game.cardsDiscard(event.cards);
						event.card2 = cards2[0];
					}

					const time = 1000 - (get.utc() - event.time);
					if (time > 0) {
						await game.delay(0, time);
					}

					// step 3
					game.broadcastAll("closeDialog", event.videoId);
					const card2 = event.card2;
					if (card2) {
						await player.gain(card2, "gain2");
						player.addTempSkill("reshuangxiong_viewas");
						player.markAuto("reshuangxiong_viewas", [get.color(card2, false)]);
					}
				},
			},
			gain: {
				trigger: {
					player: "damageEnd",
				},
				audio: "reshuangxiong",
				filter(event, player) {
					const evt = event.getParent();
					return evt?.name == "juedou" && evt[player == evt.player ? "targetCards" : "playerCards"]?.someInD("od");
				},
				async cost(event, trigger, player) {
					let evt = trigger.getParent();
					let cards = evt[player == evt.player ? "targetCards" : "playerCards"].slice(0).filterInD("od");
					event.result = await player.chooseBool("是否发动【双雄】，获得" + get.translation(cards) + "?").forResult();
					event.result.cards = cards;
				},
				async content(event, trigger, player) {
					await player.gain(event.cards, "gain2");
				},
			},
			viewas: {
				charlotte: true,
				onremove: true,
				audio: "reshuangxiong",
				logAudio: () => "shuangxiong_re_yanwen2.mp3",
				enable: "chooseToUse",
				viewAs: { name: "juedou" },
				position: "hs",
				viewAsFilter(player) {
					return player.hasCard(card => lib.skill.reshuangxiong_viewas.filterCard(card, player), "hs");
				},
				filterCard(card, player) {
					const color = get.color(card),
						colors = player.getStorage("reshuangxiong_viewas");
					for (const i of colors) {
						if (color != i) {
							return true;
						}
					}
					return false;
				},
				prompt() {
					const colors = _status.event.player.getStorage("reshuangxiong_viewas");
					let str = "将一张颜色";
					for (let i = 0; i < colors.length; i++) {
						if (i > 0) {
							str += "或";
						}
						str += "不为";
						str += get.translation(colors[i]);
					}
					str += "的手牌当做【决斗】使用";
					return str;
				},
				check(card) {
					const player = _status.event.player;
					const raw = player.getUseValue(card, null, true);
					const eff = player.getUseValue(get.autoViewAs({ name: "juedou" }, [card]));
					return eff - raw;
				},
				ai: { order: 7 },
			},
		},
	},
	reshuangxiong1: {
		audio: "shuangxiong1",
		audioname2: {
			re_yanwen: "shuangxiong_re_yanwen1",
		},
		trigger: { player: "phaseDrawBegin1" },
		sourceSkill: "reshuangxiong",
		check(event, player) {
			if (player.countCards("h") > player.hp) {
				return true;
			}
			if (player.countCards("h") > 3) {
				return true;
			}
			return false;
		},
		filter(event, player) {
			return !event.numFixed;
		},
		prompt2() {
			return "放弃摸牌，然后亮出牌堆顶的两张牌并选择获得其中的一张。本回合内可以将与此牌颜色不同的一张手牌当做【决斗】使用";
		},
		async content(event, trigger, player) {
			const cards = event.cards.slice(0);
			let result;

			// step 0
			trigger.changeToZero();
			event.cards = get.cards(2);
			event.videoId = lib.status.videoId++;
			game.broadcastAll(
				(player, id, cardsInner) => {
					const str = player == game.me && !_status.auto ? "【双雄】选择获得其中一张牌" : "双雄";
					const dialog = ui.create.dialog(str, cardsInner);
					dialog.videoId = id;
				},
				player,
				event.videoId,
				event.cards
			);
			event.time = get.utc();
			game.addVideo("showCards", player, ["双雄", get.cardsInfo(event.cards)]);
			game.addVideo("delay", null, 2);

			// step 1
			result = await player
				.chooseButton([1, 1], true)
				.set("dialog", event.videoId)
				.set("ai", function (button) {
					const playerx = _status.event.player;
					const color = get.color(button.link);
					let value = get.value(button.link, playerx);
					if (playerx.countCards("h", { color }) > playerx.countCards("h", ["red", "black"].remove(color)[0])) {
						value += 5;
					}
					return value;
				})
				.forResult();

			// step 2
			if (result?.bool && result.links) {
				const cards2 = [];
				for (const link of result.links) {
					cards2.push(link);
					cards.remove(link);
				}
				await game.cardsDiscard(cards);
				event.card2 = cards2[0];
			}

			const time = 1000 - (get.utc() - event.time);
			if (time > 0) {
				await game.delay(0, time);
			}

			// step 3
			game.broadcastAll("closeDialog", event.videoId);
			const card2 = event.card2;
			if (card2) {
				await player.gain(card2, "gain2");
				player.addTempSkill("shuangxiong2");
				player.markAuto("shuangxiong2", [get.color(card2, false)]);
			}
		},
	},
	reshuangxiong2: {
		trigger: {
			player: "damageEnd",
		},
		direct: true,
		sourceSkill: "reshuangxiong",
		filter(event, player) {
			var evt = event.getParent();
			return (evt && evt.name == "juedou" && evt[player == evt.player ? "targetCards" : "playerCards"].length) > 0;
		},
		async content(event, trigger, player) {
			const evt = trigger.getParent();
			let cards = (evt[player == evt.player ? "targetCards" : "playerCards"] || []).slice(0);
			cards = cards.filter(card => get.position(card) == "d");
			if (!cards.length) {
				return;
			}
			event.cards = cards;

			const result = await player
				.chooseBool("是否发动【双雄】，获得" + get.translation(event.cards) + "?")
				.set("ai", () => true)
				.forResult();

			if (result.bool) {
				player.logSkill("reshuangxiong");
				await player.gain(cards, "gain2");
			}
		},
	},
	new_yajiao: {
		audio: "reyajiao",
		trigger: { player: ["useCard", "respond"] },
		frequent: true,
		filter(event, player) {
			return player != _status.currentPhase;
		},
		async content(event, trigger, player) {
			event.card = get.cards()[0];
			await player.showCards(event.card);
			event.same = get.type2(event.card) == get.type2(trigger.card);
			const result = await player
				.chooseTarget(`涯角：令一名角色获得${get.translation(event.card)}`, true)
				.set("ai", target => {
					const { player, du, same } = get.event();
					let att = get.attitude(player, target);
					if (du) {
						if (target.hasSkillTag("nodu")) {
							return 0;
						}
						return -att;
					}
					if (!same) {
						att += target == player ? 1 : 0;
					}
					if (att > 0) {
						return att + Math.max(0, 5 - target.countCards("h"));
					}
					return att;
				})
				.set("du", event.card.name == "du")
				.set("same", event.same)
				.forResult();
			if (result?.targets?.length) {
				player.line(result.targets, "green");
				await result.targets[0].gain(event.card, "gain2");
				if (!event.same) {
					await player.chooseToDiscard(true, "he");
				}
			}
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (get.tag(card, "respond") && target.countCards("h") > 1) {
						return [1, 0.2];
					}
				},
			},
		},
	},
	new_liyu: {
		audio: "liyu",
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.card && event.card.name == "sha" && event.player != player && event.player.isIn() && event.player.countGainableCards(player, "hej") > 0;
		},
		direct: true,
		async content(event, trigger, player) {
			const gainResult = await player
				.gainPlayerCard(get.prompt("new_liyu", trigger.player), trigger.player, "hej", "visibleMove")
				.set("ai", function (button) {
					const player = _status.event.player;
					const target = _status.event.target;
					if (get.attitude(player, target) > 0 && get.position(button.link) === "j") {
						return 4 + get.value(button.link);
					}
					if (get.type(button.link) === "equip") {
						return _status.event.juedou;
					}
					return 3;
				})
				.set(
					"juedou",
					(() => {
						if (
							get.attitude(player, trigger.player) > 0 &&
							game.hasPlayer(current => {
								return player.canUse({ name: "juedou" }, current) && current != trigger.player && current != player && get.effect(current, { name: "juedou" }, player, player) > 2;
							})
						) {
							return 5;
						}
						if (
							game.hasPlayer(current => {
								return player.canUse({ name: "juedou" }, current) && current != trigger.player && current != player && get.effect(current, { name: "juedou" }, player, player) < 0;
							})
						) {
							return 1;
						}
						return 4;
					})()
				)
				.set("logSkill", ["new_liyu", trigger.player])
				.forResult();

			if (!gainResult?.bool) return;

			const gained = gainResult.cards?.[0];
			if (!gained) return;

			if (get.type(gained) !== "equip") {
				await trigger.player.draw();
				return;
			}

			if (!game.hasPlayer(current => current != player && current != trigger.player && player.canUse("juedou", current))) {
				return;
			}

			const chooseRes = await trigger.player
				.chooseTarget(
					true,
					(card, player2, target) => {
						const evt = _status.event.getParent();
						return evt.player.canUse({ name: "juedou" }, target) && target != _status.event.player;
					},
					"请选择一名角色，视为" + get.translation(player) + "对其使用【决斗】"
				)
				.set("ai", target => {
					const evt = _status.event.getParent();
					return get.effect(target, { name: "juedou" }, evt.player, _status.event.player) - 2;
				})
				.forResult();

			if (chooseRes?.targets?.length) {
				await player.useCard({ name: "juedou", isCard: true }, chooseRes.targets[0], "noai");
			}
		},
		ai: {
			halfneg: true,
		},
	},
	new_retuxi: {
		audio: "retuxi",
		audioname2: { gz_jun_caocao: "jianan_tuxi" },
		trigger: {
			player: "phaseDrawBegin2",
		},
		direct: true,
		preHidden: true,
		filter(event, player) {
			return (
				event.num > 0 &&
				!event.numFixed &&
				game.hasPlayer(function (target) {
					return target.countCards("h") > 0 && player != target;
				})
			);
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			let num = get.copy(trigger.num);
			if (get.mode() == "guozhan" && num > 2) {
				num = 2;
			}
			result = await player
				.chooseTarget(get.prompt("new_retuxi"), "获得至多" + get.translation(num) + "名角色的各一张手牌，然后少摸等量的牌", [1, num], (card, player, target) => target.countCards("h") > 0 && player != target)
				.set("ai", target => {
					let att = get.attitude(_status.event.player, target);
					if (target.hasSkill("tuntian")) {
						return att / 10;
					}
					return 1 - att;
				})
				.setHiddenSkill("new_retuxi")
				.forResult();

			// step 1
			if (result.bool) {
				result.targets.sortBySeat();
				player.logSkill("new_retuxi", result.targets);
				await player.gainMultiple(result.targets);
				trigger.num -= result.targets.length;
			} else {
				return;
			}

			// step 2
			if (trigger.num <= 0) {
				await game.delay();
			}
		},
		ai: {
			threaten: 1.6,
			expose: 0.2,
		},
	},
};
