import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "youlong" | "luanfeng">} */
export const groupSkills = {
	//卧龙凤雏双头祈福
	youlong: {
		enable: "chooseToUse",
		audio: 2,
		audioname: ["key_sakuya"],
		zhuanhuanji: true,
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				return `每轮限一次，你可以废除你的一个装备栏，视为使用一张未以此法使用过的${storage ? "基本" : "普通锦囊"}牌。`;
			},
		},
		init(player) {
			player.storage.youlong = false;
			if (!player.storage.youlong2) {
				player.storage.youlong2 = [];
			}
		},
		hiddenCard(player, name) {
			if (!player.hasEnabledSlot()) {
				return false;
			}
			if (get.inpileVCardList().some(info => info[2] === name && player.getStorage("youlong2").some(item => item.name === info[2] && item.nature === info[3]))) {
				return false;
			}
			if (player.getStorage("youlong_used").includes(player.storage.youlong || false)) {
				return false;
			}
			const type = get.type(name);
			if (player.storage.youlong) {
				return type == "basic";
			}
			return type == "trick";
		},
		filter(event, player) {
			if (!player.hasEnabledSlot()) {
				return false;
			}
			if (player.getStorage("youlong_used").includes(player.storage.youlong || false)) {
				return false;
			}
			const type = player.storage.youlong ? "basic" : "trick";
			return get.inpileVCardList(info => {
				if (info[0] != type) {
					return false;
				}
				if (player.getStorage("youlong2").some(item => item.name === info[2] && item.nature === info[3])) {
					return false;
				}
				return event.filterCard({ name: info[2], nature: info[3], isCard: true }, player, event);
			}).length;
		},
		chooseButton: {
			dialog(event, player) {
				const dialog = ui.create.dialog("游龙", "hidden");
				const equips = [];
				for (let i = 1; i < 6; i++) {
					if (!player.hasEnabledSlot(i)) {
						continue;
					}
					equips.push([i, get.translation("equip" + i)]);
				}
				if (equips.length > 0) {
					dialog.add([equips, "tdnodes"]);
				}
				const type = player.storage.youlong ? "basic" : "trick";
				const list = get.inpileVCardList(info => {
					if (info[0] != type) {
						return false;
					}
					if (player.getStorage("youlong2").some(item => item.name === info[2] && item.nature === info[3])) {
						return false;
					}
					return event.filterCard({ name: info[2], nature: info[3], isCard: true }, player, event);
				});
				dialog.add([list, "vcard"]);
				return dialog;
			},
			filter(button) {
				if (ui.selected.buttons.length && typeof button.link == typeof ui.selected.buttons[0].link) {
					return false;
				}
				return true;
			},
			select: 2,
			check(button) {
				const player = get.player();
				if (typeof button.link == "number") {
					const card = player.getEquip(button.link);
					if (card) {
						const val = get.value(card);
						if (val > 0) {
							return 0;
						}
						return 5 - val;
					}
					switch (button.link) {
						case 3:
							return 4.5;
						case 4:
							return 4.4;
						case 5:
							return 4.3;
						case 2:
							return (3 - player.hp) * 1.5;
						case 1: {
							if (
								game.hasPlayer(current => {
									return (get.realAttitude || get.attitude)(player, current) < 0 && get.distance(player, current) > 1;
								})
							) {
								return 0;
							}
							return 3.2;
						}
					}
				}
				const name = button.link[2];
				const evt = get.event().getParent();
				if (evt.type == "phase") {
					const card = { name: name, nature: button.link[3], isCard: true };
					if (name == "shan") {
						return 2;
					}
					if (evt.type == "dying") {
						if (get.attitude(player, evt.dying) < 2) {
							return false;
						}
						if (name == "jiu") {
							return 2.1;
						}
						return 1.9;
					}
					return player.getUseValue(card);
				}
				return 1;
			},
			backup(links, player) {
				if (typeof links[1] == "number") {
					links.reverse();
				}
				const equip = links[0];
				const name = links[1][2];
				const nature = links[1][3];
				return {
					filterCard: () => false,
					selectCard: -1,
					equip: equip,
					viewAs: {
						name: name,
						nature: nature,
						isCard: true,
					},
					popname: true,
					log: false,
					async precontent(event, trigger, player) {
						player.logSkill("youlong");
						await player.disableEquip(lib.skill.youlong_backup.equip);
						player.addTempSkill("youlong_used", "roundStart");
						player.markAuto("youlong_used", [player.storage.youlong || false]);
						player.changeZhuanhuanji("youlong");
						player.storage.youlong2.add(event.result.card);
					},
				};
			},
			prompt(links, player) {
				if (typeof links[1] == "number") {
					links.reverse();
				}
				const equip = "equip" + links[0];
				const name = links[1][2];
				const nature = links[1][3];
				return "废除自己的" + get.translation(equip) + "栏，视为使用" + (get.translation(nature) || "") + get.translation(name);
			},
		},
		ai: {
			respondSha: true,
			respondShan: true,
			fireAttack: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				if (!player.storage.youlong || player.getStorage("youlong_used").includes(true)) {
					return false;
				}
				const name = tag == "respondSha" ? "sha" : "shan";
				if (name == "shan") {
					if (player.getStorage("youlong2").some(item => item.name === "shan")) {
						return false;
					}
				} else if (name == "sha") {
					if ([undefined].concat(lib.inpile_nature.slice(0)).every(nature => player.getStorage("youlong2").some(item => item.name === "sha" && item.nature === nature))) {
						return false;
					}
				} else if (tag == "fireAttack") {
					const type = player.storage.youlong ? "basic" : "trick";
					return get
						.inpileVCardList(info => {
							if (info[0] != type) {
								return false;
							}
							return !player.getStorage("youlong2").some(item => item.name === info[2] && item.nature === info[3]);
						})
						.some(info => {
							return get.tag({ name: info[2], nature: info[3], isCard: true }, "fireDamage");
						});
				}
			},
			order(item, player) {
				if (player && _status.event.type == "phase") {
					let max = 0,
						add = false;
					const type = player.storage.youlong ? "basic" : "trick";
					let list = get
						.inpileVCardList(info => {
							if (info[0] != type) {
								return false;
							}
							return !player.getStorage("youlong2").some(item => item.name === info[2] && item.nature === info[3]);
						})
						.map(info => {
							return { name: info[2], nature: info[3], isCard: true };
						});
					for (const card of list) {
						if (player.getUseValue(card) > 0) {
							const temp = get.order(card);
							if (temp > max) {
								max = temp;
							}
						}
					}
					if (max > 0) {
						max += 0.3;
					}
					return max;
				}
				return 1;
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: { used: { charlotte: true, onremove: true } },
	},
	luanfeng: {
		audio: 2,
		audioname: ["key_sakuya"],
		trigger: { global: "dying" },
		filter(event, player) {
			return event.player.maxHp >= player.maxHp && event.player.hp < 1;
		},
		limited: true,
		skillAnimation: true,
		animationColor: "soil",
		logTarget: "player",
		check(event, player) {
			if (get.attitude(player, event.player) < 4) {
				return false;
			}
			if (
				player.countCards("h", function (card) {
					var mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (mod2 != "unchanged") {
						return mod2;
					}
					var mod = game.checkMod(card, player, event.player, "unchanged", "cardSavable", player);
					if (mod != "unchanged") {
						return mod;
					}
					var savable = get.info(card).savable;
					if (typeof savable == "function") {
						savable = savable(card, player, event.player);
					}
					return savable;
				}) >=
				1 - event.player.hp
			) {
				return false;
			}
			if (event.player == player || event.player == get.zhu(player)) {
				return true;
			}
			return !player.hasUnknown();
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			trigger.player.recover(3 - trigger.player.hp);
			"step 1";
			var list = [],
				target = trigger.player;
			for (var i = 1; i < 6; i++) {
				for (var j = 0; j < target.countDisabledSlot(i); j++) {
					list.push(i);
				}
			}
			if (list.length > 0) {
				target.enableEquip(list);
			}
			if (list.length < 6) {
				target.drawTo(6 - list.length);
			}
			if (target.storage.kotarou_rewrite) {
				target.storage.kotarou_rewrite = [];
			}
			if (player == target) {
				player.storage.youlong2 = [];
			}
		},
	},
};
