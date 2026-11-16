import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbyouyi" | "dcsbfangong">} */
export const groupSkills = {
	//谋王平
	dcsbyouyi: {
		audio: 2,
		trigger: {
			target: "useCardToTarget",
		},
		filter(event, player) {
			if (!event.player.isIn()) {
				return false;
			}
			if (!get.tag(event.card, "damage") || event.player == player) {
				return false;
			}
			if (!player.getStorage("dcsbyouyi_used")?.length) {
				return true;
			}
			let storage = player.getStorage("dcsbyouyi_used");
			if (!storage.includes("discard")) {
				return player.countDiscardableCards("he");
			}
			if (!storage.includes("loseHp")) {
				return true;
			}
			return false;
		},
		async cost(event, trigger, player) {
			let choiceList = ["弃置任意张牌，本回合结束时摸等量牌。", "失去至多3点体力，令一名角色摸等量牌，本回合结束时回复等量体力。"];
			let controlList = ["弃置牌", "失去体力", "cancel2"];
			for (let i of [0, 1]) {
				let list = ["discard", "loseHp"];
				let bool1 = player.getStorage("dcsbyouyi_used")?.includes(list[i]);
				let bool2 = i == 0 ? Boolean(!player.countDiscardableCards("he")) : false;
				if (bool1 || bool2) {
					if (bool1) choiceList[i] += "（已发动）";
					else choiceList[i] += "（无法执行）";
					choiceList[i] = `<span style="opacity:0.5">'${choiceList[i]}</span>`;
					controlList[i] = "";
				}
			}
			controlList = controlList.filter(i => i != "");
			const result = await player
				.chooseControl({
					prompt: get.prompt("dcsbyouyi"),
					controls: controlList,
					choiceList: choiceList,
					ai: () => {
						const { player, list } = get.event();
						if (
							list.includes("弃置牌") &&
							player.countCards("he", i => {
								if (["wuxie", "shan", "tao"].includes(get.name(i, player))) {
									return false;
								}
								let val = 5 - get.value(i, player);
								if (player.getStorage("dcsbfangong")) {
									val += 1;
								}
								return val >= 3;
							})
						) {
							return "弃置牌";
						}
						if (list.includes("失去体力") && player.hp >= 3) {
							return "失去体力";
						}
						return "cancel2";
					},
				})
				.set("list", choiceList)
				.forResult();
			event.result = {
				bool: result.control != "cancel2",
				cost_data: result.control,
			};
		},
		async content(event, trigger, player) {
			const user = trigger.player;
			if (!user.isIn()) {
				return;
			}
			player.line(user);
			user.addTempSkill("dcsbyouyi_sha");
			user.addMark("dcsbyouyi_sha");
			const control = event.cost_data;
			if (control == "弃置牌") {
				const result = await player
					.chooseToDiscard({
						position: "he",
						selectCard: [1, Infinity],
						forced: true,
						ai: card => {
							const player = get.player();
							if (["wuxie", "shan", "tao"].includes(get.name(card, player))) {
								return 0;
							}
							let val = 5 - get.value(card, player);
							if (player.getStorage("dcsbfangong")) {
								val += 1;
							}
							if (val < 3) val = 0;
							return val;
						},
					})
					.forResult();
				player.addTempSkill("dcsbyouyi_used");
				player.markAuto("dcsbyouyi_used", ["discard"]);
				if (!player.storage["dcsbyouyi_eff"]) {
					player.storage["dcsbyouyi_eff"] = {
						draw: 0,
						recover: 0,
						sum: 0,
					};
				}
				player.storage["dcsbyouyi_eff"].draw += result.cards.length;
				player.storage["dcsbyouyi_eff"].sum += result.cards.length;
			} else {
				const result = await player
					.chooseControl({
						controls: ["1", "2", "3"],
						prompt: "选择失去的体力值",
						ai: () => {
							const player = get.player();
							return String(Math.min(3, Math.max(1, player.hp - 2)));
						},
					})
					.forResult();
				const num = Number(result.control);
				await player.loseHp(num);
				const result1 = await player
					.chooseTarget({
						prompt: `令一名角色摸${get.cnNumber(num)}张牌`,
						forced: true,
						ai: target => {
							return get.attitude(get.player(), target);
						},
					})
					.forResult();
				const target = result1.targets[0];
				await target.draw(num);
				player.addTempSkill("dcsbyouyi_used");
				player.markAuto("dcsbyouyi_used", ["loseHp"]);
				if (!player.storage["dcsbyouyi_eff"]) {
					player.storage["dcsbyouyi_eff"] = {
						draw: 0,
						recover: 0,
						sum: 0,
					};
				}
				player.storage["dcsbyouyi_eff"].recover += num;
				player.storage["dcsbyouyi_eff"].sum += num;
			}
			const sum = player.storage["dcsbyouyi_eff"]?.sum;
			if (!sum) {
				return;
			}
			if (sum >= 7) {
				player.storage["dcsbyouyi_eff"].sum = sum % 7;
				game.log(player, "重置了", "#g【返攻】");
				player.restoreSkill("dcsbfangong");
			}
		},
		group: "dcsbyouyi_eff",
		subSkill: {
			sha: {
				charlotte: true,
				mark: true,
				intro: {
					content: "本回合使用【杀】次数+#",
				},
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("dcsbyouyi_sha");
						}
					},
				},
				onremove: true,
				sub: true,
				sourceSkill: "dcsbyouyi",
			},
			used: {
				charlotte: true,
				sub: true,
				mark: true,
				intro: {
					content(storage, player) {
						let str = "";
						if (!player.storage["dcsbyouyi_eff"]) {
							return str;
						}
						const { draw, recover } = player.storage["dcsbyouyi_eff"];
						if (draw) str += `<li>本回合结束时，摸${draw}张牌。`;
						if (draw && recover) str += "<br>";
						if (recover) str += `<li>本回合结束时，回复${recover}点体力。`;
						return str;
					},
				},
				onremove: true,
				sourceSkill: "dcsbyouyi",
			},
			eff: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: {
					global: ["phaseEnd", "phaseBeginStart"],
				},
				filter(event, player) {
					if (!player.storage["dcsbyouyi_eff"]) return false;
					const { draw, recover } = player.storage["dcsbyouyi_eff"];
					return draw || recover;
				},
				async content(event, trigger, player) {
					if (!player.storage["dcsbyouyi_eff"]) return;
					if (event.triggername == "phaseEnd") {
						const { draw, recover } = player.storage["dcsbyouyi_eff"];
						if (draw) player.draw(draw);
						if (recover) player.recover(recover);
					} else {
						player.storage["dcsbyouyi_eff"].draw = 0;
						player.storage["dcsbyouyi_eff"].recover = 0;
					}
				},
				sub: true,
				sourceSkill: "dcsbyouyi",
			},
		},
	},
	dcsbfangong: {
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		async content(event, trigger, player) {
			player.awakenSkill(event.name, true);
			await player.recoverTo(player.maxHp);
			await player.draw(Math.min(5, player.countCards("h")));
		},
		mark: true,
		intro: {
			content(storage, player) {
				let str = "";
				if (!storage) str += "限定技【返攻】未发动";
				else str += "限定技【返攻】已发动";
				let storage1 = player.storage["dcsbyouyi_eff"];
				if (!storage1) return str;
				str += "<br>";
				const sum = storage1.sum;
				str += `<br><li>再通过【诱夷】弃置${7 - sum}张牌或失去${7 - sum}点体力后刷新【返攻】。`;
				return str;
			},
		},
		init: (player, skill) => (player.storage[skill] = false),
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
	},
};
