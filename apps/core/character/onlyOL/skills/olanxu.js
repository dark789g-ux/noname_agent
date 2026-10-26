import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olanxu" | "olzhuiyi" | "olxiansi">} */
export const groupSkills = {
	//界步练师------by 清风
	olanxu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.countPlayer(current => get.info("olanxu").filterTarget(null, player, current)) > 1;
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return target.hasGainableCards(player, "e");
			}
			return target.hasGainableCards(player, "he");
		},
		selectTarget: 2,
		multiline: true,
		multitarget: true,
		async content(event, trigger, player) {
			const { targets } = event;
			for (const target of targets.sortBySeat()) {
				await player.gainPlayerCard({ target, position: player == target ? "e" : "he", forced: true });
			}
			if (targets[0].countCards("h") === targets[1].countCards("h")) {
				return;
			}
			const target = targets[0].countCards("h") > targets[1].countCards("h") ? targets[1] : targets[0];
			if (player.hasCards("he") && target?.isIn()) {
				const result = await player
					.chooseCard({
						prompt: `安恤：展示一张牌并将其交给${get.translation(target)}`,
						position: "he",
						forced: true,
						ai(card) {
							const { player, target } = get.event();
							if (get.attitude(player, target) > 0) {
								return get.value(card) * (get.suit(card) !== "spade" ? 2 : 1);
							}
							return -get.value(card);
						},
					})
					.set("target", target)
					.forResult();
				if (result?.bool && result.cards?.length) {
					const card = result.cards[0];
					await player.showCards(card, `${get.translation(player)}发动了【${get.translation(event.name)}】`);
					if (player != target) {
						await player.give(card, target);
					}
					if (get.suit(card) != "spade") {
						await player.draw({ num: 1 });
					}
				}
			}
		},
		ai: {
			order: 5,
			result: {
				player: 1,
				target(player, target) {
					var num = target.countCards("h");
					var att = get.attitude(player, target);
					if (ui.selected.targets.length == 0) {
						if (att > 0) {
							return -1;
						}
						var players = game.filterPlayer();
						for (var i = 0; i < players.length; i++) {
							var num2 = players[i].countCards("h");
							var att2 = get.attitude(player, players[i]);
							if (att2 >= 0 && num2 < num) {
								return -1;
							}
						}
						return 0;
					} else {
						return 1;
					}
				},
			},
		},
	},
	olzhuiyi: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "wood",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.players.length > 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill),
					prompt2: "令一名其他角色摸三张牌并回复1点体力",
					filterTarget: lib.filter.notMe,
					ai(target) {
						const player = get.player();
						let num = get.attitude(player, target);
						if (num > 0) {
							if (target.getHp() == 1) {
								num += 2;
							}
							if (target.isDamaged()) {
								num += 2;
							}
						}
						return num;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const {
				targets: [target],
			} = event;
			await target.draw({ num: 3 });
			await target.recover();
			player.addSkill(event.name + "_die");
			player.markAuto(event.name + "_die", [target]);
		},
		subSkill: {
			die: {
				charlotte: true,
				onremove: true,
				forceDie: true,
				audio: "olzhuiyi",
				skillAnimation: true,
				animationColor: "wood",
				trigger: { player: "die" },
				filter(event, player) {
					return player.getStorage("olzhuiyi_die").some(target => target.isIn());
				},
				prompt2(event, player) {
					const targets = player.getStorage("olzhuiyi_die").filter(target => target.isIn());
					return `令${get.translation(targets)}摸三张牌并回复1点体力`;
				},
				logTarget(event, player) {
					return player
						.getStorage("olzhuiyi_die")
						.filter(target => target.isIn())
						.sortBySeat();
				},
				async content(event, trigger, player) {
					const targets = event.targets;
					await game.doAsyncInOrder(targets, async target => {
						await target.draw({ num: 3 });
						await target.recover();
					});
				},
			},
		},
	},
	//界刘封------by 清风
	olxiansi: {
		audio: 4,
		logAudio: () => 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(current => current.hasCards("he"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill),
					prompt2: "选择至多两名角色将其共计至多两张牌置于你的武将牌上",
					selectTarget: [1, 2],
					filterTarget(card, player, target) {
						return target.hasCards("he");
					},
					ai(target) {
						return get.effect(target, { name: "guohe_copy", position: "he" }, target, get.player());
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets.sortBySeat();
			const prompt = `将${get.translation(targets)}至多两张牌置于你的武将牌上`;
			let dialog = ["陷嗣：" + prompt];
			for (const target of targets) {
				if (target.hasCards("h")) {
					const cards = target.getCards("h");
					dialog.push(`<div class="text center">${get.translation(target)}的手牌</div>`);
					if (player.hasSkillTag("viewHandcard", null, target, true)) {
						dialog.push(cards);
					} else {
						dialog.push([cards.slice(0).randomSort(), "blank"]);
					}
				}
				if (target.hasCards("e")) {
					const cards = target.getCards("e");
					dialog.push(`<div class="text center">${get.translation(target)}的装备</div>`);
					dialog.push(cards);
				}
			}
			const result = await player
				.chooseButton({
					createDialog: dialog,
					selectButton: [1, 2],
					ai(button) {
						const card = button.link;
						return get.value(card);
					},
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				const cards = result.links;
				let cardx = cards.slice(0),
					owner = get.owner(cards[0]);
				if (owner == get.owner(cards[1])) {
					await player.addToExpansion({
						cards: cardx,
						source: owner,
						animate: "give",
						gaintag: ["olxiansi"],
					});
				} else {
					for (const card of cards) {
						owner = get.owner(card);
						await player.addToExpansion({
							cards: [card],
							source: owner,
							animate: "give",
							gaintag: ["olxiansi"],
						});
					}
				}
			}
		},
		global: "olxiansi_sha",
		group: "olxiansi_x",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		ai: {
			threaten: 2,
		},
		subSkill: {
			x: {},
			sha: {
				audio: "olxiansi",
				logAudio: () => ["olxiansi3.mp3", "olxiansi4.mp3"],
				enable: "chooseToUse",
				viewAs: {
					name: "sha",
					isCard: true,
				},
				filter(event, player) {
					return game.hasPlayer(current => current.hasSkill("olxiansi_x") && current.getExpansions("olxiansi").length > 1 && event.filterTarget({ name: "sha" }, player, current));
				},
				filterTarget(card, player, target) {
					let bool = false;
					const players = ui.selected.targets.slice(0);
					for (const current of players) {
						if (current.hasSkill("olxiansi_x") && current.getExpansions("olxiansi").length > 1) {
							bool = true;
						}
					}
					if (!bool && (!target.hasSkill("olxiansi_x") || target.getExpansions("olxiansi").length <= 1)) {
						return false;
					}
					return _status.event._backup.filterTarget.apply(this, arguments);
				},
				filterCard() {
					return false;
				},
				selectCard: -1,
				complexSelect: true,
				forceaudio: true,
				prompt: "弃置一名有【逆】的角色的两张【逆】，然后视为对包含其在内的角色使用【杀】。",
				delay: false,
				log: false,
				async precontent(event, trigger, player) {
					const targets = event.result.targets.filter(current => current.getExpansions("olxiansi").length > 1 && current.hasSkill("olxiansi_x"));
					if (!targets.length) {
						return;
					}
					let target;
					if (targets.length == 1) {
						target = targets[0];
					} else {
						const result = await player
							.chooseTarget({
								prompt: "选择弃置【陷嗣】牌的目标",
								filterTarget(card, player2, target2) {
									return get.event().list.includes(target2);
								},
								forced: true,
								ai(target2) {
									const player2 = get.player();
									return get.attitude(player2, target2);
								},
							})
							.set("list", targets)
							.forResult();
						if (!result.bool || !result.targets.length) {
							return;
						}
						target = result.targets[0];
					}
					let links;
					if (target.getExpansions("olxiansi").length == 2) {
						links = target.getExpansions("olxiansi").slice(0);
					} else {
						const result = await player.chooseCardButton("移去两张“逆”", 2, target.getExpansions("olxiansi"), true).forResult();
						if (!result.bool) {
							return;
						}
						links = result.links;
					}
					player.logSkill("olxiansi_sha", target);
					await target.loseToDiscardpile(links);
				},
				ai: {
					order() {
						return get.order({ name: "sha" }) + 0.05;
					},
				},
			},
		},
	},
};
