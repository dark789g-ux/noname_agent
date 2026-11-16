import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcguying" | "dcmuzhen" | "dcboxuan" | "dcboxuan_rewrite" | "dcyizheng" | "dcguilin">} */
export const groupSkills = {
	//新杀向宠 —— by 星の语
	dcguying: {
		getNum(player) {
			const history = player.getAllHistory("useSkill", evt => evt.skill == "dcguying");
			let count = 1;
			for (let i = history.length - 1; i >= 0; i--) {
				const record = history[i];
				if (record["dcguying_mark"] === true) {
					count++;
				} else {
					break;
				}
			}
			return count;
		},
		init(player, skill) {
			const num = get.info(skill).getNum(player);
			player.setStorage(skill, num, true);
			player.addTip(skill, `${get.translation(skill)} ${player.getStorage(skill)}`);
		},
		onremove(player, skill) {
			delete player.storage[skill];
			player.removeTip(skill);
		},
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			const num = get.info(event.skill).getNum(player);
			player.setStorage(event.skill, num, true);
			player.addTip(event.skill, `${get.translation(event.skill)} ${player.getStorage(event.skill)}`);
			event.result = await player
				.chooseTarget(get.prompt(event.skill), [1, num], `令至多${get.cnNumber(num)}名角色获得以下效果直到你的下个结束阶段开始前：下次受到伤害后，摸体力上限张牌（至多摸五张），然后将X张手牌交给你（X为其手牌数减体力上限）。若在此期间此效果未触发，你下次发动〖固营〗可以多选择一名角色。`)
				.set("ai", target => get.attitude(get.player(), target) / target.hp)
				.forResult();
		},
		async content(event, trigger, player) {
			const history = player.getAllHistory("useSkill", evt => evt.skill == event.name);
			if (history.length) {
				history[history.length - 1][event.name + "_mark"] = true;
			}
			const targets = event.targets,
				skill = event.name + "_effect";
			player.addTempSkill(skill, { player: "phaseJieshuBegin" });
			player.markAuto(skill, targets);
		},
		intro: { content: "当前【固营】角色数上限：#" },
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					lib.skill.dcguying.init(player, "dcguying");
				},
				marktext: "营",
				intro: { content: "$下次受到伤害后，摸体力上限张牌（至多摸五张），然后将超出体力上限的手牌交给你" },
				audio: "dcguying",
				trigger: { global: "damageEnd" },
				filter(event, player) {
					return event.num > 0 && player.getStorage("dcguying_effect").includes(event.player);
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					const history = player.getAllHistory("useSkill", evt => evt.skill == "dcguying");
					if (history.length) {
						history[history.length - 1]["dcguying_mark"] = false;
					}
					lib.skill.dcguying.init(player, "dcguying");
					const target = trigger.player;
					player.unmarkAuto(event.name, target);
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
					await target.draw(Math.min(5, target.maxHp));
					const num = target.countCards("h") - target.maxHp;
					if (num > 0 && target != player) {
						await target
							.chooseToGive(`固营：将${get.cnNumber(num)}张手牌交给${get.translation(player)}`, player, num, true)
							.set("ai", card => {
								return (get.event().goon > 0 ? 8 : 6) - get.value(card);
							})
							.set("goon", get.attitude(target, player));
					}
				},
			},
		},
	},
	dcmuzhen: {
		audio: 2,
		enable: "phaseUse",
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			const count = event.player.getHistory("useSkill", evt => evt.skill == "dcmuzhen" && evt.event.getParent("phaseUse") === event.getParent()).length + 1;
			event.set("dcmuzhen_count", count);
		},
		filter(event, player) {
			const types = player
					.getCards("he")
					.map(card => get.type2(card))
					.unique(),
				count = event.dcmuzhen_count;
			return types.length > 0 && types.some(type => !player.getStorage("dcmuzhen_used").includes(type) && player.countCards("he", card => get.type2(card, player) == type) >= count);
		},
		filterTarget: lib.filter.notMe,
		filterCard(card, player) {
			const selected = ui.selected.cards,
				type = get.type2(card, player),
				bool = !player.getStorage("dcmuzhen_used").includes(type);
			if (!selected.length) {
				return bool;
			}
			return get.type2(selected[0], player) == type && bool;
		},
		selectCard() {
			const count = get.event().dcmuzhen_count;
			return count;
		},
		position: "he",
		complexCard: true,
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const cards = event.cards,
				num = cards.length,
				type = get.type2(cards[0], player),
				target = event.targets[0],
				str = get.translation(target);
			player.addTempSkill(event.name + "_used", ["phaseChange", "phaseAfter"]);
			player.markAuto(event.name + "_used", type);
			await player.give(cards, target);
			const list = [`令${str}弃置等量其他类型的牌`, `获得${str}场上等量的牌`, `令${str}展示牌堆顶等量的牌，并获得其中类型相同的牌`],
				controls = [1, 2, 3].map(num => "选项" + (num == 2 ? "二" : get.cnNumber(num)));
			if (!target.countGainableCards(player, "ej")) {
				list[1] = `<span style="opacity:0.5; ">${list[1]}</span>`;
				controls.remove(controls[1]);
			}
			const result = await player
				.chooseControl(controls)
				.set("choiceList", list)
				.set("prompt", `睦阵：令${str}执行一项`)
				.set("ai", () => {})
				.forResult();
			if (!result?.control) {
				return;
			}
			if (result.control == "选项一") {
				const resultx = await target
					.chooseToDiscard(`睦阵：请弃置${num}张类型不为${get.translation(type)}的牌`, "he", num, true, card => get.event().cardsx?.includes(card))
					.set(
						"cardsx",
						target.getCards("he", card => get.type2(card, target) != type)
					)
					.forResult();
				if (resultx?.cards?.length < num) {
					await target.showHandcards();
				}
			} else if (result.control == "选项二") {
				await player.gainPlayerCard(target, "ej", num, true);
			} else if (result.control == "选项三") {
				const cardsx = get.cards(num, true);
				await target.showCards(cardsx);
				const gain = cardsx.filter(card => get.type(card, false) === type);
				if (gain.length) {
					await target.gain(gain, "gain2");
				}
			}
		},
		subSkill: {
			used: {
				onremove: true,
				charlotte: true,
				intro: {
					content: "已交出过<span class=thundertext>$</span>",
				},
			},
		},
	},
	//新杀夏侯玄
	dcboxuan: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (!event.targets?.length || !event.cards?.length) {
				return false;
			}
			if (!event.targets?.some(target => target != player) && !player.storage.dcboxuan) {
				return false;
			}
			return player.hasHistory("lose", evt => {
				const evtx = evt.relatedEvent || evt.getParent();
				if (evtx != event) {
					return false;
				}
				return evt.getl(player)?.hs?.length;
			});
		},
		frequent: true,
		check: () => true,
		async content(event, trigger, player) {
			const cards = get.bottomCards(3, true);
			await player.showCards(cards, `${get.translation(player)}发动了【博玄】`).set("log", (cards, player) => [player, "展示了牌堆底的", cards]);
			const list = ["cardNameLength", "suit", "type2"].map(attri => cards.some(card => get[attri](trigger.card) == get[attri](card)));
			if (list[0]) {
				await player.draw();
			}
			if (
				list[1] &&
				game.hasPlayer(target => {
					return target.countDiscardableCards(player, "he") && target != player;
				})
			) {
				const result = await player
					.chooseTarget(`博玄：你可弃置一名其他角色一张牌`, (card, player, target) => {
						return target.countDiscardableCards(player, "he") && target != player;
					})
					.set("ai", target => get.effect(target, { name: "guohe_copy2" }, get.player(), get.player()))
					.forResult();
				if (result?.targets) {
					player.line(result.targets);
					await player.discardPlayerCard(result.targets[0], "he", true);
				}
			}
			if (list[2] && cards.some(card => player.hasUseTarget(card, true, true))) {
				const result = await player
					.chooseCardButton(`博玄：你可以使用一张展示牌`, cards)
					.set("filterButton", button => get.player().hasUseTarget(button.link, true, true))
					.set("ai", button => get.player().getUseValue(button.link))
					.forResult();
				if (result?.links) {
					const card = result.links[0];
					if (player.hasUseTarget(card, true, true)) {
						await player.chooseUseTarget(card);
					}
				}
			}
			/*if (player.storage.dcboxuan) {
				const put = trigger.cards.filterInD("od");
				if (!put.length) return;
				const result = await player
					.chooseBool()
					.set("createDialog", [`博玄：是否将这些牌置于牌堆底`, put])
					.set("ai", () => Math.random() > 0.5)
					.forResult();
				if (result?.bool) {
					game.log(player, "将", put, "置于牌堆底");
					await game.cardsGotoPile(put);
				}
			}*/
		},
	},
	dcboxuan_rewrite: {
		//空技能，博玄修改后
	},
	dcyizheng: {
		audio: 2,
		trigger: { player: ["phaseBegin"] }, //, "phaseEnd"
		filter(event, player) {
			return (
				player.countCards("h") &&
				game.hasPlayer(target => {
					return target != player && target.countCards("h");
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, player.maxHp], (card, player, target) => {
					return target != player && target.countCards("h");
				})
				.set("ai", target => {
					if (player.hp == 1) {
						return 0;
					}
					return -get.attitude(get.player(), target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = [player].concat(event.targets).sortBySeat();
			//先选牌
			let showEvent = player
				.chooseCardOL(targets, "议政：请选择要展示的牌", true)
				.set("ai", function (card) {
					return -get.value(card);
				})
				.set("source", player);
			showEvent.aiCard = function (target) {
				const hs = target.getCards("h");
				return { bool: true, cards: [hs.randomGet()] };
			};
			showEvent._args.remove("glow_result");
			const result = await showEvent.forResult();
			const cards = [];
			for (var i = 0; i < targets.length; i++) {
				cards.push(result[i].cards[0]);
			}
			await player
				.showCards(cards, `${get.translation(player)} 发动了【${get.translation(event.name)}】`, false)
				.set("multipleShow", true)
				.set("customButton", button => {
					const target = get.owner(button.link);
					if (target) {
						button.node.gaintag.innerHTML = target.getName();
					}
				})
				.set("delay_time", targets.length * 1.5);
			if (cards.map(card => get.type2(card)).unique().length == 1) {
				player.popup("洗具");
				const result = await player
					.chooseTarget(true)
					.set("createDialog", [`议政：令一名角色获得这些牌`, cards])
					.set("ai", target => get.attitude(get.player(), target))
					.forResult();
				if (result?.targets) {
					const target = result.targets[0];
					player.line(target);
					let gainEvent = target.gain(cards);
					gainEvent.set(
						"givers",
						targets.filter(i => i != target)
					);
					gainEvent.set("animate", function (event) {
						const player = event.player,
							cards = event.cards,
							givers = event.givers;
						for (let i = 0; i < givers.length; i++) {
							givers[i].$give(cards[i], player);
						}
						return 500;
					});
					await gainEvent;
				}
			} else {
				player.popup("杯具");
				await game
					.loseAsync({
						lose_list: targets.map((target, index) => {
							return [target, [cards[index]]];
						}),
						discarder: player,
					})
					.setContent("discardMultiple");
			}
		},
	},
	dcguilin: {
		audio: 2,
		derivation: ["dcboxuan_rewrite"],
		limited: true,
		unique: true,
		skillAnimation: true,
		animationColor: "thunder",
		enable: "phaseUse",
		trigger: { player: "dying" },
		filter(event, player) {
			if (event.name == "dying") {
				return player.isDying();
			}
			return true;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recoverTo(player.maxHp);
			await player.removeSkills("dcyizheng");
			if (player.hasSkill("dcboxuan", null, null, false)) {
				player.storage.dcboxuan = true;
			}
			game.log(player, "修改了", "#g【博玄】");
		},
		ai: {
			order: 10,
			result: {
				player: player => get.recoverEffect(player, player, player),
			},
		},
	},
};
