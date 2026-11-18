import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbzhouxi" | "dcsbshijin">} */
export const groupSkills = {
	//谋邓艾
	dcsbzhouxi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard(card, player, event) {
			return game.players.every(current => current == player || !player.canUse(card, current, true, true));
		},
		filter(event, player) {
			return player.countCards("h", card => get.info("dcsbzhouxi")?.filterCard(card, player, event));
		},
		selectCard: -1,
		manualConfirm: true,
		position: "h",
		async content(event, trigger, player) {
			let num = Math.min(3, event.cards.length),
				select = [];
			const bool1 =
					game.countPlayer(current => {
						return player.canUse("shunshou", current, true) && get.effect(current, { name: "shunshou" }, player, player) > 0;
					}) < num,
				bool2 = game.hasPlayer(current => {
					return player.canUse("shunshou", current, false) && get.distance(player, current) == 2 && get.effect(current, { name: "shunshou" }, player, player) > 0;
				});
			while (num > 0) {
				num--;
				const choiceList = [`计算与其他角色距离-${select.length + 1}`, `视为对至多${select.length + 1}名角色使用【顺手牵羊】`, `视为对至多${select.length + 1}名角色使用【杀】`],
					controls = ["选项一", "选项二", "选项三"];
				for (const chosen of select) {
					const index = controls.indexOf(chosen);
					choiceList[index] = `<span style="opacity:0.5;">${choiceList[index]}</span>`;
				}
				const result = await player
					.chooseControl(controls.removeArray(select))
					.set("prompt", `骤袭：请选择一项（还可选择${num}项）`)
					.set("choiceList", choiceList)
					.set("ai", () => {
						return get.event().res;
					})
					.set(
						"res",
						(() => {
							if (controls.includes("选项一") && (num > 1 || (num > 0 && bool1 && bool2))) {
								return "选项一";
							}
							return controls[controls.length - 1];
						})()
					)
					.forResult();
				const control = result.control;
				select.push(control);
				game.log(player, "选择了", `#g${choiceList[["选项一", "选项二", "选项三"].indexOf(control)]}`);
			}
			let count = 0;
			while (select.length) {
				let result = select.shift();
				switch (result) {
					case "选项一": {
						count++;
						player.addTempSkill("dcsbzhouxi_range");
						player.addMark("dcsbzhouxi_range", count, false);
						break;
					}
					case "选项二": {
						count++;
						const card = new lib.element.VCard({ name: "shunshou", isCard: true });
						if (player.hasUseTarget(card)) {
							await player.chooseUseTarget(card, [1, count], true);
						}
						break;
					}
					case "选项三": {
						count++;
						const card = new lib.element.VCard({ name: "sha", isCard: true });
						if (player.hasUseTarget(card)) {
							await player.chooseUseTarget(card, [1, count], true, false);
						}
						break;
					}
				}
			}
			if (count >= 3) {
				if (player.getStat("skill")[event.name]) {
					delete player.getStat("skill")[event.name];
					game.log(player, "重置了", "#g【骤袭】");
				}
			}
		},
		subSkill: {
			range: {
				charlotte: true,
				onremove: true,
				intro: {
					markcount(storage) {
						return storage ? `-${storage}` : null;
					},
					content: "计算与其他角色距离-#",
				},
				mod: {
					globalFrom(from, to, num) {
						return num - from.countMark("dcsbzhouxi_range");
					},
				},
			},
		},
		ai: {
			order: 6,
			result: {
				player(player) {
					if (
						game.hasPlayer(current => {
							if (get.distance(player, current) > 2 || get.effect(current, { name: "shunshou" }, player, player) <= 0) {
								return false;
							}
							return player.canUse("shunshou", current, false) || player.canUse("sha", current, false);
						})
					) {
						if (player.hasSkill("dcsbshijin") && !player.getStorage("dcsbshijin", false)) {
							const num = player.countCards("h", card => get.info("dcsbzhouxi")?.filterCard(card, player, get.event()));
							if (num < 3 && player.getHistory("sourceDamage").length) {
								return 0;
							}
						}
						return 1;
					}
					return 0;
				},
			},
		},
	},
	dcsbshijin: {
		audio: 2,
		enable: "phaseUse",
		manualConfirm: true,
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		onChooseToUse(event) {
			if (!game.online && !event.shijin_record) {
				event.set("shijin_record", event.player.getHistory("sourceDamage"));
			}
		},
		filter(event, player) {
			return event.shijin_record?.length;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.draw(2);
			/*let cards = [];
			while (true) {
				const card = get.cardPile(card => cards.every(cardx => get.type2(cardx) != get.type2(card)));
				if (card) {
					cards.push(card);
				} else {
					break;
				}
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			}*/
			player.addTempSkill("dcsbshijin_defend", { player: "phaseBeginStart" });
			player
				.when({
					player: "phaseBegin",
				})
				.step(async (event, trigger, player) => {
					const cards = player.getDiscardableCards(player, "h").filter(card => {
						return get.name(card) == "sha" || get.type2(card) == "trick";
					});
					if (cards.length) {
						await player.discard(cards);
						await player.loseHp(cards.length);
					} else {
						player.restoreSkill("dcsbshijin");
						game.log(player, "重置了", "#g【恃矜】");
					}
				});
		},
		ai: {
			order: 5,
			result: {
				player: 1,
			},
		},
		subSkill: {
			defend: {
				audio: "dcsbshijin",
				charlotte: true,
				mark: true,
				intro: {
					content: "受到伤害时，防止之并摸一张牌",
				},
				trigger: {
					player: "damageBegin3",
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.cancel();
					await player.draw();
				},
				ai: {
					filterDamage: true,
					skillTagFilter(player, tag, arg) {
						if (arg.player.hasSkillTag("jueqing", false, player)) {
							return false;
						}
					},
				},
			},
		},
	},
};
