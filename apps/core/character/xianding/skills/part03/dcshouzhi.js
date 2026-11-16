import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshouzhi" | "dcfenhui" | "dcxingmen" | "dcjuewu">} */
export const groupSkills = {
	//关樾
	dcshouzhi: {
		audio: 2,
		trigger: {
			global: "phaseEnd",
		},
		filter(event, player) {
			let delt = 0;
			player.checkHistory("lose", evt => {
				delt -= evt.hs.length;
			});
			player.checkHistory("gain", evt => {
				delt += evt.cards.length;
			});
			return delt < 0 || (delt > 0 && player.countCards("h"));
		},
		locked(skill, player) {
			return !(player && player.storage.dcshouzhi_modified);
		},
		derivation: ["dcshouzhi_modified"],
		onremove: ["dcshouzhi_modified"],
		async cost(event, trigger, player) {
			let delt = 0;
			player.checkHistory("lose", evt => {
				delt -= evt.hs.length;
			});
			player.checkHistory("gain", evt => {
				delt += evt.cards.length;
			});
			const forced = !player.storage.dcshouzhi_modified;
			if (delt < 0) {
				const bool = forced ? true : (await player.chooseBool(get.prompt(event.skill), "你可以摸两张牌。").forResult()).bool;
				event.result = { bool };
			} else {
				const next = player.chooseCard("守执：请弃置一张手牌").set("filterCard", (card, player) => {
					return lib.filter.cardDiscardable(card, player, "dcshouzhi");
				});
				next.set("forced", forced);
				if (!forced) {
					next.set("prompt", get.prompt(event.skill))
						.set("prompt2", "你可以弃置一张手牌。")
						.set("ai", card => {
							const player = get.player();
							if (player.hasSkill("dcxingmen") && get.recoverEffect(player, player) > 0) {
								return 6 - get.value(card);
							}
							return 0;
						});
				}
				event.result = await next.forResult();
			}
		},
		async content(event, trigger, player) {
			const { cards } = event;
			if (cards?.length) {
				await player.discard(cards);
			} else {
				await player.draw(2);
			}
			await game.delayx();
		},
		subSkill: { modified: {} },
	},
	dcfenhui: {
		onChooseToUse(event) {
			if (game.online || event.type !== "phase") {
				return;
			}
			event.targetprompt2.add(target => {
				if (event.skill !== "dcfenhui" || !target.classList.contains("selectable")) return;
				const count = get.event().dcfenhui_enabled.get(target);
				const num = Math.min(5, count);
				return `${num}恨`;
			});
			const player = event.player;
			const evts = player.getAllHistory("useCard", evt => evt.targets?.length);
			event.set(
				"dcfenhui_enabled",
				game
					.filterPlayer(current => {
						return evts.filter(evt => evt.targets.includes(current)).length;
					})
					.reduce((map, current) => map.set(current, evts.filter(evt => evt.targets.includes(current)).length), new Map())
			);
		},
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			const map = get.event().dcfenhui_enabled;
			if (!map?.size) {
				return false;
			}
			return map.has(target);
		},
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		derivation: ["dcxingmen", "dcshouzhi_modified"],
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const target = event.target;
			const count = player.getAllHistory("useCard", evt => {
				return evt.targets?.includes(target);
			}).length;
			target.addMark("dcfenhui_mark", Math.min(5, count));
			await player.draw(Math.min(5, count));
			player.addSkill("dcfenhui_effect");
		},
		subSkill: {
			effect: {
				audio: "dcfenhui",
				trigger: { global: ["damageBegin1", "die", "dyingAfter"] },
				filter(event, player) {
					if (!event.player.hasMark("dcfenhui_mark")) {
						return false;
					}
					if (event.name == "damage") {
						return true;
					}
					if (event.name == "dying" && !event.player?.isIn()) {
						return false;
					}
					return !player.storage.dcshouzhi_modified;
				},
				logTarget: "player",
				forced: true,
				charlotte: true,
				async content(event, trigger, player) {
					if (trigger.name === "damage") {
						trigger.player.removeMark("dcfenhui_mark", 1);
						trigger.num++;
					} else {
						await player.loseMaxHp();
						player.storage.dcshouzhi_modified = true;
						await player.addSkills("dcxingmen");
					}
				},
			},
			mark: {
				marktext: "恨",
				intro: {
					name: "恨(奋恚)",
					name2: "恨",
					content: "mark",
				},
			},
		},
		ai: {
			order: 6,
			result: {
				target(player, target) {
					if (
						!player.hasCard(card => {
							return get.tag(card, "damage") && player.canUse(card, target, true, true) && get.effect(target, card, player, player) > 0;
						}, "hs")
					) {
						return 0;
					}
					const count = Math.min(
						5,
						player.getAllHistory("useCard", evt => {
							return evt.targets && evt.targets.includes(target);
						}).length
					);
					let value = Math.max(player.getHp(true), 3) - count;
					if (
						(count - 1) *
							(target.hasSkillTag("filterDamage", null, {
								player: player,
							})
								? 1
								: 2) >=
						target.getHp(true) +
							target.countCards("hs", card => {
								return target.canSaveCard(card, target);
							})
					) {
						value -= 2;
					}
					return Math.min(0, value);
				},
			},
		},
	},
	dcxingmen: {
		audio: 2,
		trigger: { player: "loseAfter" },
		filter(event, player) {
			return event.getParent(2).name === "dcshouzhi" && player.isDamaged();
		},
		frequent: true,
		prompt2: "你可以回复1点体力。",
		group: ["dcxingmen_norespond"],
		check(event, player) {
			return get.recoverEffect(player, player) > 0;
		},
		async content(event, trigger, player) {
			await player.recover();
		},
		derivation: "dcshouzhi",
		ai: { combo: "dcshouzhi" },
		subSkill: {
			norespond: {
				audio: "dcxingmen",
				trigger: { player: "gainAfter" },
				filter(event, player) {
					return event.getParent().name === "draw" && event.cards.length >= 2;
				},
				forced: true,
				locked: false,
				popup: false,
				async content(event, trigger, player) {
					player.addGaintag(trigger.cards, "dcxingmen");
					player.addSkill("dcxingmen_directHit");
				},
			},
			directHit: {
				audio: "dcxingmen",
				trigger: { player: "useCard" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return player.hasHistory("lose", evt => {
						if ((evt.relatedEvent || evt.getParent()) !== event) {
							return false;
						}
						return Object.values(evt.gaintag_map).some(tags => tags.includes("dcxingmen"));
					});
				},
				async content(event, trigger, player) {
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat("card"),
							name = trigger.card.name;
						if (typeof stat[name] == "number" && stat[name] > 0) {
							stat[name]--;
						}
					}
					trigger.directHit.addArray(game.filterPlayer());
					game.log(trigger.card, "不计次数且不可被响应");
				},
				mod: {
					cardUsable(card, player) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("dcxingmen"))) {
							return Infinity;
						}
					},
				},
			},
		},
	},
	//武关羽
	dcjuewu: {
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			if (
				!player.hasCard(card => {
					return _status.connectMode || get.number(card) === 2;
				}, "hes")
			) {
				return false;
			}
			let list = get.inpileVCardList(info => {
				return get.is.damageCard({ name: info[2], nature: info[3] });
			});
			if (!list.some(info => info[2] === "shuiyanqijuny")) {
				list.add(["锦囊", "", "shuiyanqijuny"]);
			}
			list = list.filter(info => {
				const name = info[2],
					nature = info[3];
				if (player.getStorage("dcjuewu_used").includes(name)) {
					return false;
				}
				return event.filterCard(get.autoViewAs({ name, nature }, "unsure"), player, event);
			});
			return list.length > 0;
		},
		hiddenCard(player, name) {
			if (!lib.inpile.includes(name)) {
				return false;
			}
			if (player.getStorage("dcjuewu_used").includes(name)) {
				return false;
			}
			if (
				!player.hasCard(card => {
					return _status.connectMode || get.number(card) === 2;
				}, "hes")
			) {
				return false;
			}
			return get.is.damageCard({ name });
		},
		group: "dcjuewu_inTwo",
		chooseButton: {
			dialog(event, player) {
				let list = get.inpileVCardList(info => {
					return get.is.damageCard({ name: info[2], nature: info[3] });
				});
				if (!list.some(info => info[2] === "shuiyanqijuny")) {
					list.add(["锦囊", "", "shuiyanqijuny"]);
				}
				list = list.filter(info => {
					const name = info[2],
						nature = info[3];
					if (player.getStorage("dcjuewu_used").includes(name)) {
						return false;
					}
					return event.filterCard(get.autoViewAs({ name, nature }, "unsure"), player, event);
				});
				return ui.create.dialog("绝武", [list, "vcard"]);
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				const player = get.player();
				return player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
				});
			},
			backup(links, player) {
				return {
					audio: "dcjuewu",
					filterCard(card, player) {
						return get.number(card) === 2;
					},
					position: "hes",
					check(card) {
						return 8 - get.value(card);
					},
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					async precontent(event, trigger, player) {
						player.addTempSkill("dcjuewu_used");
						player.markAuto("dcjuewu_used", [event.result.card.name]);
					},
				};
			},
			prompt(links, player) {
				return "将一张点数为2的牌当" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "本回合已使用牌名：$" },
			},
			backup: {},
			inTwo: {
				audio: "dcjuewu",
				trigger: {
					player: "gainAfter",
					global: "loseAsyncAfter",
				},
				filter(event, player) {
					const cards = event.getg(player);
					if (!cards.length) {
						return false;
					}
					return game.hasPlayer(current => {
						if (current === player) {
							return false;
						}
						const evt = event.getl(current);
						if (!evt) {
							return false;
						}
						return evt.hs.some(card => cards.includes(card)) || evt.es.some(card => cards.includes(card)) || evt.js.some(card => cards.includes(card));
					});
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					let gcards = trigger.getg(player),
						cards = [];
					game.countPlayer(current => {
						if (current === player) {
							return false;
						}
						const evt = trigger.getl(current);
						if (!evt) {
							return false;
						}
						cards.addArray(evt.hs.filter(card => gcards.includes(card)));
						cards.addArray(evt.es.filter(card => gcards.includes(card)));
						cards.addArray(evt.js.filter(card => gcards.includes(card)));
					});
					player.addGaintag(cards, "dcjuewu_two");
					player.addSkill("dcjuewu_two");
				},
			},
			two: {
				charlotte: true,
				mod: {
					cardnumber(card) {
						if (card.hasGaintag("dcjuewu_two")) {
							return 2;
						}
					},
				},
			},
		},
		ai: {
			fireAttack: true,
			respondSha: true,
			skillTagFilter(player) {
				if (
					!player.hasCard(card => {
						return _status.connectMode || get.number(card) === 2;
					}, "hes")
				) {
					return false;
				}
			},
			order: 7,
			result: {
				player(player) {
					if (get.event().dying) {
						return get.attitude(player, get.event().dying);
					}
					return 1;
				},
			},
		},
	},
};
