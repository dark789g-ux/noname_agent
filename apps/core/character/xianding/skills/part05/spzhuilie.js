import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "spzhuilie" | "spzhuilie2" | "manyi" | "mansi" | "souying" | "zhanyuan" | "hmxili">} */
export const groupSkills = {
	//王双
	spzhuilie: {
		mod: {
			targetInRange(card) {
				if (card.name == "sha") {
					return true;
				}
			},
		},
		audio: 2,
		trigger: { player: "useCardToTargeted" },
		filter(event, player) {
			return event.card && event.card.name == "sha" && !player.inRange(event.target);
		},
		forced: true,
		logTarget: "target",
		async content(event, trigger, player) {
			const next = player.judge(function (card) {
				var type = get.subtype(card);
				return ["equip1", "equip4", "equip3", "equip6"].includes(type) ? 6 : -6;
			});
			next.judge2 = function (result) {
				return result.bool;
			};
			const result = await next.forResult();
			if (trigger.getParent().addCount !== false) {
				trigger.getParent().addCount = false;
				var stat = player.getStat();
				if (stat && stat.card && stat.card.sha) {
					stat.card.sha--;
				}
			}
			if (result.bool === true) {
				var map = trigger.customArgs;
				var id = trigger.target.playerid;
				if (!map[id]) {
					map[id] = {};
				}
				if (typeof map[id].extraDamage != "number") {
					map[id].extraDamage = 0;
				}
				map[id].extraDamage += trigger.target.hp - 1;
			} else if (result.bool === false && get.type(result.card) != "basic") {
				await player.loseHp();
				await player.gain(result.card);
			}
		},
		group: "spzhuilie_sha",
		subSkill: {
			sha: {
				silent: true,
				charlotte: true,
				trigger: { player: "useCardToTargeted" },
				filter(event, player) {
					return event.card && event.card.name == "sha";
				},
				async content(event, trigger, player) {
					trigger.target.addTempSkill("qinggang2");
					trigger.target.storage.qinggang2.add(trigger.card);
					trigger.target.markSkill("qinggang2");
				},
			},
		},
	},
	spzhuilie2: {
		onremove: true,
		intro: {
			content: "使用【杀】的次数上限+#",
		},
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + player.countMark("spzhuilie2");
				}
			},
		},
	},
	//花鬘
	manyi: {
		audio: 2,
		audioname: ["mengyou", "menghuo", "zhurong"],
		trigger: { target: "useCardToBefore" },
		filter(event, player) {
			return event.card.name == "nanman";
		},
		forced: true,
		content() {
			trigger.cancel();
		},
		ai: {
			effect: {
				target(card) {
					if (card.name == "nanman") {
						return "zeroplayertarget";
					}
				},
			},
		},
		group: "manyi_single",
		subSkill: {
			single: {
				trigger: {
					player: "enterGame",
					global: "gameDrawAfter",
				},
				filter(event, player) {
					return get.mode() == "single" && _status.mode == "normal";
				},
				direct: true,
				content() {
					player.chooseUseTarget("nanman", get.prompt("manyi"), "视为使用一张【南蛮入侵】").logSkill = "manyi";
				},
			},
		},
	},
	mansi: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.card?.name == "nanman";
		},
		frequent: true,
		async content(event, trigger, player) {
			player.addMark(event.name, 1, false);
			await player.draw();
		},
		intro: { content: "已因此技能得到了#张牌" },
		group: "mansi_viewas",
		subSkill: {
			viewas: {
				audio: "mansi",
				enable: "phaseUse",
				usable: 1,
				filter(event, player) {
					const hs = player.getCards("h");
					if (!hs.length) {
						return false;
					}
					if (hs.some(card => game.checkMod(card, player, "unchanged", "cardEnabled2", player) === false)) {
						return false;
					}
					return true;
				},
				viewAs: { name: "nanman" },
				filterCard: true,
				selectCard: -1,
				position: "h",
				ai: {
					order: 0.1,
					nokeep: true,
					skillTagFilter(player, tag, arg) {
						if (tag === "nokeep") {
							return (!arg || (arg.card && get.name(arg.card) === "tao")) && player.isPhaseUsing() && !player.getStat("skill").mansi_viewas && player.hasCard(card => get.name(card) !== "tao", "h");
						}
					},
				},
			},
		},
	},
	souying: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		filter(event, player, name) {
			if (!player.countCards("he")) {
				return false;
			}
			if (!event.targets || event.targets.length != 1 || event.player == event.target) {
				return false;
			}
			if (event.card.name != "sha" && get.type(event.card) != "trick") {
				return false;
			}
			if (name == "useCardToPlayered") {
				if (!event.cards.filterInD().length) {
					return false;
				}
				const { target } = event;
				return player.getHistory("useCard", evt => evt.targets?.includes(target)).indexOf(event.getParent()) > 0;
			} else {
				const { player: source } = event;
				return source.getHistory("useCard", evt => evt.targets?.includes(player)).indexOf(event.getParent()) > 0;
			}
		},
		usable: 1,
		async cost(event, trigger, player) {
			let prompt, target;
			const next = player.chooseToDiscard("he");
			if (event.triggername == "useCardToTargeted") {
				target = trigger.player;
				prompt = `令${get.translation(trigger.card)}对你无效`;
				next.set("goon", -get.effect(player, trigger.card, trigger.player, player));
			} else {
				target = trigger.targets[0];
				prompt = `弃置一张牌，并获得${get.translation(trigger.cards.filterInD())}`;
				next.set("goon", get.value(trigger.cards.filterInD()));
			}
			next.set("prompt", get.prompt(event.skill, target));
			next.set("prompt2", prompt);
			next.set("ai", card => {
				return get.event().goon - get.value(card);
			});
			next.set("logSkill", [event.skill, target]);
			event.result = await next.forResult();
		},
		popup: false,
		async content(event, trigger, player) {
			if (event.triggername == "useCardToTargeted") {
				trigger.excluded.add(player);
			} else if (trigger.cards?.someInD()) {
				await player.gain(trigger.cards.filterInD(), "gain2");
			}
		},
		ai: { expose: 0.25 },
	},
	zhanyuan: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.getAllHistory("gain", evt => evt.getParent().name == "draw" && evt.getParent(2).name == "mansi").reduce((num, evt) => num + evt.cards.length, 0) >= 7;
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "soil",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.gainMaxHp();
			await player.recover();
			if (!game.hasPlayer(current => current != player && current.hasSex("male"))) {
				return;
			}
			const result = await player
				.chooseTarget("是否失去〖蛮嗣〗，令一名其他男性角色和自己一同获得技能〖系力〗？", (card, player, target) => {
					return target != player && target.hasSex("male");
				})
				.set("ai", target => {
					const player = get.player();
					return get.attitude(player, target);
				})
				.forResult();
			if (result?.bool && result?.targets?.length) {
				const target = result.targets[0];
				player.line(target, "fire");
				await player.changeSkills(["hmxili"], ["mansi"]);
				await target.addSkills("hmxili");
			}
		},
		derivation: "hmxili",
		ai: { combo: "mansi" },
	},
	hmxili: {
		audio: 2,
		trigger: { global: "damageBegin1" },
		filter(event, player) {
			return event.source?.hasSkill("hmxili") && event.source != player && player !== _status.currentPhase && !event.player.hasSkill("hmxili") && player.countCards("he") > 0;
		},
		usable: 1,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt(event.skill, trigger.source), `是否弃置一张牌，令${get.translation(trigger.source)}对${get.translation(trigger.player)}的伤害+1，且你与其各摸两张牌？`, "he", "chooseonly")
				.set("ai", card => {
					if (get.event().eff > 0) {
						return 7 - get.value(card);
					}
					return 0;
				})
				.set("eff", get.damageEffect(trigger.player, trigger.source, player) + 0.2 * get.attitude(player, trigger.source))
				.forResult();
		},
		logTarget: "source",
		async content(event, trigger, player) {
			await player.discard(event.cards);
			await game.asyncDraw([trigger.source, player].sortBySeat(), 2);
			trigger.num++;
			await game.delayx();
		},
	},
};
