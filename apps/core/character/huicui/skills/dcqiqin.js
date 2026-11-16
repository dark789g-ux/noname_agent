import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcqiqin" | "dcweiwan" | "dcyijia" | "dcdingji">} */
export const groupSkills = {
	//小乔
	dcqiqin: {
		audio: 2,
		audioname: ["yue_daqiao"],
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			const cards = player.getCards("h"); //
			player.addGaintag(cards, "eternal_dcqiqin_tag");
		},
		group: "dcqiqin_restore",
		subSkill: {
			tag: {},
			restore: {
				audio: "dcqiqin",
				audioname: ["yue_daqiao"],
				trigger: { player: "phaseZhunbeiBegin" },
				filter(event, player) {
					return Array.from(ui.discardPile.childNodes).some(card => card.hasGaintag("eternal_dcqiqin_tag"));
					/*const targets = game.players.slice().concat(game.dead);
					return targets.some(target => target.getStorage("dcqiqin").filterInD("d").length);*/
				},
				forced: true,
				async content(event, trigger, player) {
					const cards = Array.from(ui.discardPile.childNodes).filter(card => card.hasGaintag("eternal_dcqiqin_tag"));
					await player.gain({
						cards,
						animate: "gain2",
					});
				},
			},
		},
		mod: {
			ignoredHandcard(card, player) {
				if (card.hasGaintag("eternal_dcqiqin_tag")) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && card.hasGaintag("eternal_dcqiqin_tag")) {
					return false;
				}
			},
		},
	},
	dcweiwan: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return (
				player.hasCards(lib.skill.dcweiwan.position, card => {
					return lib.skill.dcweiwan.filterCard(card, player);
				}) &&
				game.hasPlayer(target => {
					return lib.skill.dcweiwan.filterTarget(null, player, target);
				})
			);
		},
		filterCard(card, player) {
			return card.hasGaintag("eternal_dcqiqin_tag") && lib.filter.cardDiscardable(card, player);
		},
		filterTarget(card, player, target) {
			return target != player && target.hasCards("hej");
		},
		position: "he",
		check(card) {
			const player = _status.event.player;
			const target = game.players.reduce(
				(result, current) => {
					if (current === player) {
						return result;
					}
					const effect = Math.abs(lib.skill.dcweiwan.ai.result.target(player, current));
					return effect > result[1] ? [current, effect] : result;
				},
				[null, 0]
			)[0];
			return target ? lib.skill.dcweiwan.getWeiWanEffect(player, card, target) : 0;
		},
		usable: 1,
		async content(event, trigger, player) {
			const target = event.target;
			let suit = get.suit(event.cards[0], player);
			let cards = target.getCards("hej", card => get.suit(card, target) != suit && lib.filter.canBeGained(card, player, target));
			if (!cards.length) {
				player.chat("无牌可得！！");
				return;
			}
			let suits = lib.suit.slice();
			suits.reverse();
			suits.add("none");
			suits.forEach(suit2 => {
				let cards2 = cards.filter(card => get.suit(card, target) == suit2);
				if (cards2.length) {
					cards2.randomRemove();
					cards.removeArray(cards2);
				}
			});
			if (!cards.length) {
				player.chat("无牌可得！！");
				return;
			}
			await player.gain(cards, target, "give");
			switch (cards.length) {
				case 1:
					await target.loseHp();
					break;
				case 2:
					player.addTempSkill("dcweiwan_buff");
					player.markAuto("dcweiwan_buff", [target]);
					break;
				case 3:
					player.addTempSkill("dcweiwan_debuff");
					player.markAuto("dcweiwan_debuff", [target]);
					break;
			}
		},
		ai: {
			order: 9,
			result: {
				target: (player, target) => {
					const att = get.sgn(get.attitude(player, target)) - 1;
					const cards = player.getCards(lib.skill.dcweiwan.position, card => lib.skill.dcweiwan.filterCard(card, player));
					return (
						att *
						cards.reduce((result, card) => {
							const effect = lib.skill.dcweiwan.getWeiWanEffect(player, card, target);
							return effect > result ? effect : result;
						}, 0)
					);
				},
			},
			combo: "dcqiqin",
		},
		getWeiWanEffect(player, cardx, target) {
			const suit = get.suit(cardx, player);
			const cards = target.getCards("hej", card => get.suit(card, target) !== suit && lib.filter.canBeGained(card, player, target));
			const num = lib.suits.filter(suit => cards.some(card => get.suit(card, target) === suit)).length;
			switch (num) {
				case 1:
					return num + Math.max(0, get.sgn(get.effect(target, { name: "losehp" }, player, player)));
				case 2:
					return num + player.countCards("he", card => player.canUse(card, target, false) && get.effect(target, card, player, player) > 0);
				case 3:
					return Math.ceil(num / 2);
				default:
					return num;
			}
		},
		subSkill: {
			buff: {
				charlotte: true,
				onremove: true,
				intro: { content: "本回合对$使用牌无距离和次数限制" },
				mod: {
					targetInRange(card, player, target) {
						if (player.getStorage("dcweiwan_buff").includes(target)) {
							return true;
						}
					},
					cardUsableTarget(card, player, target) {
						if (player.getStorage("dcweiwan_buff").includes(target)) {
							return true;
						}
					},
				},
			},
			debuff: {
				charlotte: true,
				onremove: true,
				intro: { content: "本回合不能对$使用牌" },
				mod: {
					playerEnabled(card, player, target) {
						if (player.getStorage("dcweiwan_debuff").includes(target)) {
							return false;
						}
					},
				},
			},
		},
	},
	//董昭
	dcyijia: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			if (!event.player.isIn()) {
				return false;
			}
			if (get.distance(player, event.player) > 1) {
				return false;
			}
			return player.canMoveCard(
				null,
				true,
				game.filterPlayer(i => i != event.player),
				event.player,
				"canReplace"
			);
		},
		check(event, player) {
			return player.canMoveCard(
				true,
				true,
				game.filterPlayer(i => i != event.player),
				event.player,
				"canReplace"
			);
		},
		prompt2(event, player) {
			return `将场上一张装备牌移动至${get.translation(event.player)}的装备区内（替换原装备）。然后若其因此脱离了一名角色的攻击范围，你摸一张牌。`;
		},
		logTarget: "player",
		line: false,
		async content(event, trigger, player) {
			const target = trigger.player;
			const inRangeList = game.filterPlayer(current => current.inRange(target));
			await player
				.moveCard(
					true,
					game.filterPlayer(i => i != target),
					target,
					"canReplace"
				)
				.set("nojudge", true);
			const leaveSomeone = inRangeList.some(current => !current.inRange(target));
			if (leaveSomeone) {
				player.draw();
			}
		},
		ai: {
			maixie: true,
			expose: 0.2,
			threaten: 3.3,
		},
	},
	dcdingji: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		async content(event, trigger, player) {
			let result;
			result = await player
				.chooseTarget(get.prompt2("dcdingji"))
				.set("ai", target => {
					let att = get.attitude(get.player(), target) / 2;
					const delta = 5 - target.countCards("h");
					let fix = 1;
					const hs = target.getCards("h");
					outer: for (let i = 0; i < hs.length - 1; i++) {
						const name1 = get.name(hs[i]);
						for (let j = i + 1; j < hs.length; j++) {
							const name2 = get.name(hs[j]);
							if (name1 == name2) {
								fix = 0.5;
								break outer;
							}
						}
					}
					if (delta > 0) {
						if (target.hasSkillTag("nogain")) {
							att /= 3;
						}
						return Math.sqrt(delta) * att * fix;
					}
					if (delta > -2 && att > 0) {
						return fix == 0.5 ? 0.1 : -1;
					}
					return (-Math.sqrt(-delta) * att) / 2;
				})
				.forResult();
			if (!result.bool) {
				return;
			}
			const target = result.targets[0];
			player.logSkill("dcdingji", target);
			if (target != player) {
				player.addExpose(0.3);
			}
			const delta = 5 - target.countCards("h");
			if (delta != 0) {
				await target[delta > 0 ? "draw" : "chooseToDiscard"](Math.abs(delta), true, "allowChooseAll");
			}
			await target.showHandcards();
			const hs = target.getCards("h");
			let hasSame = false;
			outer: for (let i = 0; i < hs.length - 1; i++) {
				const name1 = get.name(hs[i]);
				for (let j = i + 1; j < hs.length; j++) {
					const name2 = get.name(hs[j]);
					if (name1 == name2) {
						hasSame = true;
						break outer;
					}
				}
			}
			await game.delayex();
			if (hasSame) {
				return;
			}
			const list = get.inpileVCardList(info => {
				if (!["basic", "trick"].includes(info[0])) {
					return false;
				}
				if (!target.hasUseTarget(new lib.element.VCard({ name: info[2], nature: info[3], isCard: true }))) {
					return false;
				}
				return hs.some(card => {
					return get.name(card) == info[2] && get.is.sameNature([card, info[3]], true);
				});
			});
			if (!list.length) {
				return;
			}
			result = await target
				.chooseButton(["是否视为使用其中一张牌？", [list, "vcard"]])
				.set("ai", button => {
					return get.player().getUseValue({ name: button.link[2] });
				})
				.forResult();
			if (result.bool) {
				target.chooseUseTarget(
					new lib.element.VCard({
						name: result.links[0][2],
						nature: result.links[0][3],
						isCard: true,
					}),
					true,
					false
				);
			}
		},
	},
};
