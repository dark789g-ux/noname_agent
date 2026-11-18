import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbsushen" | "dcsbrushi" | "dcsbfumou">} */
export const groupSkills = {
	//谋贾诩
	dcsbsushen: {
		limited: true,
		audio: 2,
		audioname: ["dc_sb_jiaxu_shadow"],
		enable: "phaseUse",
		skillAnimation: true,
		animationColor: "soil",
		content() {
			player.awakenSkill(event.name);
			player.storage.dcsbsushen_reload = [Boolean(player.storage.dcsbfumou), player.countCards("h"), player.getHp()];
			player.addSkill("dcsbsushen_reload");
			player.addSkills("dcsbrushi");
		},
		derivation: "dcsbrushi",
		subSkill: {
			reload: {
				charlotte: true,
				onremove: true,
				mark: true,
				intro: {
					content(storage) {
						return ["【覆谋】状态：" + ["阳", "阴"][storage[0] ? 1 : 0], "手牌数：" + storage[1], "体力值：" + storage[2]].join("<br>");
					},
				},
			},
		},
		ai: {
			//waiting for PZ157
		},
	},
	dcsbrushi: {
		limited: true,
		audio: 2,
		audioname: ["dc_sb_jiaxu_shadow"],
		enable: "phaseUse",
		filter(event, player) {
			return Array.isArray(player.storage.dcsbsushen_reload);
		},
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			const storage = player.storage.dcsbsushen_reload;
			player.awakenSkill(event.name);
			player.removeSkill("dcsbsushen_reload");
			if (Boolean(player.storage.dcsbfumou) !== storage[0]) {
				if (player.hasSkill("dcsbfumou", null, null, false)) {
					player.changeZhuanhuanji("dcsbfumou");
				}
			}
			if (player.countCards("h") != storage[1]) {
				if (player.countCards("h") < storage[1]) {
					await player.drawTo(storage[1]);
				} else {
					await player.chooseToDiscard("h", true, player.countCards("h") - storage[1], "allowChooseAll");
				}
			}
			if (player.getHp() != storage[2]) {
				await player[player.getHp() > storage[2] ? "loseHp" : "recover"](Math.abs(player.getHp() - storage[2]));
			}
			if (player.getStat("skill").dcsbfumou) {
				delete player.getStat("skill").dcsbfumou;
			}
		},
		ai: {
			//waiting for PZ157
		},
	},
	dcsbfumou: {
		audio: 2,
		audioname: ["dc_sb_jiaxu_shadow"],
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => {
				return target != player && target.countCards("h");
			});
		},
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			if (!ui.selected.targets.length) {
				return target.countCards("h");
			}
			return !player.storage.dcsbfumou && game.countPlayer(target => target != player) > 1;
		},
		selectTarget() {
			const player = get.event().player;
			if (game.countPlayer(target => target != player) == 1) {
				return [1, 2];
			}
			return player.storage.dcsbfumou ? [1, 2] : 2;
		},
		targetprompt() {
			const player = get.event().player;
			if (game.countPlayer(target => target != player) == 1) {
				return "";
			}
			return player.storage.dcsbfumou ? "" : ["看牌角色", "得牌角色"][ui.selected.targets.length - 1];
		},
		prompt() {
			const player = get.event().player;
			return lib.skill.dcsbfumou.intro.content(player.storage.dcsbfumou);
		},
		usable: 1,
		complexTarget: true,
		complexSelect: true,
		multitarget: true,
		async content(event, trigger, player) {
			const storage = player.storage.dcsbfumou,
				target = event.targets[0],
				num = Math.ceil(target.countCards("h") / 2);
			player.changeZhuanhuanji("dcsbfumou");
			let { cards } = await player
				.choosePlayerCard("覆谋：选择展示" + get.translation(target) + "的至多" + get.cnNumber(num) + "张牌", target, "h", [1, num], true)
				.set("ai", card => {
					const player = get.event().player,
						storage = get.event().storage,
						target = get.event().getParent().targets[0];
					if (!storage) {
						return get.value(card) * -get.attitude(player, target);
					}
					return target.getUseValue(card, false) * get.attitude(player, target);
				})
				.set("visible", true)
				.set("storage", storage)
				.forResult();
			if (!cards.length) {
				return;
			}
			await player.showCards(cards, get.translation(player) + "发动了【覆谋】");
			if (!storage) {
				const aim = event.targets[1];
				if (aim) {
					cards = cards.filter(card => lib.filter.canBeGained(card, aim, target));
					if (cards.length) {
						await aim.gain(cards, target, "give");
						await game.asyncDraw([player, target], cards.length);
					} else {
						aim.popup("杯具");
						aim.chat("555一张都拿不到");
					}
				} else {
					player.chat("只是看看，但给不了...");
				}
			} else {
				for (const card of cards) {
					if (target.hasUseTarget(card, false)) {
						await target.chooseUseTarget(card, true, false, "nodistance").set("oncard", card => {
							game.log(_status.event.card, "不可被响应");
							_status.event.directHit.addArray(game.players);
						});
					}
				}
			}
		},
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			player.changeSkin({ characterName: "dc_sb_jiaxu" }, "dc_sb_jiaxu" + (player.storage[skill] ? "_shadow" : ""));
		},
		marktext: "☯",
		mark: true,
		intro: {
			content(storage) {
				if (storage) {
					return "转换技，出牌阶段限一次，你可以观看一名其他角色的手牌并展示其至多一半手牌，令其依次使用这些牌中所有其可以使用的牌（无距离限制且不可被响应）。";
				}
				return "转换技，出牌阶段限一次，你可以观看一名其他角色A的手牌并展示其至多一半手牌并将这些牌交给另一名其他角色B，然后你与A各摸X张牌（X为A以此法失去的手牌数）。";
			},
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					const storage = player.storage.dcsbfumou;
					if (!storage && !ui.selected.targets.length) {
						return Math.ceil(target.countCards("h") / 2);
					}
					return 0;
				},
				target(player, target) {
					const storage = player.storage.dcsbfumou;
					if (storage) {
						return target.countCards("h") * get.threaten(target, player);
					}
					let att = get.attitude(player, target);
					if (!ui.selected.targets.length) {
						if (
							att > 0 &&
							game.hasPlayer(cur => {
								return cur !== player && cur !== target && get.attitude(player, cur) > 0;
							})
						) {
							return target.countCards("h") / get.threaten(target, player) / 10;
						}
						return -Math.ceil(target.countCards("h") / 2);
					}
					return Math.ceil(ui.selected.targets[0].countCards("h") / 2);
				},
			},
		},
		group: "dcsbfumou_change",
		subSkill: {
			change: {
				audio: "dcsbfumou",
				audioname: ["dc_sb_jiaxu_shadow"],
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				prompt2(event, player) {
					return "切换【覆谋】为状态" + (player.storage.dcsbfumou ? "阳" : "阴");
				},
				check: (event, player) => player.storage.dcsbfumou,
				content() {
					player.changeZhuanhuanji("dcsbfumou");
				},
			},
		},
	},
};
