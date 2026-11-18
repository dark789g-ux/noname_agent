import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olyongzu" | "olqingliu" | "rejianxiong_caoteng" | "tianming_caoteng" | "olkouchao">} */
export const groupSkills = {
	//曹腾
	olyongzu: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(t => t != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.event().player;
					if (get.attitude(player, target) <= 0) {
						return 0;
					}
					const list = get
						.info("olyongzu")
						.getList(player, target)
						.map(listx => listx[0][1])
						.filter(effect => !effect.filter || effect.filter(player));
					return Math.max(...list.map(effect => effect.ai(player))) + Math.max(...list.map(effect => effect.ai(target)));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			let list = get.info("olyongzu").getList(player, target),
				choosed;
			for (const current of [player, target]) {
				const result = await current
					.chooseButton(["拥族：请选择一项执行", [list.filter(effect => choosed !== effect[0][0]), "textbutton"]], true)
					.set("filterButton", button => {
						const effect = button.link[1];
						return !effect.filter || effect.filter(get.player());
					})
					.set("target", target)
					.set("ai", button => {
						const { dialog, player, target } = get.event();
						const effect = button.link[1],
							buttons = dialog.buttons.slice(0).remove(button);
						if (target !== player) {
							const targetButton = buttons.maxBy(buttonx => buttonx.link[1].ai(target));
							if (targetButton) {
								return effect.ai(player) + targetButton.link[1].ai(target) * get.sgnAttitude(player, target);
							}
						}
						return effect.ai(player);
					})
					.forResult();
				if (result.bool) {
					if (!choosed) {
						choosed = result.links[0][0];
					}
					await result.links[0][1].content(current);
				}
			}
		},
		getList(player, target) {
			let list = [
				[
					"摸两张牌",
					{
						async content(player) {
							await player.draw(2);
						},
						ai(player) {
							return get.effect(player, { name: "draw" }, player, player);
						},
					},
				],
				[
					"回复1点体力",
					{
						async content(player) {
							await player.recover();
						},
						ai(player) {
							return get.recoverEffect(player, player, player);
						},
					},
				],
				[
					"复原武将牌",
					{
						async content(player) {
							if (player.isTurnedOver()) {
								await player.turnOver(false);
							}
							if (player.isLinked()) {
								await player.link(false);
							}
						},
						ai(player) {
							return (player.isTurnedOver() ? 3 : 0) + (player.isLinked() ? 2 : 0);
						},
					},
				],
			];
			if (get.mode() == "guozhan" ? target.isFriendOf(player) : target.group == player.group) {
				list.addArray([
					[
						"手牌上限+1",
						{
							async content(player) {
								player.addSkill("olyongzu_hand");
								player.addMark("olyongzu_hand", 1, false);
							},
							ai: () => 1,
						},
					],
					[
						"若为魏/群势力，则获得【奸雄】/【天命】直到你的下个回合开始",
						{
							async content(player) {
								player.addTempSkill("olyongzu_skill", { player: "phaseBegin" });
								const group = player[get.mode() == "guozhan" ? "identity" : "group"];
								const skill = group == "wei" ? "rejianxiong" : "tianming";
								await player.addAdditionalSkills("olyongzu_skill", skill, true);
							},
							filter: player => ["wei", "qun"].includes(player[get.mode() == "guozhan" ? "identity" : "group"]),
							ai(player) {
								return player[get.mode() == "guozhan" ? "identity" : "group"] == "wei" ? 2 : 3;
							},
						},
					],
				]);
			}
			return list.map(listx => [listx, listx[0]]);
		},
		derivation: ["rejianxiong", "tianming"],
		ai: { threaten: 3.5 },
		subSkill: {
			skill: {
				charlotte: true,
			},
			hand: {
				charlotte: true,
				markimage: "image/card/handcard.png",
				intro: { content: "手牌上限+#" },
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("olyongzu_hand");
					},
				},
			},
		},
	},
	olqingliu: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: ["enterGame", "dyingAfter"],
		},
		filter(event, player) {
			if (event.name == "dying") {
				const group = player.storage.olqingliu;
				if (!group || player.group == group) {
					return false;
				}
				return (
					game
						.getAllGlobalHistory("everything", evt => {
							return (
								evt.name == "dying" &&
								evt.player == player &&
								!game.getAllGlobalHistory("everything", evtx => {
									return evtx.name == "die" && evtx.player == player && evtx.getParent().name == "dying";
								}).length
							);
						})
						.indexOf(event) == 0
				);
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.name == "dying") {
				await player.changeGroup(player.storage.olqingliu);
			} else {
				const result = await player
					.chooseControl("wei", "qun")
					.set("ai", () => {
						return get.rand(0, 1);
					})
					.set("prompt", "清流：请选择你的势力")
					.forResult();
				if (result.control) {
					const group = result.control;
					player.popup(group + "2");
					game.log(player, "选择了", "#y" + get.translation(group + "2"));
					player.storage.olqingliu = group == "wei" ? "qun" : "wei";
					if (player.group != group) {
						await player.changeGroup(group);
					}
				}
			}
		},
	},
	rejianxiong_caoteng: { audio: true },
	tianming_caoteng: { audio: true },
	//步度根
	//古希腊掌管扣工资的神（bushi
	olkouchao: {
		audio: 2,
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = ["sha", "huogong", "guohe"];
			}
		},
		hiddenCard(player, name) {
			const storage = player.getStorage("olkouchao");
			for (let i = 0; i < storage.length; i++) {
				if (!player.getStorage("olkouchao_used").includes(i) && name == storage[i]) {
					return true;
				}
			}
			return false;
		},
		enable: "chooseToUse",
		filter(event, player) {
			if (!player.countCards("hes")) {
				return false;
			}
			const storage = player.getStorage("olkouchao");
			for (let i = 0; i < storage.length; i++) {
				if (player.getStorage("olkouchao_used").includes(i)) {
					continue;
				}
				if (event.filterCard(get.autoViewAs({ name: storage[i] }, "unsure"), player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				const storage = player.getStorage("olkouchao");
				let list = [];
				for (let i = 0; i < storage.length; i++) {
					const name = storage[i];
					list.push([get.translation(get.type(name)), "", name, undefined, i]);
				}
				return ui.create.dialog("寇钞", [list, "vcard"]);
			},
			filter(button, player) {
				const evt = get.event().getParent();
				return evt.filterCard(get.autoViewAs({ name: button.link[2] }, "unsure"), player, evt) && !player.getStorage("olkouchao_used").includes(button.link[4]);
			},
			check(button) {
				const evt = get.event().getParent();
				const player = get.event().player;
				if (evt.type != "phase") {
					return 1;
				}
				if (button.link[2] == "jiu") {
					if (player.getUseValue({ name: "jiu" }) <= 0) {
						return 0;
					}
					if (player.countCards("h", "sha")) {
						return player.getUseValue({ name: "jiu" });
					}
					return 0;
				}
				return player.getUseValue({ name: button.link[2] }) / 4;
			},
			backup(links, player) {
				return {
					filterCard: true,
					position: "hes",
					viewAs: {
						name: links[0][2],
						storage: { olkouchao: links[0][4] + 1 },
					},
					precontent() {
						if (!player.storage.olkouchao_used) {
							player.when({ global: "roundStart" }).step(async () => delete player.storage.olkouchao_used);
						}
						player.markAuto("olkouchao_used", [lib.skill.olkouchao_backup.viewAs.storage.olkouchao - 1]);
						player.addTempSkill("olkouchao_effect");
					},
				};
			},
			prompt(links, player) {
				const name = links[0][2],
					index = links[0][4] + 1;
				return '###寇钞###<div class="text center">将一张牌当作【' + get.translation(name) + "】使用，然后修改【寇钞】的第" + get.cnNumber(index, true) + "项</div>";
			},
		},
		ai: {
			order(_, player) {
				if (!player || get.event().type != "phase") {
					return 1;
				}
				let names = player.getStorage("olkouchao").slice();
				for (let i = 0; i < names.length; i++) {
					if (player.getStorage("olkouchao_used").includes(i)) {
						names.splice(i--, 1);
					}
				}
				names = names.map(name => {
					return { name: name };
				});
				names.sort((a, b) => {
					return player.getUseValue(b, true, true) - player.getUseValue(a, true, true);
				});
				let max = get.order(names[0], player);
				if (max > 0) {
					max += 0.3;
				}
				return max;
			},
			respondShan: true,
			respondSha: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				if (!player.countCards("hes")) {
					return false;
				}
				return player.getStorage("olkouchao").includes(tag == "respondSha" ? "sha" : "shan");
			},
			result: {
				player(player) {
					const dying = get.event().dying;
					return dying ? get.attitude(player, dying) : 1;
				},
			},
		},
		subSkill: {
			backup: {},
			effect: {
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return (event.card.storage || {}).olkouchao;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const cards = game
						.getAllGlobalHistory("everything", evt => {
							if (!evt.cards || !evt.cards.someInD("d")) {
								return false;
							}
							if (evt.name == "lose") {
								return evt.position == ui.discardPile;
							}
							if (evt.name != "cardsDiscard") {
								return false;
							}
							const evtx = evt.getParent();
							if (evtx.name != "orderingDiscard") {
								return false;
							}
							const evt2 = evtx.relatedEvent || evtx.getParent();
							return evt2 && evt2.name != "useCard";
						})
						.map(evt => evt.cards.filterInD("d"))
						.flat()
						.reverse();
					const card = cards.find(card => ["basic", "trick"].includes(get.type(card)));
					if (card) {
						const index = (trigger.card.storage || {}).olkouchao;
						player.storage.olkouchao[index - 1] = card.name;
						game.log(player, "修改", "#g【寇钞】", "的", "#y第" + get.cnNumber(index, true) + "项", "为", "#g【" + get.translation(card.name) + "】");
						if (player.storage.olkouchao.every(name => get.type(name) == "basic")) {
							player.storage.olkouchao = ["shunshou", "shunshou", "shunshou"];
							game.log(player, "修改", "#g【寇钞】", "的", "#y所有项", "为", "#g【顺手牵羊】");
						}
					}
				},
			},
		},
	},
};
