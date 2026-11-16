import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jimie" | "mbtiantao" | "mbxinghun" | "mbshenpei" | "mbhuitian">} */
export const groupSkills = {
	jimie: {
		audio: 4,
		trigger: { player: "phaseUseEnd" },
		limited: true,
		skillAnimation: true,
		filter(_event, player) {
			return player.countMark("tingwei") >= 8;
		},
		logAudio(event) {
			if (typeof event == "number") {
				return `jimie${event}.mp3`;
			}
			return 2;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill),
					prompt2: "弃8枚“霆”标记，对一名角色造成等于其体力上限的伤害",
					ai(target) {
						const player = get.player();
						return get.damageEffect(target, player, player);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.awakenSkill("jimie");
			player.removeMark("tingwei", 8);
			const target = event.targets[0];
			await target.damage({
				num: target.maxHp,
			});
			player.setStorage("yuli", [], true);
		},
	},
	//手杀神姜维
	mbtiantao: {
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			//return ["h", "e", "j"].some(pos => player.countDiscardableCards(player, pos));
			return true;
		},
		forced: true,
		async content(event, trigger, player) {
			const position = ["h", "e", "j"], //.filter(pos => player.countDiscardableCards(player, pos)),
				map = { h: "手牌区", e: "装备区", j: "判定区" };
			let list = position.map(i => map[i]);
			const result = await player
				.chooseControl({ controls: list })
				.set("prompt", `###${get.translation(event.name)}：选择一个区域并弃置其中所有牌###然后选择弃置任意名其他角色对应区域内的各一张牌。`)
				.set("ai", (event, player) => {
					const targets = game.filterPlayer(current => current != player),
						{ position, controls } = get.event(),
						list = {};
					for (const pos of position) {
						let info = targets
							.filter(target => target.countDiscardableCards(player, pos))
							.reduce((sum, target) => {
								const eff = get.effect(target, { name: "guohe_copy", position: pos }, player, player);
								return eff > 0 ? sum + eff : sum;
							}, 0);
						list[pos] = info - (pos == "j" ? -1 : 1) * get.value(player.getDiscardableCards(player, pos));
					}
					let choice = Object.entries(list).sort((a, b) => b[1] - a[1])[0];
					return { h: "手牌区", e: "装备区", j: "判定区" }[choice[0]];
				})
				.set("position", position)
				.forResult();
			if (!result?.control || result.control == "cancel2") {
				return;
			}
			const pos = { 手牌区: "h", 装备区: "e", 判定区: "j" }[result.control];
			let doneList = new Map();
			const result2 = await player.modedDiscard(player.getCards(pos)).forResult();
			if (result2?.cards?.length) {
				doneList.set(player, result2.cards);
			}
			while (true) {
				if (!game.hasPlayer(current => current != player && !doneList.has(current) && current.countDiscardableCards(player, pos))) {
					break;
				}
				let result = await player
					.chooseTarget(`天涛：选择一名其他角色，弃置其${{ h: "手牌区", e: "装备区", j: "判定区" }[pos]}内的一张牌`)
					.set("filterTarget", (_, player, target) => {
						return target != player && !get.event().doneList.has(target) && target.countDiscardableCards(player, get.event().pos);
					})
					.set("ai", target => {
						const { pos, player } = get.event();
						return get.effect(target, { name: "guohe_copy", position: pos }, player, player);
					})
					.set("doneList", doneList)
					.set("pos", pos)
					.forResult();
				if (!result?.bool || !result.targets?.length) {
					break;
				}
				const target = result.targets[0];
				player.line(target);
				result = await player.discardPlayerCard(target, pos, true).forResult();
				if (result?.bool && result.links?.length) {
					doneList.set(target, result.links);
				}
			}
			if ([...doneList.keys()].length) {
				const targets = [...doneList.entries()].filter(([_, cards]) => !cards.some(card => get.name(card) == "sha")).map(([target]) => target);
				await game.doAsyncInOrder(targets, async target => {
					return target.loseHp();
				});
			}
		},
	},
	mbxinghun: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		manualConfirm: true,
		async content(event, trigger, player) {
			const num = 5;
			const cards = get.cards(num, true);
			let result = await player
				.chooseToMove_new("星魂：选择任意张手牌进行交换", true)
				.set("list", [
					["牌堆顶的牌", cards],
					["你的手牌", player.getCards("h")],
				])
				.set("filterMove", (from, to, moved) => typeof to != "number")
				.set("selectionSpec", { move: "swap" })
				.set("processAI", list => {
					const player = get.player();
					let cards = list
						.map(i => i[1])
						.flat()
						.sort((a, b) => get.value(b, player) - get.value(a, player));
					let sha = cards.filter(card => get.name(card, player) == "sha");
					cards.removeArray(sha);
					const hs = [];
					let num = Math.ceil(sha.length / 2);
					if (num <= player.countCards("h")) {
						hs.addArray(sha.slice(0, num));
						sha.removeArray(hs);
					}
					if (hs.length < player.countCards("h")) {
						hs.addArray(cards.slice(0, player.countCards("h") - hs.length));
						cards.removeArray(hs);
					}
					const top = sha.concat(cards);
					return [top, hs];
				})
				.forResult();
			if (result?.bool) {
				await game
					.loseAsync({
						player,
						cards: result.moved.flat(),
						moved: result.moved,
					})
					.setContent(async function (event, trigger, player) {
						const { cards, moved } = event,
							hs = player.getCards("h");
						const gain = moved[1].filter(card => !hs.includes(card)),
							puts = moved[0].filter(card => hs.includes(card)),
							originPile = cards.slice().removeArray(hs);
						//将手牌中有变动的和牌堆顶的牌送入处理区
						if (puts.length) {
							player.$throw(puts.length, 1000);
							await player.lose(puts, ui.ordering).set("getlx", false);
						}
						await game.cardsGotoOrdering(originPile);
						//手牌部分
						if (gain.length) {
							await player.gain(gain, "draw").set("getlx", false);
							//调整手牌顺序
							/*player.getCards("h").forEach(i => i.goto(ui.special));
							player.directgain(moved[1].slice().reverse(), false);*/
						}
						//牌堆部分
						await game.cardsGotoPile(moved[0].slice().reverse(), ["insert_card", true]);
						//知情牌
						game.addCardKnower(moved[0], player);
					});
			}
			if (!game.hasPlayer(current => current != player)) {
				return;
			}
			result = await player
				.chooseTarget(`星魂：选择一名其他角色，令其展示牌堆顶和你的手牌共计${get.cnNumber(num)}张牌`, true)
				.set("filterTarget", (_, player, target) => target != player)
				.set("ai", target => {
					const { player } = get.event();
					return get.effect(target, { name: "sha" }, player, player);
				})
				.forResult();
			if (result?.bool && result.targets?.length) {
				const [target] = result.targets;
				player.line(target, "thunder");
				let showCards = [];
				const top = get.cards(5, true);
				if (player.countCards("h")) {
					const dialog = [];
					dialog.push("星魂：请选择五张牌");
					dialog.add(`<div class="text center">${get.translation(player)}的手牌</div>`);
					if (target.hasSkillTag("viewHandcard", null, player, true)) {
						dialog.push(player.getCards("h"));
					} else {
						dialog.push([player.getCards("h"), "blank"]);
					}
					dialog.addArray([`<div class="text center">牌堆顶</div>`, [top, "blank"]]);
					const result = await target
						.chooseButton(5, true)
						.set("createDialog", dialog)
						.set("top", top)
						.set("target", player)
						.set("ai", () => Math.random())
						.forResult();
					showCards = result?.links || [];
				} else {
					showCards = top;
				}
				await target
					.showCards(showCards, `${get.translation(target)}因“${get.translation(event.name)}”展示`)
					.set("customButton", button => {
						if (get.event().top.includes(button.link)) {
							button.node.gaintag.innerHTML = "牌堆顶";
						}
					})
					.set("top", top)
					.set("delay_time", 5);
				if (showCards.some(card => get.name(card) == "sha")) {
					let sha = showCards.filter(card => get.name(card) == "sha");
					while (sha.length) {
						let card = sha.shift();
						if (player.canUse(card, target, false, false)) {
							if (top.includes(card)) {
								top.remove(card);
							}
							await player.useCard(card, target, false);
						}
					}
				}
			}
		},
		ai: {
			order(item, player) {
				if (player.countCards("hs", card => get.tag(card, "draw"))) {
					return 1;
				}
				return 20;
			},
			result: {
				player(player) {
					if (!game.hasPlayer(current => current != player && get.effect(current, { name: "sha" }, player, player) > 0)) {
						return 0;
					}
					return 1;
				},
			},
		},
	},
	mbshenpei: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		derivation: ["mbhuitian"],
		trigger: {
			player: "dying",
		},
		check(event, player) {
			return !player.canSave(player) || player.countCards("hs", card => get.tag(card, "save")) <= -player.hp;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const num = game.getAllGlobalHistory("everything", evt => {
				if (evt.name != "dying" || evt.player != player) {
					return false;
				}
				return true;
			}).length;
			if (num > 0) {
				await player.recover(num);
				const result = await player
					.chooseTarget(`神霈：选择一名角色对其造成${num}点雷电伤害`, true)
					.set("ai", target => {
						const { player } = get.event();
						return get.damageEffect(target, player, player, "thunder");
					})
					.forResult();
				if (result?.bool && result.targets?.length) {
					player.line(result.targets, "thunder");
					await result.targets[0].damage(num, "thunder");
				}
			}
			await player.addSkills("mbhuitian");
		},
	},
	mbhuitian: {
		audio: 4,
		trigger: {
			global: ["roundStart", "phaseEnd"],
		},
		filter(event, player, name) {
			if (name == "roundStart") {
				return player.hasAllHistory("useSkill", evt => evt.skill == "mbhuitian");
			}
			return event.player.getHp() > player.getHp();
		},
		async cost(event, trigger, player) {
			if (event.triggername == "roundStart") {
				event.result = {
					bool: true,
					die: true,
				};
			} else {
				event.result = await player
					.chooseBool(get.prompt2(event.skill))
					.set(
						"choice",
						(() => {
							if (player.hasAllHistory("useSkill", evt => evt.skill == "mbhuitian")) {
								return true;
							}
							let targets = game.filterPlayer(current => current != player, undefined, true);
							if (!targets.length) {
								return false;
							} else if (!trigger.player.getHistory().isRound) {
								return false;
							}
							return targets.every(current => {
								let att = get.attitude(player, current);
								return att < -1 || att > 1;
							});
						})()
					)
					.forResult();
			}
		},
		logAudio: (a, b, c, d, costResult) => (costResult.die ? ["mbhuitian3.mp3", "mbhuitian4.mp3"] : 2),
		async content(event, tigger, player) {
			if (event.triggername == "roundStart") {
				await player.die();
			} else {
				await player.draw();
				player.insertPhase(event.name);
			}
		},
	},
};
