import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "shencai" | "xunshi">} */
export const groupSkills = {
	shencai: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + player.countMark("shencai");
		},
		filterTarget: lib.filter.notMe,
		onremove: true,
		prompt: "选择一名其他角色进行地狱审判",
		async content(event, trigger, player) {
			const { target } = event;

			const next = target.judge();
			next.callback = lib.skill.shencai.contentx;
			await next;
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					const att = get.sgnAttitude(player, target),
						hp = target.getHp(true) + 0.1,
						hs = target.countCards("h") + 0.1;
					if (att < 0) {
						return (att * hp * hs) / 100;
					}
					return 0;
				},
			},
		},
		async contentx(event) {
			const { card } = event.judgeResult;
			const { player, target } = event.getParent(2);
			if (get.position(card, true) == "o") {
				await player.gain(card, "gain2");
			}

			const list = [];
			const str = get.cardDescription(card, player);
			for (const name in lib.skill.shencai.filterx) {
				if (str.indexOf(lib.skill.shencai.filterx[name]) != -1) {
					list.push("shencai_" + name);
				}
			}
			if (list.length) {
				for (const name in lib.skill.shencai.filterx) {
					var num = target.countMark("shencai_" + name);
					if (num > 0) {
						target.removeMark("shencai_" + name, num);
						target.removeSkill("shencai_" + name);
					}
				}
				if (target.isIn()) {
					for (const name of list) {
						target.addSkill(name);
						target.addMark(name, 1);
					}
				}
			} else if (target.isIn()) {
				await player.gainPlayerCard(target, true, "hej");
				target.addMark("shencai_death", 1);
				target.addSkill("shencai_death");
			}
		},
		filterx: {
			losehp: "体力",
			weapon: "武器",
			respond: "打出",
			distance: "距离",
		},
		getStr(node) {
			var str = "",
				name = node.name;
			if (lib.translate[name + "_info"]) {
				if (lib.card[name].type && lib.translate[lib.card[name].type]) {
					str += "" + get.translation(lib.card[name].type) + "牌|";
				}
				if (get.subtype(name)) {
					str += "" + get.translation(get.subtype(name)) + "|";
				}
				if (lib.card[name] && lib.card[name].addinfomenu) {
					str += "" + lib.card[name].addinfomenu + "|";
				}
				if (get.subtype(name) == "equip1") {
					var added = false;
					if (lib.card[node.name] && lib.card[node.name].distance) {
						var dist = lib.card[node.name].distance;
						if (dist.attackFrom) {
							added = true;
							str += "攻击范围：" + (-dist.attackFrom + 1) + "|";
						}
					}
					if (!added) {
						str += "攻击范围：1|";
					}
				}
			}
			if (lib.card[name].cardPrompt) {
				str += "" + lib.card[name].cardPrompt(node) + "|";
			} else if (lib.translate[name + "_info"]) {
				str += "" + lib.translate[name + "_info"] + "|";
			}
			if (lib.translate[name + "_append"]) {
				str += "" + lib.translate[name + "_append"] + "|";
			}
			if (get.is.yingbianConditional(node)) {
				const yingbianEffects = get.yingbianEffects(node);
				if (!yingbianEffects.length) {
					const defaultYingbianEffect = get.defaultYingbianEffect(node);
					if (lib.yingbian.prompt.has(defaultYingbianEffect)) {
						yingbianEffects.push(defaultYingbianEffect);
					}
				}
				if (yingbianEffects.length) {
					str += `应变：${yingbianEffects.map(value => lib.yingbian.prompt.get(value)).join("；")}|`;
				}
			}
			return str;
		},
		subSkill: {
			losehp: {
				charlotte: true,
				marktext: "笞",
				trigger: { player: "damageEnd" },
				forced: true,
				async content(event, trigger, player) {
					await player.loseHp(trigger.num);
				},
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "damage") && current < 0 && !target._shencai_losehp_effect) {
								target._shencai_losehp_effect = true;
								let eff = get.effect(target, { name: "losehp" }, target, target) / 10;
								delete target._shencai_losehp_effect;
								return [1, eff];
							}
						},
					},
				},
				intro: {
					name: "神裁 - 体力",
					name2: "笞",
					content: "锁定技。当你受到伤害后，你失去等量的体力。",
					onunmark: true,
				},
			},
			weapon: {
				charlotte: true,
				marktext: "杖",
				trigger: { target: "useCardToTargeted" },
				forced: true,
				filter(event, player) {
					return event.card.name == "sha";
				},
				async content(event, trigger, player) {
					trigger.directHit.add(player);
					game.log(player, "不可响应", trigger.card);
				},
				intro: {
					name: "神裁 - 武器",
					name2: "杖",
					content: "锁定技。当你成为【杀】的目标后，你不能使用牌响应此【杀】。",
					onunmark: true,
				},
				global: "shencai_weapon_ai",
			},
			ai: {
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (!arg || !arg.card || arg.card.name != "sha") {
							return false;
						}
						if (!arg.target || !arg.target.hasSkill("shencai_weapon")) {
							return false;
						}
						return true;
					},
				},
			},
			respond: {
				charlotte: true,
				marktext: "徒",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				forced: true,
				filter(event, player) {
					if (
						!player.hasCard(function (card) {
							return lib.filter.cardDiscardable(card, player, "shencai_respond");
						}, "h")
					) {
						return false;
					}
					var evt = event.getParent("shencai_respond");
					if (evt && evt.player == player) {
						return false;
					}
					evt = event.getl(player);
					return evt && evt.hs && evt.hs.length > 0;
				},
				async content(event, trigger, player) {
					const cards = player.getCards("h", card => {
						return lib.filter.cardDiscardable(card, player, "shencai_respond");
					});
					if (cards.length > 0) {
						await player.discard(cards.randomGet());
					}
				},
				intro: {
					name: "神裁 - 打出",
					name2: "徒",
					content: "锁定技。当你失去手牌后，你随机弃置一张手牌（不嵌套触发）。",
					onunmark: true,
				},
			},
			distance: {
				charlotte: true,
				marktext: "流",
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				async content(event, trigger, player) {
					await player.turnOver();
				},
				intro: {
					name: "神裁 - 距离",
					name2: "流",
					content: "锁定技。结束阶段开始时，你翻面。",
					onunmark: true,
				},
			},
			death: {
				charlotte: true,
				marktext: "死",
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("shencai_death");
					},
				},
				trigger: { player: "phaseEnd" },
				forced: true,
				filter(event, player) {
					return player.countMark("shencai_death") > game.countPlayer();
				},
				async content(event, trigger, player) {
					await player.die();
				},
				intro: {
					name: "神裁 - 死",
					name2: "死",
					content: "锁定技。你的角色手牌上限-#；回合结束时，若场上存活人数小于#，则你死亡。",
					onunmark: true,
				},
			},
		},
		mark: true,
		intro: {
			markcount: (storage = 0) => storage + 1,
			content: (storage = 0) => "当前最大发动次数：" + (storage + 1),
		},
	},
	xunshi: {
		audio: 2,
		mod: {
			cardname(card) {
				if (lib.skill.xunshi.isXunshi(card) && get.position(card) === "h") {
					return "sha";
				}
			},
			cardnature(card) {
				if (lib.skill.xunshi.isXunshi(card) && get.position(card) === "h") {
					return false;
				}
			},
			suit(card) {
				if (lib.skill.xunshi.isXunshi(card) && get.position(card) === "h") {
					return "none";
				}
			},
			targetInRange(card) {
				const suit = get.color(card);
				if (suit == "none" || suit == "unsure") {
					return true;
				}
			},
			cardUsable(card) {
				const suit = get.color(card);
				if (suit == "none" || suit == "unsure") {
					return Infinity;
				}
			},
		},
		isXunshi(card) {
			var info = lib.card[card.name];
			if (!info || (info.type != "trick" && info.type != "delay")) {
				return false;
			}
			if (info.notarget) {
				return false;
			}
			if (info.selectTarget != undefined) {
				if (Array.isArray(info.selectTarget)) {
					if (info.selectTarget[0] < 0) {
						return !info.toself;
					}
					return info.selectTarget[0] != 1 || info.selectTarget[1] != 1;
				} else {
					if (info.selectTarget < 0) {
						return !info.toself;
					}
					return info.selectTarget != 1;
				}
			}
			return false;
		},
		trigger: { player: "useCard2" },
		forced: true,
		filter(event, player) {
			return get.color(event.card) == "none";
		},
		async content(event, trigger, player) {
			if (player.countMark("shencai") < 4 && player.hasSkill("shencai", null, null, false)) {
				player.addMark("shencai", 1, false);
			}

			if (trigger.addCount !== false) {
				trigger.addCount = false;
				const stat = player.getStat().card;
				const name = trigger.card.name;
				if (typeof stat[name] == "number") {
					stat[name]--;
				}
			}

			const info = get.info(trigger.card);
			if (info.allowMultiple == false) {
				return;
			}

			if (!trigger.targets || info.multitarget) {
				return;
			}

			if (!game.hasPlayer(current => !trigger.targets.includes(current) && lib.filter.targetEnabled2(trigger.card, player, current))) {
				return;
			}

			const prompt2 = "为" + get.translation(trigger.card) + "增加任意个目标";
			const result = await player
				.chooseTarget(
					get.prompt("xunshi"),
					(card, _player, target) => {
						const player = get.player();
						return !_status.event.targets.includes(target) && lib.filter.targetEnabled2(_status.event.card, player, target);
					},
					[1, Infinity]
				)
				.set("prompt2", prompt2)
				.set("ai", function (target) {
					var trigger = _status.event.getTrigger();
					var player = _status.event.player;
					return get.effect(target, trigger.card, player, player);
				})
				.set("card", trigger.card)
				.set("targets", trigger.targets)
				.forResult();

			if (!result.bool || !result.targets?.length) {
				return;
			}
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			player.line(result.targets, "fire");
			trigger.targets.addArray(result.targets);
		},
	},
};
