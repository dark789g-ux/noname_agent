import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "spolxudai" | "spolzhujiu" | "spoljinglei" | "olfengwei" | "olzonghu">} */
export const groupSkills = {
	//SP刘备
	spolxudai: {
		audio: 2,
		limited: true,
		trigger: { player: ["useCard", "respond", "damageEnd"] },
		filter(event, player) {
			if (!game.hasPlayer(current => current != player && !current.hasSkill("spolzhujiu", null, null, false))) {
				return false;
			}
			return event.name == "damage" || event.respondTo;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target != player && !target.hasSkill("spolzhujiu", null, null, false);
				})
				.set("ai", target => {
					return get.attitude(get.player(), target);
				})
				.forResult();
		},
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const {
				targets: [target],
			} = event;
			await target.addSkills("spolzhujiu");
		},
		derivation: "spolzhujiu",
	},
	spolzhujiu: {
		audio: 2,
		onChooseToUse(event) {
			if (!game.online && !event.spolzhujiu) {
				event.set("spolzhujiu", event.player.getHistory("useCard", evt => get.name(evt.card) == "jiu").length + 1);
			}
		},
		enable: "chooseToUse",
		viewAs: {
			name: "jiu",
		},
		position: "hes",
		filter(event, player) {
			const num = event.spolzhujiu;
			return typeof num == "number" && player.countCards("hes") >= num;
		},
		filterCard: true,
		selectCard() {
			const num = get.event().spolzhujiu;
			return [num, Infinity];
		},
		log: false,
		allowChooseAll: true,
		precontent() {
			player.logSkill("spolzhujiu");
			if (event.result.cards?.some(i => get.suit(i) !== "club")) {
				player.tempBanSkill("spolzhujiu");
			}
		},
		check(card) {
			const player = get.player();
			if (game.hasPlayer(current => current.hasSkill("spoljinglei") && !current.storage.counttrigger?.spoljinglei && get.attitude(current, player) > 0 && current.getHp() > 1)) {
				if (get.position(card) !== "h") {
					return -get.value(card);
				}
				return 10 - ui.selected.cards.length - get.value(card);
			}
			const num = get.event().spolzhujiu;
			if (typeof num == "number" && ui.selected.cards.length >= num) {
				return 0;
			}
			return 6 - get.value(card);
		},
		ai: {
			save: true,
			order(item, player) {
				if (get.event().dying) {
					return 9;
				}
				if (game.hasPlayer(current => current.hasSkill("spoljinglei") && !current.storage.counttrigger?.spoljinglei && get.attitude(current, player) > 0 && current.getHp() > 1)) {
					return get.order({ name: "sha" }) + 0.2;
				}
				return get.order({ name: "jiu" }) + 0.1;
			},
			nokeep: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "nokeep") {
					return (!arg || (arg?.card && get.name(arg.card) === "tao")) && get.event()?.type === "phase" && game.hasPlayer(current => current.hasSkill("spoljinglei") && !current.storage.counttrigger?.spoljinglei && get.attitude(current, player) > 0 && current.getHp() > 1) && player.hasCard(card => get.name(card) !== "tao", "h");
				}
			},
		},
	},
	spoljinglei: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		usable: 1,
		filter(event, player) {
			return event.card.name === "jiu" && !game.hasPlayer(current => current.isDying());
		},
		check(event, player) {
			if (get.damageEffect(player, player, player, "thunder") > 0) {
				return true;
			}
			return (
				Math.max(
					...[0].concat(
						game
							.filterPlayer(target => {
								return target.hasSkill("spolzhujiu", null, null, false);
							})
							.map(target => {
								return get.info("spoljinglei").getEffect(player, target);
							})
					)
				) > 0
			);
		},
		async content(event, trigger, player) {
			await player.damage("thunder", "nosource");
			if (!player.isIn() || !game.hasPlayer(target => target.hasSkill("spolzhujiu", null, null, false))) {
				return;
			}
			const result = await player
				.chooseTarget(
					"惊雷：请选择一名拥有〖煮酒〗的角色",
					(card, player, target) => {
						return target.hasSkill("spolzhujiu", null, null, false);
					},
					true
				)
				.set("prompt2", "令其将手牌调整至体力上限（至多摸至5），然后若该角色不为你：其须将以此法弃置的牌交给你")
				.set("ai", target => get.info("spoljinglei").getEffect(get.player(), target))
				.forResult();
			const target = result.targets?.[0];
			if (!target) {
				return;
			}
			const num = target.maxHp - target.countCards("h");
			if (num === 0) {
				return;
			}
			if (num > 0) {
				await target.drawTo(Math.min(target.maxHp, 5));
			} else {
				const num = Math.min(
					target.countCards("h") - target.maxHp,
					target.countCards("h", card => lib.filter.cardDiscardable(card, target))
				);
				if (num === 0) {
					return;
				}
				const result = await target.chooseToDiscard(num, true, "allowChooseAll").forResult();
				if (player != target && result?.cards?.someInD("d")) {
					await player.gain(result.cards.filterInD("d"), "gain2").set("giver", target);
				}
			}
		},
		getEffect(player, target) {
			if (player.countCards("hs", card => player.canSaveCard(card, player)) < 2 - player.hp) {
				return 0;
			}
			const draw = Math.min(5, target.maxHp) - target.countCards("h");
			const eff1 = get.damageEffect(player, player, player, "thunder");
			if (draw > 0) {
				return get.effect(target, { name: "draw" }, player, player) * draw + eff1;
			}
			if (draw < -1) {
				return get.effect(target, { name: "guohe_copy", position: "h" }, player, player) * Math.sqrt(Math.min(target.countDiscardableCards(target, "h"), -draw)) + eff1;
			}
			return 0;
		},
		ai: { combo: "spolzhujiu" },
	},
	//OL刘璋
	olfengwei: {
		audio: 2,
		trigger: { global: "roundStart" },
		forced: true,
		async content(event, trigger, player) {
			const nums = Array.from({ length: 4 }).map((_, i) => get.cnNumber(i + 1) + "张");
			const result = await player
				.chooseControl(nums)
				.set("prompt", "奉蔚：请选择摸牌数")
				.set("ai", () => 3)
				.forResult();
			const next = player.draw(result.index + 1);
			next.gaintag.add("olfengwei_debuff");
			await next;
			player.addTempSkill("olfengwei_debuff", "roundStart");
		},
		subSkill: {
			debuff: {
				charlotte: true,
				trigger: {
					player: ["damageBegin3", "phaseDrawBefore"],
				},
				filter(event, player) {
					if (event.name == "damage" && !event.card) {
						return false;
					}
					return player.hasCard(card => card.hasGaintag("olfengwei_debuff"), "h");
				},
				forced: true,
				async content(event, trigger, player) {
					if (trigger.name == "damage") {
						trigger.num++;
					} else {
						trigger.cancel();
					}
				},
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
			},
		},
	},
	olzonghu: {
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			if (player.countCards("he") < Math.min(3, game.roundNumber)) {
				return false;
			}
			if (event.type == "wuxie" || player.hasSkill("olzonghu_used")) {
				return false;
			}
			for (var name of ["sha", "shan"]) {
				if (event.filterCard({ name: name, isCard: true }, player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var vcards = [];
				for (var name of ["sha", "shan"]) {
					var card = { name: name, isCard: true };
					if (event.filterCard(card, player, event)) {
						vcards.push(["基本", "", name]);
					}
				}
				var dialog = ui.create.dialog("宗护", [vcards, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			backup(links, player) {
				return {
					filterTarget: lib.filter.notMe,
					selectTarget: 1,
					filterCard: true,
					selectCard() {
						const count = Math.min(3, game.roundNumber);
						return [count, count];
					},
					position: "he",
					lose: false,
					discard: false,
					visible: false,
					popname: true,
					ignoreMod: true,
					viewAs: {
						name: links[0][2],
						suit: "none",
						number: "none",
						isCard: true,
					},
					log: false,
					ai1(card) {
						return 1 / (1.1 + Math.max(-1, get.value(card)));
					},
					ai2(target) {
						const att = get.attitude(get.player(), target);
						if (att <= 0) {
							return false;
						}
						if (target.hasSkillTag("nogain")) {
							return 0;
						}
						if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
							return target.hasSkillTag("nodu") ? 0 : -10;
						}
						if (target.hasJudge("lebu")) {
							return 0;
						}
						const nh = target.countCards("h");
						return Math.max(1, 5 - nh);
					},
					async precontent(event, trigger, player) {
						player.addTempSkill("olzonghu_used");
						const skill = "olzonghu";
						const cards = event.result.cards.slice(0);
						const target = event.result.targets[0];
						delete event.result.cards;
						player.logSkill(skill);
						await player.give(cards, target, false);
						const viewAs = get.autoViewAs({
							name: event.result.card.name,
							isCard: true,
						});
						game.broadcastAll(
							(viewAs, skill) => {
								lib.skill[`${skill}_backup2`].viewAs = viewAs;
							},
							viewAs,
							skill
						);
						const evt = event.getParent();
						evt.set("_backupevent", `${skill}_backup2`);
						evt.set("openskilldialog", `请选择${get.translation(event.result.card.name)}的目标`);
						evt.backup(`${skill}_backup2`);
						evt.set("norestore", true);
						evt.set("custom", {
							add: {},
							replace: { window() {} },
						});
						evt.goto(0);
					},
				};
			},
			prompt(links, player) {
				return `宗护：将${Math.min(3, game.roundNumber)}张牌交给一名其他角色，视为使用一张【${get.translation(links[0][2])}】`;
			},
		},
		ai: {
			order(item, player) {
				let event = get.event();
				if (!game.hasPlayer(current => current != player && get.attitude(player, current) > 0) && game.roundNumber > 2) {
					return 0;
				}
				if (event.filterCard({ name: "sha" }, player, event)) {
					if (
						!player.hasShan() &&
						!game.hasPlayer(function (current) {
							return player.canUse("sha", current) && current.hp == 1 && get.effect(current, { name: "sha" }, player, player) > 0;
						})
					) {
						return 0;
					}
					return 2.95;
				}
				return 1;
			},
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond" || player.hasSkill("olzonghu_used")) {
					return false;
				}
			},
			result: {
				player: 1,
			},
		},
		subSkill: {
			backup2: {
				filterCard: () => false,
				selectCard: -1,
				log: false,
			},
			used: {
				charlotte: true,
				mark: true,
				onremove: true,
				intro: {
					content: "本回合已发动",
				},
			},
		},
	},
};
