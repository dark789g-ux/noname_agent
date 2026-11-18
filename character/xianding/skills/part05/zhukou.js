import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhukou" | "mengqing" | "yuyun">} */
export const groupSkills = {
	//周夷
	zhukou: {
		audio: 2,
		trigger: { source: "damageSource" },
		filter(event, player) {
			if (!player.getHistory("useCard").length) {
				return false;
			}
			var evt = event.getParent("phaseUse");
			if (!evt || !evt.player) {
				return false;
			}
			return (
				player
					.getHistory("sourceDamage", function (evtx) {
						return evtx.getParent("phaseUse") == evt;
					})
					.indexOf(event) == 0
			);
		},
		frequent: true,
		content() {
			player.draw(player.getHistory("useCard").length);
		},
		group: "zhukou_all",
		subSkill: {
			all: {
				audio: "zhukou",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return game.countPlayer(current => current != player) > 1 && !player.getHistory("sourceDamage").length;
				},
				direct: true,
				content() {
					"step 0";
					player.chooseTarget(get.prompt("zhukou"), "对两名其他角色各造成1点伤害", 2, lib.filter.notMe).set("ai", function (target) {
						var player = _status.event.player;
						return get.damageEffect(target, player, player);
					});
					"step 1";
					if (result.bool) {
						var targets = result.targets.sortBySeat();
						player.logSkill("zhukou", targets);
						for (var i of targets) {
							i.damage();
						}
					}
				},
			},
		},
	},
	mengqing: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			return game.countPlayer(current => current.isDamaged()) > player.getHp();
		},
		juexingji: true,
		skillAnimation: true,
		animationColor: "wood",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.gainMaxHp(3);
			await player.recover(3);
			await player.changeSkills(["yuyun"], ["zhukou"]);
		},
		derivation: ["yuyun", "zhukou"],
	},
	yuyun: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		locked: true,
		async cost(event, trigger, player) {
			if (player.maxHp <= 1) {
				event.result = { bool: true, cost_data: 0 };
			} else {
				const result = await player
					.chooseControl("失去体力", "减体力上限")
					.set("prompt", "玉陨：请选择一项")
					.set("ai", () => {
						const player = get.player();
						if (player.hp < 2 || player.getDamagedHp() > 2) {
							return 1;
						}
						return 0;
					})
					.forResult();
				event.result = {
					bool: true,
					cost_data: result.index,
				};
			}
		},
		async content(event, trigger, player) {
			if (event.cost_data == 1) {
				if (player.maxHp > 1) {
					await player.loseMaxHp();
				}
			} else {
				await player.loseHp();
			}
			const list = ["选项一：摸两张牌", "选项二：对一名其他角色造成1点伤害，且本回合对其使用【杀】无距离和次数限制", "选项三：本回合手牌上限视为无限", "选项四：获得一名其他角色区域内的一张牌", "选项五：令一名其他角色将手牌数摸至体力上限（至多摸至五张）"],
				num = Math.min(5, player.getDamagedHp() + 1),
				selected = [];
			while (selected.length < num) {
				const result = await player
					.chooseButton([
						"玉陨：是否选择一项执行？",
						[
							list.map((item, i) => {
								return [i, item];
							}),
							"textbutton",
						],
					])
					.set("filterButton", button => {
						return !get.event().selected.includes(button.link);
					})
					.set("selected", selected)
					.set("ai", button => {
						const player = get.player();
						switch (button.link) {
							case 0:
								return 2;
							case 1:
								return (
									Math.max(
										0.5,
										player.countCards("hs", card => {
											return get.name(card) == "sha" && player.hasValueTarget(card);
										}) - player.getCardUsable({ name: "sha" })
									) +
									Math.max.apply(
										Math,
										game
											.filterPlayer(current => {
												return current != player;
											})
											.map(target => {
												return get.damageEffect(target, player, player);
											})
									)
								);
							case 2:
								return player.needsToDiscard() / 4;
							case 3:
								var num = 0;
								return (
									0.8 *
									Math.max.apply(
										Math,
										game
											.filterPlayer(current => {
												return current != player && current.hasCard(card => lib.filter.canBeGained(card, current, player), "hej");
											})
											.map(target => {
												return get.effect(target, { name: "shunshou_copy" }, player, player);
											})
									)
								);
							case 4:
								var num = 0;
								game.countPlayer(current => {
									if (current != player && get.attitude(player, current) > 0) {
										var num2 = Math.min(5, current.maxHp) - current.countCards("h");
										if (num2 > num) {
											num = num2;
										}
									}
								});
								return num * 0.8;
						}
					})
					.forResult();
				if (result?.bool) {
					const choice = result.links[0];
					selected.add(choice);
					game.log(player, "选择了", "#g【玉陨】", "的", "#y选项" + get.cnNumber(1 + choice, true));
					switch (choice) {
						case 0:
							await player.draw(2);
							break;
						case 1: {
							if (game.hasPlayer(current => current != player)) {
								const result2 = await player
									.chooseTarget(lib.filter.notMe, true, "请选择一名其他角色，你对其造成1点伤害且本回合你对其使用【杀】无距离和次数限制")
									.set("ai", target => {
										const player = get.player();
										return get.damageEffect(target, player, player);
									})
									.forResult();
								if (result2?.bool) {
									const target = result2.targets[0];
									player.line(target, "green");
									await target.damage();
									player.markAuto("yuyun_sha", [target]);
									player.addTempSkill("yuyun_sha");
								}
							}
							break;
						}
						case 2:
							player.addTempSkill("yuyun_114514");
							break;
						case 3: {
							if (
								game.hasPlayer(current => {
									return current != player && current.hasGainableCards(player, "hej");
								})
							) {
								const result2 = await player
									.chooseTarget(true, "获得一名其他角色区域内的一张牌", (card, player, current) => {
										return current != player && current.hasGainableCards(player, "hej");
									})
									.set("ai", target => {
										const player = get.player();
										return get.effect(target, { name: "shunshou_copy" }, player, player);
									})
									.forResult();
								if (result2?.bool) {
									const target = result2.targets[0];
									player.line(target, "green");
									await player.gainPlayerCard(target, "hej", true);
								}
							}
							break;
						}
						case 4: {
							if (
								game.hasPlayer(current => {
									return current != player && current.countCards("h") < Math.min(5, current.maxHp);
								})
							) {
								const result2 = await player
									.chooseTarget(true, "令一名其他角色将手牌数摸至体力上限", (card, player, current) => {
										return current != player && current.countCards("h") < Math.min(5, current.maxHp);
									})
									.set("ai", target => {
										const player = get.player();
										let att = get.attitude(player, target);
										if (target.hasSkillTag("nogain")) {
											att /= 6;
										}
										if (att > 2) {
											return Math.min(5, target.maxHp) - target.countCards("h");
										}
										return att / 3;
									})
									.forResult();
								if (result2?.bool) {
									const target = result2.targets[0];
									player.line(target, "green");
									await target.drawTo(Math.min(5, target.maxHp));
								}
							}
							break;
						}
					}
				} else {
					break;
				}
			}
		},
		subSkill: {
			114514: {
				mod: {
					maxHandcardFinal(player, num) {
						return 114514;
					},
				},
				charlotte: true,
				mark: true,
				intro: { content: "本回合手牌上限无限" },
			},
			sha: {
				mod: {
					cardUsableTarget(card, player, target) {
						if (card.name == "sha" && player.getStorage("yuyun_sha").includes(target)) {
							return Infinity;
						}
					},
					targetInRange(card, player, target) {
						if (card.name == "sha" && player.getStorage("yuyun_sha").includes(target)) {
							return true;
						}
					},
				},
				charlotte: true,
				onremove: true,
				intro: { content: "本回合对$使用【杀】无距离和次数限制" },
			},
		},
	},
};
