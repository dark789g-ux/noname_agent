import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dangmo" | "reshuishi" | "shuishi" | "stianyi" | "zuoxing" | "resghuishi">} */
export const groupSkills = {
	dangmo: {
		audio: 2,
		trigger: { player: "useCard2" },
		direct: true,
		filter(event, player) {
			if (event.card.name != "sha" || player.hp <= 1) {
				return false;
			}
			var evt = event.getParent("phaseUse");
			return (
				evt &&
				evt.player == player &&
				player.getHistory("useCard", function (evtx) {
					return evtx.card.name == "sha" && evtx.getParent("phaseUse") == evt;
				})[0] == event &&
				game.hasPlayer(function (current) {
					return !event.targets.includes(current) && lib.filter.filterTarget(event.card, player, current);
				})
			);
		},
		async content(event, trigger, player) {
			let num = Math.min(
				player.hp - 1,
				game.countPlayer(function (current) {
					return !trigger.targets.includes(current) && lib.filter.filterTarget(trigger.card, player, current);
				})
			);
			let result = await player
				.chooseTarget(get.prompt("dangmo"), "为" + get.translation(trigger.card) + "增加至多" + get.translation(num) + "个目标", [1, num], function (card, player, target) {
					var evt = _status.event.getTrigger();
					return !evt.targets.includes(target) && lib.filter.filterTarget(evt.card, player, target);
				})
				.set("ai", function (target) {
					var evt = _status.event.getTrigger(),
						eff = get.effect(target, evt.card, evt.player, evt.player);
					if (player.hasSkill("tspowei") && target.hasMark("dulie")) {
						return 4 * eff;
					}
					return eff;
				})
				.forResult();
			if (result.bool) {
				if (player != game.me && !player.isOnline()) {
					game.delayx();
				}
				event.targets = result.targets;
			} else {
				return;
			}
			player.logSkill("dangmo", event.targets);
			trigger.targets.addArray(event.targets);
		},
	},
	reshuishi: {
		audio: "shuishi",
		enable: "phaseUse",
		usable: 1,
		frequent: true,
		filter(event, player) {
			return player.maxHp < 10;
		},
		async content(event, trigger, player) {
			event.cards = [];
			event.suits = [];
			event.again = true;
			while (event.again) {
				event.again = false;
				await player
					.judge(function (result) {
						var evt = _status.event.getParent("reshuishi");
						if (evt && evt.suits && evt.suits.includes(get.suit(result))) {
							return 0;
						}
						return 1;
					})
					.set("callback", lib.skill.reshuishi.callback)
					.set("judge2", result => result.bool);
			}
			const cards = event.cards.filterInD();
			if (!cards.length) {
				return;
			}
			const result = await player
				.chooseTarget("将" + get.translation(cards) + "交给一名角色", true)
				.set("ai", function (target) {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (att <= 0) {
						return att;
					}
					if (target.countCards("h") + _status.event.num >= _status.event.max) {
						att /= 3;
					}
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					return att;
				})
				.set("num", cards.length)
				.set(
					"max",
					game.filterPlayer().reduce((num, i) => {
						return Math.max(num, i.countCards("h"));
					}, 0)
				)
				.forResult();
			if (!result.bool) {
				return;
			}
			const target = result.targets[0];
			event.target = target;
			player.line(target, "green");
			await target.gain(cards, "gain2").set("giver", player);
			if (target.isMaxHandcard()) {
				await player.loseMaxHp();
			}
		},
		async callback(event, trigger, player) {
			const evt = event.getParent(2);
			event.getParent().orderingCards.remove(event.judgeResult.card);
			evt.cards.push(event.judgeResult.card);
			if (!event.getParent().result.bool || player.maxHp >= 10) {
				return;
			}
			evt.suits.push(event.getParent().result.suit);
			await player.gainMaxHp();
			const result = await player.chooseBool("是否继续发动【慧识】？").set("frequentSkill", "reshuishi").forResult();
			if (result.bool) {
				event.getParent(2).again = true;
			}
		},
		ai: {
			order: 9,
			result: {
				player: 1,
			},
		},
	},
	shuishi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.maxHp < 10;
		},
		filterTarget: true,
		async content(event, trigger, player) {
			const { target } = event;
			while (true) {
				let result = await target.draw().forResult();
				if (!result.bool || !Array.isArray(result.cards) || result.cards.length !== 1 || get.itemtype(result.cards[0]) !== "card") {
					return;
				}

				const card = result.cards[0];
				const suit = get.suit(card);
				const hs = target.getCards("h");
				if (hs.some(cardx => cardx !== card && get.suit(cardx, target) === suit)) {
					await player.loseMaxHp();
					await target.showHandcards();
					return;
				}

				await player.gainMaxHp();
				if (player.maxHp >= 10) {
					return;
				}

				result = await player.chooseBool("是否继续发动【慧识】？").forResult();
				if (!result.bool) {
					return;
				}
			}
		},
		ai: {
			order: 0.5,
			result: {
				target: 0.2,
				player(player, target) {
					var list = [],
						hs = target.getCards("h");
					for (var i of hs) {
						list.add(get.suit(i, target));
					}
					if (list.length == 0) {
						return 0;
					}
					if (list.length == 1) {
						return player.maxHp > 2 ? 0 : -2;
					}
					if (list.length == 2) {
						return player.maxHp > 3 ? 0 : -2;
					}
					return -2;
				},
			},
		},
	},
	stianyi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return !game.hasPlayer(function (current) {
				return current.getAllHistory("damage").length == 0;
			});
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.gainMaxHp(2);
			await player.recover();

			const next = player.chooseTarget(true, "令一名角色获得技能〖佐幸〗");
			next.set("ai", target => get.attitude(_status.event.player, target));

			const result = await next.forResult();
			if (result.bool) {
				const target = result.targets[0];
				player.line(target, "green");
				target.storage.zuoxing = player;
				await target.addSkills("zuoxing");
			}
		},
		derivation: "zuoxing",
	},
	zuoxing: {
		audio: 3,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			var target = player.storage.zuoxing;
			if (!target || !target.isIn() || target.maxHp < 2) {
				return false;
			}
			for (var i of lib.inpile) {
				if (get.type(i) == "trick" && event.filterCard({ name: i, isCard: true }, player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i of lib.inpile) {
					if (get.type(i) == "trick" && event.filterCard({ name: i, isCard: true }, player, event)) {
						list.push(["锦囊", "", i]);
					}
				}
				return ui.create.dialog("佐幸", [list, "vcard"]);
			},
			check(button) {
				return _status.event.player.getUseValue({ name: button.link[2], isCard: true });
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
						isCard: true,
					},
					filterCard: () => false,
					selectCard: -1,
					popname: true,
					log: false,
					async precontent(event, trigger, player) {
						player.logSkill("zuoxing");
						const target = player.storage.zuoxing;
						await target.loseMaxHp();
					},
				};
			},
			prompt(links, player) {
				return "请选择" + get.translation(links[0][2]) + "的目标";
			},
		},
		ai: { order: 1, result: { player: 1 } },
	},
	resghuishi: {
		onChooseToUse(event) {
			event.targetprompt2.add(target => {
				if (event.skill !== "resghuishi" || !target.classList.contains("selectable")) {
					return;
				}
				if (
					event.player.maxHp >= game.players.length &&
					target.getSkills(null, false, false).some(skill => {
						const info = get.info(skill);
						return info?.juexingji && !target.awakenedSkills.includes(skill);
					})
				) {
					return "觉醒";
				} else {
					return "摸牌";
				}
			});
		},
		audio: "sghuishi",
		enable: "phaseUse",
		filterTarget: true,
		limited: true,
		skillAnimation: true,
		animationColor: "water",
		prompt() {
			const player = get.player();
			if (player.maxHp >= game.players.length) {
				return "选择一名角色。若其拥有未发动过的觉醒技，则你解除其中一个觉醒技的发动限制；否则其摸四张牌。然后你减2点体力上限。";
			}
			return "令一名角色摸四张牌，然后你减2点体力上限。";
		},
		async content(event, trigger, player) {
			const { target } = event;
			player.awakenSkill(event.name);
			const list = target.getSkills(null, false, false).filter(skill => {
				const info = get.info(skill);
				return info?.juexingji && !target.awakenedSkills.includes(skill);
			});
			if (player.maxHp >= game.players.length && list.length > 0) {
				const result =
					list.length == 1
						? { bool: true, links: list }
						: await player
								.chooseButton([`辉逝：选择一个觉醒技，令${get.translation(target)}可无视条件发动该技能`, [list, "skill"]], true)
								.set("displayIndex", false)
								.forResult();
				if (result?.bool && result.links?.length) {
					const [skill] = result.links;
					target.storage.resghuishi_mark = skill;
					target.markSkill("resghuishi_mark");
					const info = get.info(skill);
					if (info.filter && !info.charlotte && !info.resghuishi_filter) {
						info.resghuishi_filter = info.filter;
						info.filter = function (event, player) {
							if (player.storage.resghuishi_mark) {
								return true;
							}
							return this.resghuishi_filter.apply(this, arguments);
						};
					}
				}
			} else {
				await target.draw(4);
			}
			await player.loseMaxHp(2);
		},
		ai: {
			order: 0.1,
			expose: 0.2,
			result: {
				target(player, target) {
					if ((target != player && player.hasUnknown()) || player.maxHp < (player.getDamagedHp() > 1 ? 5 : 6)) {
						return 0;
					}
					if (
						target == player &&
						player.hasSkill("resghuishi") &&
						game.hasPlayer(function (current) {
							return current.getAllHistory("damage").length == 0;
						})
					) {
						return 4;
					}
					var list = target.getSkills(null, false, false).filter(function (skill) {
						var info = lib.skill[skill];
						return info && info.juexingji && !target.awakenedSkills.includes(skill);
					});
					if (list.length || target.hasJudge("lebu") || target.hasSkillTag("nogain")) {
						return 0;
					}
					return 4;
				},
			},
		},
		subSkill: { mark: { charlotte: true, intro: { content: "发动【$】时无视条件" } } },
	},
};
