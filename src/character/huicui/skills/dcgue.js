import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcgue" | "dcsigong">} */
export const groupSkills = {
	//霍峻
	dcgue: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			if (player.hasSkill("dcgue_blocker", null, null, false)) {
				return false;
			}
			return name == "sha" || name == "shan";
		},
		filter(event, player) {
			if (event.dcgue || event.type == "wuxie" || player == _status.currentPhase) {
				return false;
			}
			if (player.hasSkill("dcgue_blocker", null, null, false)) {
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
				return ui.create.dialog("孤扼", [vcards, "vcard"], "hidden");
			},
			check(button) {
				if (_status.event.player.countCards("h", { name: ["sha", "shan"] }) > 1) {
					return 0;
				}
				return 1;
			},
			backup(links, player) {
				return {
					filterCard: () => false,
					selectCard: -1,
					viewAs: {
						name: links[0][2],
						isCard: true,
					},
					log: false,
					popname: true,
					async precontent(event, trigger, player) {
						player.logSkill("dcgue");
						player.addTempSkill("dcgue_blocker");
						await player.showHandcards();
						if (player.countCards("h", { name: ["sha", "shan"] }) > 1) {
							const evt = event.getParent();
							evt.set("dcgue", true);
							evt.goto(0);
							delete evt.openskilldialog;
							return;
						}
						await game.delayx();
					},
				};
			},
			prompt(links, player) {
				return (player.countCards ? "展示所有手牌" : "") + (player.countCards("h", { name: ["sha", "shan"] }) <= 1 ? "，然后视为使用【" + get.translation(links[0][2]) + "】" : "");
			},
		},
		subSkill: { blocker: { charlotte: true } },
		ai: {
			order: 1,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player) {
				if (player.hasSkill("dcgue_blocker", null, null, false)) {
					return false;
				}
			},
			result: {
				player(player) {
					if (player.countCards("h", { name: ["sha", "shan"] }) > 1) {
						return 0;
					}
					return 1;
				},
			},
		},
	},
	dcsigong: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			if (event.player === player || !event.player.isIn()) {
				return false;
			}
			if (!player.canUse("sha", event.player, false)) {
				return false;
			}
			let respondEvts = [];
			for (const current of game.filterPlayer2()) {
				respondEvts.addArray(current.getHistory("useCard"));
				respondEvts.addArray(current.getHistory("respond"));
			}
			respondEvts = respondEvts.filter(i => i.respondTo).map(evt => evt.respondTo);
			return event.player.hasHistory("useCard", evt => {
				return respondEvts.some(list => list[1] == evt.card);
			});
		},
		direct: true,
		async content(event, trigger, player) {
			const num = 1 - player.countCards("h");
			event.num = num;
			let prompt2 = "";
			let next;
			if (num >= 0) {
				next = player.chooseBool().set("ai", () => _status.event.goon);
				prompt2 += (num > 0 ? "摸一张牌，" : "") + "视为对" + get.translation(trigger.player) + "使用一张【杀】（伤害基数+1）";
			} else {
				next = player
					.chooseToDiscard(-num, "allowChooseAll")
					.set("ai", card => {
						if (_status.event.goon) {
							return 5.2 - get.value(card);
						}
						return 0;
					})
					.set("logSkill", ["dcsigong", trigger.player]);
				prompt2 += "将手牌数弃置至1，视为对" + get.translation(trigger.player) + "使用一张【杀】（伤害基数+1）";
			}
			next.set("prompt", get.prompt("dcsigong", trigger.player));
			next.set("prompt2", prompt2);
			next.set("goon", get.effect(trigger.player, { name: "sha" }, player, player) > 0);
			const result = await next.forResult();
			if (!result.bool) {
				return;
			}
			if (num >= 0) {
				player.logSkill("dcsigong", trigger.player);
			}
			if (num > 0) {
				await player.draw(num, "nodelay");
			}
			event.num = Math.max(1, Math.abs(num));
			if (player.canUse("sha", trigger.player, false)) {
				player.addTempSkill("dcsigong_check");
				await player
					.useCard({ name: "sha", isCard: true }, trigger.player, false)
					.set("shanReq", event.num)
					.set("oncard", card => {
						const evt = _status.event;
						evt.baseDamage++;
						for (const target of game.filterPlayer(null, null, true)) {
							const id = target.playerid;
							const map = evt.customArgs;
							if (!map[id]) {
								map[id] = {};
							}
							map[id].shanRequired = evt.shanReq;
						}
					});
			}
		},
		subSkill: {
			check: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: { source: "damageSource" },
				filter(event, player) {
					return event.card && event.card.name == "sha" && event.getParent(3).name == "dcsigong";
				},
				async content(event, trigger, player) {
					player.tempBanSkill("dcsigong", "roundStart");
				},
			},
		},
	},
};
