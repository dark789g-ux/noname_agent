import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "pianchong" | "zunwei">} */
export const groupSkills = {
	//郭照
	pianchong: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		filter(event, player) {
			return !event.numFixed;
		},
		check(event, player) {
			return player.getStorage("pianchong_effect").length < 2 || event.num <= 2;
		},
		async content(event, trigger, player) {
			trigger.changeToZero();
			const cards = [];
			const card1 = get.cardPile2(card => get.color(card, false) == "red");
			if (card1) {
				cards.push(card1);
			}
			const card2 = get.cardPile2(card => get.color(card, false) == "black");
			if (card2) {
				cards.push(card2);
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
			const effect = event.name + "_effect";
			const { control } = await player
				.chooseControl("red", "black")
				.set("prompt", "偏宠：请选择一种颜色。直至你的下回合开始时，失去该颜色的一张牌后，从牌堆获得另一种颜色的一张牌。")
				.set("ai", () => {
					const { player, effect, controls } = get.event();
					if (!effect.length) {
						let red = 0,
							black = 0;
						const cards = player.getCards("he");
						for (const i of cards) {
							let add = 1;
							const color = get.color(i, player);
							if (get.position(i) == "e") {
								add = 0.5;
							} else if (get.name(i, player) != "sha" && player.hasValueTarget(i)) {
								add = 1.5;
							}
							if (color == "red") {
								red += add;
							} else {
								black += add;
							}
						}
						if (black > red) {
							return "black";
						}
						return "red";
					} else if (effect.length == 1) {
						return controls.remove(effect[0])[0];
					} else {
						return controls.randomGet();
					}
				})
				.set("effect", player.getStorage(effect))
				.forResult();
			if (!["red", "black"].includes(control)) {
				return;
			}
			player.markAuto(effect, control);
			player.addTempSkill(effect, { player: "phaseBeginStart" });
			player.popup(control, control == "red" ? "fire" : "thunder");
			game.log(player, "声明了", "#y" + get.translation(control));
		},
		subSkill: {
			effect: {
				audio: "pianchong",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				forced: true,
				charlotte: true,
				onremove: true,
				filter(event, player) {
					const evt = event.getl(player);
					return evt?.cards2?.some(card => player.getStorage("pianchong_effect").includes(get.color(card, player)));
				},
				async content(event, trigger, player) {
					let cardsx = trigger
						.getl(player)
						.cards2.filter(card => player.getStorage(event.name).includes(get.color(card, player)))
						.slice(0);
					let cards = [];
					while (cardsx.length) {
						let precard = cardsx.shift();
						const card = get.cardPile2(card => !cards.includes(card) && get.color(card, false) != get.color(precard, false));
						if (card) {
							cards.push(card);
						} else {
							break;
						}
					}
					if (cards.length) {
						await player.gain(cards, "gain2", false);
					}
				},
				mark: true,
				intro: { content: "失去一张$牌后，从牌堆中获得一张与此牌颜色不同的牌" },
			},
		},
		ai: { threaten: 4.8 },
	},
	zunwei: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			let storage = player.getStorage("zunwei");
			return (
				storage.length < 3 &&
				game.hasPlayer(current => {
					return (player.isDamaged() && current.getHp() > player.getHp() && !storage.includes(0)) || (current.countCards("h") > player.countCards("h") && !storage.includes(1)) || (current.countCards("e") > player.countCards("e") && !storage.includes(2));
				})
			);
		},
		chooseButton: {
			dialog(event, player) {
				var list = ["选择体力值大于你的一名角色", "选择手牌数大于你的一名角色", "选择装备数大于你的一名角色"];
				var choiceList = ui.create.dialog("尊位：请选择一项", "forcebutton", "hidden");
				choiceList.add([
					list.map((item, i) => {
						if (player.getStorage("zunwei").includes(i)) {
							item = `<span style="text-decoration: line-through;">${item}</span>`;
						}
						return [i, item];
					}),
					"textbutton",
				]);
				return choiceList;
			},
			filter(button) {
				const player = get.player();
				if (player.getStorage("zunwei").includes(button.link)) {
					return false;
				}
				if (button.link == 0) {
					if (!player.isDamaged()) {
						return false;
					}
					return game.hasPlayer(current => {
						return current.getHp() > player.getHp();
					});
				}
				if (button.link == 1) {
					return game.hasPlayer(current => {
						return current.countCards("h") > player.countCards("h");
					});
				}
				if (button.link == 2) {
					return game.hasPlayer(current => {
						return current.countCards("e") > player.countCards("e");
					});
				}
			},
			backup(links) {
				var next = get.copy(lib.skill.zunwei.backups[links[0]]);
				next.audio = "zunwei";
				next.filterCard = function () {
					return false;
				};
				next.selectCard = -1;
				return next;
			},
			check(button) {
				var player = _status.event.player;
				switch (button.link) {
					case 0: {
						var target = game.findPlayer(function (current) {
							return current.isMaxHp();
						});
						return (Math.min(target.hp, player.maxHp) - player.hp) * 2;
					}
					case 1: {
						var target = game.findPlayer(function (current) {
							return current.isMaxHandcard();
						});
						return Math.min(5, target.countCards("h") - player.countCards("h")) * 0.8;
					}
					case 2: {
						var target = game.findPlayer(function (current) {
							return current.isMaxEquip();
						});
						return (target.countCards("e") - player.countCards("e")) * 1.4;
					}
				}
			},
			prompt(links) {
				return ["选择一名体力值大于你的其他角色，将体力值回复至与其相同", "选择一名手牌数大于你的其他角色，将手牌数摸至与其相同", "选择一名装备区内牌数大于你的其他角色，依次使用牌堆中的装备牌，直到装备数与其相同"][links[0]];
			},
		},
		backups: [
			{
				filterTarget(card, player, target) {
					if (player.isHealthy()) {
						return false;
					}
					return target.hp > player.hp;
				},
				content() {
					player.recover(target.hp - player.hp);
					if (!player.storage.zunwei) {
						player.storage.zunwei = [];
					}
					player.storage.zunwei.add(0);
				},
				ai: {
					order: 10,
					result: {
						player(player, target) {
							return Math.min(target.hp, player.maxHp) - player.hp;
						},
					},
				},
			},
			{
				filterTarget(card, player, target) {
					return target.countCards("h") > player.countCards("h");
				},
				content() {
					player.draw(Math.min(5, target.countCards("h") - player.countCards("h")));
					if (!player.storage.zunwei) {
						player.storage.zunwei = [];
					}
					player.storage.zunwei.add(1);
				},
				ai: {
					order: 10,
					result: {
						player(player, target) {
							return Math.min(5, target.countCards("h") - player.countCards("h"));
						},
					},
				},
			},
			{
				filterTarget(card, player, target) {
					return target.countCards("e") > player.countCards("e");
				},
				content() {
					"step 0";
					if (!player.storage.zunwei) {
						player.storage.zunwei = [];
					}
					player.storage.zunwei.add(2);
					event.num = 1;
					"step 1";
					var type = "equip" + num;
					if (!player.hasEmptySlot(type)) {
						return;
					}
					var card = get.cardPile2(function (card) {
						return get.subtype(card, false) == type && player.canUse(card, player);
					});
					if (card) {
						player.chooseUseTarget(card, true).nopopup = true;
					}
					"step 2";
					event.num++;
					if (event.num <= 5 && target.isIn() && player.countCards("e") < target.countCards("e")) {
						event.goto(1);
					}
				},
				ai: {
					order: 10,
					result: {
						player(player, target) {
							return target.countCards("e") - player.countCards("e");
						},
					},
				},
			},
		],
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
	},
};
