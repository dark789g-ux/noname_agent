import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olzuolian" | "oljingzhou" | "olmaozhu" | "oljinlan">} */
export const groupSkills = {
	//蔡瑁
	olzuolian: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.getHp() > 0 && game.hasPlayer(target => target.countCards("h"));
		},
		filterTarget(card, player, target) {
			return target.countCards("h");
		},
		selectTarget() {
			return [1, get.event().player.getHp()];
		},
		usable: 1,
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const targets = event.targets.sortBySeat();
			const cards = targets.slice().map(i => i.getCards("h").randomGet());
			const next = player
				.showCards(cards, get.translation(player) + "发动了【佐练】")
				.set("customButton", button => {
					const target = get.owner(button.link);
					button.querySelector(".info").innerHTML = target.getName();
				})
				.set("log", (cards, player) => [player, "展示了", cards.map(card => get.owner(card)), "的", cards])
				.set("delay_time", Math.min(targets.length * 2.5, 7.5))
				.set("closeDialog", false);
			await next;
			//videoId只有执行了事件才会有！
			const id = next.videoId;
			const update = id => {
				const dialog = get.idDialog(id);
				if (dialog) {
					const div = dialog.querySelector(".caption");
					div.innerHTML = "是否将这些牌与牌堆或弃牌堆中的属性杀交换？";
					ui.update();
				}
			};
			if (player.isOnline2()) {
				player.send(update, id);
			} else {
				update(id);
			}
			const result = await player.chooseBool().set("dialog", get.idDialog(id)).forResult();
			game.broadcastAll("closeDialog", id);
			if (!result?.bool) {
				return;
			}
			const cards_cardPile = Array.from(ui.cardPile.childNodes).filter(i => i.name == "sha" && get.nature(i, false));
			const cards_discardPile = Array.from(ui.discardPile.childNodes).filter(i => i.name == "sha" && get.nature(i, false));
			let hasFire = true;
			for (let i = 0; i < targets.length; i++) {
				let target = targets[i];
				let card = cards[i];
				let cardx;
				if (hasFire) {
					let cardxs = get.cardPile(card => {
						return card.name == "sha" && game.hasNature(card, "fire");
					});
					if (cardxs) {
						cardx = cardxs;
					} else {
						hasFire = false;
					}
				}
				if (!hasFire) {
					let cardxs = get.cardPile(card => {
						return card.name == "sha" && get.nature(card, false);
					});
					if (cardxs) {
						cardx = cardxs;
					} else {
						player.popup("杯具");
						player.chat("我属性【杀】呢？！");
						game.log("但牌堆和弃牌堆都没有属性【杀】！");
						return;
					}
				}
				if (!cardx) {
					return;
				}
				let position;
				if (cards_cardPile.includes(cardx)) {
					position = "牌堆";
					target.$throw([card], 1000);
					await target
						.lose([card], ui.cardPile)
						.set("insert_index", () => {
							return ui.cardPile.childNodes[get.event().num];
						})
						.set("num", cards_cardPile.indexOf(cardx));
				} else if (cards_discardPile.includes(cardx)) {
					position = "弃牌堆";
					await target.loseToDiscardpile(card);
				}
				game.log(target, "将", cards[i], `与${position}的`, cardx, "交换");
				await target.gain(cardx, "gain2").set("log", false);
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					//插个眼，等PZ157拯救此AI
					return 0.5 - Math.random();
				},
			},
		},
	},
	oljingzhou: {
		audio: 2,
		trigger: { player: "damageBegin3" },
		filter(event, player) {
			return player.getHp() > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, player.getHp()])
				.set("ai", target => {
					const player = get.event().player,
						trigger = get.event().getTrigger();
					if (trigger.hasNature() && target == player) {
						return -get.effect(target, { name: "tiesuo" }, player, player);
					}
					return get.effect(target, { name: "tiesuo" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			for (const i of event.targets) {
				await i.link(!i.isLinked());
			}
		},
	},
	//裴秀
	//我们三国杀也有属于自己的爽文.jpg
	olmaozhu: {
		audio: 2,
		trigger: { source: "damageBegin1" },
		filter(event, player) {
			const count = lib.skill.olmaozhu.countSkill;
			if (!player.isPhaseUsing() || count(player) <= count(event.player)) {
				return false;
			}
			const evtx = event.getParent("phaseUse");
			return !player.getHistory("sourceDamage", evt => {
				return evt.getParent("phaseUse") == evtx && count(player) > count(evt.player);
			}).length;
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.num++;
		},
		countSkill(player) {
			return player.getSkills(null, false, false).filter(i => {
				const info = get.info(i);
				if (info) {
					if (info.charlotte) {
						return get.plainText(get.translation(`${i}_info`)).length > 0;
					}
					return true;
				}
				return false;
			}).length;
		},
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + lib.skill.olmaozhu.countSkill(player);
				}
			},
			maxHandcard(player, num) {
				return num + lib.skill.olmaozhu.countSkill(player);
			},
		},
	},
	oljinlan: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			const count = lib.skill.olmaozhu.countSkill;
			return player.countCards("h") < Math.max(...game.filterPlayer().map(i => count(i)));
		},
		manualConfirm: true,
		prompt() {
			const count = lib.skill.olmaozhu.countSkill;
			return "将手牌数摸至" + get.cnNumber(Math.max(...game.filterPlayer().map(i => count(i)))) + "张";
		},
		usable: 1,
		async content(event, trigger, player) {
			const count = lib.skill.olmaozhu.countSkill;
			await player.drawTo(Math.max(...game.filterPlayer().map(i => count(i))));
		},
		ai: {
			order: 0.000000114514191981,
			result: { player: 1 },
		},
	},
};
