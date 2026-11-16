import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjianzhuan" | "dcfanshi" | "dcfudou">} */
export const groupSkills = {
	//新杀曹爽
	dcjianzhuan: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			const evtx = event.getParent("phaseUse");
			return (
				player.isPhaseUsing() &&
				player.getHistory("useSkill", evt => {
					return evt.skill == "dcjianzhuan" && evt.event.getParent("phaseUse") == evtx;
				}).length <
					4 - player.getStorage("dcjianzhuan").length
			);
		},
		forced: true,
		derivation: "dcjianzhuan_faq",
		async content(event, trigger, player) {
			const evtx = event.getParent("phaseUse"),
				num = player.getHistory("useSkill", evt => {
					return evt.skill == "dcjianzhuan" && evt.event.getParent("phaseUse") == evtx;
				}).length,
				info = get.info("dcjianzhuan").choices;
			let choices = [],
				choiceList = [],
				map = {};
			for (const i in info) {
				map[info[i].intro] = i;
				if (player.getStorage("dcjianzhuan").includes(i) || player.getStorage("dcjianzhuan_used").includes(i)) {
					continue;
				}
				choices.push(info[i].intro);
				choiceList.push(info[i].introx(num));
			}
			const { control } = await player
				.chooseControl(choices)
				.set("choiceList", choiceList)
				.set("ai", () => {
					const player = get.event().player,
						num = get.event().num,
						info = get.info("dcjianzhuan").choices;
					let choices = get.event().controls.slice(),
						map = get.event().map;
					return choices.sort((a, b) => info[map[b]].ai_effect(player, num) - info[map[a]].ai_effect(player, num))[0];
				})
				.set("num", num)
				.set("map", map)
				.set("prompt", "渐专：请选择一项执行")
				.forResult();
			if (control) {
				if (!player.storage.dcjianzhuan_used) {
					player.when("phaseUseAfter").step(async () => delete player.storage.dcjianzhuan_used);
				}
				player.markAuto("dcjianzhuan_used", [map[control]]);
				await info[map[control]].content(player, num);
			}
		},
		choices: {
			discard_target: {
				intro: "拆牌",
				introx: num => `令一名其他角色弃置${get.cnNumber(num)}张牌`,
				weight: 1,
				ai_effect(player, num) {
					return game.hasPlayer(target => {
						return player != target && get.effect(target, { name: "guohe_copy2" }, player, player) > 0;
					})
						? 2 + num
						: 0;
				},
				async content(player, num = 1) {
					if (!game.hasPlayer(current => current != player)) {
						return;
					}
					const { bool, targets } = await player
						.chooseTarget(`令一名其他角色弃置${get.cnNumber(num)}张牌`, true, lib.filter.notMe)
						.set("ai", target => {
							return get.effect(target, { name: "guohe_copy2" }, get.event().player, get.event().player) * Math.sqrt(Math.min(get.event().num, target.countDiscardableCards(target, "he")));
						})
						.set("num", num)
						.forResult();
					if (bool) {
						const target = targets[0];
						player.line(target);
						await target.chooseToDiscard(num, "he", true);
					}
				},
			},
			draw_self: {
				intro: "摸牌",
				introx: num => `摸${get.cnNumber(num)}张牌`,
				weight: 1,
				ai_effect(player, num) {
					return 3;
				},
				async content(player, num = 1) {
					await player.draw(num);
				},
			},
			recast_self: {
				intro: "重铸",
				introx: num => `重铸${get.cnNumber(num)}张牌`,
				weight: 1,
				ai_effect(player, num) {
					return 1;
				},
				async content(player, num = 1) {
					if (!player.hasCard(lib.filter.cardRecastable, "he")) {
						return;
					}
					const { bool, cards } = await player
						.chooseCard(`重铸${get.cnNumber(num)}张牌`, "he", num, lib.filter.cardRecastable, true)
						.set("ai", lib.skill.zhiheng.check)
						.forResult();
					if (bool) {
						await player.recast(cards);
					}
				},
			},
			discard_self: {
				intro: "弃牌",
				introx: num => `弃置${get.cnNumber(num)}张牌`,
				weight: "90%",
				ai_effect(player, num) {
					let cards = player.getCards("hs");
					cards.sort((a, b) => get.value(b) - get.value(a));
					cards = cards.slice(0, -Math.min(num, cards.length));
					return cards.some(card => player.hasValueTarget(card, true, true)) ? 4 : -4;
				},
				async content(player, num = 1) {
					await player.chooseToDiscard(num, "he", true, "allowChooseAll");
				},
			},
		},
		group: "dcjianzhuan_remove",
		subSkill: {
			remove: {
				audio: "dcjianzhuan",
				trigger: { player: "phaseUseEnd" },
				filter(event, player) {
					if (player.getStorage("dcjianzhuan").length >= 3) {
						return false;
					}
					return player.getStorage("dcjianzhuan_used").length >= 4 - player.getStorage("dcjianzhuan").length;
				},
				forced: true,
				async content(event, trigger, player) {
					const info = get.info("dcjianzhuan").choices;
					let map = {};
					let unfixedWeightTotal = 0,
						remainedWeight = 100;
					let entries = [];
					for (const i in info) {
						const infox = info[i];
						map[infox.intro] = i;
						if (player.getStorage("dcjianzhuan").includes(i)) {
							continue;
						}
						let weight = (infox.weight || 1).toString();
						if (weight.endsWith("%")) {
							weight = Math.min(remainedWeight, parseInt(weight.slice(0, -1)));
							entries.push([infox.intro, weight]);
							remainedWeight -= weight;
						} else {
							weight = parseInt(weight);
							unfixedWeightTotal += weight;
							entries.push([infox.intro, -weight]);
						}
					}
					entries = entries.map(entry => {
						let weight = entry[1];
						if (weight < 0) {
							weight = (-remainedWeight / unfixedWeightTotal) * weight;
						}
						return [entry[0], weight];
					});
					let rand = Math.random() * 100;
					let removeChoice = entries.find(entry => {
						rand -= entry[1];
						return rand < 0;
					})[0];
					if (get.isLuckyStar(player) && Object.keys(entries).includes("弃牌")) {
						removeChoice = "弃牌";
					}
					player.markAuto("dcjianzhuan", [map[removeChoice]]);
					player.popup(removeChoice);
					game.log(player, "移去了", "#g" + removeChoice, "项");
				},
			},
		},
		mark: true,
		intro: {
			markcount(storage) {
				return 4 - (storage || []).length;
			},
			content(storage) {
				if (!(storage || []).length) {
					return "暂未移去任何项";
				}
				const info = get.info("dcjianzhuan").choices;
				let str = "";
				for (const i of storage) {
					str += info[i].intro;
					str += "、";
				}
				str = str.slice(0, -1);
				return "已移去" + str + "项";
			},
		},
	},
	dcfanshi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return 4 - player.getStorage("dcjianzhuan").length < 2;
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const info = get.info("dcjianzhuan").choices;
			let choices = [];
			for (const i in info) {
				if (!player.getStorage("dcjianzhuan").includes(i)) {
					choices.push(i);
				}
			}
			if (choices.length) {
				for (const choice of choices) {
					for (let i = 1; i <= 3; i++) {
						await info[choice].content(player, 1);
					}
				}
			}
			await player.gainMaxHp(2);
			await player.recover(2);
			await player.changeSkills(["dcfudou"], ["dcjianzhuan"]);
		},
		derivation: "dcfudou",
		ai: { combo: "dcjianzhuan" },
	},
	dcfudou: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (event.targets.length != 1 || event.target == player) {
				return false;
			}
			const color = get.color(event.card);
			if (!["black", "red"].includes(color)) {
				return false;
			}
			const damage = event.target.getAllHistory("sourceDamage", evt => evt.player == player).length;
			return Math.min(1, damage) == (color == "black");
		},
		check(event, player) {
			const color = get.color(event.card);
			if (color == "red") {
				return get.attitude(player, event.target) > 0;
			}
			if (player.getHp() + player.countCards("hs", card => player.canSaveCard(card, player)) <= 1) {
				return false;
			}
			return get.effect(player, { name: "losehp" }, player, player) >= get.effect(event.target, { name: "losehp" }, player, player);
		},
		prompt2(event, player) {
			return "与" + get.translation(event.target) + "各" + (get.color(event.card) == "black" ? "失去1点体力" : "摸一张牌");
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const color = get.color(trigger.card),
				target = trigger.target;
			if (color == "red") {
				await player.draw("nodelay");
				await target.draw();
			} else {
				await player.loseHp();
				await target.loseHp();
			}
		},
	},
};
