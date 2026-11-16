import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twylyanshi" | "twjuexing" | "twxiayong">} */
export const groupSkills = {
	twylyanshi: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		filter(event, player) {
			return ["juedou", "binglinchengxiax"].concat(get.zhinangs()).some(name => {
				const info = { name: name };
				return (
					get.info(info) &&
					player.hasCard(card => {
						return get.name(card) == "sha" && event.filterCard({ name: name, cards: [card] }, player, event);
					}, "hs")
				);
			});
		},
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		onremove: ["twylyanshi", "twduwang_ylyanshi"],
		chooseButton: {
			dialog(event, player) {
				const list = ["juedou", "binglinchengxiax"]
					.concat(get.zhinangs())
					.filter(name => {
						const info = { name: name };
						return (
							get.info(info) &&
							player.hasCard(card => {
								return get.name(card) == "sha" && event.filterCard({ name: name, cards: [card] }, player, event);
							}, "hs")
						);
					})
					.map(name => [get.translation(get.type(name)), "", name]);
				return ui.create.dialog("延势", [list, "vcard"]);
			},
			check(button) {
				return get.event().player.getUseValue({ name: button.link[2] });
			},
			backup(links, player) {
				return {
					audio: "twylyanshi",
					filterCard(card, player) {
						return get.name(card) == "sha";
					},
					popname: true,
					check(card) {
						return 5 - get.value(card);
					},
					position: "hs",
					viewAs: { name: links[0][2] },
					log: false,
					precontent() {
						player.logSkill("twylyanshi");
						player.awakenSkill("twylyanshi");
						if (player.storage.twduwang_ylyanshi) {
							player.when({ global: "phaseEnd" }).step(async () => {
								if (player.awakenedSkills.includes("twylyanshi")) {
									player.popup("历战");
									player.restoreSkill("twylyanshi");
									game.log(player, "触发了", "#g【延势】", "的", "#y历战", "效果");
								}
							});
						}
					},
				};
			},
			prompt(links, player) {
				return "将一张【杀】当作" + "【" + get.translation(links[0][2]) + "】使用";
			},
		},
		subSkill: { backup: {} },
		hiddenCard(player, name) {
			if (player.awakenedSkills.includes("twylyanshi") || !player.countCards("hs", card => _status.connectMode || get.name(card) == "sha")) {
				return false;
			}
			return ["juedou", "binglinchengxiax"].concat(get.zhinangs()).includes(name);
		},
		ai: {
			order(item, player) {
				if (!player || _status.event.type != "phase") {
					return 0.001;
				}
				let max = 0,
					names = ["juedou", "binglinchengxiax"].concat(get.zhinangs()).filter(name => {
						const info = { name: name };
						return (
							get.info(info) &&
							player.hasCard(card => {
								return get.name(card) == "sha" && player.hasValueTarget(get.autoViewAs(info, [card]), true, true);
							}, "hs")
						);
					});
				if (!names.length) {
					return 0;
				}
				names = names.map(namex => {
					return { name: namex };
				});
				names.forEach(card => {
					if (player.getUseValue(card) > 0) {
						let temp = get.order(card);
						if (temp > max) {
							max = temp;
						}
					}
				});
				if (max > 0) {
					max += 0.3;
				}
				return max;
			},
			result: { player: 1 },
		},
	},
	twjuexing: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => get.info("twjuexing").filterTarget(null, player, target));
		},
		filterTarget(_, player, target) {
			const card = new lib.element.VCard({ name: "juedou", isCard: true });
			return target != player && player.canUse(card, target);
		},
		usable: 1,
		onremove: "twjuexing_lizhan",
		async content(event, trigger, player) {
			player.when({ global: "phaseEnd" }).step(async () => {
				player.popup("历战");
				player.addSkill("twjuexing_lizhan");
				player.addMark("twjuexing_lizhan", 1, false);
				game.log(player, "触发了", "#g【绝行】", "的", "#y历战", "效果");
			});
			const target = event.target;
			const card = new lib.element.VCard({ name: "juedou", isCard: true });
			player.addTempSkill("twjuexing_effect");
			player
				.when({ global: "useCardAfter" })
				.filter(evtx => evtx.getParent() == event)
				.step(async (event, trigger, player) => {
					let list = [];
					const targets = [player].concat(trigger.targets);
					for (const i of targets) {
						if (i.isIn() && i.hasCard(card => card.hasGaintag("twjuexing"), "h")) {
							list.push([i, i.getCards("h", card => card.hasGaintag("twjuexing"))]);
						}
					}
					if (list.length) {
						await game.loseAsync({ lose_list: list }).setContent("discardMultiple");
					}

					let listx = [];
					for (const i of targets) {
						if (i.isIn() && i.getExpansions("twjuexing_buff").length) {
							listx.push([i, i.getExpansions("twjuexing_buff")]);
						}
					}
					if (listx.length) {
						await game.loseAsync({ gain_list: listx, animate: "draw" }).setContent("gaincardMultiple");
					}

					targets.forEach(current => {
						current.removeSkill("twjuexing_buff");
					});
					await game.delay();
				});
			await player.useCard(card, target, false);
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					return (
						get.sgn(get.attitude(player, target)) *
						get.effect(target, { name: "juedou" }, player, player) *
						((player.getHp() + 1) / (target.getHp() + 1))
					);
				},
			},
		},
		subSkill: {
			effect: {
				trigger: { global: "useCardToBegin" },
				forced: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					return event.getParent(2).name === "twjuexing";
				},
				async content(event, trigger, player) {
					const target = trigger.target;
					player.addSkill("twjuexing_buff");
					target.addSkill("twjuexing_buff");
					let list = [];
					for (const i of [player, target]) {
						if (i.isIn() && i.countCards("h")) {
							list.push([i, i.getCards("h")]);
						}
					}
					if (list.length) {
						await game
							.loseAsync({
								lose_list: list,
								log: true,
								animate: "giveAuto",
								gaintag: ["twjuexing_buff"],
							})
							.setContent("addToExpansionMultiple");
					}
					if (player.getHp() > 0) {
						await player.draw(player.getHp(), target.getHp() > 0 ? "nodelay" : "").set("gaintag", ["twjuexing"]);
					}
					if (target.getHp() > 0) {
						await target.draw(target.getHp()).set("gaintag", ["twjuexing"]);
					}
					await game.delay();
				},
			},
			lizhan: {
				charlotte: true,
				onremove: true,
				marktext: "战",
				intro: { content: "因【绝行】摸牌时，摸牌数+#" },
				trigger: { player: "drawBegin" },
				filter(event, player) {
					if (!player.hasMark("twjuexing_lizhan")) {
						return false;
					}
					return (event.gaintag || []).includes("twjuexing");
				},
				forced: true,
				popup: false,
				content() {
					player.popup("历战");
					game.log(player, "触发了", "#g【绝行】", "的", "#y历战", "效果");
					trigger.num += player.countMark("twjuexing_lizhan");
				},
			},
			buff: {
				charlotte: true,
				onremove(player, skill) {
					const cards = player.getExpansions(skill);
					if (cards.length) {
						player.gain(cards, "gain2");
					}
				},
				intro: {
					markcount: "expansion",
					mark(dialog, _, player) {
						var cards = player.getExpansions("twjuexing_buff");
						if (player.isUnderControl(true)) {
							dialog.addAuto(cards);
						} else {
							return "共有" + get.cnNumber(cards.length) + "张牌";
						}
					},
				},
			},
		},
	},
	twxiayong: {
		audio: 2,
		audioname: ["tw_yanliang"],
		trigger: { global: "damageBegin1" },
		filter(event, player) {
			if (event.getParent().type != "card" || event.card.name != "juedou" || !event.player.isIn()) {
				return false;
			}
			const evt = event.getParent();
			if (evt && evt.targets && (event.player != player || player.countCards("h") > 0)) {
				return evt.player === player || evt.targets.includes(player);
			}
			return false;
		},
		logTarget: "player",
		logAudio(event, player) {
			return (
				"twxiayong" +
				(lib.skill.twxiayong.audioname.includes(player.name) ? "_" + player.name : "") +
				(event.player === player ? 1 : 2) +
				".mp3"
			);
		},
		locked: true,
		forced: true,
		async content(event, trigger, player) {
			if (trigger.player === player) {
				const cards = player.getCards("h", card => {
					return lib.filter.cardDiscardable(card, player, "twxiayong");
				});
				if (cards.length > 0) {
					player.discard(cards.randomGet());
				}
			} else {
				trigger.num++;
			}
		},
	},
};
