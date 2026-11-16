import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twxingshang">} */
export const groupSkills = {
	//不想你，出生牢丕
	//想你了，牢丕😭
	twxingshang: {
		getLimit: 9,
		getList: [
			{
				cost: 2,
				prompt: () => "令一名角色复原武将牌",
				filter: () => game.hasPlayer(target => target.isLinked() || target.isTurnedOver()),
				filterTarget: {
					filterTarget: (card, player, target) => target.isLinked() || target.isTurnedOver(),
				},
				async content(player, target) {
					if (target.isLinked()) {
						await target.link(false);
					}
					if (target.isTurnedOver()) {
						await target.turnOver(false);
					}
				},
				ai: {
					result: {
						target(player, target) {
							let res = 0;
							if (target.isLinked()) {
								res = 0.3;
							}
							if (target.isTurnedOver()) {
								res += 3.5 * get.threaten(target, player);
							}
							return res;
						},
					},
				},
			},
			{
				cost: 2,
				prompt: () => "令一名角色摸" + get.cnNumber(Math.min(5, Math.max(2, game.dead.length))) + "张牌",
				filter: () => true,
				filterTarget: {
					filterTarget: true,
				},
				async content(player, target) {
					await target.draw(Math.min(5, Math.max(2, game.dead.length)));
				},
				ai: {
					result: {
						player(player, target) {
							return get.effect(target, { name: "draw" }, player, player) * Math.min(5, Math.max(2, game.dead.length));
						},
					},
				},
			},
			{
				cost: 5,
				prompt: () => "令一名体力上限小于10的角色回复1点体力，增加1点体力上限，随机恢复一个废除的装备栏",
				filter: () => game.hasPlayer(target => target.maxHp < 10),
				filterTarget: {
					filterTarget: (card, player, target) => target.maxHp < 10,
				},
				async content(player, target) {
					await target.recover();
					await target.gainMaxHp();
					let list = Array.from({ length: 13 }).map((_, i) => "equip" + parseFloat(i + 1));
					list = list.filter(i => target.hasDisabledSlot(i));
					if (list.length) {
						await target.enableEquip(list.randomGet());
					}
				},
				ai: {
					result: {
						target(player, target) {
							let res = 0.2;
							if (target.isHealthy()) {
								res += 0.4;
							}
							if (
								Array.from({ length: 5 })
									.map((_, i) => "equip" + parseFloat(i + 1))
									.some(i => target.hasDisabledSlot(i))
							) {
								res += 0.3;
							}
							return res + get.recoverEffect(target, target, target) / 16;
						},
					},
				},
			},
			{
				cost: 5,
				prompt: () => "获得一名已阵亡角色的武将牌上的所有技能，然后失去〖行殇〗〖放逐〗〖颂威〗",
				filter: () => game.dead.some(target => target.getStockSkills(true, true).some(i => get.info(i) && !get.info(i).charlotte)),
				filterTarget: {
					filterTarget(card, player, target) {
						if (!target.isDead()) {
							return false;
						}
						return target.getStockSkills(true, true).some(i => get.info(i) && !get.info(i).charlotte);
					},
					deadTarget: true,
				},
				async content(player, target) {
					await player.changeSkills(
						target.getStockSkills(true, true).filter(skill => get.info(skill) && !get.info(skill).charlotte),
						["twxingshang", "twfangzhu", "twsongwei"]
					);
				},
				ai: {
					result: {
						player(player, target) {
							return ["name", "name1", "name2"].reduce((sum, name) => {
								if (!target[name] || !lib.character[target[name]] || (name == "name1" && target.name1 == target.name)) {
									return sum;
								}
								return sum + get.rank(target[name], true);
							}, 0);
						},
					},
				},
			},
		],
		marktext: "颂",
		intro: {
			name: "颂",
			content: "mark",
		},
		audio: "sbxingshang",
		enable: "phaseUse",
		filter(event, player) {
			return get.info("twxingshang").getList.some(effect => {
				return player.countMark("twxingshang") >= effect.cost && effect.filter(player);
			});
		},
		usable: 2,
		chooseButton: {
			dialog() {
				let dialog = ui.create.dialog("行殇：请选择一项", "hidden");
				const list = get.info("twxingshang").getList.slice();
				dialog.add([
					list.map(effect => {
						return [effect, "移去" + effect.cost + "个“颂”标记，" + effect.prompt()];
					}),
					"textbutton",
				]);
				return dialog;
			},
			filter(button, player) {
				const effect = button.link;
				return player.countMark("twxingshang") >= effect.cost && effect.filter(player);
			},
			check(button) {
				const player = get.event().player,
					effect = button.link;
				return Math.max(
					...game
						.filterPlayer(target => {
							const filterTarget = effect.filterTarget.filterTarget;
							if (!filterTarget) {
								return target == player;
							}
							if (typeof filterTarget == "function") {
								return filterTarget(null, player, target);
							}
							return true;
						})
						.map(target => {
							game.broadcastAll(effect => (lib.skill["twxingshang_aiSkill"].ai = effect.ai || {}), effect);
							return get.effect(target, "twxingshang_aiSkill", player, player);
						})
				);
			},
			backup(links, player) {
				const effect = links[0];
				return {
					effect: effect,
					audio: "sbxingshang",
					filterCard: () => false,
					selectCard: -1,
					...effect.filterTarget,
					async content(event, trigger, player) {
						const effect = lib.skill.twxingshang_backup.effect;
						player.removeMark("twxingshang", effect.cost);
						await effect.content(player, ...event.targets);
					},
					ai: effect.ai,
				};
			},
			prompt(links, player) {
				const effect = links[0],
					str = "###行殇###";
				return str + '<div class="text center">' + "移去" + effect.cost + "个“颂”标记，" + effect.prompt() + "</div>";
			},
		},
		ai: {
			order: 6.5,
			result: {
				player(player) {
					const list = get.info("twxingshang").getList.filter(effect => {
						return player.countMark("twxingshang") >= effect.cost && effect.filter(player);
					});
					return Math.max(
						...list.map(effect => {
							return Math.max(
								...game
									.filterPlayer(target => {
										const filterTarget = effect.filterTarget.filterTarget;
										if (!filterTarget) {
											return target == player;
										}
										if (typeof filterTarget == "function") {
											return filterTarget(null, player, target);
										}
										return true;
									})
									.map(target => {
										game.broadcastAll(effect => (lib.skill["twxingshang_aiSkill"].ai = effect.ai || {}), effect);
										return get.effect(target, "twxingshang_aiSkill", player, player);
									})
							);
						})
					);
				},
			},
		},
		group: "twxingshang_gain",
		subSkill: {
			aiSkill: {},
			backup: {},
			gain: {
				audio: "sbxingshang",
				trigger: { global: ["die", "damageEnd"] },
				filter(event, player) {
					if (player.countMark("twxingshang") >= get.info("twxingshang").getLimit) {
						return false;
					}
					return event.name == "die" || !player.getHistory("custom", evt => evt.twxingshang).length;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					player.addMark("twxingshang", Math.min(2, get.info("twxingshang").getLimit - player.countMark("twxingshang")));
					if (trigger.name == "damage") {
						player.getHistory("custom").push({ twxingshang: true });
					}
				},
			},
		},
	},
};
