import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twbeiding" | "twjielv" | "twhunyou" | "twhuanji" | "twchanggui">} */
export const groupSkills = {
	//幻诸葛亮
	twbeiding: {
		audio: 2,
		audioname: ["huan_zhugeliang_shadow"],
		intro: {
			content: "已记录牌名：$",
		},
		mod: {
			targetInRange(card, player, target) {
				if (!player.storage.isInHuan) {
					return;
				}
				if (
					player
						.getStorage("twbeiding")
						.map(i => i[0].name)
						.includes(card.name)
				) {
					return true;
				}
			},
		},
		locked: false,
		onremove: true,
		derivation: "twbeidingx",
		group: ["twbeiding_record", "twbeiding_use", "twbeiding_huan"],
		subSkill: {
			record: {
				audio: "twbeiding",
				trigger: {
					global: "phaseZhunbeiBegin",
				},
				filter(event, player) {
					if (player.storage.isInHuan) {
						return false;
					}
					return (
						player.getHp() > 0 &&
						get.inpileVCardList(info => {
							if (!["basic", "trick"].includes(info[0])) {
								return false;
							}
							return !player
								.getStorage("twbeiding")
								.map(i => i[0].name)
								.includes(info[2]);
						}).length
					);
				},
				async cost(event, trigger, player) {
					const num = player.getHp(),
						vcards = get.inpileVCardList(info => {
							if (!["basic", "trick"].includes(info[0])) {
								return false;
							}
							return !player
								.getStorage("twbeiding")
								.map(i => i[0].name)
								.includes(info[2]);
						});
					const { bool, links } = await player
						.chooseButton(
							[
								`${get.translation(event.name.slice(0, -5))}：你可以声明并记录至多${get.cnNumber(num)}个未以此法记录的牌名`,
								[vcards, "vcard"],
							],
							[1, num]
						)
						.set("filterButton", button => {
							return !ui.selected.buttons.some(buttonx => buttonx.link[2] == "sha") || button.link[2] != "sha";
						})
						.set("ai", button => {
							const player = get.player();
							return player.getUseValue({ name: button.link[2], nature: button.link[3] });
						})
						.forResult();
					event.result = {
						bool: bool,
						cost_data: links,
					};
				},
				async content(event, trigger, player) {
					const names = event.cost_data.map(link => [{ name: link[2], nature: link[3] }]);
					game.log(player, "声明了", "#g" + get.translation(names));
					player.markAuto("twbeiding", names);
					player.markAuto("twbeiding_use", names);
				},
			},
			use: {
				audio: "twbeiding",
				trigger: {
					global: "phaseDiscardEnd",
				},
				filter(event, player) {
					if (player.storage.isInHuan) {
						return false;
					}
					const target = _status.currentPhase;
					if (!target || !target.isIn() || event.player != target) {
						return false;
					}
					return player.getStorage("twbeiding_use").length;
				},
				forced: true,
				async content(event, trigger, player) {
					const target = _status.currentPhase,
						storage = player.getStorage(event.name);
					while (storage.length) {
						const name = storage.shift(),
							card = get.autoViewAs({ name: name[0].name, nature: name[0].nature, isCard: true });
						if ((!get.info(card).notarget || !lib.filter.cardEnabled(card, player)) && !player.hasUseTarget(card, false)) {
							continue;
						}
						const { targets } = await player
							.chooseUseTarget(
								`请选择${get.translation(card)}的目标，若此牌的目标不包含${get.translation(target)}，则其摸一张牌`,
								card,
								true,
								false,
								"nodistance"
							)
							.forResult();
						if (!targets.includes(target) && target.isIn()) {
							await target.draw();
						}
					}
					player.storage[event.name] = [];
					player.unmarkSkill(event.name);
				},
				intro: {
					content: "本回合新增牌名：$",
				},
			},
			huan: {
				audio: "twbeiding",
				trigger: {
					player: ["useCard1", "useCardAfter"],
				},
				filter(event, player, name) {
					if (!player.storage.isInHuan) {
						return false;
					}
					if (
						!player
							.getStorage("twbeiding")
							.map(i => i[0].name)
							.includes(event.card.name)
					) {
						return false;
					}
					return name == "useCardAfter" || (name == "useCard1" && event.addCount !== false);
				},
				forced: true,
				async content(event, trigger, player) {
					if (event.triggername == "useCard1") {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] == "number") {
							stat[name]--;
						}
					} else {
						await player.draw();
						player.unmarkAuto(
							"twbeiding",
							player.getStorage("twbeiding").filter(i => i[0].name == trigger.card.name)
						);
					}
				},
			},
		},
	},
	twjielv: {
		audio: 2,
		audioname: ["huan_zhugeliang_shadow"],
		derivation: "twjielvx",
		group: ["twjielv_lose", "twjielv_buff", "twjielv_huan"],
		locked: true,
		ai: { halfneg: true },
		subSkill: {
			lose: {
				audio: "twjielv",
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					if (player.storage.isInHuan) {
						return false;
					}
					return !player.hasHistory("useCard", evt => evt.targets?.some(i => i == event.player));
				},
				forced: true,
				async content(event, trigger, player) {
					await player.loseHp();
				},
			},
			buff: {
				audio: "twjielv",
				trigger: { player: ["loseHpEnd", "damageEnd"] },
				filter(event, player) {
					if (player.storage.isInHuan) {
						return false;
					}
					return player.maxHp < 7 && event.num > 0;
				},
				forced: true,
				getIndex: event => event.num,
				async content(event, trigger, player) {
					await player.gainMaxHp();
				},
			},
			huan: {
				audio: "twjielv",
				trigger: { player: "loseMaxHpEnd" },
				filter(event, player) {
					if (!player.storage.isInHuan) {
						return false;
					}
					return event.num > 0 && player.isDamaged();
				},
				forced: true,
				getIndex: event => event.num,
				async content(event, trigger, player) {
					await player.recover();
				},
			},
		},
	},
	twhunyou: {
		audio: 2,
		limited: true,
		enable: "chooseToUse",
		filter(event, player) {
			return event.type == "dying" && event.dying == player;
		},
		skillAnimation: true,
		animationColor: "orange",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recoverTo(1);
			player.addTempSkill(event.name + "_buff");
			if (!_status.currentPhase) {
				return;
			}
			player.when({ global: "phaseAfter" }).step(async (event, trigger, player) => {
				player.insertPhase("twhunyou");
				player.storage.isInHuan = true;
				player.changeSkin({ characterName: "huan_zhugeliang" }, "huan_zhugeliang_shadow");
				player.changeSkills(get.info("twhunyou").derivation, ["twhunyou"]);
			});
		},
		derivation: ["twhuanji", "twchanggui"],
		subSkill: {
			buff: {
				audio: "twhunyou",
				trigger: { player: ["damageBefore", "loseHpBefore"] },
				forced: true,
				charlotte: true,
				async content(event, trigger, player) {
					trigger.cancel();
					game.log(player, "防止此次了" + (trigger.name == "damage" ? "伤害" : "失去体力"));
				},
				ai: {
					nofire: true,
					nothunder: true,
					nodamage: true,
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "damage")) {
								return "zeroplayertarget";
							}
						},
					},
				},
				mark: true,
				intro: { content: "我是无敌的" },
			},
		},
		ai: {
			order: 1,
			save: true,
			skillTagFilter(player, tag, target) {
				if (player != target || player.storage.twhunyou) {
					return false;
				}
			},
			result: { player: 1 },
		},
	},
	twhuanji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				player.getHp() > 0 &&
				get.inpileVCardList(info => {
					if (!["basic", "trick"].includes(info[0])) {
						return false;
					}
					return !player
						.getStorage("twbeiding")
						.map(i => i[0].name)
						.includes(info[2]);
				}).length
			);
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(info => {
					if (!["basic", "trick"].includes(info[0])) {
						return false;
					}
					return !player
						.getStorage("twbeiding")
						.map(i => i[0].name)
						.includes(info[2]);
				});
				return ui.create.dialog(get.translation("twhuanji"), [list, "vcard"], "hidden");
			},
			filter(button) {
				return !ui.selected.buttons.some(buttonx => buttonx.link[2] == "sha") || button.link[2] != "sha";
			},
			check(button, player) {
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			select() {
				return [1, get.player().getHp()];
			},
			backup(links, player) {
				return {
					audio: "twhuanji",
					names: links.map(i => [{ name: i[2], nature: i[3] }]),
					filterCard: () => false,
					selectCard: -1,
					async content(event, trigger, player) {
						const names = lib.skill[event.name].names;
						await player.loseMaxHp();
						game.log(player, "声明了", "#g" + get.translation(names));
						player.markAuto("twbeiding", names);
					},
				};
			},
			prompt(links, player) {
				const names = links.map(i => i[2]);
				return `减少1点体力上上限并记录${get.translation(names)}`;
			},
		},
		ai: {
			order: 10,
			result: {
				player(player) {
					if (player.maxHp > 2) {
						return 1;
					}
					return 0;
				},
			},
			combo: "twbeiding",
		},
		subSkill: {
			backup: {},
		},
	},
	twchanggui: {
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			return player.isMinHp() && player.maxHp != player.getHp();
		},
		forced: true,
		async content(event, trigger, player) {
			const num = player.maxHp - player.getHp();
			await player[num > 0 ? "loseMaxHp" : "gainMaxHp"](Math.abs(num));
			delete player.storage.isInHuan;
			player.changeSkin({ characterName: "huan_zhugeliang" }, "huan_zhugeliang");
			await player.changeSkills(["twhunyou"], get.info("twhunyou").derivation);
		},
	},
};
