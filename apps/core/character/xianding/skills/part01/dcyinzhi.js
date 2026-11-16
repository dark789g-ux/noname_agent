import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcyinzhi" | "dckeming">} */
export const groupSkills = {
	//神曹丕
	dcyinzhi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		init(player, skill) {
			player.storage[skill] = {};
		},
		//onremove: true,
		intro: {
			content(storage, player, skill) {
				let str = "";
				for (const id in storage) {
					const target = game.playerMap[id] || lib.playerOL[id];
					if (target) {
						if (str.length) {
							str += "<br>";
						}
						str += `${get.translation(target)}：${storage[id]}`;
					}
				}
				return str;
			},
		},
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target, name } = event;
			player.addTempSkill(`${name}_clear`, { player: "dieAfter" });
			const storage = player.getStorage(name, {});
			storage[target.playerid] ??= 0;
			storage[target.playerid] = Math.min(3, ++storage[target.playerid]);
			player.setStorage(name, storage, true);
			await player.draw(storage[target.playerid]);
			target.markAuto(`${name}_debuff`, player);
			target.addAdditionalSkill(`${name}_debuff_${player.playerid}`, `${name}_debuff`);
			target.addTempSkill(`${name}_reset`, { player: "dieAfter" });
			target.markAuto(`${name}_reset`, player);
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					if (target.hasSkill("dcyinzhi_debuff")) {
						return -1;
					}
					return -2;
				},
			},
		},
		subSkill: {
			clear: {
				charlotte: true,
				silent: true,
				onremove(player, skill) {
					game.filterPlayer2(() => true, void 0, true).forEach(target => {
						target.removeAdditionalSkill(`dcyinzhi_debuff_${player.playerid}`);
						const storage = target.getStorage("dcyinzhi_reset");
						if (storage.length == 1 && storage[0] == player) {
							target.removeSkill("dcyinzhi_reset");
						}
					});
				},
				trigger: {
					global: "phaseBegin",
				},
				async content(event, trigger, player) {
					trigger.player.removeAdditionalSkill(`dcyinzhi_debuff_${player.playerid}`);
				},
			},
			debuff: {
				charlotte: true,
				init(player, skill) {
					player.addSkill("fengyin");
				},
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeSkill("fengyin");
				},
				trigger: {
					player: ["useCardAfter", "respondAfter"],
				},
				getIndex(event, player) {
					return player
						.getStorage("dcyinzhi_debuff")
						.filter(i => i.isIn())
						.sortBySeat();
				},
				filter(event, player, name, target) {
					return target.isIn() && target.getStorage("dcyinzhi", {})[player.playerid] > 0;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const source = event.indexedData;
					source.logSkill("dcyinzhi", player);
					await source.draw(source.getStorage("dcyinzhi", {})[player.playerid]);
				},
			},
			reset: {
				charlotte: true,
				silent: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeGaintag(skill);
				},
				intro: {
					content: "<li>回合内只能使用或打出本回合获得的牌<br><li>对$造成伤害后移除效果",
				},
				mod: {
					cardEnabled(card, player) {
						if (_status.currentPhase != player) {
							return;
						}
						let cards = [];
						if (get.itemtype(card) == "card") {
							cards = [card];
						} else {
							cards = card.cards || [];
						}
						if (!cards.length) {
							return;
						}
						if (cards.some(card => !card.hasGaintag("dcyinzhi_reset"))) {
							return false;
						}
					},
					cardRespondable(card, player) {
						if (_status.currentPhase != player) {
							return;
						}
						let cards = [];
						if (get.itemtype(card) == "card") {
							cards = [card];
						} else {
							cards = card.cards || [];
						}
						if (!cards.length) {
							return;
						}
						if (cards.some(card => !card.hasGaintag("dcyinzhi_reset"))) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (_status.currentPhase != player) {
							return;
						}
						let cards = [];
						if (get.itemtype(card) == "card") {
							cards = [card];
						} else {
							cards = card.cards || [];
						}
						if (!cards.length) {
							return;
						}
						if (cards.some(card => !card.hasGaintag("dcyinzhi_reset"))) {
							return false;
						}
					},
				},
				trigger: {
					player: ["gainBegin", "phaseBeforeStart", "phaseAfter"],
					source: ["damageSource"],
				},
				filter(event, player) {
					if (event.name == "phase") {
						return true;
					}
					if (_status.currentPhase !== player) {
						return false;
					}
					if (event.name != "damage") {
						return !event.gaintag.includes("dcyinzhi_reset");
					}
					return player.getStorage("dcyinzhi_reset").includes(event.player);
				},
				async content(event, trigger, player) {
					if (trigger.name == "phase") {
						player.removeGaintag(event.name);
						return;
					}
					if (trigger.name != "damage") {
						trigger.gaintag.add(event.name);
					} else {
						player.removeSkill(event.name);
					}
				},
			},
		},
	},
	dckeming: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player, name) {
			return name == "damageEnd" ? event.source?.isIn() && event.source != player : event.player?.isIn() && event.player != player;
		},
		async cost(event, trigger, player) {
			if (event.triggername == "damageSource") {
				event.result = { bool: true };
			} else {
				event.result = await player
					.chooseBool({
						prompt: get.prompt2(event.skill, trigger.source),
						choice: true,
					})
					.forResult();
			}
		},
		logTarget(event, player, name) {
			return name == "damageEnd" ? event.source : event.player;
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			if (event.triggername == "damageSource") {
				player.addTempSkill(`${event.name}_effect`, { player: "dieAfter" });
				player.markAuto(`${event.name}_effect`, target);
			} else {
				const checkTrigger = skill => {
					if (player.hasSkill(skill, null, false, false)) {
						return false;
					}
					const info = get.info(skill);
					if (!info || info.charlotte) {
						return false;
					}
					const list = [skill];
					game.expandSkills(list);
					const name = "damageEnd";
					for (const i of list) {
						const info = get.info(i);
						if (!info || !info.trigger || info.silent) {
							return false;
						}
						const toArray = arr => {
							return Array.isArray(arr) ? arr : !arr ? [] : [arr];
						};
						const triggers = [...toArray(info.trigger?.player), ...toArray(info.trigger?.global)];
						if (triggers.includes(name)) {
							if (info.ai && (info.ai.combo || info.ai.notemp || info.ai.neg)) {
								return false;
							}
							if (info.init) {
								return false;
							}
							if (typeof info.getIndex == "function") {
								try {
									const indexedResult = info.getIndex(trigger, player, name);
									if (Array.isArray(indexedResult)) {
										if (!info.filter || indexedResult.some(indexedData => info.filter(trigger, player, name, indexedData))) {
											return true;
										}
									}
									if (typeof indexedResult == "number" && indexedResult > 0) {
										if (!info.filter || info.filter(trigger, player, name)) {
											return true;
										}
									}
									return false;
								} catch (e) {
									return false;
								}
							} else if (info.filter) {
								try {
									const bool = info.filter(trigger, player, name);
									if (!bool) {
										return false;
									}
								} catch (e) {
									return false;
								}
							}
							return true;
						}
					}
				};
				let skills = target.getStockSkills(true, true).filter(skill => checkTrigger(skill));
				if (!skills.length) {
					if (!_status.characterlist) {
						game.initCharacterList();
					}
					const list = _status.characterlist.filter(name => get.characterSurname(name).some(j => j[0] == "曹") && get.character(name).skills.some(skill => checkTrigger(skill)));
					if (!list.length) {
						player.chat("无将可用");
						return;
					}
					skills = get
						.character(list.randomGet())
						.skills.filter(i => checkTrigger(i))
						.randomGets(1);
				}
				player.addInvisibleSkill(skills);
				player.addTempSkill(`${event.name}_check`);
				player.markAuto(`${event.name}_check`, skills);
				const next = game.createEvent(`${event.name}_check`, false, trigger);
				next.player = player;
				next.skills = skills;
				trigger.next.remove(next);
				trigger.after.push(next);
				next.setContent(async (event, trigger, player) => {
					const { skills } = event;
					player.removeInvisibleSkill(skills);
					player.removeSkill("dckeming_check");
				});
			}
		},
		subSkill: {
			check: {
				charlotte: true,
				onremove: true,
				silent: true,
				trigger: { player: ["logSkillBegin", "useSkill"] },
				filter(event, player) {
					const info = get.info(event.skill);
					if (info && info.charlotte) {
						return false;
					}
					const skill = get.sourceSkillFor(event);
					return player.getStorage("dckeming_check").includes(skill);
				},
				async content(event, trigger, player) {
					const skill = get.sourceSkillFor(trigger);
					player.removeInvisibleSkill(skill);
					player.unmarkAuto(event.name, skill);
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
				},
			},
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { global: ["logSkill", "useSkillAfter"] },
				intro: { content: "players" },
				forced: true,
				filter(event, player) {
					if (["global", "equip"].includes(event.type) || !player.getStorage("dckeming_effect").includes(event.player)) {
						return false;
					}
					let info = get.info(event.skill);
					if (info && info.charlotte) {
						return false;
					}
					const skill = get.sourceSkillFor(event);
					info = get.info(skill);
					const list = [skill];
					game.expandSkills(list);
					for (const i of list) {
						const info = get.info(i);
						if (!info || (!info.trigger && !info.enable) || info.silent) {
							return false;
						}
						const toArray = arr => {
							return Array.isArray(arr) ? arr : !arr ? [] : [arr];
						};
						const triggers = [...toArray(info.trigger?.player), ...toArray(info.trigger?.global), ...toArray(info.enable)];
						if (triggers.some(i => ["phaseZhunbei", "phaseJieshu", "phaseUse", "chooseToUse"].some(j => i.startsWith(j)))) {
							const evtx = event.log_event || event;
							const history = _status.globalHistory[_status.globalHistory.length - 1]["everything"].slice().reverse();
							for (const evt of history) {
								if (evt.player != event.player) {
									continue;
								}
								if (evt.name == "useCard") {
									if (evt == evtx) {
										return true;
									} else if (evt.getParent(evtx.name) == evtx) {
										return true;
									}
								}
								if (evt.name == "gain" && evt.getParent().name == "draw") {
									if (evt.getParent(evtx.name) == evtx) {
										return true;
									}
								}
								if (evt == evtx) {
									break;
								}
							}
						}
					}
					return false;
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					player.unmarkAuto(event.name, target);
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
					const evtx = trigger.log_event || trigger;
					const cards = [];
					const skill = get.sourceSkillFor(trigger);
					const history = _status.globalHistory[_status.globalHistory.length - 1]["everything"].slice().reverse();
					for (const evt of history) {
						if (evt.player != target) {
							continue;
						}
						if (evt.name == "useCard") {
							if (evt == evtx || (game.findSkill(evt) == skill && evt.getParent(evtx.name) == evtx)) {
								cards.push(evt.card);
							}
						}
						if (evt.name == "gain" && evt.getParent().name == "draw") {
							if (game.findSkill(evt) == skill && evt.getParent(evtx.name) == evtx) {
								cards.push(...evt.cards);
							}
						}
						if (evt == evtx) {
							break;
						}
					}
					const gain = [];
					const names = cards.map(card => get.name(card, false)).unique();
					for (let i = 0; i < Math.min(5, cards.length); i++) {
						const card = get.cardPile2(card => {
							return names.includes(get.name(card)) && !gain.includes(card);
						});
						if (card) {
							gain.push(card);
						} else {
							break;
						}
					}
					if (gain.length) {
						await player.gain({ cards: gain, animate: "gain2" });
					}
				},
			},
		},
	},
};
