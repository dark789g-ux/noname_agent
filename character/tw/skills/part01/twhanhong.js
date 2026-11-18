import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twhanhong" | "twhuazhang">} */
export const groupSkills = {
	//幻曹植
	twhanhong: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (player.getStorage("twhanhong_used").length >= 4) {
				return false;
			}
			return player.countDiscardableCards(player, "h") > 0;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog(get.prompt2("twhanhong"));
			},
			chooseControl(event, player) {
				const choices = lib.suit.filter(s => !player.getStorage("twhanhong_used").includes(s));
				choices.push("cancel2");
				return choices;
			},
			check(event, player) {
				return lib.suit.filter(s => !player.getStorage("twhanhong_used").includes(s)).randomGet();
			},
			backup(result, player) {
				return {
					audio: "twhanhong",
					suit: result.control,
					filterCard: true,
					position: "he",
					selectCard() {
						const player = get.player();
						const nums = lib.suit
							.map(s => {
								return player.countCards("h", { suit: s });
							})
							.sort((a, b) => b - a);
						return nums[0];
					},
					async content(event, trigger, player) {
						const suit = lib.skill.twhanhong_backup.suit;
						const cards = event.cards;
						player.popup(suit);
						player.addTempSkill("twhanhong_used", "phaseUseAfter");
						player.markAuto("twhanhong_used", [suit]);
						let view = [];
						for (let i = 0; i < cards.length; i++) {
							let card = get.cardPile(card => {
								return get.suit(card) == suit && !view.includes(card);
							});
							if (!card) {
								break;
							}
							view.add(card);
						}
						if (!view.length) {
							player.chat(`bro牌堆没有${suit}牌了`);
							return;
						}
						const result = await player
							.chooseCardButton("翰鸿：请选择要获得的牌", view, true)
							.set("ai", button => get.buttonValue(button))
							.forResult();
						const card = result.links[0];
						game.log(player, "从牌堆获得一张牌");
						await player.gain(card, "draw");
						if (cards.some(cardx => get.suit(cardx) == "club")) {
							await player.draw();
						}
					},
				};
			},
			prompt(result, player) {
				const nums = lib.suit
					.map(s => {
						return player.countCards("h", { suit: s });
					})
					.sort((a, b) => b - a);
				return `请弃置${nums[0]}张牌，然后观看牌堆顶前${nums[0]}张${get.translation(result.contrl)}牌并获得其中一张`;
			},
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
		subSkill: {
			used: {
				onremove: true,
				charlotte: true,
				intro: {
					content: "已发动过的花色：$",
				},
			},
		},
	},
	twhuazhang: {
		audio: 3,
		logAudio: index => (typeof index === "number" ? "twhuazhang" + index + ".mp3" : 2),
		trigger: {
			player: "phaseUseEnd",
		},
		filter(event, player) {
			return player.countCards("h") >= 2 && player.hasCard(card => player.canRecast(card), "h");
		},
		check: () => true,
		async content(event, trigger, player) {
			const cards = player.getCards("h", card => player.canRecast(card)),
				num = cards.length;
			await player.recast(cards);

			let count = 0;
			if (cards.map(card => get.suit(card)).unique().length == 1) {
				count++;
			}
			const nums = cards
				.map(card => get.number(card))
				.unique()
				.sort((a, b) => a - b);
			if (nums.length == cards.length && nums.length > 1) {
				if (nums[nums.length - 1] - nums[0] == nums.length - 1) {
					count++;
				}
			}
			if (cards.map(card => get.name(card, player)).unique().length == 1) {
				count++;
			}

			if (count > 0) {
				player.logSkill("twhuazhang", null, null, null, [3]);
				await player.draw(num);
			}
			if (count > 1) {
				player.addTempSkill("twhuazhang_hs");
				player.addMark("twhuazhang_hs", num, false);
			}
			if (count > 2) {
				await player.draw(num);
				player.addMark("twhuazhang_hs", num, false);
			}
		},
		subSkill: {
			hs: {
				onremove: true,
				charlotte: true,
				markimage: "image/card/handcard.png",
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("twhuazhang_hs");
					},
				},
				intro: {
					content: "本回合手牌上限+#",
				},
			},
		},
	},
};
