import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olfudao" | "olfengyan">} */
export const groupSkills = {
	//丁尚涴
	olfudao: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		locked: false,
		content() {
			"step 0";
			player.draw(3);
			"step 1";
			var num = player.countCards("h");
			if (num > 0) {
				player.chooseCardTarget({
					prompt: "抚悼：将至多三张手张牌交给一名其他角色",
					selectCard: [1, 3],
					filterCard: true,
					filterTarget: lib.filter.notMe,
					position: "h",
					ai1(card) {
						if (card.name == "du") {
							return 10;
						} else if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
							return 0;
						}
						var player = _status.event.player;
						if (
							ui.selected.cards.length > 4 ||
							!game.hasPlayer(function (current) {
								return get.attitude(player, current) > 0 && !current.hasSkillTag("nogain");
							})
						) {
							return 0;
						}
						return 1 / Math.max(0.1, get.value(card));
					},
					ai2(target) {
						var player = _status.event.player,
							att = get.attitude(player, target);
						if (ui.selected.cards[0].name == "du") {
							return -att;
						}
						if (target.hasSkillTag("nogain")) {
							att /= 6;
						}
						return att;
					},
					allowChooseAll: true,
				});
			} else {
				event.goto(3);
			}
			"step 2";
			if (result.bool) {
				player.give(result.cards, result.targets[0]);
			}
			"step 3";
			var num = player.countCards("h");
			if (num > 0) {
				player.chooseToDiscard("h", [1, num], "抚悼：弃置任意张手牌，然后记录手牌数", "allowChooseAll");
			}
			"step 4";
			player.storage.olfudao = player.countCards("h");
			player.markSkill("olfudao");
		},
		intro: {
			content: "一名角色的回合结束时，若其手牌数等于#，你可以与其各摸一张牌。",
		},
		group: "olfudao_qiaoshi",
		subSkill: {
			qiaoshi: {
				audio: "olfudao",
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					if (typeof player.storage.olfudao != "number") {
						return false;
					}
					return event.player.countCards("h") == player.storage.olfudao && event.player.isIn();
				},
				check(event, player) {
					return get.attitude(player, event.player) >= 0;
				},
				logTarget: "player",
				prompt2(event, player) {
					return "与" + get.translation(event.player) + "各摸一张牌";
				},
				content() {
					game.asyncDraw([trigger.player, player]);
				},
			},
		},
	},
	olfengyan: {
		audio: 2,
		trigger: { player: ["damageEnd", "useCard", "respond"] },
		filter(event, player) {
			if (event.name == "damage") {
				return event.source && event.source.isIn() && event.source != player;
			}
			return Array.isArray(event.respondTo) && event.respondTo[0] != player;
		},
		logTarget(event, player) {
			if (event.name == "damage") {
				return event.source;
			}
			return event.respondTo[0];
		},
		forced: true,
		content() {
			"step 0";
			var target = lib.skill.olfengyan.logTarget(trigger, player);
			var str = get.translation(target);
			event.target = target;
			player
				.chooseControl()
				.set("choiceList", ["摸一张牌，然后交给" + str + "一张牌", "令" + str + "摸一张牌，然后" + str + "弃置两张牌"])
				.set("ai", () => (_status.event.att > 0 ? 0 : 1))
				.set("att", get.attitude(player, target));
			"step 1";
			if (result.index == 0) {
				player.draw();
				player.chooseToGive(target, "he", true);
			} else {
				target.draw();
				target.chooseToDiscard(2, "he", true);
			}
		},
	},
};
