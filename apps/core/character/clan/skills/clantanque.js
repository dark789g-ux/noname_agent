import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clantanque" | "clanshengmo">} */
export const groupSkills = {
	//族王明山
	clantanque: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		usable: 1,
		filter(event, player) {
			const evt = lib.skill.dcjianying.getLastUsed(player, event);
			if (!evt || !evt.card) {
				return false;
			}
			const curCard = event.card,
				prevCard = evt.card;
			const curNum = get.number(curCard),
				prevNum = get.number(prevCard);
			if (typeof curNum != "number" || typeof prevNum != "number") {
				return false;
			}
			const delNum = Math.abs(curNum - prevNum);
			if (delNum === 0) {
				return false;
			}
			return game.hasPlayer(current => {
				return current.getHp() === delNum || current.countCards("h") == delNum;
			});
		},
		locked: false,
		async cost(event, trigger, player) {
			const evt = lib.skill.dcjianying.getLastUsed(player, trigger);
			const curCard = trigger.card,
				prevCard = evt.card;
			const curNum = get.number(curCard),
				prevNum = get.number(prevCard);
			const delNum = Math.abs(curNum - prevNum);
			event.result = await player
				.chooseTarget(get.prompt(event.skill), `对一名体力值或手牌数为${delNum}的角色造成1点伤害`, (card, player, target) => {
					return target.getHp() === get.event().delNum || target.countCards("h") == get.event().delNum;
				})
				.set("delNum", delNum)
				.set("ai", target => {
					return get.damageEffect(target, get.player(), get.player());
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.damage();
			await game.delayx();
		},
		mod: {
			aiOrder(player, card, num) {
				if (typeof card != "object") {
					return;
				}
				const evt = lib.skill.dcjianying.getLastUsed(player);
				if (!evt || !evt.card) {
					return;
				}
				const curNum = get.number(card),
					prevNum = get.number(evt.card);
				if (typeof curNum != "number" || typeof prevNum != "number") {
					return;
				}
				const pairs = game
					.filterPlayer()
					.map(current => {
						return [current.getHp(), get.damageEffect(current, player, player)];
					})
					.filter(pair => pair[1] > 0);
				if (!pairs.length) {
					return;
				}
				const delNum = Math.abs(curNum - prevNum);
				for (const [hp, eff] of pairs) {
					if (hp != delNum) {
						continue;
					}
					return num + 10 + pairs.filter(pair => pair[0] === hp).sort((a, b) => b[1] - a[1])[0][1] / 20;
				}
			},
		},
		group: "clantanque_mark",
		init(player) {
			var history = player.getAllHistory("useCard");
			if (history.length) {
				var trigger = history[history.length - 1];
				if (typeof get.number(trigger.card, player) != "number") {
					return;
				}
				player.storage.clantanque_mark = trigger.card;
				player.markSkill("clantanque_mark");
			}
		},
		onremove(player) {
			player.unmarkSkill("clantanque_mark");
			delete player.storage.clantanque_mark;
		},
		subSkill: {
			mark: {
				charlotte: true,
				trigger: { player: "useCard1" },
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (typeof get.number(trigger.card, player) != "number") {
						player.unmarkSkill("clantanque_mark");
					} else {
						player.storage.clantanque_mark = trigger.card;
						player.markSkill("clantanque_mark");
					}
				},
				intro: {
					markcount(card, player) {
						return get.strNumber(get.number(card, player));
					},
					content(card, player) {
						return "上一张牌的点数：" + get.strNumber(get.number(card, player));
					},
				},
			},
		},
	},
	clanshengmo: {
		audio: 2,
		enable: "chooseToUse",
		round: 1,
		hiddenCard(player, name) {
			if (get.type(name) != "basic") {
				return false;
			}
			if (!player.getStorage("clanshengmo").includes(name) && (get.event().clanshengmo_cards || []).length > 0) {
				return true;
			}
		},
		filter(event, player) {
			if (event.responded) {
				return false;
			}
			const names = lib.inpile.filter(name => get.type(name) == "basic"),
				cards = get.event().clanshengmo_cards || [];
			return (
				cards.length > 0 &&
				cards.some(card => !player.getStorage("clanshengmo_num").includes(get.number(card, false))) &&
				names.some(name => {
					return event.filterCard({ name, isCard: true }, player, event);
				})
			);
		},
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			if (!event.clanshengmo_cards) {
				let cards = [];
				game.checkGlobalHistory("cardMove", evt => {
					if (evt.name != "cardsDiscard" && (evt.name != "lose" || evt.position != ui.discardPile)) {
						return;
					}
					cards.addArray(evt.cards.filter(card => get.position(card, true) == "d"));
				});
				event.set("clanshengmo_cards", cards);
				/*
				const numbers = cards.map(card => get.number(card, false)).unique();
				const [min, max] = [Math.min(...numbers), Math.max(...numbers)];
				event.set(
					"clanshengmo_cards",
					cards.filter(card => {
						const num = get.number(card, false);
						return num > min && num < max;
					})
				);*/
			}
		},
		async content(event, trigger, player) {
			const evt = event.getParent(2);
			const names = lib.inpile.filter(name => get.type(name) == "basic" && !player.getStorage("clanshengmo").includes(name)),
				cards = evt.clanshengmo_cards.sort((a, b) => get.number(a, false) - get.number(b, false)),
				canChoose = cards.filter(card => !player.getStorage("clanshengmo_num").includes(get.number(card, false)));
			const { links } = await player
				.chooseButton(["剩墨：获得其中一张牌", cards], true)
				.set("filterButton", button => {
					return get.event().canChoose.includes(button.link);
				})
				.set("canChoose", canChoose)
				.set("ai", button => {
					return get.value(button.link);
				})
				.forResult();
			if (links?.length) {
				await player.gain(links, "gain2");
				player.markAuto("clanshengmo_num", links.map(card => get.number(card, false)).toUniqued());
				const numbers = cards.map(card => get.number(card, false)).unique();
				const [min, max] = [Math.min(...numbers), Math.max(...numbers)],
					num = get.number(links[0], false);
				if (num > min && num < max) {
					const list = [];
					for (const name of names) {
						const card = { name, isCard: true };
						if (evt.filterCard(card, player, evt)) {
							list.push(["基本", "", name]);
						}
						if (name == "sha") {
							for (const nature of lib.inpile_nature) {
								card.nature = nature;
								if (evt.filterCard(card, player, evt)) {
									list.push(["基本", "", name, nature]);
								}
							}
						}
					}
					if (list.length) {
						const { links: links2 } = await player
							.chooseButton(["视为使用一张未以此法使用过的基本牌", [list, "vcard"]], true)
							.set("ai", button => {
								return get.player().getUseValue(button.link) + 1;
							})
							.forResult();
						const name = links2[0][2],
							nature = links2[0][3];
						game.broadcastAll(
							(name, nature) => {
								lib.skill.clanshengmo_backup.viewAs = {
									name,
									nature,
									isCard: true,
								};
								lib.skill.clanshengmo_backup.prompt = `选择${get.translation(nature)}【${get.translation(name)}】的目标`;
							},
							name,
							nature
						);
						evt.set("_backupevent", "clanshengmo_backup");
						evt.backup("clanshengmo_backup");
						evt.set("openskilldialog", `选择${get.translation(nature)}【${get.translation(name)}】的目标`);
						evt.set("norestore", true);
						evt.set("custom", {
							add: {},
							replace: { window() {} },
						});
					}
				}
			}
			evt.goto(0);
		},
		marktext: "墨",
		intro: {
			content: "已以此法使用过$",
		},
		subSkill: {
			backup: {
				async precontent(event, trigger, player) {
					event.result.card.storage.clanshengmo = true;
					player.markAuto("clanshengmo", event.result.card.name);
				},
				filterCard: () => false,
				selectCard: -1,
				log: false,
			},
		},
		ai: {
			order: 3,
			result: {
				player(player) {
					if (get.event().dying) {
						return get.attitude(player, get.event().dying);
					}
					if (get.event().type != "phase") {
						return 1;
					}
					const names = lib.inpile.filter(name => get.type(name) == "basic" && !player.getStorage("clanshengmo").includes(name));
					if (Array.isArray(names)) {
						return names.some(name => {
							return player.getUseValue({ name }) > 0;
						});
					}
					return 0;
				},
			},
			tag: {
				recover: 1,
				save: 1,
			},
		},
	},
};
