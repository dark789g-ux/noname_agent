import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "spzhengjun" | "spshiji" | "sptaoluan">} */
export const groupSkills = {
	//手杀皇甫嵩
	spzhengjun: {
		audio: 3,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return ["zhengsu_leijin", "zhengsu_bianzhen", "zhengsu_mingzhi"].some(i => !player.hasSkill(i));
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([get.prompt(event.skill), [["zhengsu_leijin", "zhengsu_bianzhen", "zhengsu_mingzhi"].filter(i => !player.hasSkill(i)), "vcard"]])
				.set("ai", () => Math.random())
				.forResult();
			event.result = {
				bool: result.bool,
				cost_data: result.links?.[0][2],
			};
		},
		onremove: true,
		logAudio: () => 1,
		async content(event, trigger, player) {
			const name = event.cost_data;
			player.addTempSkill("spzhengjun_share", {
				player: ["phaseDiscardAfter", "phaseAfter"],
			});
			player.addTempSkill(name, { player: ["phaseDiscardAfter", "phaseAfter"] });
			player.markAuto("spzhengjun", name);
			player.popup(name, "thunder");
			await game.delayx();
		},
		subSkill: {
			share: {
				audio: "spzhengjun",
				charlotte: true,
				trigger: { player: "phaseDiscardEnd" },
				forced: true,
				getIndex(event, player) {
					return player.getStorage("spzhengjun");
				},
				logAudio(event, player, _3, data) {
					if (!player.storage[data]) {
						return "spzhengjun3.mp3";
					}
					return "spzhengjun2.mp3";
				},
				async content(event, trigger, player) {
					player.unmarkAuto("spzhengjun", event.indexedData);
					if (!player.storage[event.indexedData]) {
						player.popup("整肃失败", "fire");
						game.log(player, "整肃失败");
						return;
					}
					player.popup("整肃成功", "wood");
					game.log(player, "整肃成功");
					await player.chooseDrawRecover(2, "整肃奖励：摸两张牌或回复1点体力", true);
					let result = await player
						.chooseTarget("整军：是否令一名其他角色也获得整肃奖励？", lib.filter.notMe)
						.set("ai", function (target) {
							const player = _status.event.player;
							return Math.max(2 * get.effect(target, { name: "draw" }, target, player), get.recoverEffect(target, target, player));
						})
						.forResult();
					if (!result.bool) {
						return;
					}
					const target = result.targets[0];
					player.line(target);
					if (target.isHealthy()) {
						result.index = 0;
					} else {
						result = await player
							.chooseControl("摸牌", "回血")
							.set("prompt", "整肃奖励：令" + get.translation(target) + "摸两张牌或回复1点体力")
							.set("ai", function () {
								return _status.event.goon ? 1 : 0;
							})
							.set("goon", 2 * get.effect(target, { name: "draw" }, target, player) < get.recoverEffect(target, target, player))
							.forResult();
					}
					if (result.index) {
						await target.recover();
					} else {
						await target.draw(2);
					}
				},
			},
		},
	},
	spshiji: {
		audio: 2,
		trigger: { source: "damageBegin2" },
		logTarget: "player",
		filter(event, player) {
			return player != event.player && event.hasNature("linked") && event.player.countCards("h") > 0 && !player.isMaxHandcard(true);
		},
		check(event, player) {
			return get.attitude(player, event.player) <= 0;
		},
		content() {
			var target = trigger.player;
			player.viewHandcards(target);
			var hs = target.getCards("h", { color: "red" });
			if (hs.length) {
				target.discard(hs);
				player.draw(hs.length);
			}
		},
	},
	sptaoluan: {
		audio: 2,
		trigger: { global: "judgeFixing" },
		usable: 1,
		filter(event, player) {
			return event.result && event.result.suit == "spade";
		},
		check(event, player) {
			return event.result.judge * get.attitude(player, event.player) <= 0;
		},
		content() {
			"step 0";
			var evt = trigger.getParent();
			if (evt.name == "phaseJudge") {
				evt.excluded = true;
			} else {
				evt.finish();
				evt._triggered = null;
				if (evt.name.startsWith("pre_")) {
					var evtx = evt.getParent();
					evtx.finish();
					evtx._triggered = null;
				}
				var nexts = trigger.next.slice();
				for (var next of nexts) {
					if (next.name == "judgeCallback") {
						trigger.next.remove(next);
					}
				}
				var evts = game.getGlobalHistory("cardMove", function (evt) {
					return evt.getParent(2) == trigger.getParent();
				});
				var cards = [];
				for (var i = evts.length - 1; i >= 0; i--) {
					var evt = evts[i];
					for (var card of evt.cards) {
						if (get.position(card, true) == "o") {
							cards.push(card);
						}
					}
				}
				trigger.orderingCards.addArray(cards);
			}
			var list = [];
			if (get.position(trigger.result.card) == "d") {
				list.push(0);
			}
			if (trigger.player.isIn() && player.canUse({ name: "sha", nature: "fire", isCard: true }, trigger.player, false)) {
				list.push(1);
			}
			if (list.length == 2) {
				player
					.chooseControl()
					.set("choiceList", ["获得" + get.translation(trigger.result.card), "视为对" + get.translation(trigger.player) + "使用一张火【杀】"])
					.set("choice", get.effect(trigger.player, { name: "sha" }, player, player) > 0 ? 1 : 0);
			} else if (list.length == 1) {
				event._result = { index: list[0] };
			} else {
				event.finish();
			}
			"step 1";
			if (result.index == 0) {
				player.gain(trigger.result.card, "gain2");
			} else {
				player.useCard({ name: "sha", nature: "fire", isCard: true }, trigger.player, false);
			}
		},
	},
};
