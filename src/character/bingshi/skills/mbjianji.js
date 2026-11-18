import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mbjianji" | "mbyuanmo" | "mbtanfeng" | "mbganjue">} */
export const groupSkills = {
	//手杀杨弘 —— by 刘巴
	//用同一张牌拼点神将
	mbjianji: {
		audio: 3,
		logAudio: index => (typeof index === "number" ? "mbjianji" + index + ".mp3" : "mbjianji" + get.rand(2, 3) + ".mp3"),
		enable: "phaseUse",
		usable: 1,
		filter: (event, player) => player.hasCard(true, "h"),
		filterTarget(card, player, target) {
			if (ui.selected.targets.length) {
				return ui.selected.targets[0].canCompare(target, true, true) && !ui.selected.targets[0].hasSkillTag("noCompareSource") && !target.hasSkillTag("noCompareTarget");
			}
			return true;
		},
		targetprompt: ["发起者", "拼点目标"],
		filterCard: true,
		discard: false,
		lose: false,
		delay: false,
		check(card) {
			if (get.player().getHp() == 1) {
				return 8 - get.value(card);
			}
			if (get.name(card, get.player()) == "sha") {
				return 7 - get.value(card);
			}
			return 6 - get.value(card);
		},
		selectTarget: 2,
		multitarget: true,
		multiline: true,
		complexTarget: true,
		complexSelect: true,
		async content(event, trigger, player) {
			const target1 = event.targets[0],
				target2 = event.targets[1],
				card = event.cards[0];
			player.addGaintag(card, "mbjianji");
			player.addTempSkill(event.name + "_put");
			event.targets.forEach(target => target.addTempSkill(event.name + "_fake"));
			const result = await target1
				.chooseToCompare(target2, function (card) {
					if (typeof card == "string" && lib.skill[card]) {
						var ais =
							lib.skill[card].check ||
							function () {
								return 0;
							};
						return ais();
					}
					var addi = get.value(card) >= 8 && get.type(card) != "equip" ? -3 : 0;
					if (card.name == "du") {
						addi -= 3;
					}
					var source = _status.event.source;
					var player = _status.event.player;
					var event = _status.event.getParent();
					var getn = function (card) {
						//会赢吗？会赢的！
						if (card.hasGaintag("mbjianji")) {
							if (
								!player.hasCard(function (card) {
									var val = get.value(card);
									//对秦宓天辩的ai做了点小修改
									return val < 0 || (val <= 5 && get.number(card) >= 10);
								}, "h")
							) {
								return 10 + Math.random() * 3;
							}
						}
						if (player.hasSkillTag("forceWin", null, { card })) {
							return 13 * (event.small ? -1 : 1);
						}
						return get.number(card) * (event.small ? -1 : 1);
					};
					if (source && source != player) {
						if (get.attitude(player, source) > 1) {
							if (event.small) {
								return getn(card) - get.value(card) / 3 + addi;
							}
							return -getn(card) - get.value(card) / 3 + addi;
						}
						if (event.small) {
							return -getn(card) - get.value(card) / 5 + addi;
						}
						return getn(card) - get.value(card) / 5 + addi;
					} else {
						if (event.small) {
							return -getn(card) - get.value(card) / 5 + addi;
						}
						return getn(card) - get.value(card) / 5 + addi;
					}
				})
				.set("mbjianji", true)
				.set("mbjianji_card", card)
				.set("position", "hs")
				.set("filterCard", function (card) {
					/*if (typeof originalFilter === "function" && !originalFilter(card)) {
								return false;
							}*/
					if (get.position(card) == "s") {
						return card.hasGaintag("mbjianji");
					}
					return true;
				})
				.forResult();
			const sha = async function sha(target, victim) {
				if (!target.canUse({ name: "sha", isCard: true }, victim, false, false)) {
					return;
				}
				await target.useCard({ name: "sha", isCard: true }, victim).set("addCount", false);
			};
			player.removeGaintag("mbjianji");
			if (result.bool) {
				await sha(target1, target2);
			} else if (!result.tie) {
				await sha(target2, target1);
			}
			if (get.name(event.cards[0], player) === "sha") {
				let targets = [
					[target1, result.player],
					[target2, result.target],
				]
					.filter(list => {
						if (list[1] == card) {
							return true;
						}
					})
					.map(list => list[0])
					.sortBySeat();
				if (targets.length) {
					for (const target of targets) {
						await target.chat("我也干了");
					}
					await game.delayx();
					player.logSkill("mbjianji", [targets], null, null, [1]);
					for (const target of targets) {
						await target.damage();
					}
				}
			}
		},
		subSkill: {
			fake: {
				charlotte: true,
				trigger: {
					global: ["chooseCardOLBegin", "chooseCardOLEnd"],
				},
				filter(event, player) {
					return event.type == "compare" && event.getParent().mbjianji;
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					const evt = trigger.getParent(2);
					const card = evt.cards[0];
					if (!card) {
						return;
					}
					if (event.triggername == "chooseCardOLBegin") {
						const cardx = game.createFakeCards(card, true, "mbjianji_card")[0];
						player.directgains([cardx], null, "mbjianji");
					} else {
						const cards = player.getCards("s", card => card.hasGaintag("mbjianji"));
						game.deleteFakeCards(cards);
						if (!trigger.result[trigger.list.indexOf(player)].skill) {
							if (trigger.result[trigger.list.indexOf(player)].cards[0]._cardid === card.cardid) {
								trigger.result[trigger.list.indexOf(player)].cards = [card];
							}
						}
					}
				},
			},
			put: {
				charlotte: true,
				trigger: { global: "compareCardShowBefore" },
				filter(event, player) {
					if (!event?.mbjianji) {
						return false;
					}
					const evt = event.getParent();
					if (!(evt?.name === "mbjianji" && evt.player === player)) {
						return false;
					}
					//其实不用看fixedResult吧，这会看card1，card2应该就可以了
					return [event.card1, event.card2].includes(evt.cards[0]);
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					const card = trigger.getParent().cards[0];
					if (get.position(card) !== "o") {
						const owner = get.owner(card);
						if (owner) {
							await owner.lose([card], ui.ordering, false).set("log", false);
						} else {
							await game.cardsGotoOrdering([card]);
						}
					}
				},
			},
		},
		ai: {
			expose: 0.4,
			order: 4,
			result: {
				target(player, target) {
					if (ui.selected.targets.length) {
						return -1;
					}
					return -0.5;
				},
			},
		},
	},
	mbyuanmo: {
		audio: 3,
		trigger: { player: ["phaseZhunbeiBegin", "damageEnd"] },
		filter: (event, player) => player.canMoveCard(),
		logAudio: index => (typeof index === "number" ? "mbyuanmo" + index + ".mp3" : 1),
		async cost(event, trigger, player) {
			let nums = {};
			game.filterPlayer().forEach(target => (nums[target.playerid] = game.countPlayer(c => c.inRangeOf(target))));
			event.result = await player
				.moveCard(get.prompt2(event.skill))
				.set("logSkill", [event.skill, null, null, null, [get.rand(2, 3)]])
				.forResult();
			event.result.cost_data = nums;
		},
		usable: 2,
		popup: false,
		async content(event, trigger, player) {
			const drawer = event.targets[0];
			const num = event.cost_data[drawer.playerid] - game.countPlayer(c => c.inRangeOf(drawer));
			if (num > 0) {
				const result = await player
					.chooseBool("远谟", `是否令${get.translation(drawer)}摸${get.cnNumber(num)}张牌？`)
					.set("choice", get.effect(drawer, { name: "draw" }, player, player) > 0)
					.forResult();
				if (result?.bool) {
					player.logSkill("mbyuanmo", [drawer], null, null, [1]);
					await drawer.draw(Math.min(5, num));
				}
			}
		},
	},
	//夏侯尚 —— by 刘巴
	mbtanfeng: {
		audio: "twtanfeng",
		trigger: { player: "phaseZhunbeiBegin" },
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([
					get.prompt(event.skill),
					[
						[
							["discard", "弃置一名角色至多两张牌，然后若其手牌数小于等于你,你跳过摸牌阶段"],
							["damage", "对一名角色造成1点火焰伤害，然后若其体力值小于等于你，你跳过出牌阶段。"],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => !(button.link === "discard" && !game.hasPlayer(c => c.countDiscardableCards(get.player(), "he"))))
				.set("ai", button => {
					const player = get.player();
					if (button.link === "discard") {
						if (
							!game.hasPlayer(target => {
								return target.countCards("he") - 2 > player.countCards("he") && get.effect(target, { name: "guohe_copy2" }, player);
							})
						) {
							return 0;
						}
						return 1;
					} else if (button.link === "damage") {
						if (!game.hasPlayer(target => target.getHp() - 1 > player.getHp() && get.damageEffect(target, player, player, "fire"))) {
							return 0;
						}
						return 1;
					}
				})
				.set("selectButton", [1, 2])
				.forResult();
			event.result = {
				bool: result.bool,
				cost_data: result.links,
			};
		},
		async content(event, trigger, player) {
			const choices = event.cost_data;
			if (choices.includes("discard") && game.hasPlayer(c => c.countDiscardableCards(player, "he"))) {
				const result = await player
					.chooseTarget("探锋：弃置一名角色至多两张牌", true, (card, player, target) => {
						return target.countDiscardableCards(player, "he");
					})
					.set("ai", target => {
						return get.effect(target, { name: "guohe_copy2" }, get.player());
					})
					.forResult();
				player.line(result.targets);
				await player.discardPlayerCard(result.targets[0], true, "he", [1, 2]);
				if (result.targets[0].countCards("h") <= player.countCards("h")) {
					player.skip("phaseDraw");
				}
			}
			if (choices.includes("damage")) {
				const result = await player
					.chooseTarget("探锋：对一名角色造成1点火焰伤害", true)
					.set("ai", target => {
						const player = get.player();
						return get.damageEffect(target, player, player, "fire");
					})
					.forResult();
				player.line(result.targets);
				await result.targets[0].damage("fire");
				if (result.targets[0].getHp() <= player.getHp()) {
					player.skip("phaseUse");
				}
			}
		},
	},
	//孙韶
	mbganjue: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("e") > 0;
		},
		filterCard: true,
		position: "e",
		viewAs: {
			name: "sha",
			storage: { mbganjue: true },
		},
		viewAsFilter(player) {
			if (!player.countCards("e")) {
				return false;
			}
		},
		prompt: "将装备区的一张牌当【杀】使用或打出",
		check(card) {
			return 6 - get.value(card);
		},
		async precontent(event, trigger, player) {
			event.getParent().addCount = false;
			event.result._apply_args = {
				oncard: (card, currentPlayer) => {
					const evt = get.event();
					evt.directHit.addArray(
						evt.targets.filter(target => {
							return !target.hasCard(cardx => get.suit(cardx, target) == get.suit(card), "h");
						})
					);
				},
			};
		},
		ai: {
			order(item, player) {
				return get.order({ name: "sha" }, player) - 0.2;
			},
			result: { player: 1 },
		},
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.mbganjue) {
					return Infinity;
				}
			},
			targetInRange(card, player, target) {
				if (card?.storage?.mbganjue) {
					return true;
				}
			},
		},
	},
};
