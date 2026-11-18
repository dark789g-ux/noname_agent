import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "potyinzhan" | "potkuanggu" | "kunfen_pot_weiyan" | "mbfeijing" | "mbxiaoge">} */
export const groupSkills = {
	potyinzhan: {
		audio: 3,
		audioname: ["pot_weiyan_achieve", "pot_weiyan_fail"],
		trigger: {
			source: "damageBegin1",
		},
		forced: true,
		filter(event, player) {
			if (event.card?.name != "sha") {
				return false;
			}
			const target = event.player;
			if (player.hp <= target.hp || player.countCards("h") <= target.countCards("h")) {
				return true;
			}
			return false;
		},
		logTarget: "player",
		popup: false,
		logAudio: (player, indexedData) => "potyinzhan" + (lib.skill.potyinzhan.audioname.includes(player.skin.name) ? "_" + player.skin.name : "") + (indexedData ? indexedData : get.rand(1, 2)) + ".mp3",
		async content(event, trigger, player) {
			const target = trigger.player,
				bool1 = target.hp >= player.hp,
				bool2 = target.countCards("h") >= player.countCards("h");
			player.logSkill("potyinzhan", null, null, null, [player, bool1 && bool2 ? 3 : get.rand(1, 2)]);
			if (bool1) {
				trigger.num++;
			}
			if (bool2) {
				if (bool1) {
					player.popup("乘势", "fire");
				}
				player
					.when("useCardAfter")
					.filter(evt => evt == trigger.getParent(2))
					.step(async (event, trigger, player) => {
						let result;
						if (target.isIn() && target.countDiscardableCards(player, "he")) {
							result = await player.discardPlayerCard(target, "he", true).forResult();
						}
						if (bool1) {
							await player.recover();
							if (result?.cards?.length) {
								await player.gain(result.cards.filterInD("od"), "gain2");
							}
						}
					});
			}
		},
	},
	potkuanggu: {
		audio: 2,
		audioname: ["pot_weiyan_fail"],
		audioname2: {
			pot_weiyan_achieve: "potkuanggu_pot_weiyan_achieve",
		},
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			return event.checkKuanggu && event.num > 0;
		},
		frequent: true,
		popup: false,
		logAudio: (player, indexedData) => "potkuanggu" + (lib.skill.potkuanggu.audioname.includes(player.skin.name) ? "_" + player.skin.name : "") + (indexedData ? indexedData : get.rand(1, 2)) + ".mp3",
		logAudio2: {
			pot_weiyan_achieve: (player, indexedData) => "potkuanggu_pot_weiyan_achieve" + (indexedData ? indexedData : get.rand(1, 2)) + ".mp3",
		},
		async cost(event, trigger, player) {
			let choice,
				list = ["draw_card"],
				choiceList = ["选项一：回复1点体力", "选项二：摸一张牌"];
			if (player.getStorage(event.skill, 0) && player.countCards("he")) {
				list.push("背水！");
				choiceList.push("背水：弃置一张牌并令你本阶段使用【杀】的次数+1");
			}
			if (player.isDamaged()) {
				list.unshift("recover_hp");
			} else {
				choiceList[0] = `<span class = 'transparent'>${choiceList[0]}</span>`;
			}
			if (list.length == 1) {
				event.result = await player.chooseBool(get.prompt(event.skill), "摸一张牌").set("frequentSkill", event.skill).forResult();
				event.result.cost_data = "draw_card";
			} else {
				list.push("cancel2");
				if (
					player.isDamaged() &&
					get.recoverEffect(player) > 0 &&
					player.countCards("hs", function (card) {
						return card.name == "sha" && player.hasValueTarget(card);
					}) >= player.getCardUsable("sha")
				) {
					if (player.countCards("he") > 1 && list.includes("背水！")) {
						choice = "背水！";
					} else {
						choice = "recover_hp";
					}
				} else {
					choice = "draw_card";
				}
				const { control } = await player
					.chooseControl(list)
					.set("prompt", get.prompt(event.skill))
					.set("choiceList", choiceList)
					.set("displayIndex", false)
					.set("choice", choice)
					.set("ai", () => {
						return get.event().choice;
					})
					.forResult();
				event.result = {
					bool: control != "cancel2",
					cost_data: control,
				};
			}
		},
		async content(event, trigger, player) {
			const result = event.cost_data;
			if (result == "背水！" && player.skin.name === "pot_weiyan_achieve") {
				player.logSkill("potkuanggu", null, null, null, [player, get.rand(3, 4)]);
			} else {
				player.logSkill("potkuanggu", null, null, null, [player]);
			}

			if (result == "recover_hp" || result == "背水！") {
				await player.recover();
			}
			if (result == "draw_card" || result == "背水！") {
				await player.draw();
			}
			if (result == "背水！" && player.countCards("he")) {
				await player.chooseToDiscard("he", true);
				player.addTempSkill("potkuanggu_effect", "phaseChange");
				player.addMark("potkuanggu_effect", 1, false);
			}
		},
		subSkill: {
			pot_weiyan_achieve: {
				audio: 4,
			},
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (player.countMark("potkuanggu_effect") && card.name == "sha") {
							return num + player.countMark("potkuanggu_effect");
						}
					},
				},
			},
		},
	},
	kunfen_pot_weiyan: { audio: 2 },
	//张燕
	mbfeijing: {
		audio: 4,
		logAudio() {
			return ["mbfeijing1.mp3", "mbfeijing3.mp3"];
		},
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			if (event.card.name != "sha" || !event.isFirstTarget) {
				return false;
			}
			if (event.targets?.length != 1 || !event.target?.isIn()) {
				return false;
			}
			const [left, right] = get.info("mbfeijing").getTargets(player, event.target);
			return left.length || right.length;
		},
		usable: 2,
		getTargets(source, target) {
			let left = [],
				right = [],
				left2 = source,
				right2 = source;
			while (!(left2 == target && right2 == target)) {
				if (left2 != target) {
					left2 = left2.getPrevious();
					if (left2.isIn() && left2 != target) {
						left.push(left2);
					}
				}
				if (right2 != target) {
					right2 = right2.getNext();
					if (right2.isIn() && right2 != target) {
						right.push(right2);
					}
				}
			}
			return [left, right];
		},
		async cost(event, trigger, player) {
			const [left, right] = get.info(event.skill).getTargets(player, trigger.target);
			if (left.length && right.length) {
				const shun = `顺时针：${left.map(i => get.translation(i)).join("、")}`,
					ni = `逆时针：${right.map(i => get.translation(i)).join("、")}`,
					prompt = "令顺时针或逆时针上的角色同时展示并依次弃置一张手牌，然后你可令弃置一种颜色牌的所有角色成为此【杀】额外目标";
				const result = await player
					.chooseButton([
						get.prompt(event.skill),
						prompt,
						[
							[
								[left, shun],
								[right, ni],
							],
							"textbutton",
						],
					])
					.set("ai", button => {
						const player = get.player(),
							trigger = get.event().getTrigger(),
							targets = button.link;
						let eff = 0;
						for (let target of targets) {
							if (lib.filter.targetEnabled2(trigger.card, player, target)) {
								eff += get.effect(target, trigger.card, player, player);
							}
						}
						return eff;
					})
					.forResult();
				event.result = {
					bool: result?.bool,
					targets: result?.links?.[0],
				};
			} else {
				const targets = left.length ? left : right;
				event.result = await player.chooseBool(get.prompt2(event.skill, targets)).forResult();
				if (event.result?.bool) {
					event.result.targets = targets;
				}
			}
		},
		async content(event, trigger, player) {
			const targets = event.targets.filter(target => target.countCards("h", card => lib.filter.cardDiscardable(card, target, "mbfeijing")));
			if (targets.length) {
				const next = player
					.chooseCardOL(targets, "h", true, "飞径：展示并弃置一张手牌", (card, player) => {
						return lib.filter.cardDiscardable(card, player, "mbfeijing");
					})
					.set("ai", get.unuseful)
					.set("aiCard", target => {
						const cards = target.getCards("h");
						return { bool: true, cards: [cards.randomGet()] };
					});
				next._args.remove("glow_result");
				const result = await next.forResult();
				const cards = [];
				for (let i = 0; i < result.length; i++) {
					const current = targets[i],
						card = result[i].cards[0];
					cards.push(card);
				}
				await player
					.showCards(cards, get.translation(player) + "发动了【飞径】")
					.set("customButton", button => {
						const target = get.owner(button.link);
						if (target) {
							game.createButtonCardsetion(`${target.getName(true)}`, button);
						}
					})
					.set("delay_time", 4)
					.set("multipleShow", true);
				const colors = {};
				for (let i = 0; i < result.length; i++) {
					const current = targets[i],
						card = result[i].cards[0],
						color = get.color(card, current);
					await current.discard([card]);
					if (!colors[color]) {
						colors[color] = [];
					}
					colors[color].add(current);
				}
				const list = [];
				for (let color in colors) {
					list.add([colors[color], `${get.translation(color)}：${colors[color].map(i => get.translation(i)).join("、")}`]);
				}
				if (!list.length) {
					return;
				}
				const result2 = await player
					.chooseButton(["飞径：是否令弃置一种颜色牌的所有角色成为此【杀】额外目标？", [list, "textbutton"]])
					.set("ai", button => {
						const player = get.player(),
							trigger = get.event().getTrigger(),
							targets = button.link;
						let eff = 0;
						for (let target of targets) {
							if (lib.filter.targetEnabled2(trigger.card, player, target)) {
								eff += get.effect(target, trigger.card, player, player);
							}
						}
						return eff;
					})
					.forResult();
				if (result2?.bool && result2.links?.length) {
					const targetx = result2.links[0].filter(target => lib.filter.targetEnabled2(trigger.card, player, target));
					if (targetx.length) {
						player.line(targetx);
						trigger.targets.addArray(targetx);
						trigger.getParent().feijingExtra ??= [];
						trigger.getParent().feijingExtra.addArray(targetx);
					}
				}
			}
		},
		group: "mbfeijing_viewas",
		subSkill: {
			viewas: {
				audio: ["mbfeijing2.mp3", "mbfeijing4.mp3"],
				enable: ["chooseToRespond", "chooseToUse"],
				filterCard(card, player) {
					return get.type2(card) == "trick" && get.tag(card, "damage");
				},
				position: "hes",
				viewAs: {
					name: "sha",
				},
				viewAsFilter(player) {
					if (!player.countCards("hes", card => get.type2(card) == "trick" && get.tag(card, "damage"))) {
						return false;
					}
				},
				prompt: "将一张伤害类锦囊牌当杀使用或打出",
				check(card) {
					const val = get.value(card);
					if (_status.event.name == "chooseToRespond") {
						return 1 / Math.max(0.1, val);
					}
					return 7 - val;
				},
				ai: {
					skillTagFilter(player) {
						if (!player.countCards("hes", card => get.type2(card) == "trick" && get.tag(card, "damage"))) {
							return false;
						}
					},
					respondSha: true,
				},
			},
		},
	},
	mbxiaoge: {
		audio: 4,
		trigger: {
			source: "damageBegin2",
			player: "useCardAfter",
		},
		forced: true,
		filter(event, player) {
			if (event.name == "damage") {
				const evt = event.getParent("useCard", true);
				return evt?.feijingExtra?.includes(event.player) && evt?.targets?.includes(event.player) && evt?.card?.name == "sha";
			}
			return event.card.name == "sha" && event.targets.length == 1;
		},
		logTarget(event, player) {
			return event[event.name == "damage" ? "player" : "targets"];
		},
		logAudio(event) {
			if (event.name == "damage") {
				return 2;
			}
			return ["mbxiaoge3.mp3", "mbxiaoge4.mp3"];
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				trigger.cancel();
				if (player.isDamaged()) {
					await player.recover();
				}
				const target = trigger.player,
					evt = trigger.getParent("useCard", true);
				let cards;
				target.getHistory("lose", evtx => {
					const evtv = evtx.getParent(2);
					if (evtv?.name != "mbfeijing") {
						return false;
					}
					if (evtv?.getTrigger()?.getParent() != evt) {
						return false;
					}
					cards = evtx.cards2.filterInD("d");
				});
				if (cards?.length) {
					await player.gain(cards, "gain2");
				}
			} else {
				const card = { name: "juedou", isCard: true },
					target = event.targets[0];
				if (player.canUse(card, target)) {
					await player.useCard(card, target);
				}
			}
		},
	},
};
