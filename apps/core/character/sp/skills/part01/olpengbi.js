import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olpengbi" | "olyintian" | "olbiri" | "oldici" | "olshanjia" | "olliubing">} */
export const groupSkills = {
	//赵忠
	olpengbi: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		filter(event, player) {
			if (get.info("olpengbi").derivation.every(i => player.hasSkill(i, null, false, false))) {
				return false;
			}
			return player.phaseNumber === 1;
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			let skills = get.info(event.name).derivation.slice();
			const list = skills.filter(i => !player.hasSkill(i, null, false, false));
			const skill =
				list.length > 1
					? (
							await player
								.chooseControl(list)
								.set(
									"choiceList",
									list.map(i => {
										return '<div class="skill">【' + get.translation(lib.translate[i + "_ab"] || get.translation(i).slice(0, 2)) + "】</div><div>" + get.skillInfoTranslation(i, player, false) + "</div>";
									})
								)
								.set("displayIndex", false)
								.set("prompt", get.translation(event.name) + "：请选择你要获得的技能")
								.set("ai", () => get.rand(0, 1))
								.forResult()
						).control
					: list[0];
			if (skill) {
				await player.addSkills(skill);
				skills.remove(skill);
				const skill2 = skills[0];
				if (game.hasPlayer(target => target !== player && !target.hasSkill(skill2, null, false, false))) {
					const [target] =
						(
							await player
								.chooseTarget(
									"是否令一名其他角色获得〖" + get.translation(skill2) + "〗",
									(card, player, target) => {
										return target !== player && !target.hasSkill(get.event().skill, null, false, false);
									},
									'<div class="text center">' + lib.translate[skill2 + "_info"] + "</div>"
								)
								.set("skill", skill2)
								.set("ai", target => {
									const player = get.player();
									if (player.identity === "nei") {
										return 0;
									}
									return get.attitude(player, target);
								})
								.forResult()
						).targets ?? [];
					if (target) {
						player.line(target);
						await target.addSkills(skill2);
					}
				}
			}
		},
		derivation: ["olyintian", "olbiri"],
	},
	olyintian: {
		audio: 1,
		trigger: { global: "recoverEnd" },
		filter(event, player) {
			if (player.hasSkill("olyintian_effect")) {
				return false;
			}
			return (
				game
					.getGlobalHistory("changeHp", evt => evt.getParent().name === "recover")
					.map(evt => evt.getParent())
					.indexOf(event) === 0
			);
		},
		forced: true,
		content() {
			player.addSkill(event.name + "_effect");
		},
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				intro: { content: "下次造成的伤害+1" },
				trigger: { source: "damageBegin1" },
				forced: true,
				popup: false,
				content() {
					player.removeSkill(event.name);
					trigger.num++;
				},
			},
		},
	},
	olbiri: {
		audio: 1,
		trigger: { global: ["gainAfter", "loseAsyncAfter"] },
		filter(event, player) {
			return (
				game
					.getGlobalHistory("everything", evt => {
						if (!evt.name || !["gain", "loseAsync"].includes(evt.name)) {
							return false;
						}
						if (evt.type === "draw" || evt.getParent().name === "draw") {
							return false;
						}
						return game.hasPlayer2(current => (evt.getg?.(current) ?? []).length > 0);
					})
					.indexOf(event) === 0
			);
		},
		forced: true,
		content() {
			player.draw();
		},
	},
	oldici: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => get.info("oldici").filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target.countCards("h") && target !== player;
		},
		usable: 1,
		async content(event, trigger, player) {
			const target = event.target;
			await target.chooseToGive(player, "h", true);
			await target.recover();
			await target.link(false);
			const targets = [target.getPrevious(), target.getNext()].unique();
			if (targets.length) {
				const func = async target => {
					if (target?.isIn()) {
						await target.link(true);
					}
				};
				await game.doAsyncInOrder(targets, func);
			}
			target.addSkill("oldici_effect");
			target.markAuto("oldici_effect", [player]);
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					const targets = [target.getPrevious(), target.getNext()].filter(current => current?.isIn() && !current.isLinked()).unique();
					let num = target.isLinked() ? get.effect(target, { name: "tiesuo" }, player, player) : 0;
					if (targets.length) {
						for (const current of targets) {
							num += get.effect(current, { name: "tiesuo" }, player, player);
							const goon = current.getStorage("oldici_effect").includes(player);
							const max = Math.max(...[get.damageEffect(current, player, player, "thunder"), get.effect(current, { name: "shunshou_copy", position: "h" }, player, player)].concat(goon ? [] : [0]));
							num += max * (goon ? 1 : 0.2);
						}
					}
					return num + get.effect(target, { name: "shunshou_copy", position: "h" }, player, player) + get.recoverEffect(target, player, player);
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: { content: "下次进入连环状态后，交给$一张手牌或受到$对你造成的1点雷属性伤害" },
				trigger: { player: "linkAfter" },
				getIndex(event, player) {
					return player.getStorage("oldici_effect").sortBySeat();
				},
				filter(event, player, name, target) {
					if (!player.isLinked()) {
						return false;
					}
					if (!target?.isIn()) {
						if (target) {
							player.unmarkAuto("oldici_effect", target);
						}
						return false;
					}
					return true;
				},
				forced: true,
				logTarget: (event, player, name, target) => target,
				async content(event, trigger, player) {
					const target = event.targets[0],
						str = get.translation(target);
					player.unmarkAuto("oldici_effect", target);
					const { bool } = await player
						.chooseToGive(target, "h", "交给" + str + "一张手牌，或受到" + str + "对你造成的1点雷属性伤害")
						.set("ai", card => {
							const { player, target } = get.event();
							return 7 - get.value(card) - get.damageEffect(player, target, player, "thunder");
						})
						.set("target", target)
						.forResult();
					if (!bool) {
						await player.damage(1, target, "thunder");
					}
				},
			},
		},
	},
	//OL曹笨
	olshanjia: {
		audio: "shanjia",
		enable: "phaseUse",
		prompt() {
			return lib.translate.olshanjia_info.split("③")[1];
		},
		usable: 1,
		async content(event, trigger, player) {
			await player.draw(3);
			const { bool } = await player
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) !== "sha") {
							return false;
						}
						return lib.filter.cardEnabled.apply(this, arguments);
					},
					get.translation(event.name) + "：是否使用一张【杀】？"
				)
				.set("oncard", () => {
					get.event().player?.chat("雪豹我们走");
				})
				.set("addCount", false)
				.forResult();
			if (!bool) {
				player.chat("雪豹闭嘴");
			}
			player.addTempSkill("olshanjia_effect", { global: ["phaseChange", "phaseBeforeStart", "phaseAfter"] });
			//player.storage["olshanjia_effect"].set(event.getParent("phaseUse"), player.countMark("olshanjia"));
		},
		ai: {
			order: 10,
			result: { player: 1 },
		},
		group: "olshanjia_init",
		intro: {
			name: "损",
			content: "mark",
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				/*init(player, skill) {
					player.storage[skill] = player.storage[skill] || new Map();
				},*/
				audio: "shanjia",
				trigger: { player: ["useCard", "phaseUseEnd"] },
				filter(event, player) {
					/*const storage = player.storage["olshanjia_effect"];
					if (!storage) {
						return false;
					}*/
					if (event.name === "phaseUse") {
						/*if (typeof storage.get(event) !== "number") {
							return false;
						}*/
						return !player.hasHistory("lose", evt => {
							if (evt.type !== "discard" || evt.getParent(3).name !== "olshanjia_effect") {
								return false;
							}
							return evt.cards2.some(card => get.type(card, player) !== "equip");
						});
					}
					if (
						!player.hasHistory("lose", evt => {
							const evtx = evt.relatedEvent || evt.getParent();
							return evtx === event && evt.hs.length > 0;
						})
					) {
						return false;
					}
					return player.countMark("olshanjia_effect") < player.countMark("olshanjia");
				},
				direct: true,
				async content(event, trigger, player) {
					if (trigger.name === "useCard") {
						/*const storage = player.storage["olshanjia_effect"];
						const num = storage.get(trigger.getParent("phaseUse"));
						player.storage["olshanjia_effect"].set(trigger.getParent("phaseUse"), num - 1);*/
						player.addMark(event.name, 1, false);
						await player
							.chooseToDiscard({
								position: "he",
								forced: true,
								prompt: "缮甲：请弃置一张牌",
							})
							.set("logSkill", event.name);
					} else {
						await player
							.chooseUseTarget({
								card: new lib.element.VCard({ name: "sha", isCard: true }),
								addCount: false,
								nodistance: true,
								prompt: "缮甲：是否视为使用一张无距离限制的【杀】？",
							})
							.set("logSkill", event.name);
					}
				},
			},
			init: {
				audio: "shanjia",
				trigger: {
					player: ["enterGame", "loseAfter"],
					global: ["phaseBefore", "loseAsyncAfter", "equipAfter", "addJudgeAfter", "addToExpansionAfter", "gainAfter"],
				},
				getIndex(event, player, name) {
					if (event.name === "phase" || name === "enterGame") {
						return 1;
					}
					return (event.getl?.(player)?.cards2 ?? []).filter(card => get.type(card, player) === "equip");
				},
				filter(event, player, name) {
					if (event.name === "phase" || name === "enterGame") {
						return event.name !== "phase" || game.phaseNumber === 0;
					}
					if (!player.hasMark("olshanjia")) {
                        return false;
                    }
					const parentEvt = event.relatedEvent || event.getParent();
					if (parentEvt && parentEvt.name === "useCard" && parentEvt.player === player && get.type(parentEvt.card, null, false) === "equip") {
						return false;
					}
					return true;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					if (trigger.name === "phase" || event.triggername === "enterGame") {
						player.addMark("olshanjia", 3);
					} else {
						player.removeMark("olshanjia", 1);
					}
				},
			},
		},
	},
	//OL吴景
	olliubing: {
		audio: "liubing",
		trigger: { player: "useCard1" },
		filter(event, player) {
			if (event.card.name != "sha" || !event.cards?.length) {
				return false;
			}
			return (
				player
					.getHistory("useCard", evt2 => {
						return evt2.card.name == "sha" && evt2.cards?.length;
					})
					.indexOf(event) == 0
			);
		},
		forced: true,
		content() {
			trigger.card.suit = "diamond";
			trigger.card.color = "red";
			game.log(player, "将", trigger.card, "的花色改为", "#y♦");
		},
		group: "olliubing_gain",
		subSkill: {
			gain: {
				audio: "liubing",
				trigger: { global: "useCardAfter" },
				filter(event, player) {
					return event.player != player && event.card.isCard && event.card.name == "sha" && get.color(event.card) != "black" && event.cards.filterInD().length > 0 && event.player.isPhaseUsing() && !event.player.hasHistory("sourceDamage", evt => evt.card == event.card);
				},
				forced: true,
				logTarget: "player",
				content() {
					player.gain(trigger.cards.filterInD(), "gain2");
				},
			},
		},
	},
};
