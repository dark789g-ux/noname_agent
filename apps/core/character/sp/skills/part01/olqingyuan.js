import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqingyuan" | "olchongshen" | "olshandao">} */
export const groupSkills = {
	//胡金定
	olqingyuan: {
		audio: 2,
		trigger: {
			global: ["phaseBefore", "gainAfter", "loseAsyncAfter"],
			player: ["enterGame", "damageEnd"],
		},
		filter(event, player) {
			const storage = player.getStorage("olqingyuan");
			if (event.name == "gain" || event.name == "loseAsync") {
				if (player.hasSkill("olqingyuan_used")) {
					return false;
				}
				return storage.some(target => event.getg(target).length) && storage.some(target => target.hasCard(card => lib.filter.canBeGained(card, target, player), "h"));
			}
			if (!game.hasPlayer(target => !storage.includes(target) && target != player)) {
				return false;
			}
			if (event.name == "damage" && player.getAllHistory("damage").indexOf(event) != 0) {
				return false;
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.name == "gain" || trigger.name == "loseAsync") {
				const target = player
					.getStorage("olqingyuan")
					.filter(target => target.hasCard(card => lib.filter.canBeGained(card, target, player), "h"))
					.randomGet();
				player.line(target);
				player.addTempSkill("olqingyuan_used");
				player.gain(
					target
						.getCards("h", card => {
							return lib.filter.canBeGained(card, target, player);
						})
						.randomGet(),
					target,
					"giveAuto"
				);
			} else {
				const filterTarget = (card, player, target) => {
						return target != player && !player.getStorage("olqingyuan").includes(target);
					},
					targetsx = game.filterPlayer(current => filterTarget(null, player, current));
				let result;
				if (targetsx.length == 1) {
					result = { bool: true, targets: targetsx };
				} else {
					result = await player
						.chooseTarget(filterTarget, true)
						.set("prompt2", "每回合限一次，当你以此法选择的角色获得牌后，你随机获得其中一名角色的一张手牌")
						.set("prompt", "请选择【轻缘】的目标")
						.set("ai", target => {
							const player = get.event().player;
							return get.effect(target, new lib.element.VCard({ name: "shunshou_copy2" }), player, player);
						})
						.forResult();
				}
				if (result.bool) {
					const target = result.targets[0];
					player.line(target);
					game.log(player, "选择了", target);
					player.markAuto("olqingyuan", [target]);
				}
			}
		},
		subSkill: { used: { charlotte: true } },
		intro: { content: "已选择$为目标" },
		ai: {
			expose: 0.3,
		},
	},
	olchongshen: {
		audio: 2,
		locked: false,
		enable: "chooseToUse",
		filterCard(card) {
			return get.itemtype(card) == "card" && card.hasGaintag("olchongshen") && get.color(card) == "red";
		},
		position: "h",
		viewAs: { name: "shan" },
		viewAsFilter(player) {
			if (!player.countCards("h", card => card.hasGaintag("olchongshen") && get.color(card) == "red")) {
				return false;
			}
		},
		prompt: "将本轮得到的红色牌当作【闪】使用",
		check(card) {
			return 7 - get.value(card);
		},
		ai: {
			order: 2,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond" || !player.countCards("h", card => _status.connectMode || (card.hasGaintag("olchongshen") && get.color(card) == "red"))) {
					return false;
				}
			},
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "respondShan") && current < 0) {
						return 0.6;
					}
				},
			},
		},
		group: "olchongshen_mark",
		mod: {
			aiValue(player, card, num) {
				if (get.name(card) != "shan" && get.itemtype(card) == "card" && (!card.hasGaintag("olchongshen") || get.color(card) != "red")) {
					return;
				}
				let cards = player.getCards("hs", card => get.name(card) == "shan" || card.hasGaintag("olchongshen"));
				cards.sort((a, b) => (get.name(b) == "shan" ? 1 : 2) - (get.name(a) == "shan" ? 1 : 2));
				const geti = () => {
					if (cards.includes(card)) {
						return cards.indexOf(card);
					}
					return cards.length;
				};
				if (get.name(card) == "shan") {
					return Math.min(num, [6, 4, 3][Math.min(geti(), 2)]) * 0.6;
				}
				return Math.max(num, [6.5, 4, 3][Math.min(geti(), 2)]);
			},
			aiUseful() {
				return lib.skill.olchongshen.mod.aiValue.apply(this, arguments);
			},
			// ignoredHandcard(card,player){
			// 	if(card.hasGaintag('olchongshen')) return true;
			// },
			// cardDiscardable(card,player,name){
			// 	if(name=='phaseDiscard'&&card.hasGaintag('olchongshen')) return false;
			// },
		},
		init(player) {
			if (game.phaseNumber > 0) {
				const hs = player.getCards("h"),
					history = player.getAllHistory();
				let cards = [];
				for (let i = history.length - 1; i >= 0; i--) {
					for (const evt of history[i].gain) {
						cards.addArray(evt.cards);
					}
					if (history[i].isRound) {
						break;
					}
				}
				cards = cards.filter(i => hs.includes(i));
				if (cards.length) {
					player.addGaintag(cards, "olchongshen");
				}
			}
		},
		onremove(player) {
			player.removeGaintag("olchongshen");
		},
		subSkill: {
			mark: {
				charlotte: true,
				trigger: { player: "gainBegin", global: "roundStart" },
				filter(event, player) {
					return event.name == "gain" || game.roundNumber > 1;
				},
				forced: true,
				popup: false,
				content() {
					if (trigger.name == "gain") {
						trigger.gaintag.add("olchongshen");
					} else {
						player.removeGaintag("olchongshen");
					}
				},
			},
		},
	},
	//田畴
	olshandao: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.olshandao.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target.countCards("hej");
		},
		usable: 1,
		selectTarget: [1, Infinity],
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const wugu = new lib.element.VCard({ name: "wugu", isCard: true });
			const wanjian = new lib.element.VCard({ name: "wanjian", isCard: true });
			const targets = game.filterPlayer(target => {
					if (target == player) {
						return false;
					}
					return !event.targets.includes(target) && player.canUse(wanjian, target, false);
				}),
				targetx = event.targets.sortBySeat();
			let dialog = ["将这些角色的各一张牌置于牌堆顶，然后视为对这些角色使用【五谷丰登】"];
			for (const target of targetx) {
				const name = target == player ? "你" : get.translation(target);
				if (target.countCards("h")) {
					dialog.add('<div class="text center">' + name + "的手牌区</div>");
					if (player.hasSkillTag("viewHandcard", null, target, true) || player == target) {
						dialog.push(target.getCards("h"));
					} else {
						dialog.push([target.getCards("h"), "blank"]);
					}
				}
				if (target.countCards("e")) {
					dialog.addArray(['<div class="text center">' + name + "的装备区</div>", target.getCards("e")]);
				}
				if (target.countCards("j")) {
					dialog.addArray(['<div class="text center">' + name + "的判定区</div>", target.getCards("j")]);
				}
			}
			const { bool, links } = await player
				.chooseButton(dialog, event.targets.length, true)
				.set("filterButton", button => {
					return !ui.selected.buttons.some(but => get.owner(but.link) == get.owner(button.link));
				})
				.set("ai", button => 1 / (get.value(button.link, get.owner(button.link)) || 0.5))
				.forResult();
			if (bool) {
				const cards = links.sort((a, b) => targetx.indexOf(get.owner(a)) - targetx.indexOf(get.owner(b)));
				for (const card of cards) {
					const target = get.owner(card);
					target.$throw(1, 1000);
					await target.lose([card], ui.cardPile, "insert");
				}
				const targety = targetx.filter(target => player.canUse(wugu, target, false));
				if (targety.length) {
					await player.useCard(wugu, targety, false);
				}
				if (targets.length) {
					await player.useCard(wanjian, targets, false);
				}
			}
		},
		ai: {
			order: 9,
			result: { target: 1 },
		},
	},
};
