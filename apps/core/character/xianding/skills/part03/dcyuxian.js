import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcyuxian" | "dcminshan" | "dcbaguan" | "dcxiaowu">} */
export const groupSkills = {
	//徐馨
	dcyuxian: {
		audio: 2,
		trigger: {
			global: "roundStart",
		},
		filter(event, player) {
			return player.countCards("h");
		},
		async cost(event, trigger, player) {
			player.setStorage(event.skill, [], true);
			event.result = await player.chooseCard(get.prompt(event.skill), "依次选择至多四张手牌展示并记录花色", [1, 4]).forResult();
		},
		async content(event, trigger, player) {
			const cards = event.cards;
			await player.showCards(cards, `${get.translation(player)}发动了【育贤】`);
			player.setStorage(
				event.name,
				cards.map(card => get.suit(card, player)),
				true
			);
			player.addTip(event.name, `育贤 ${player.getStorage(event.name).reduce((str, suit) => str + get.translation(suit), "")}`);
		},
		intro: { content: "已记录花色：$" },
		onremove(player, skill) {
			delete player.storage[skill];
			player.removeTip(skill);
		},
		global: "dcyuxian_ai",
		group: "dcyuxian_draw",
		subSkill: {
			ai: {
				mod: {
					aiOrder(player, card, num) {
						const targets = game.filterPlayer(current => {
							if (current == player || !current.hasSkill("dcyuxian")) {
								return false;
							}
							return get.attitude(player, current) >= 0 && current.getStorage("dcyuxian").length;
						});
						if (!targets.length) {
							return;
						}
						const index = player.getHistory("useCard").length;
						if (
							targets.some(target => {
								const list = target.getStorage("dcyuxian");
								return list?.[index] == get.suit(card, player);
							})
						) {
							return num + 10;
						}
					},
					aiValue(player, card, num) {
						return get.info("dcyuxian_ai").mod.aiOrder.apply(this, arguments);
					},
					aiUseful(player, card, num) {
						return get.info("dcyuxian_ai").mod.aiOrder.apply(this, arguments);
					},
				},
			},
			draw: {
				audio: "dcyuxian",
				trigger: { global: "useCard" },
				filter(event, player) {
					if (_status.currentPhase !== event.player || event.player === player) {
						return false;
					}
					const num = event.player.getHistory("useCard").indexOf(event);
					return player.getStorage("dcyuxian")[num] === get.suit(event.card, event.player);
				},
				logTarget: "player",
				check: (event, player) => get.attitude(player, event.player) > 0,
				prompt2: (event, player) => "与" + get.translation(event.player) + "各摸一张牌",
				async content(event, trigger, player) {
					await game.asyncDraw([player, trigger.player]);
				},
			},
		},
	},
	dcminshan: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.num > 0;
		},
		getIndex: event => event.num,
		async cost(event, trigger, player) {
			event.result = player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "draw" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			let cards = [];
			if (player.getStorage("dcyuxian").length) {
				while (cards.length < 2) {
					let card = get.cardPile2(card => {
						if (cards.includes(card)) {
							return false;
						}
						const suit = get.suit(card);
						if (player.getStorage("dcyuxian").includes(suit)) {
							return true;
						}
						return false;
					});
					if (card) {
						cards.push(card);
					} else {
						break;
					}
				}
			}
			if (cards.length < 2) {
				cards.addArray(get.cards(2 - cards.length));
			}
			if (cards.length) {
				await event.targets[0].gain(cards, "draw");
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1];
					}
					if (get.tag(card, "damage")) {
						return [1, 0.55];
					}
				},
			},
		},
	},
	//威吕布
	dcbaguan: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (!player.getEquips(1).length || get.type(event.card) !== "equip" || !get.subtypes(event.card).includes("equip1")) {
				return false;
			}
			const num = player.getEquips(1).reduce((sum, card) => sum + get.cardNameLength(card), 0);
			return lib.skill.dcbaguan.getUsed(player) && num > 0 && player.countCards("hs") > 0;
		},
		direct: true,
		comboSkill: true,
		clearTime: true,
		async content(event, trigger, player) {
			const num = player.getEquips(1).reduce((sum, card) => sum + get.cardNameLength(card), 0);
			game.broadcastAll(num => (lib.skill.dcbaguan_backup.selectCard = [1, num]), num);
			const next = player.chooseToUse();
			next.set("openskilldialog", `###${get.prompt(event.name)}###是否将至多${get.cnNumber(num)}张手牌当作无任何次数限制且伤害基数为对应实体牌数的【杀】使用`);
			next.set("norestore", true);
			next.set("_backupevent", "dcbaguan_backup");
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup("dcbaguan_backup");
			next.set("targetRequired", true);
			next.set("complexSelect", true);
			next.set("logSkill", event.name);
			next.set("addCount", false);
			next.set("oncard", () => {
				let event = get.event(),
					{ cards } = event;
				event.set("dcbaguan", true);
				event.baseDamage = cards.length;
			});
			await next;
		},
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
		},
		getUsed(player, first) {
			let history;
			if (first) {
				history = player
					.getAllHistory("useCard")
					//.filter(c => c.targets && c.targets.length)
					.at(-1);
			} else {
				history = player
					.getAllHistory("useCard")
					.slice(0, -1)
					//.filter(c => c.targets && c.targets.length)
					.at(-1);
			}
			if (!history || history.dcbaguan) {
				return false;
			}
			return history.targets.length == 1;
		},
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				if (lib.skill.dcbaguan.getUsed(player, true) && typeof card === "object") {
					if (get.itemtype(card) === "card" && get.subtype(card) === "equip1") {
						return num + 100;
					}
				}
			},
			cardUsable(card, player, num) {
				if (card.storage?.dcbaguan) {
					return Infinity;
				}
			},
			cardEnabled(card, player) {
				if (card.storage?.dcbaguan) {
					return true;
				}
			},
		},
		//group: "dcbaguan_mark",
		subSkill: {
			mark: {
				init(player, skill) {
					const evt = lib.skill.dcbaguan.getUsed(player, true);
					if (evt && !evt.dcbaguan) {
						player.addTip(skill, "霸关 可连击");
					}
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				charlotte: true,
				trigger: { player: "useCard" },
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (lib.skill.dcbaguan.getUsed(player, true)) {
						player.addTip(event.name, "霸关 可连击");
					} else {
						player.removeTip(event.name);
					}
				},
			},
			backup: {
				filterCard(card, player) {
					return get.itemtype(card) === "card";
				},
				filterTarget: lib.filter.filterTarget,
				viewAs: {
					name: "sha",
					storage: { dcbaguan: true },
				},
				position: "hs",
				ai1(card) {
					return 8 - get.value(card);
				},
				log: false,
			},
		},
	},
	dcxiaowu: {
		audio: 2,
		usable: 1,
		enable: "phaseUse",
		position: "he",
		filterCard: lib.filter.cardDiscardable,
		check(card) {
			const player = get.player();
			if (card.hasGaintag("dcxiaowu") && !player.hasValueTarget(card)) {
				return 4;
			}
			return 6 - get.value(card);
		},
		async content(event, trigger, player) {
			player.addSkill("dcxiaowu_effect");
			const cards = [];
			const num = player.hasHistory("custom", evt => evt.dcxiaowu) ? 2 : 1;
			while (cards.length < num) {
				let card = get.cardPile2(card => {
					if (cards.includes(card)) {
						return false;
					}
					return card.name == "sha" || get.cardDescription(card, player).includes("【杀】");
				});
				if (card) {
					cards.push(card);
				} else {
					break;
				}
			}
			if (cards.length) {
				await player.gain({ cards, animate: "gain2", gaintag: [event.name] });
			} else {
				player.chat("孩子们怎么没有牌");
			}
		},
		locked: false,
		mod: {
			aiValue(player, card, num) {
				if (card.name === "zhangba") {
					return num + 1145141919810;
				}
			},
		},
		ai: {
			order: 10,
			result: { player: 1 },
		},
		group: ["dcxiaowu_restore"],
		subSkill: {
			restore: {
				trigger: { source: "damageSource" },
				forced: true,
				popup: false,
				locked: false,
				content() {
					if (player.getStat().skill.dcxiaowu) {
						delete player.getStat().skill.dcxiaowu;
						game.log(player, "重置了", "#g【骁武】");
					}
					player.getHistory("custom").push({ dcxiaowu: true });
				},
			},
			effect: {
				inherit: "nocount",
				mod: {
					cardUsable(card) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("dcxiaowu"))) {
							return Infinity;
						}
					},
				},
				filter(event, player) {
					return (
						event.addCount !== false &&
						player.hasHistory("lose", evt => {
							if ((evt.relatedEvent || evt.getParent()) !== event) {
								return false;
							}
							return Object.values(evt.gaintag_map).flat().includes("dcxiaowu");
						})
					);
				},
			},
		},
	},
};
