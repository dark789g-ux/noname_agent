import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twguoyi" | "twchuhai">} */
export const groupSkills = {
	//周处
	twguoyi: {
		audio: "zhangming",
		trigger: { player: "useCardToTargeted" },
		filter(event, player) {
			if (event.target == player || (event.card.storage && event.card.storage.twguoyi)) {
				return false;
			}
			return (
				(event.card.name == "sha" || get.type(event.card) == "trick") &&
				(event.target.isMaxHp() || event.target.isMaxHandcard() || player.countCards("h") <= player.getDamagedHp() + 1)
			);
		},
		check(event, player) {
			return get.attitude(player, event.target) <= 0;
		},
		logTarget: "target",
		group: "twguoyi_reuse",
		content() {
			"step 0";
			event.bool1 = false;
			event.bool2 = false;
			if (trigger.target.isMaxHp() || trigger.target.isMaxHandcard()) {
				event.bool1 = true;
			}
			if (player.countCards("h") <= player.getDamagedHp() + 1) {
				event.bool2 = true;
			}
			if (!trigger.target.countCards("he")) {
				event._result = { index: 0 };
			} else {
				trigger.target
					.chooseControl()
					.set("choiceList", ["本回合不能使用或打出手牌", "弃置" + get.cnNumber(player.getDamagedHp() + 1) + "张牌"])
					.set("ai", function () {
						var player = _status.event.player;
						if (player.countCards("h") <= player.getHandcardLimit()) {
							return 0;
						}
						return 1;
					});
			}
			"step 1";
			player.addTempSkill("twguoyi_" + result.index);
			if (result.index == 0) {
				trigger.target.addTempSkill("twguoyi_hand");
			} else {
				trigger.target.chooseToDiscard("he", player.getDamagedHp() + 1, true);
			}
			"step 2";
			if ((event.bool1 && event.bool2) || (player.hasSkill("twguoyi_0") && player.hasSkill("twguoyi_1"))) {
				if (!trigger.getParent().twguoyi_reuse) {
					trigger.getParent().twguoyi_reuse = {
						name: trigger.card.name,
						nature: trigger.card.nature,
						isCard: true,
						storage: { twguoyi: true },
					};
				}
			}
		},
		subSkill: {
			0: { charlotte: true },
			1: { charlotte: true },
			hand: {
				charlotte: true,
				mark: true,
				intro: { content: "不能使用或打出手牌" },
				mod: {
					cardEnabled2(card) {
						if (get.position(card) == "h") {
							return false;
						}
					},
				},
			},
			reuse: {
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.twguoyi_reuse;
				},
				direct: true,
				content() {
					var card = trigger.twguoyi_reuse;
					for (var i of trigger.targets) {
						if (!i.isIn() || !player.canUse(card, i, false)) {
							return;
						}
					}
					if (trigger.addedTarget && !trigger.addedTarget.isIn()) {
						return;
					}
					if (trigger.addedTargets && trigger.addedTargets.length) {
						for (var i of trigger.addedTargets) {
							if (!i.isIn()) {
								return;
							}
						}
					}
					var next = player.useCard(get.copy(card), trigger.targets, false);
					if (trigger.addedTarget) {
						next.addedTarget = trigger.addedTarget;
					}
					if (trigger.addedTargets && trigger.addedTargets.length) {
						next.addedTargets = trigger.addedTargets.slice(0);
					}
				},
			},
		},
	},
	twchuhai: {
		audio: ["xianghai1.mp3", "xianghai2.mp3", "chuhai1.mp3", "chuhai2.mp3", "chuhai3.mp3"],
		trigger: { global: "phaseEnd" },
		logAudio: () => 4,
		filter(event, player) {
			var targets = [];
			player.getHistory("sourceDamage", evt => {
				if (player != evt.player && evt._dyinged) {
					targets.add(evt.player);
				}
			});
			return targets.length >= 2;
		},
		forced: true,
		locked: false,
		dutySkill: true,
		skillAnimation: true,
		animationColor: "wood",
		group: "twchuhai_lose",
		content() {
			"step 0";
			game.log(player, "成功完成使命");
			player.awakenSkill("twchuhai");
			if (!player.isDisabledJudge()) {
				player.disableJudge();
			}
			event.current = player.next;
			"step 1";
			if (!event.current.countCards("he")) {
				event.goto(3);
			} else {
				event.current.chooseCard("交给" + get.translation(player) + "一张牌", "he", true).set("ai", get.disvalue2);
			}
			"step 2";
			if (result.bool && result.cards && result.cards.length) {
				event.current.give(result.cards, player);
			}
			"step 3";
			event.current = event.current.next;
			if (event.current != player) {
				event.goto(1);
			}
		},
		subSkill: {
			lose: {
				audio: "chuhai3.mp3",
				trigger: {
					global: ["gainAfter", "loseAsyncAfter"],
				},
				forced: true,
				dutySkill: true,
				filter(event, player) {
					var cards = event.getg(player);
					if (!cards.length) {
						return false;
					}
					return game.hasPlayer(current => {
						if (current == player) {
							return false;
						}
						var evt = event.getl(current);
						if (evt && evt.cards && evt.cards.length) {
							return true;
						}
						return false;
					});
				},
				content() {
					"step 0";
					var cards = trigger.getg(player);
					if (!cards.length) {
						event.finish();
						return;
					}
					player
						.chooseCard("h", "除害：将其中一张得到的牌置入弃牌堆", true, function (card) {
							return _status.event.cards?.includes(card);
						})
						.set("ai", function (card) {
							return -get.value(card);
						})
						.set("cards", cards);
					"step 1";
					if (result.bool) {
						player.loseToDiscardpile(result.cards);
					}
				},
			},
		},
	},
};
