import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dctanban" | "dcdiou" | "dcshuangrui" | "dcfuxie" | "dcshouxing" | "dcshaxue" | "dcxiongyi">} */
export const groupSkills = {
	//乐貂蝉
	dctanban: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			const cards = player.getCards("h");
			player.addGaintag(cards, "dctanban");
		},
		mod: {
			ignoredHandcard(card) {
				if (card.hasGaintag("dctanban")) {
					return true;
				}
			},
			cardDiscardable(card, _, name) {
				if (name == "phaseDiscard" && card.hasGaintag("dctanban")) {
					return false;
				}
			},
		},
		group: "dctanban_change",
		subSkill: {
			change: {
				audio: "dctanban",
				trigger: { player: "phaseDrawEnd" },
				filter(event, player) {
					return player.countCards("h");
				},
				prompt2: () => "交换手牌中的“檀板”牌",
				check(event, player) {
					return player.countCards("h", card => !card.hasGaintag("dctanban")) * 2 < player.countCards("h");
				},
				async content(event, trigger, player) {
					const cards = player.getCards("h", card => !card.hasGaintag("dctanban"));
					player.removeGaintag("dctanban");
					player.addGaintag(cards, "dctanban");
				},
			},
		},
	},
	dcdiou: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (!player.hasCard(card => _status.connectMode || !card.hasGaintag("dctanban"), "h")) {
				return false;
			}
			return player.hasHistory("lose", evt => {
				const evtx = evt.relatedEvent || evt.getParent();
				if (evtx != event) {
					return false;
				}
				return Object.keys(evt.gaintag_map).some(i => evt.gaintag_map[i].includes("dctanban"));
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), (card, player) => {
					return !card.hasGaintag("dctanban");
				})
				.set("ai", card => {
					const player = get.player();
					const shown = game
						.getGlobalHistory("everything", evt => {
							return evt.name === "showCards";
						})
						.reduce((list, evt) => list.addArray(evt.cards), []);
					const cardx = {
						name: get.name(card, player),
						nature: get.nature(card, player),
						isCard: true,
					};
					return player.getUseValue(cardx) + (shown.includes(card) && get.event().getTrigger().card.name !== cardx.name) ? 0 : get.effect(player, { name: "draw" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const next = player.showCards(event.cards, get.translation(player) + "发动了【低讴】");
			await next;
			const cardx = {
				name: get.name(event.cards[0], player),
				nature: get.nature(event.cards[0], player),
				isCard: true,
			};
			if (get.type(cardx) !== "equip" && get.type(cardx) !== "delay" && player.hasUseTarget(cardx)) {
				await player.chooseUseTarget(cardx, true, false);
			}
			if (
				!game.getGlobalHistory(
					"everything",
					evt => {
						return evt.name === "showCards" && evt !== next && evt.cards.includes(event.cards[0]);
					},
					next
				).length ||
				trigger.card.name === cardx.name
			) {
				await player.draw(2);
			}
		},
		ai: {
			combo: "dctanban",
		},
	},
	//黄舞蝶
	dcshuangrui: {
		onChooseTarget(event, player) {
			event.targetprompt2.add(target => {
				if (event.getParent().skill !== "dcshuangrui" || !target.classList.contains("selectable")) {
					return;
				}
				if (player.inRange(target)) {
					return "加伤";
				} else {
					return "不可响应";
				}
			});
		},
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(current => {
				return current != player && player.canUse({ name: "sha", isCard: true }, current, false);
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return target != player && player.canUse({ name: "sha", isCard: true }, target, false);
				})
				.set("ai", target => {
					const player = get.player(),
						card = { name: "sha", isCard: true };
					return get.effect(target, card, player, player);
				})
				.set("_get_card", { name: "sha", isCard: true })
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			let directHit = [],
				baseDamage = 1;
			if (player.inRange(target)) {
				baseDamage++;
				await player.addTempSkills("dcshaxue");
			} else {
				directHit.addArray(game.players);
				await player.addTempSkills("dcshouxing");
			}
			await player.useCard({ name: "sha", isCard: true }, target, false).set("directHit", directHit).set("baseDamage", baseDamage);
		},
		ai: {
			skillTagFilter(player, tag, arg) {
				if (!_status.event.getParent("dcshuangrui_cost", true, true)) {
					return false;
				}
				return !player.inRange(arg.target);
			},
			directHit_ai: true,
		},
		derivation: ["dcshouxing", "dcshaxue"],
	},
	dcfuxie: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => current != player && current.countCards("he"));
		},
		chooseButton: {
			dialog(event, player) {
				const skills = player.getSkills(null, false, false).filter(skill => {
					let info = get.info(skill);
					if (!info || info.charlotte || get.skillInfoTranslation(skill, player).length == 0) {
						return false;
					}
					return true;
				});
				const dialog = ui.create.dialog("伏械：弃置一张武器牌或失去1个技能");
				dialog.direct = true;
				dialog.add([
					[["discardEquip1", "弃置武器牌"]],
					(item, type, position, noclick, node) => {
						node = ui.create.buttonPresets.tdnodes(item, type, position, noclick);
						node.link = ["discard", "equip1"];
						return node;
					},
				]);
				dialog.add([skills, "skill"]);
				return dialog;
			},
			filter(button, player) {
				if (Array.isArray(button.link)) {
					return player.countDiscardableCards(player, "he", card => get.subtype(card) == button.link[1]);
				}
				return true;
			},
			check(button) {
				const player = get.player();
				if (Array.isArray(button.link)) {
					if (player.countDiscardableCards(player, "he", card => get.subtype(card) == button.link[1] && get.value(card) < 10)) {
						return 3;
					}
					return 1;
				}
				if (["dcshouxing", "dcshaxue"].includes(button.link)) {
					return 4;
				}
				return 2;
			},
			backup(links, player) {
				return {
					audio: "dcfuxie",
					choice: links[0],
					filterCard(card) {
						const { choice } = get.info("dcfuxie_backup");
						if (Array.isArray(choice)) {
							return get.subtype(card) == "equip1" && lib.filter.cardDiscardable(card, player, "dcfuxie");
						}
						return false;
					},
					position: "he",
					selectCard() {
						const { choice } = get.info("dcfuxie_backup");
						if (Array.isArray(choice)) {
							return 1;
						}
						return -1;
					},
					filterTarget(card, player, target) {
						return target != player && target.countCards("he");
					},
					async content(event, trigger, player) {
						const { choice } = get.info("dcfuxie_backup");
						if (Array.isArray(choice)) {
							await player.modedDiscard(event.cards);
						} else {
							await player.removeSkills(choice);
						}
						const target = event.target;
						await target.chooseToDiscard(2, true, "he");
					},
					ai1(card) {
						return 10 - get.value(card);
					},
					ai2(target) {
						const player = get.player();
						return get.effect(target, { name: "guohe_copy2" }, player, player);
					},
				};
			},
			prompt(links, player) {
				let prompt = Array.isArray(links[0]) ? "弃置一张武器牌" : `失去【${get.translation(links[0])}】`;
				return `${prompt}，令一名角色弃置两张牌`;
			},
		},
		subSkill: {
			backup: {},
		},
		ai: {
			order: 3,
			result: {
				player(player, target) {
					if (["dcshouxing", "dcshaxue"].some(skill => player.hasSkill(skill))) {
						return 1;
					}
					if (player.countCards("he", card => get.subtype(card) == "equip1")) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	dcshouxing: {
		audio: 2,
		enable: "chooseToUse",
		filterCard: true,
		selectCard: [1, Infinity],
		position: "hse",
		viewAs: { name: "sha" },
		viewAsFilter(player) {
			if (!player.countCards("hse")) {
				return false;
			}
		},
		filterTarget(card, player, target) {
			const cards = ui.selected.cards;
			if (!cards || !cards.length) {
				return false;
			}
			if (player.inRange(target)) {
				return false;
			}
			if (get.distance(player, target) != cards.length) {
				return false;
			}
			return lib.filter.targetEnabled(card, player, target);
		},
		complexSelect: true,
		prompt: "将X张牌当杀对一名攻击范围外的角色使用（X为你计算与其的距离）",
		check(card) {
			return 4.5 - get.value(card);
		},
		async precontent(event) {
			event.getParent().addCount = false;
		},
		ai: {
			skillTagFilter(player) {
				if (!player.countCards("hes")) {
					return false;
				}
			},
			respondSha: true,
		},
	},
	dcshaxue: {
		audio: 2,
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			return event.player != player;
		},
		check(event, player) {
			return get.distance(player, event.player) <= 2;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.draw(2);
			const num = get.distance(player, trigger.player);
			if (num > 0 && trigger.player.isIn()) {
				await player.chooseToDiscard(num, "he", true);
			}
		},
	},
	//马腾
	dcxiongyi: {
		skillAnimation: true,
		animationColor: "gray",
		unique: true,
		enable: "phaseUse",
		audio: "xiongyi",
		limited: true,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await game.asyncDraw([event.target, player], 3);
			if (
				game
					.getAllGlobalHistory("everything", evt => {
						return evt.name == event.name && evt.player == player;
					})
					.indexOf(event) == 0 &&
				player.isMinHp(true)
			) {
				if (player.isDamaged()) {
					await player.recover();
				}
			}
			player.addAdditionalSkill(event.name, "dcxiongyi_restore");
		},
		ai: {
			order: 1,
			result: {
				target: 1,
			},
		},
		subSkill: {
			restore: {
				trigger: {
					player: "dyingAfter",
				},
				charlotte: true,
				direct: true,
				filter(event, player) {
					return player.isIn();
				},
				async content(event, trigger, player) {
					game.log(player, "重置了", "#g【雄异】");
					player.restoreSkill("dcxiongyi");
					player.addAdditionalSkill("dcxiongyi", []);
				},
			},
		},
	},
};
