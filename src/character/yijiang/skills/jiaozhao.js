import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jiaozhao" | "jiaozhao2" | "jiaozhao3" | "jiaozhao3_backup" | "xindanxin" | "danxin" | "zongzuo" | "zhige">} */
export const groupSkills = {
	jiaozhao: {
		audio: 2,
		usable: 1,
		enable: "phaseUse",
		filter(event, player) {
			return player.countMark("xindanxin") < 2 && player.countCards("h") > 0;
		},
		filterCard: true,
		check(card) {
			return 8 - get.value(card);
		},
		locked: false,
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards } = event;
			await player.showCards(cards);
			let jiaozhaoTarget = player;
			if (player.countMark("xindanxin") <= 1) {
				const targets = game.filterPlayer();
				targets.remove(player);
				targets.sort((a, b) => Math.max(1, get.distance(player, a)) - Math.max(1, get.distance(player, b)));
				const distance = Math.max(1, get.distance(player, targets[0]));
				for (const [i, target] of targets.entries()) {
					if (i == 0) {
						continue;
					}
					if (Math.max(1, get.distance(player, target)) > distance) {
						targets.splice(i);
						break;
					}
				}
				const result = await player
					.chooseTarget({
						prompt: "请选择【矫诏】的目标",
						filterTarget(card, player, target) {
							return get.event().targets.includes(target);
						},
						forced: true,
						ai(target) {
							return get.attitude(get.player(), target);
						},
					})
					.set("targets", targets)
					.forResult();
				jiaozhaoTarget = result.targets[0];
				player.line(result.targets, "green");
			}
			if (!jiaozhaoTarget) {
				return;
			}
			const list = [];
			for (const name of lib.inpile) {
				if (name == "sha") {
					list.push(["基本", "", "sha"]);
					for (const nature of lib.inpile_nature) {
						list.push(["基本", "", "sha", nature]);
					}
				} else if (get.type(name) == "basic") {
					list.push(["基本", "", name]);
				} else if (player.countMark("xindanxin") > 0 && get.type(name) == "trick") {
					list.push(["锦囊", "", name]);
				}
			}
			const result = await jiaozhaoTarget
				.chooseButton({
					createDialog: ["矫诏", [list, "vcard"]],
					forced: true,
					ai(button) {
						const player = get.event(0).getParent().player;
						const card = {
							name: button.link[2],
							nature: button.link[3],
							storage: {
								jiaozhao: player,
							},
						};
						return player.getUseValue(card, null, true) * get.event().att;
					},
				})
				.set("att", get.attitude(jiaozhaoTarget, player) > 0 ? 1 : -1)
				.forResult();
			const chosen = result.links[0][2];
			const nature = result.links[0][3];
			const fakecard = {
				name: chosen,
				storage: { jiaozhao: player },
			};
			if (nature) {
				fakecard.nature = nature;
			}
			await jiaozhaoTarget.showCards(
				game.createCard({
					name: chosen,
					nature: nature,
					suit: cards[0].suit,
					number: cards[0].number,
				}),
				get.translation(jiaozhaoTarget) + "声明了" + get.translation(chosen)
			);
			player.storage.jiaozhao = cards[0];
			player.storage.jiaozhao_card = fakecard;
			game.broadcastAll(
				function (name, card) {
					lib.skill.jiaozhao2.viewAs = name;
					card.addGaintag("jiaozhao");
				},
				fakecard,
				cards[0]
			);
			player.addTempSkill("jiaozhao2", "phaseUseEnd");
		},
		group: "jiaozhao3",
		mod: {
			targetEnabled(card, player, target) {
				if (card.storage && card.storage.jiaozhao && card.storage.jiaozhao == target) {
					return false;
				}
			},
		},
		ai: {
			order: 9,
			result: {
				player: 1,
			},
		},
	},
	jiaozhao2: {
		enable: "phaseUse",
		audio: "jiaozhao",
		charlotte: true,
		sourceSkill: "jiaozhao",
		filter(event, player) {
			if (!player.storage.jiaozhao || !lib.skill.jiaozhao2.viewAs) {
				return false;
			}
			var name = lib.skill.jiaozhao2.viewAs.name;
			return player.getCards("h").includes(player.storage.jiaozhao) && player.storage.jiaozhao.hasGaintag("jiaozhao") && game.checkMod(player.storage.jiaozhao, player, "unchanged", "cardEnabled2", player) !== false;
		},
		filterCard(card, player) {
			return card == player.storage.jiaozhao;
		},
		selectCard: -1,
		popname: true,
		prompt() {
			return "选择" + get.translation(lib.skill.jiaozhao2.viewAs) + "的目标";
		},
		check(card) {
			return 8 - get.value(card);
		},
		ai: {
			order: 6,
		},
		onremove(player) {
			player.removeGaintag("jiaozhao");
			delete player.storage.jiaozhao;
			delete player.storage.jiaozhao_card;
		},
	},
	jiaozhao3: {
		audio: "jiaozhao",
		enable: "phaseUse",
		sourceSkill: "jiaozhao",
		filter(event, player) {
			return (player.getStat("skill").jiaozhao || 0) + (player.getStat("skill").jiaozhao3 || 0) < player.countMark("xindanxin") - 1 && player.countCards("h") > 0;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i of lib.inpile) {
					var type = get.type(i, null, false);
					if (type == "basic" || type == "trick") {
						var card = {
							name: i,
							storage: {
								jiaozhao: player,
							},
						};
						if (event.filterCard(card, player, event)) {
							list.push([type, "", i]);
						}
						if (i == "sha") {
							for (var j of lib.inpile_nature) {
								card.nature = j;
								if (event.filterCard(card, player, event)) {
									list.push([type, "", i, j]);
								}
							}
						}
					}
				}
				if (list.length) {
					return ui.create.dialog("矫诏", [list, "vcard"]);
				}
				return ui.create.dialog("矫诏：当前没有可用牌");
			},
			check(button) {
				var player = _status.event.player,
					card = {
						name: button.link[2],
						nature: button.link[3],
						storage: {
							jiaozhao: player,
						},
					};
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					audio: "jiaozhao",
					filterCard: true,
					position: "h",
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						storage: {
							jiaozhao: player,
						},
					},
					check(card) {
						return 8 - get.value(card);
					},
				};
			},
			prompt(links, player) {
				return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order: 9,
			result: {
				player: 1,
			},
		},
	},
	jiaozhao3_backup: { audio: "jiaozhao" },
	xindanxin: {
		trigger: { player: "damageEnd" },
		frequent: true,
		audio: "danxin",
		async content(event, trigger, player) {
			await player.draw();
			if (player.countMark("xindanxin") < 3) {
				player.addMark("xindanxin", 1, false);
				game.log(player, "修改了技能", "#g【矫诏】");
			}
		},
		intro: { content: "【矫诏】加成等级：Lv.#" },
		ai: {
			maixie: true,
			effect: {
				target: (card, player, target) => {
					if (!get.tag(card, "damage")) {
						return;
					}
					if (target.hp + target.hujia < 2 || player.hasSkillTag("jueqing", false, target)) {
						return 1.8;
					}
					if (!target.hasSkill("jiaozhao") || target.countMark("xindanxin") > 1) {
						return [1, 1];
					}
					return [1, 0.8 * target.hp - 0.5];
				},
			},
		},
	},
	danxin: {
		trigger: { player: "damageEnd" },
		frequent: true,
		audio: 2,
		async content(event, trigger, player) {
			let result;
			if (player.countMark("xindanxin") >= 2) {
				await player.draw();
				return;
			}
			const list = ["draw_card", "更改描述"];
			let prompt;
			if (player.countMark("xindanxin") == 0) {
				prompt = '摸一张牌或更改矫诏的描述<br><br><div class="text">更改描述：将“选择距离最近的一名其他角色，该角色”改为“你”';
			} else {
				prompt = '摸一张牌或更改矫诏的描述<br><br><div class="text">更改描述：将“基本牌”改为“基本牌或普通锦囊牌”';
			}
			result = await player
				.chooseControl({
					prompt,
					controls: list,
					ai() {
						if (!_status.event.player.hasSkill("jiaozhao")) {
							return "draw_card";
						}
						return "更改描述";
					},
				})
				.forResult();
			if (result.control == "draw_card") {
				await player.draw();
			} else {
				game.log(player, "更改了", "【矫诏】", "的描述");
				player.popup("更改描述");
				player.addMark("xindanxin", 1, false);
			}
		},
		ai: {
			maixie: true,
			effect: {
				target: (card, player, target) => {
					if (!get.tag(card, "damage")) {
						return;
					}
					if (target.hp < 2 || player.hasSkillTag("jueqing", false, target)) {
						return 1.5;
					}
					return [1, 0.8];
				},
			},
		},
	},
	zongzuo: {
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		audio: 2,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async content(event, trigger, player) {
			const num = game.countGroup();
			await player.gainMaxHp({ num });
			await player.recover({ num });
			//player.update();
		},
		group: "zongzuo_lose",
		subSkill: {
			lose: {
				trigger: { global: "dieAfter" },
				forced: true,
				audio: "zongzuo",
				filter(event, player) {
					if (!lib.group.includes(event.player.group)) {
						return false;
					}
					if (
						game.hasPlayer(function (current) {
							return current.group == event.player.group;
						})
					) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					await player.loseMaxHp();
				},
			},
		},
	},
	zhige: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		filter(event, player) {
			return player.countCards("h") > player.hp;
		},
		filterTarget(card, player, target) {
			return player !== target && target.inRange(player);
		},
		async content(event, trigger, player) {
			const { target } = event;
			let result;
			result = await target
				.chooseToUse({
					prompt: `止戈：使用一张杀，或将装备区里的一张牌交给${get.translation(player)}`,
					filterCard: get.filter({ name: "sha" }),
				})
				.forResult();
			if (result.bool || !target.countCards("e")) {
				return;
			}

			result = await target
				.chooseCard({
					prompt: `将装备区里的一张牌交给${get.translation(player)}`,
					position: "e",
					forced: true,
				})
				.forResult();
			if (result.bool && result.cards?.length) {
				await target.give(result.cards, player);
			}
		},
		ai: {
			expose: 0.2,
			order: 5,
			result: {
				target: -1,
				player(player, target) {
					if (target.countCards("h") == 0) {
						return 0;
					}
					if (target.countCards("h") == 1) {
						return -0.1;
					}
					if (player.hp <= 2) {
						return -2;
					}
					if (player.countCards("h", "shan") == 0) {
						return -1;
					}
					return -0.5;
				},
			},
		},
	},
};
