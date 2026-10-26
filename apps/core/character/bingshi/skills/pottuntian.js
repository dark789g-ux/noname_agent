import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "pottuntian" | "potzaoxian" | "potjixi" | "mbsizi" | "mbxiezhi" | "mbyunan" | "mbkechang">} */
export const groupSkills = {
	//势邓艾·重做
	pottuntian: {
		audio: 2,
		chargeSkill: 0,
		locked: false,
		forced: true,
		group: ["pottuntian_phaseUse"],
		trigger: {
			player: "loseAfter",
			global: ["loseAsyncAfter", "gainAfter", "addToExpansionAfter", "addJudgeAfter", "equipAfter", "phaseBegin"],
		},
		filter(event, player) {
			if (event.name == "phase") {
				return !player.countCharge(true);
			}
			if (!event.getl?.(player)?.cards2.some(card => !get.is.damageCard(card)) || !player.countCharge(true)) {
				return false;
			}
			const cards = event.getl(player).cards2;
			return event.getParent()?.name != "useCard" || cards.some(card => get.type(card) != "equip");
		},
		async content(event, trigger, player) {
			if (trigger.name == "phase") {
				await player.draw();
				game.log(player, "的蓄力值上限+1");
				player.addMark(event.name, 1, false);
				player.markSkill("charge");
			} else {
				player.addCharge(1);
			}
		},
		mod: {
			maxCharge(player, num) {
				return num + player.countMark("pottuntian");
			},
		},
		subSkill: {
			phaseUse: {
				audio: "pottuntian",
				enable: "phaseUse",
				filter(event, player) {
					return player.countCharge() > 0;
				},
				usable: 1,
				async precontent(event, trigger, player) {
					const skill = event.name.slice(4);
					const result = await player
						.chooseNumbers(`###${get.translation(skill)}###出牌阶段限一次，你可以消耗任意点蓄力值，令至多等量名角色从牌堆或弃牌堆中各获得一张红桃牌`, [{ prompt: "请选择要移去的蓄力值", min: 1, max: player.countCharge() }])
						.set("processAI", () => {
							const player = get.player();
							const num = Math.min(player.countCharge(), 3);
							return [num];
						})
						.forResult();
					if (result?.bool && result.numbers?.length) {
						event.result = {
							bool: true,
						};
						event.getParent().set(skill, result.numbers[0]);
					} else {
						event.getParent().goto(0);
					}
				},
				async content(event, trigger, player) {
					const { [event.name]: num } = event.getParent(2);
					if (!num) {
						return;
					}
					player.removeCharge(num);
					const result = await player
						.chooseTarget(`屯田：令至多${num}名角色各获得一张红桃牌`, [1, num], true)
						.set("ai", target => get.attitude(get.player(), target) > 0)
						.forResult();
					const { targets } = result;
					if (!targets?.length) {
						return;
					}
					player.line(targets);
					await game.doAsyncInOrder(targets, async target => {
						const card = get.cardPile(card => get.suit(card) == "heart");
						if (card) {
							return target.gain(card, "gain2");
						} else if (target != player) {
							//牢萌最爱的免费鸡蛋
							target.throwEmotion(player, "egg");
							target.chat("我的免费鸡蛋呢");
						}
					});
				},
				ai: {
					order: 8,
					result: {
						player: 1,
					},
				},
			},
		},
	},
	potzaoxian: {
		audio: 2,
		forced: true,
		trigger: { player: "removeMark" },
		filter(event, player) {
			return event.markName == "charge" && event.num >= 2;
		},
		async content(event, trigger, player) {
			const { num } = trigger;
			const list = ["wuzhong", "wuxie", "wugu"];
			const numList = [2, 5, 7],
				cards = [];
			for (let i = 0; i < numList.length; i++) {
				if (num >= numList[i]) {
					const card = get.discardPile(card => get.name(card) == list[i]);
					if (card) {
						cards.push(card);
					} else {
						player.chat(`没有${get.translation(list[i])}!`);
					}
				}
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
		},
	},
	potjixi: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return get.info("potjixi").getTargets(player).length && _status.currentPhase?.countDiscardableCards(player, "he") > 0;
		},
		getTargets(player) {
			return player
				.getHistory("useCard")
				.flatMap(evt => evt.targets || [])
				.unique()
				.remove(player);
		},
		logTarget: () => _status.currentPhase,
		check(event, player) {
			return get
				.info("potjixi")
				.getTargets(player)
				.some(target => get.effect(target, { name: "shunshou" }, player, player) > 0);
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			await player.discardPlayerCard({ target, position: "he", forced: true });
			const card = get.autoViewAs({ name: "shunshou", isCard: true });
			const targets = get
				.info(event.name)
				.getTargets(player)
				.filter(target => player.canUse(card, target, false));
			if (targets.length) {
				await player
					.chooseUseTarget({
						card,
						prompt: `急袭：视为对任意名其他角色使用一张无距离限制的【顺手牵羊】`,
						selectTarget: [1, targets.length],
						filterTarget(card, player, target) {
							return get.event().targets.includes(target);
						},
					})
					.set("targets", targets);
			}
		},
	},
	//势钟会 by柴油鹿鹿
	mbsizi: {
		audio: 7,
		logAudio(event) {
			if (typeof event == "number") {
				return `mbsizi${event}.mp3`;
			}
			return 2;
		},
		enable: "phaseUse",
		usable: 1,
		beginMarkCount: 4,
		chargeSkill: 4,
		filter(event, player) {
			return player.countCharge() > 0;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog(get.prompt2("mbsizi"), "hidden");
			},
			chooseControl(event, player) {
				const choices = Array.from(Array(player.countCharge())).map((v, i) => i + 1);
				return [...choices, "cancel2"];
			},
			check(event, player) {
				return get.rand(1, player.countCharge());
			},
			backup(result, player) {
				return {
					audio: "mbsizi",
					logAudio: () => 2,
					control: result.control,
					async content(event, trigger, player) {
						const { control: num } = get.info(event.name),
							skill = "mbsizi_effect";
						player.removeCharge(num);
						player.addTempSkill(skill, { player: "phaseBegin" });
						player.addMark(skill, num, false);
						if (num > player.getHp()) {
							player.addTempSkill("mbsizi_extra", { player: "phaseBegin" });
						}
					},
				};
			},
			prompt(result, player) {
				let prompt = `直到你的回合开始，接下来${get.cnNumber(result.control)}个回合：`;
				let list = ["所有角色使用【杀】造成的伤害+1", "每个回合结束时，本回合内使用过【杀】的角色失去一点体力，你摸两张牌", "每个回合结束时，若本回合未有角色使用过【杀】，你与当前回合角色各失去1点体力"];
				if (result.control <= player.hp) {
					list = list.slice(0, 2);
				}
				return `###${prompt}###${list.join("<br>")}`;
			},
		},
		group: "mbsizi_init",
		subSkill: {
			backup: {},
			init: {
				audio: "mbsizi",
				logAudio: () => "mbsizi3.mp3",
				trigger: {
					player: "enterGame",
					global: "phaseBefore",
				},
				filter(event, player) {
					if (!player.countCharge(true)) {
						return false;
					}
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const num = lib.skill.mbsizi.beginMarkCount;
					player.addCharge(num);
					await game.delayx();
				},
			},
			extra: {
				charlotte: true,
			},
			effect: {
				charlotte: true,
				onremove(player, skill) {
					player.clearMark(skill, false);
					player.removeSkill("mbsizi_extra");
				},
				intro: {
					content(storage, player) {
						if (!storage) {
							return "已无效果";
						}
						let list = ["所有角色使用【杀】造成的伤害+1", "每个回合结束时，你摸两张牌且本回合内使用过【杀】的角色失去一点体力", "每个回合结束时，若本回合未有角色使用过【杀】，当前回合角色失去1点体力"];
						if (!player.hasSkill("mbsizi_extra")) {
							list = list.slice(0, 2);
						}
						return `剩余可用${storage || "0"}个回合<br>${list.map(i => `<li>${i}`).join("<br>")}`;
					},
				},
				trigger: {
					global: ["phaseEnd", "damageBegin1"],
				},
				filter(event, player) {
					if (!player.countMark("mbsizi_effect")) {
						return false;
					}
					return event.name == "phase" || (event.card?.name == "sha" && event.notLink());
				},
				async cost(event, trigger, player) {
					if (trigger.name == "phase") {
						player.removeMark(event.skill, 1, false);
						event.result = {
							bool: true,
							skill_popup: false,
						};
					} else {
						trigger.num++;
					}
				},
				async content(event, trigger, player) {
					const targets = game.filterPlayer2(
						current => {
							return current.hasHistory("useCard", evt => evt.card?.name == "sha");
						},
						undefined,
						true
					);
					const func = async target => {
						if (!target?.isIn()) {
							return;
						}
						await target.loseHp();
					};
					player.logSkill("mbsizi", null, null, null, [get.rand(4, 5)]);
					await player.draw(2);
					if (targets.length) {
						await game.doAsyncInOrder(targets, func);
					}
					if (player.hasSkill("mbsizi_extra") && !targets?.length) {
						player.logSkill("mbsizi", null, null, null, [get.rand(6, 7)]);
						await game.doAsyncInOrder([_status.currentPhase], func);
					}
				},
			},
		},
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
	},
	mbxiezhi: {
		audio: 2,
		trigger: { player: "changeHpAfter" },
		filter(event, player) {
			return event.changedHp != 0;
		},
		forced: true,
		async content(event, trigger, player) {
			const max = Math.max(player.countCharge(true), 0);
			const num = Math.min(Math.abs(trigger.changedHp), max);
			if (num > 0) {
				player.addCharge(num);
			}
			const num2 = Math.abs(trigger.changedHp) - num;
			if (num2 > 0) {
				const buff = `${event.name}_effect`;
				player.addSkill(buff);
				player.addMark(buff, 1, false);
				game.log(player, "的手牌上限和出杀次数", "#y+1");
				await game.delayx();
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: { content: "手牌上限和出杀次数+#" },
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("mbxiezhi_effect");
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("mbxiezhi_effect");
						}
					},
				},
			},
		},
	},
	mbyunan: {
		audio: 4,
		trigger: {
			source: "dying",
		},
		juexingji: true,
		initGroup: "wei",
		forced: true,
		skillAnimation: true,
		animationColor: "purple",
		filter(event, player) {
			return game.getRoundHistory("everything", evt => evt.name == "die").length > 0;
		},
		async content(event, trigger, player) {
			await player.changeGroup("qun");
			player.awakenSkill(event.name);
			const skill = "mbkechang";
			if (!player.hasSkill(skill, null, null, false)) {
				await player.addSkills(skill);
			} else {
				player.setStorage(skill, true);
				player.popup(skill, "purple");
				game.log(player, "升级了技能", `#g【${get.translation(skill)}】`);
				await game.delayx();
			}
		},
		derivation: ["mbkechang"],
	},
	mbkechang: {
		audio: 2,
		onremove: true,
		zhuSkill: true,
		forced: true,
		trigger: {
			player: "useCard1",
		},
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return player.getStorage("mbkechang", false) === true;
		},
		async content(event, trigger, player) {
			trigger.directHit.addArray(game.players);
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return player.getStorage("mbkechang", false) && arg?.card?.name == "sha";
			},
		},
		derivation: ["mbkechang_rewrite"],
		global: "mbkechang_global",
		subSkill: {
			rewrite: {
				nopop: true,
			},
			global: {
				charlotte: true,
				mod: {
					targetInRange(card, player) {
						if (player.group != "qun" || card.name != "sha") {
							return;
						}
						if (game.hasPlayer(current => current.hasSkill("mbkechang"))) {
							return true;
						}
					},
				},
			},
		},
	},
};
