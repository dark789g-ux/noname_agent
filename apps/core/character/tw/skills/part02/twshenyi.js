import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twshenyi" | "twxinghan">} */
export const groupSkills = {
	//侠刘备
	twshenyi: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			if (!event.player.isIn()) {
				return false;
			}
			if (event.player.getHistory("damage").indexOf(event) != 0) {
				return false;
			}
			return event.player == player || player.inRange(event.player);
		},
		usable: 1,
		async cost(event, trigger, player) {
			const { player: target } = trigger;
			const list = get.inpileVCardList(info => {
				return ["basic", "trick", "delay"].includes(info[0]) && !player.getStorage(event.skill).includes(info[2]);
			});
			const dialog = [
				`###${get.prompt(event.skill, target)}###<div class="text center">从牌堆中将一张牌作为“侠义”置于武将牌上${player != target && player.countCards("h") ? "，然后将任意张手牌交给其" : ""}</div>`,
				[list, "vcard"],
			];
			const { bool, links } = await player
				.chooseButton(dialog)
				.set("ai", button => {
					const trigger = _status.event.getTrigger();
					const player = get.player(),
						name = button.link[2];
					if (!get.cardPile2(card => card.name == name)) {
						return 0;
					}
					const value = get.value({ name: name });
					if (["tao", "jiu", "caochuan", "wuxie"].includes(name) && get.event().getRand() > 0.4) {
						return value * 2;
					}
					return value;
				})
				.forResult();
			event.result = {
				bool: bool,
				cost_data: links,
				targets: [target],
			};
		},
		async content(event, trigger, player) {
			const {
				cost_data: links,
				targets: [target],
				name: skillName,
			} = event;
			const name = links[0][2],
				nature = links[0][3];
			const cardx = { name: name, nature: nature };
			player.popup(cardx);
			player.markAuto(skillName, [name]);
			game.log(player, "声明了", `#y${get.translation(cardx)}`);
			const card = get.cardPile2(card => get.name(card, false) == name && get.nature(card, false) == nature);
			if (card) {
				const next = player.addToExpansion([card], "gain2");
				next.gaintag.add(skillName);
				await next;
			} else {
				const card = get.cardPile2(card => get.type2(card) == get.type2(name));
				if (card) {
					const next = player.addToExpansion([card], "gain2");
					next.gaintag.add(skillName);
					await next;
				} else {
					player.chat("无牌可得？！");
				}
			}
			if (target != player && player.countCards("h")) {
				game.delayex();
				const skill = `${skillName}_${player.playerid}`;
				game.addTempTag(skill, `义·${get.translation(player.name)}`);
				player.addSkill(skillName + "_draw");
				const next = player
					.chooseToGive(target, `伸义：是否将任意张手牌交给${get.translation(target)}？`, [1, player.countCards("h")], "allowChooseAll")
					.set("ai", card => {
						if (!_status.event.goon) {
							return 0;
						}
						return 7 - get.value(card);
					})
					.set("goon", get.attitude(player, target) > 0);
				next.gaintag.add(skill);
				await next;
			}
		},
		marktext: "义",
		intro: {
			name: "侠义",
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			delete player.storage[skill];
			//var cards=player.getExpansions(skill);
			//if(cards.length) player.loseToDiscardpile(cards);
		},
		subSkill: {
			draw: {
				charlotte: true,
				audio: "twshenyi",
				trigger: { global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"] },
				filter(event, player, name, target) {
					return target?.isIn();
				},
				forced: true,
				getIndex(event, player) {
					return game
						.filterPlayer(target => {
							const evt = event.getl(target);
							if (!evt?.hs?.length) {
								return false;
							}
							return Object.values(evt.gaintag_map).flat().includes(`twshenyi_${player.playerid}`);
						})
						.sortBySeat();
				},
				logTarget: (event, player, triggername, target) => target,
				async content(event, trigger, player) {
					const evt = trigger.getl(event.targets[0]);
					const num = Object.values(evt.gaintag_map)
						.flat()
						.reduce((numx, tag) => numx + (tag.includes(`twshenyi_${player.playerid}`) ? 1 : 0), 0);
					if (num) {
						await player.draw(num);
					}
				},
			},
		},
	},
	twxinghan: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.getExpansions("twshenyi").length > game.countPlayer();
		},
		check(event, player) {
			if (
				player.hp >= 3 ||
				(player.countCards("h") >= 4 &&
					player
						.getExpansions("twshenyi")
						.every(card => !player.hasValueTarget(card) || !get.tag(card, "damage") || !lib.skill.xunshi.isXunshi(card)))
			) {
				return false;
			}
			return player.getExpansions("twshenyi").some(card => player.hasValueTarget(card));
		},
		direct: true,
		async content(event, trigger, player) {
			var result = await player
				.chooseBool()
				.set("createDialog", [
					get.prompt("twxinghan"),
					`<div class="text center">按顺序使用以下“侠义”牌。但是回合结束时你须弃置所有手牌并失去X点体力（X为你的体力值-1且X至少为1）</div>`,
					player
						.getExpansions("twshenyi")
						.filter(card => player.hasUseTarget(card))
						.reverse(),
					"hidden",
				])
				.set("choice", lib.skill.twxinghan.check(null, player))
				.forResult();
			if (!result.bool) {
				event.finish();
				return;
			}
			while (true) {
				var cards = player
					.getExpansions("twshenyi")
					.filter(card => player.hasUseTarget(card))
					.reverse();
				if (!cards.length) {
					break;
				}
				await player.chooseUseTarget(true, cards[0], false);
			}
			player.when("phaseEnd").step(async () => {
				if (player.countCards("h")) {
					await player.chooseToDiscard(player.countCards("h"), true);
				}
				var num = Math.max(1, player.getHp() - 1);
				await player.loseHp(num);
			});
		},
		group: "twxinghan_init",
		subSkill: {
			init: {
				audio: "twxinghan",
				trigger: {
					player: ["loseEnd", "dying", "phaseBefore", "phaseAfter", "dyingAfter", "die"],
					global: ["equipEnd", "addJudgeEnd", "gainEnd", "loseAsyncEnd", "addToExpansionEnd"],
				},
				filter(event, player) {
					return (
						(player.getExpansions("twshenyi").length && event.name != "die" && (_status.currentPhase != player || player.isDying())) ^
						player.hasSkill("twxinghan_in")
					);
				},
				forced: true,
				firstDo: true,
				silent: true,
				forceDie: true,
				content() {
					if (player.getExpansions("twshenyi").length && trigger.name != "die" && (_status.currentPhase != player || player.isDying())) {
						var cards = player.getExpansions("twshenyi");
						var cardsx = cards.map(card => {
							var cardx = ui.create.card();
							cardx.init(get.cardInfo(card));
							cardx._cardid = card.cardid;
							return cardx;
						});
						player.directgains(cardsx, null, "twxinghan_tag");
						player.addSkill("twxinghan_in");
					} else {
						player.removeSkill("twxinghan_in");
					}
				},
			},
			in: {
				charlotte: true,
				audio: "twxinghan",
				trigger: { player: "addToExpansionEnd" },
				filter(event, player) {
					return event.gaintag.includes("twshenyi");
				},
				forced: true,
				locked: false,
				silent: true,
				content() {
					"step 0";
					var cards2 = player.getCards("s", card => card.hasGaintag("twxinghan_tag"));
					if (player.isOnline2()) {
						player.send(
							function (cards, player) {
								cards.forEach(i => i.delete());
								if (player == game.me) {
									ui.updatehl();
								}
							},
							cards2,
							player
						);
					}
					cards2.forEach(i => i.delete());
					if (player == game.me) {
						ui.updatehl();
					}
					"step 1";
					var cards = player.getExpansions("twshenyi");
					var cardsx = cards.map(card => {
						var cardx = ui.create.card();
						cardx.init(get.cardInfo(card));
						cardx._cardid = card.cardid;
						return cardx;
					});
					player.directgains(cardsx, null, "twxinghan_tag");
				},
				onremove(player) {
					var cards2 = player.getCards("s", card => card.hasGaintag("twxinghan_tag"));
					if (player.isOnline2()) {
						player.send(
							function (cards, player) {
								cards.forEach(i => i.delete());
								if (player == game.me) {
									ui.updatehl();
								}
							},
							cards2,
							player
						);
					}
					cards2.forEach(i => i.delete());
					if (player == game.me) {
						ui.updatehl();
					}
				},
				group: "twxinghan_use",
			},
			use: {
				charlotte: true,
				trigger: { player: ["useCardBefore", "respondBefore"] },
				filter(event, player) {
					var cards = player.getCards("s", card => card.hasGaintag("twxinghan_tag") && card._cardid);
					return (
						event.cards &&
						event.cards.some(card => {
							return cards.includes(card);
						})
					);
				},
				forced: true,
				popup: false,
				firstDo: true,
				content() {
					var idList = player.getCards("s", card => card.hasGaintag("twxinghan_tag")).map(i => i._cardid);
					var cards = player.getExpansions("twshenyi");
					var cards2 = [];
					for (var card of trigger.cards) {
						var cardx = cards.find(cardx => cardx.cardid == card._cardid);
						if (cardx) {
							cards2.push(cardx);
						}
					}
					var cards3 = trigger.cards.slice();
					trigger.cards = cards2;
					trigger.card.cards = cards2;
					if (player.isOnline2()) {
						player.send(
							function (cards, player) {
								cards.forEach(i => i.delete());
								if (player == game.me) {
									ui.updatehl();
								}
							},
							cards3,
							player
						);
					}
					cards3.forEach(i => i.delete());
					if (player == game.me) {
						ui.updatehl();
					}
				},
			},
		},
		ai: {
			combo: "twshenyi",
		},
	},
};
