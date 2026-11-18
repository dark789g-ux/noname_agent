import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjuying" | "dcjianshu" | "dcyongdi">} */
export const groupSkills = {
	//刘辟
	dcjuying: {
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		filter(event, player) {
			return ["sha", "jiu"].some(name => {
				return (
					player.getCardUsable(name, true) >
					player.getHistory("useCard", evt => {
						return evt.getParent("phaseUse") == event && evt.card.name == name && evt.addCount !== false;
					}).length
				);
			});
		},
		direct: true,
		async content(event, trigger, player) {
			const result = await player
				.chooseButton([
					get.prompt("dcjuying"),
					[
						[
							["sha", "你于下回合使用【杀】的次数上限+1"],
							["hand", "本回合手牌上限+2"],
							["draw", "摸三张牌"],
						],
						"textbutton",
					],
				])
				.set("ai", function (button) {
					const player = _status.event.player;
					const choice = button.link;
					if (choice == "draw") {
						return 10;
					}
					if (choice == "sha") {
						return 9;
					}
					const del = 3 - player.hp;
					if (choice == "hand") {
						if (del <= 0 || player.needsToDiscard()) {
							return 8;
						}
					}
					return 0;
				})
				.set("selectButton", [1, 3])
				.forResult();
			if (!result.bool) {
				return;
			}
			player.logSkill("dcjuying");
			const choices = result.links;
			if (choices.includes("sha")) {
				player.addMark("dcjuying_sha", 1, false);
				player.addSkill("dcjuying_sha");
			}
			if (choices.includes("hand")) {
				player.addMark("dcjuying_hand", 1, false);
				player.addTempSkill("dcjuying_hand");
			}
			if (choices.includes("draw")) {
				await player.draw(3);
			}
			const num = choices.length - Math.max(0, player.hp);
			if (num > 0) {
				await player.chooseToDiscard(true, "he");
			}
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					if (
						typeof card == "object" &&
						player.isPhaseUsing() &&
						["sha", "jiu"].some(name => {
							return card.name == name && player.getCardUsable(name) == 1 && !player.getCardUsable(name == "sha" ? "jiu" : "sha");
						})
					) {
						return "zeroplayertarget";
					}
				},
				target_use(card, player, target) {
					if (card.name == "jiu" && player.getCardUsable("sha") == 2) {
						return [1, 1];
					}
				},
			},
		},
		subSkill: {
			sha: {
				trigger: { player: "phaseBegin" },
				filter(event, player) {
					return player.countMark("dcjuying_sha") > 0;
				},
				silent: true,
				firstDo: true,
				charlotte: true,
				onremove: true,
				async content(event, trigger, player) {
					player.addMark("dcjuying_effect", player.countMark("dcjuying_sha"), false);
					player.addTempSkill("dcjuying_effect");
					player.removeSkill("dcjuying_sha");
				},
				intro: { content: "下回合使用【杀】的次数上限+#" },
			},
			effect: {
				onremove: true,
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("dcjuying_effect");
						}
					},
				},
				intro: { content: "本回合使用【杀】的次数上限+#" },
			},
			hand: {
				onremove: true,
				charlotte: true,
				mod: {
					maxHandcard(player, num) {
						return num + 2 * player.countMark("dcjuying_hand");
					},
				},
			},
		},
	},
	//新服加强魏贾诩
	dcjianshu: {
		audio: "jianshu",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h", { color: "black" }) > 0;
		},
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			if (ui.selected.targets.length) {
				return ui.selected.targets[0] != target && !ui.selected.targets[0].hasSkillTag("noCompareSource") && target.countCards("h") && !target.hasSkillTag("noCompareTarget");
			}
			return true;
		},
		targetprompt: ["发起者", "拼点目标"],
		filterCard: { color: "black" },
		discard: false,
		lose: false,
		delay: false,
		check(card) {
			if (_status.event.player.hp == 1) {
				return 8 - get.value(card);
			}
			return 6 - get.value(card);
		},
		selectTarget: 2,
		multitarget: true,
		async content(event, trigger, player) {
			const { cards, targets } = event;
			await player.give(cards, targets[0], "give");
			if (!targets[0].canCompare(targets[1])) {
				return;
			}
			const result = await targets[0].chooseToCompare(targets[1]).forResult();
			player.addTempSkill("dcjianshu_check", "phaseUseAfter");
			if (result.bool) {
				const cards1 = targets[0].getCards("he", function (card) {
					return lib.filter.cardDiscardable(card, targets[0], "dcjianshu");
				});
				if (cards1.length > 0) {
					await targets[0].discard(cards1.randomGet());
				}
				await targets[1].loseHp();
			} else if (result.tie) {
				await targets[0].loseHp();
				await targets[1].loseHp();
			} else {
				const cards2 = targets[1].getCards("he", function (card) {
					return lib.filter.cardDiscardable(card, targets[1], "dcjianshu");
				});
				if (cards2.length > 0) {
					await targets[1].discard(cards2.randomGet());
				}
				await targets[0].loseHp();
			}
		},
		subSkill: {
			check: {
				trigger: { global: "dieAfter" },
				charlotte: true,
				forced: true,
				popup: false,
				filter(event, player) {
					return event.getParent(3).name == "dcjianshu";
				},
				async content(event, trigger, player) {
					delete player.getStat("skill").dcjianshu;
				},
			},
		},
		ai: {
			expose: 0.4,
			order: 4,
			result: {
				target(player, target) {
					if (ui.selected.targets.length) {
						return -1;
					}
					return -0.5;
				},
			},
		},
	},
	dcyongdi: {
		audio: "yongdi",
		audioname: ["xinping"],
		limited: true,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return target.hasSex("male");
		},
		animationColor: "thunder",
		skillAnimation: "legend",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const target = event.target;
			if (target.isMinMaxHp() || target.isMinHp()) {
				await target.gainMaxHp();
				await target.recover();
			}
			if (target.isMinHandcard()) {
				await target.draw(Math.min(5, target.maxHp));
			}
			await game.delayx();
		},
		ai: {
			expose: 0.3,
			order: 1,
			result: {
				target(player, target) {
					var val = 0;
					var bool1 = !game.hasPlayer(current => current.maxHp < target.maxHp),
						bool2 = target.isMinHp(),
						bool3 = target.isMinHandcard();
					if (bool1) {
						val += 6.5;
					}
					if (bool2) {
						if (bool1) {
							target.maxHp++;
						}
						val += Math.max(0, get.recoverEffect(target, player, player));
						if (bool1) {
							target.maxHp--;
						}
					}
					if (bool3) {
						var num = Math.max(0, Math.min(5, target.maxHp + (bool1 ? 1 : 0)));
						val += 5 * num;
					}
					return val;
				},
			},
		},
	},
};
