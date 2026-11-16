import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olkuangjuan" | "olfeibian" | "olfulve">} */
export const groupSkills = {
	//OL猴子
	olkuangjuan: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return player.maxHp;
		},
		filter(event, player) {
			return game.hasPlayer(target => get.info("olkuangjuan").filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target.countCards("h") != player.countCards("h");
		},
		async content(event, trigger, player) {
			const num = player.countCards("h") - event.target.countCards("h");
			player.addTempSkill("olkuangjuan_effect");
			if (num > 0) {
				const result = await player.chooseToDiscard("h", num, true, "allowChooseAll").forResult();
				if (result?.cards?.length) {
					await player.draw(result.cards.length).set("gaintag", ["olkuangjuan_effect"]);
				}
			} else if (num < 0) {
				await player.drawTo(event.target.countCards("h")).set("gaintag", ["olkuangjuan_effect"]);
			}
		},
		ai: {
			order: 0.1,
			result: {
				player(player, target) {
					return Math.abs(target.countCards("h") - player.countCards("h"));
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				trigger: { player: "useCard0" },
				filter(event, player) {
					if (event.addCount === false) {
						return false;
					}
					return player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx !== event) {
							return false;
						}
						return Object.values(evt.gaintag_map).flat().includes("olkuangjuan_effect");
					});
				},
				forced: true,
				popup: false,
				firstDo: true,
				content() {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				},
				mod: {
					cardUsable(card, player) {
						if (!card.cards || card.cards.length !== 1) {
							return;
						}
						if (get.itemtype(card.cards[0]) === "card" && card.cards[0].hasGaintag("olkuangjuan_effect")) {
							return Infinity;
						}
					},
				},
			},
		},
	},
	olfeibian: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		filter(event, player) {
			if (event.player === player) {
				return _status.currentPhase === player;
			}
			return event.targets?.includes(player);
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player;
			const cards = target.getDiscardableCards(target, "h");
			if (cards.length) {
				await target.discard(cards.randomGets(1));
			}
			const info = target.forceCountChoose;
			if (_status.countDown) {
				return;
			}
			let time;
			if (typeof info?.["chooseToUse"] === "number") {
				time = info["chooseToUse"];
			} else if (typeof info?.default === "number") {
				time = info.default;
			} else {
				if (!_status.connectMode) {
					return;
				}
				time = lib.configOL.choose_timeout;
			}
			if (time) {
				time = parseInt(time);
				if (time > 1) {
					time--;
					target.addTempSkill("olfeibian_time", "roundStart");
					target.addMark("olfeibian_time", 1, false);
					game.broadcastAll(
						(player, time) => {
							if (!player.forceCountChoose) {
								player.forceCountChoose = {};
							}
							player.forceCountChoose.chooseToUse = time;
						},
						target,
						time
					);
					game.log(target, "出牌时限", "#y-1s");
				}
			}
		},
		group: ["olfeibian_init", "olfeibian_loseHp"],
		init() {
			game.broadcastAll(() => {
				const countDown = game.countDown;
				if (typeof countDown !== "function") {
					return;
				}
				game.countDown = function (time, onEnd) {
					const newOnEnd = () => {
						const event = get.event();
						if (event?.name === "chooseToUse" && event.player?.isIn()) {
							event.player.addTempSkill("olfeibian_effect");
						}
						if (typeof onEnd === "function") {
							onEnd();
						}
					};
					return countDown.call(this, time, newOnEnd);
				};
			});
		},
		subSkill: {
			effect: { charlotte: true },
			time: {
				charlotte: true,
				onremove(player, skill) {
					game.broadcastAll(
						(player, time) => {
							player.forceCountChoose.chooseToUse = time;
						},
						player,
						player.forceCountChoose.chooseToUse + player.countMark(skill)
					);
					delete player.storage[skill];
				},
			},
			init: {
				audio: "olfeibian",
				trigger: { global: "phaseBefore", player: "enterGame" },
				filter: event => event.name !== "phase" || game.phaseNumber === 0,
				forced: true,
				content() {
					game.broadcastAll(player => {
						if (!player.forceCountChoose) {
							player.forceCountChoose = {};
						}
						player.forceCountChoose.chooseToUse = 15;
					}, player);
					game.log(player, "的出牌时限改为了", "#g15s");
				},
			},
			loseHp: {
				audio: "olfeibian",
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					return game.hasPlayer(target => target.hasSkill("olfeibian_effect"));
				},
				logTarget(event, player) {
					return game.filterPlayer(target => target.hasSkill("olfeibian_effect"));
				},
				forced: true,
				content() {
					for (const i of event.targets) {
						i.loseHp();
					}
				},
			},
		},
	},
	//OL裴元绍
	olfulve: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (event.targets.length != 1 || player.getStorage("olfulve_used").length > 1) {
				return false;
			}
			return event.card.name == "sha" || (get.type(event.card) == "trick" && get.tag(event.card, "damage"));
		},
		async cost(event, trigger, player) {
			const target = trigger.target;
			const list = [
				["damage", "此牌造成伤害+1"],
				["gain", "获得其一张牌"],
			];
			const result = await player
				.chooseButton([get.prompt2(event.skill, target), [list, "textbutton"]], 1)
				.set("filterButton", function (button) {
					if (get.player().getStorage("olfulve_used").includes(button.link)) {
						return false;
					}
					if (button.link == "gain") {
						return get.event().target.countGainableCards(get.player(), "he") > 0;
					}
					return true;
				})
				.set("target", target)
				.set("ai", button => {
					if (button.link == "gain") {
						return get.effect(get.event().target, { name: "shunshou_copy2" }, get.player(), get.player());
					}
					return get.damageEffect(get.event().target, get.player(), get.player());
				})
				.forResult();
			if (result.bool) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const target = trigger.target;
			let choice = event.cost_data;
			const map = {
				damage: async (player, target, trigger) => {
					game.log(trigger.card, "造成的伤害+1");
					trigger.baseDamage++;
				},
				gain: async (player, target, trigger) => {
					if (!target.countGainableCards(player, "he")) {
						return;
					}
					await player.gainPlayerCard(target, "he", true);
				},
			};
			player.addTempSkill("olfulve_used");
			player.markAuto("olfulve_used", [choice]);
			await map[choice](player, target, trigger.getParent());
			choice = choice == "damage" ? "gain" : "damage";
			const sourcex = player;
			target
				.when({ global: "useCardAfter" })
				.filter(evt => {
					return evt === trigger.getParent();
				})
				.step(async (event, trigger, player) => {
					if (
						game.hasPlayer(current => {
							return current.hasHistory("damage", evt => evt.getParent(2) == trigger);
						})
					) {
						return;
					}
					player
						.chooseToUse(
							function (card, player, event) {
								if (get.name(card) != "sha") {
									return false;
								}
								return lib.filter.filterCard.apply(this, arguments);
							},
							"复掠：是否对" + get.translation(sourcex) + "使用一张【杀】"
						)
						.set("targetRequired", true)
						.set("complexSelect", true)
						.set("complexTarget", true)
						.set("filterTarget", function (card, player, target) {
							if (target != get.event().sourcex && !ui.selected.targets.includes(get.event().sourcex)) {
								return false;
							}
							return lib.filter.filterTarget.apply(this, arguments);
						})
						.set("sourcex", sourcex)
						.set("func", map[choice])
						.set("oncard", (card, player) => {
							const event = get.event(),
								evt = event.getParent();
							evt.func(player, evt.sourcex, event);
						});
				});
		},
		subSkill: {
			used: {
				onremove: true,
				charlotte: true,
			},
		},
	},
};
