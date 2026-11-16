import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcbeini" | "dcshizong">} */
export const groupSkills = {
	//魏贾充
	dcbeini: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard(card, player) {
			const delt = player.countCards("h") - player.maxHp;
			return delt > 0;
		},
		selectCard() {
			const player = get.player();
			const delt = player.countCards("h") - player.maxHp;
			return delt > 0 ? delt : -1;
		},
		promptfunc: () => {
			const player = get.player();
			const delt = player.countCards("h") - player.maxHp;
			let str = "";
			if (delt > 0) {
				str += `弃置${get.cnNumber(delt)}张牌`;
			} else if (delt == 0) {
				str += `点击“确定”`;
			} else {
				str += `摸${get.cnNumber(-delt)}张牌`;
			}
			return `${str}，然后选择两名角色，前者视为对后者使用一张【杀】，且这两者的非锁定技失效。`;
		},
		allowChooseAll: true,
		async content(event, trigger, player) {
			if (player.countCards("h") < player.maxHp) {
				await player.drawTo(player.maxHp);
			}
			if (game.countPlayer() < 2) {
				return;
			}
			var result = await player
				.chooseTarget("悖逆：请选择两名角色", "前者视为对后者使用一张【杀】，且这两名角色的非锁定技失效直到回合结束。", true, 2, (card, player, target) => {
					var sha = new lib.element.VCard({ name: "sha", isCard: true });
					if (ui.selected.targets.length) {
						var targetx = ui.selected.targets[0];
						return targetx.canUse(sha, target, false);
					}
					return lib.filter.cardEnabled(sha, target);
				})
				.set("targetprompt", ["打人", "被打"])
				.set("multitarget", true)
				.set("ai", target => {
					var aiTargets = get.event().aiTargets;
					if (aiTargets) {
						return aiTargets[ui.selected.targets.length] == target ? 10 : 0;
					}
					return 0;
				})
				.set(
					"aiTargets",
					(() => {
						var targets = [],
							eff = 0;
						var sha = new lib.element.VCard({ name: "sha", isCard: true });
						for (var user of game.filterPlayer()) {
							for (var target of game.filterPlayer()) {
								if (user == target) {
									continue;
								}
								var targetsx = [user, target];
								targetsx.forEach(i => i.addSkill("dcbeini_fengyin2"));
								var effx = get.effect(target, sha, user, player);
								targetsx.forEach(i => i.removeSkill("dcbeini_fengyin2"));
								if (user == player) {
									effx += 1;
								}
								if (get.attitude(player, user) > 0) {
									effx -= 0.1;
								}
								if (effx > eff) {
									eff = effx;
									targets = targetsx;
								}
							}
						}
						if (targets.length) {
							return targets;
						}
						return null;
					})()
				)
				.forResult();
			if (result.bool) {
				var user = result.targets[0],
					target = result.targets[1];
				result.targets.forEach(i => i.addTempSkill("dcbeini_fengyin"));
				var sha = new lib.element.VCard({ name: "sha", isCard: true });
				if (user.canUse(sha, target, false)) {
					user.useCard(sha, target, false, "noai");
				}
			}
		},
		ai: {
			order: 0.1,
			result: {
				player(player) {
					if (player.countCards("h") - player.maxHp >= 3) {
						return 1;
					}
					return game.hasPlayer(current => get.attitude(player, current) <= 0) ? 1 : 0;
				},
			},
		},
		subSkill: {
			fengyin: {
				inherit: "fengyin",
			},
			fengyin2: {
				inherit: "fengyin",
			},
		},
	},
	dcshizong: {
		audio: 2,
		enable: "chooseToUse",
		hiddenCard(player, name) {
			if (get.type(name) != "basic") {
				return false;
			}
			return player.countCards("he") >= player.countMark("dcshizong_used") + 1;
		},
		filter(event, player) {
			if (event.type == "wuxie" || event.dcshizong) {
				return false;
			}
			if (player.countCards("he") < player.countMark("dcshizong_used") + 1) {
				return false;
			}
			return get
				.inpileVCardList(info => {
					return info[0] == "basic";
				})
				.some(info => event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const vcards = get.inpileVCardList(info => {
					if (info[0] != "basic") {
						return false;
					}
					const card = { name: info[2], nature: info[3], isCard: true };
					return event.filterCard(card, player, event);
				});
				return ui.create.dialog("恃纵", [vcards, "vcard"], "hidden");
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				const player = get.player();
				const card = { name: button.link[2], nature: button.link[3] };
				if (
					game.hasPlayer(current => {
						return player.canUse(card, current) && get.effect(current, card, player, player) > 0;
					})
				) {
					switch (button.link[2]) {
						case "tao":
							return 5;
						case "jiu":
							return 3.01;
						case "sha":
							if (button.link[3] == "fire") {
								return 2.95;
							} else if (button.link[3] == "thunder") {
								return 2.92;
							} else {
								return 2.9;
							}
					}
				}
				return 0;
			},
			backup(links, player) {
				return {
					filterCard: true,
					filterTarget: lib.filter.notMe,
					selectTarget: 1,
					selectCard: () => get.player().countMark("dcshizong_used") + 1,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						suit: "none",
						number: null,
						isCard: true,
					},
					position: "he",
					popname: true,
					ignoreMod: true,
					ai1(card) {
						return 1 / (1.1 + Math.max(-1, get.value(card)));
					},
					ai2(target) {
						return get.attitude(get.player(), target);
					},
					async precontent(event, trigger, player) {
						const target = event.result.targets[0];
						player.addTempSkill("dcshizong_used");
						player.addMark("dcshizong_used", 1, false);
						player.logSkill("dcshizong", target);
						await player.give(event.result.cards.slice(), target);
						const viewAs = new lib.element.VCard({
							name: event.result.card.name,
							nature: event.result.card.nature,
							isCard: true,
						});
						let result = await target
							.chooseCard("恃纵：是否将一张牌置于牌堆底？", `若如此做，${get.translation(player)}视为使用一张${get.translation(viewAs.nature)}【${get.translation(viewAs.name)}】`, "he")
							.set("ai", card => {
								if (get.event().goon) {
									return 7 - get.value(card);
								}
								return 0;
							})
							.set("goon", get.attitude(target, player) * (player.getUseValue(viewAs) || 1) >= 1)
							.forResult();
						if (result?.bool) {
							const card = result.cards[0];
							await game.delayex();
							const next = target.loseToDiscardpile(card, ui.cardPile);
							next.log = false;
							if (get.position(card) == "e") {
								game.log(target, "将", card, "置于了牌堆底");
							} else {
								next.blank = true;
								game.log(target, "将一张牌置于了牌堆底");
							}
							await next;
							game.broadcastAll(viewAs => {
								lib.skill.dcshizong_backup2.viewAs = viewAs;
							}, lib.skill.dcshizong_backup.viewAs);
							const evt = event.getParent();
							evt.set("_backupevent", "dcshizong_backup2");
							evt.set("openskilldialog", `请选择${get.translation(viewAs.nature)}${get.translation(viewAs.name)}的目标`);
							evt.backup("dcshizong_backup2");
							evt.set("norestore", true);
							evt.set("custom", {
								add: {},
								replace: { window() {} },
							});
							evt.goto(0);
							if (target != _status.currentPhase) {
								player.tempBanSkill("dcshizong");
							}
						} else {
							target.chat("不放！");
							game.log(target, "选择不将牌置于牌堆底");
							var evt = event.getParent();
							evt.set("dcshizong", true);
							evt.goto(0);
							player.tempBanSkill("dcshizong");
						}
						await game.delayx();
					},
					ai: { order: 10 },
				};
			},
			prompt(links, player) {
				return `###恃纵：选择要交出的牌和目标角色###将${get.cnNumber(player.countMark("dcshizong_used") + 1)}张牌交给一名其他角色，其可以选择将一张牌置于牌堆底，视为你使用一张${get.translation(links[0][3] || "")}${get.translation(links[0][2])}。`;
			},
		},
		ai: {
			order() {
				const player = get.player(),
					event = get.event();
				if (event.filterCard({ name: "jiu" }, player, event) && get.effect(player, { name: "jiu" }) > 0) {
					return get.order({ name: "jiu" }) + 0.1;
				}
				return get.order({ name: "sha" }) + 0.1;
			},
			respondSha: true,
			fireAttack: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond" || tag == "fireAttack") {
					return true;
				}
				if (player.countCards("he") < player.countMark("dcshizong_used") + 1) {
					return false;
				}
				if (tag == "respondSha") {
					return false;
				}
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			backup: {},
			backup2: {
				filterCard: () => false,
				selectCard: -1,
				log: false,
			},
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "本回合已发动#次【恃纵】" },
			},
		},
	},
};
