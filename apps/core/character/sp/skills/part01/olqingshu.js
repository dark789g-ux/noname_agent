import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqingshu" | "olshoushu">} */
export const groupSkills = {
	olqingshu: {
		audio: 3,
		trigger: {
			global: "phaseBefore",
			player: ["enterGame", "phaseZhunbeiBegin", "phaseJieshuBegin"],
		},
		filter(event, player) {
			return event.name !== "phase" || game.phaseNumber === 0;
		},
		forced: true,
		async content(event, trigger, player) {
			let { tianshuTrigger: fromItems, tianshuContent: toItems } = get.info("olhedao");
			fromItems = fromItems.randomGets(3);
			const froms = await player
				.chooseButton(
					[
						'###青书：请选择“天书”时机###<div class="text center">时机触发等级将决定后续效果词条的等级</div>',
						[
							dialog => {
								dialog.css({ top: get.is.phoneLayout() ? "20%" : "25%" });
								dialog.addNewRow(
									...fromItems.map((item, index) => {
										return {
											item: [`${item.name}<br>（触发等级：${item.fromIndex}）`],
											custom(itemContainer) {
												itemContainer.link = index;
												itemContainer.classList.add("button");
												dialog.buttons.add(itemContainer);
											},
											clickItemContainer(itemContainer, 棍, 母, e) {
												ui.click.button.call(itemContainer, e);
											},
										};
									})
								);
							},
							"handle",
						],
					],
					true
				)
				.set("ai", () => 1 + Math.random())
				.forResult();
			if (!froms?.links?.length) {
				return;
			}
			const from = fromItems[froms.links[0]];
			const items = toItems.filter(item => !item.filter || item.filter(from.name));
			toItems = items.filter(item => from.fromIndex === item.toIndex).randomGets(3);
			if (get.isLuckyStar(player) || Math.random() > 0.5) {
				let levelItem = items.filter(item => from.fromIndex + 1 === item.toIndex).randomGet();
				if (levelItem) {
					toItems[get.rand(0, toItems.length - 1)] = levelItem;
				}
			}
			const tos = await player
				.chooseButton(
					[
						'###青书：请选择“天书”效果###<div class="text center">' + from.name + "</div>",
						[
							dialog => {
								dialog.css({ top: get.is.phoneLayout() ? "20%" : "25%" });
								dialog.addNewRow(
									...toItems.map((item, index) => {
										return {
											item: [`${["", '<span style="color: #EEC900; text-shadow: 0.5px 0.5px 0.5px white, 0.5px 0.5px 0.5px white, 0.5px 0.5px 0.5px white, 0.5px 0.5px 0.5px white;">'][item.toIndex - from.fromIndex]}${item.name}${["", "</span>"][item.toIndex - from.fromIndex]}`],
											custom(itemContainer) {
												itemContainer.link = index;
												itemContainer.classList.add("button");
												dialog.buttons.add(itemContainer);
											},
											clickItemContainer(itemContainer, 棍, 母, e) {
												ui.click.button.call(itemContainer, e);
											},
										};
									})
								);
							},
							"handle",
						],
					],
					true
				)
				.set("ai", () => 1 + Math.random())
				.forResult();
			if (!tos?.links?.length) {
				return;
			}
			const to = toItems[tos.links[0]];
			let skill;
			while (true) {
				skill = "olhedao_tianshu_" + Math.random().toString(36).slice(-8);
				if (!lib.skill[skill]) {
					break;
				}
			}
			game.broadcastAll(
				(skill, from, to) => {
					const { filter: filterFrom, ...otherFrom } = from.effect;
					const { filter: filterTo, ...otherTo } = to.effect;
					lib.skill[skill] = {
						nopop: true,
						olhedao: true,
						charlotte: true,
						init(player, skill) {
							player.storage[skill] ??= [0, []];
						},
						onremove: true,
						filter(...args) {
							return (filterFrom ? filterFrom(...args) : true) && (filterTo ? filterTo(...args) : true);
						},
						markimage: "image/card/tianshu2.png",
						intro: {
							markcount: (storage = [0]) => storage[0],
							content(storage = [0, []], player, book) {
								const [count, targets] = storage;
								if (!book) {
									return "查无此书";
								}
								return [
									`此书还可使用${count}次`,
									(() => {
										if (!get.info(book)?.nopop || [player, ...targets].some(i => i.isUnderControl(true) || i.isFriendOf(game.me))) {
											return lib.translate[`${book}_info`];
										}
										return "此书仍是个秘密";
									})(),
								]
									.map(str => `<li>${str}`)
									.join("<br>");
							},
						},
						...otherFrom,
						...otherTo,
					};
					lib.translate[skill] = "天书";
					lib.translate[`${skill}_info`] = `${from.name}，${to.name}。`;
					game.finishSkill(skill);
				},
				skill,
				from,
				to
			);
			player.addSkill(skill);
			lib.skill.olhedao.tianshuClear(skill, player, -2);
			const skills = player.getSkills(null, false, false).filter(skill => get.info(skill)?.olhedao);
			const num = skills.length - lib.skill.olhedao.getLimit(player);
			if (num > 0) {
				const result =
					num < skills.length
						? await player
								.chooseButton(
									[
										"青书：选择失去" + get.cnNumber(num) + "册多余的“天书”",
										[
											dialog => {
												dialog.css({ top: get.is.phoneLayout() ? "20%" : "25%" });
												dialog.addNewRow(
													...skills.map(item => {
														return {
															item: [`${lib.translate[`${item}_info`]}<br>（剩余${player.storage[item][0]}次）`],
															custom(itemContainer) {
																itemContainer.link = item;
																itemContainer.classList.add("button");
																dialog.buttons.add(itemContainer);
															},
															clickItemContainer(itemContainer, 棍, 母, e) {
																ui.click.button.call(itemContainer, e);
															},
														};
													})
												);
											},
											"handle",
										],
									],
									true,
									num
								)
								.set("ai", () => 1 + Math.random())
								.forResult()
						: { bool: true, links: skills };
				if (result?.bool && result.links?.length) {
					player.removeSkill(result.links);
				}
			}
		},
		ai: { threaten: 4 },
	},
	olshoushu: {
		audio: 3,
		enable: "phaseUse",
		filter(event, player) {
			return (
				player.getSkills(null, false, false).some(skill => {
					return get.info(skill)?.olhedao && get.info(skill).nopop;
				}) && game.hasPlayer(target => target !== player)
			);
		},
		usable: 1,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target } = event;
			const skills = player.getSkills(null, false, false).filter(skill => {
				return get.info(skill)?.olhedao && get.info(skill).nopop;
			});
			if (!skills.length) {
				return;
			}
			const result =
				skills.length > 1
					? await player
							.chooseButton(
								[
									"授术：请选择你要授予" + get.translation(target) + "的天书",
									[
										dialog => {
											dialog.css({ top: get.is.phoneLayout() ? "20%" : "25%" });
											dialog.addNewRow(
												...skills.map(item => {
													return {
														item: [lib.translate[`${item}_info`]],
														custom(itemContainer) {
															itemContainer.link = item;
															itemContainer.classList.add("button");
															dialog.buttons.add(itemContainer);
														},
														clickItemContainer(itemContainer, 棍, 母, e) {
															ui.click.button.call(itemContainer, e);
														},
													};
												})
											);
										},
										"handle",
									],
								],
								true
							)
							.set("ai", () => 1 + Math.random())
							.forResult()
					: { bool: true, links: skills };
			if (result?.bool && result.links?.length) {
				const [skill] = result.links;
				player.removeSkill(skill);
				target.addSkill(skill);
				target.storage[skill][1].add(player);
				lib.skill.olhedao.tianshuClear(skill, target, -1);
				let skills = target.getSkills(null, false, false).filter(skill => get.info(skill)?.olhedao);
				const num = skills.length - lib.skill.olhedao.getLimit(target);
				skills = skills.slice(0, Math.max(0, num));
				if (skills.length) {
					target.removeSkill(skills);
				}
			}
		},
		ai: {
			order: 1,
			result: { target: 1 },
			combo: "olqingshu",
		},
	},
};
