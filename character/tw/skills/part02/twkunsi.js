import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twkunsi" | "twlinglu">} */
export const groupSkills = {
	//蹇硕
	twkunsi: {
		audio: 2,
		enable: "phaseUse",
		onremove: true,
		derivation: "twlinglu",
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return (
					player.canUse({ name: "sha", isCard: true }, current, false) &&
					current != player &&
					!player.getStorage("twkunsi").includes(current)
				);
			});
		},
		filterTarget(card, player, target) {
			return player.canUse({ name: "sha", isCard: true }, target, false) && target != player && !player.getStorage("twkunsi").includes(target);
		},
		content() {
			"step 0";
			player.markAuto("twkunsi", [target]);
			player.storage.twkunsi.sortBySeat();
			player.markSkill("twkunsi");
			player.useCard({ name: "sha", isCard: true }, target, false).animate = false;
			"step 1";
			if (
				!player.hasHistory("sourceDamage", function (evt) {
					var card = evt.card;
					if (!card || card.name != "sha") {
						return false;
					}
					var evtx = evt.getParent("useCard");
					return evtx.card == card && evtx.getParent() == event;
				})
			) {
				player.line(target);
				target.markAuto("twlinglu", [player]);
				target.addAdditionalSkills("twkunsi_temp", "twlinglu");
				player.markAuto("twkunsi_clear", [target]);
				player.addTempSkill("twkunsi_clear", { player: "phaseBegin" });
			}
		},
		intro: { content: "已对$发动过〖困兕〗" },
		ai: {
			order() {
				return get.order({ name: "sha" }) - 0.1;
			},
			expose: 0.2,
			result: {
				target(player, target) {
					if (
						target.countCards("h") <= target.hp &&
						!target.mayHaveShan(player, "use") &&
						get.effect(target, { name: "sha", isCard: true }, player, player) > 0
					) {
						return -1;
					} else if (target.countCards("h") > target.hp && target.hp > 2 && target.hasShan()) {
						return 1;
					}
					return 0;
				},
			},
		},
		subSkill: {
			clear: {
				forced: true,
				onremove(player, skill) {
					var targets = player.getStorage(skill);
					for (var target of targets) {
						if (target.isIn()) {
							target.removeAdditionalSkill("twkunsi_temp");
						}
					}
				},
			},
		},
	},
	twlinglu: {
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player;
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("twlinglu"), function (card, player, target) {
					return target != player;
				})
				.set("ai", function (target) {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (target.countCards("hs") > 4 && target.hp >= 3) {
						return att;
					}
					if (player.getStorage("twlinglu").includes(target)) {
						return -2 * att;
					}
					return -att;
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twlinglu", target);
				target.addTempSkill("twlinglu_order", { player: "phaseAfter" });
				if (!target.storage.twlinglu_settle) {
					target.storage.twlinglu_settle = [];
				}
				target.storage.twlinglu_settle.unshift([player, 1]);
				if (player.getStorage("twlinglu").includes(target)) {
					player.chooseBool("是否令" + get.translation(target) + "于〖令戮〗失败时进行两次结算？").set("ai", function () {
						return true;
					});
				} else {
					event.finish();
				}
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				target.storage.twlinglu_settle[0][1]++;
				game.log(target, "于本次强令失败时进行两次结算");
			}
		},
		ai: { expose: 0.2 },
		subSkill: {
			order: {
				audio: 2,
				trigger: { source: "damageSource" },
				group: "twlinglu_settle",
				silent: true,
				charlotte: true,
				onremove: true,
				mark: true,
				marktext: "令",
				intro: {
					content(storage, player) {
						return "<li>任务目标：于你下回合结束前造成的伤害不小于2点<br><li>已造成" + player.countMark("twlinglu_order") + "点伤害";
					},
				},
				content() {
					player.addMark("twlinglu_order", trigger.num, false);
				},
			},
			settle: {
				audio: "twlinglu_order",
				trigger: { player: "phaseEnd" },
				charlotte: true,
				silent: true,
				onremove: true,
				filter(event, player) {
					return player.getStorage("twlinglu_settle").length > 0;
				},
				content() {
					"step 0";
					var list = player.getStorage("twlinglu_settle").shift();
					var target = list[0],
						count = list[1] || 1;
					event.target = target;
					event.count = count;
					"step 1";
					if (player.countMark("twlinglu_order") >= 2) {
						game.log(player, "成功完成了", target, "发布的", "#g【令戮】", "强令");
						player.popup("强令成功", "wood");
						player.draw(2);
						event.finish();
					} else {
						game.log(player, "未完成", target, "发布的", "#g【令戮】", "强令");
						player.popup("强令失败", "fire");
					}
					"step 2";
					if (player.countMark("twlinglu_order") >= 2) {
						game.delayx();
					} else {
						event.count--;
						player.loseHp();
					}
					"step 3";
					if (event.count > 0) {
						event.goto(2);
					}
					"step 4";
					if (player.getStorage("twlinglu_settle").length > 0) {
						event.goto(0);
						game.delayx();
					}
				},
			},
		},
	},
};
