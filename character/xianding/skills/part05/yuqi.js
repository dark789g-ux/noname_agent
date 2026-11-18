import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yuqi" | "shanshen" | "xianjing">} */
export const groupSkills = {
	//曹金玉
	yuqi: {
		audio: 2,
		trigger: { global: "damageEnd" },
		getInfo(player) {
			if (!player.storage.yuqi) {
				player.storage.yuqi = [0, 3, 1, 1];
			}
			return player.storage.yuqi;
		},
		usable: 2,
		filter(event, player) {
			var list = lib.skill.yuqi.getInfo(player);
			return event.player.isIn() && get.distance(player, event.player) <= list[0];
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const list = lib.skill.yuqi.getInfo(player);
			const {
				targets: [target],
			} = event;
			const cards = get.cards(list[1], true);
			await game.cardsGotoOrdering(cards);
			const next = player.chooseToMove_new(true, "隅泣");
			next.set("list", [
				["牌堆顶的牌", cards],
				[["交给" + get.translation(target) + '<div class="text center">至少一张' + (list[2] > 1 ? "<br>至多" + get.cnNumber(list[2]) + "张" : "") + "</div>"], ['交给自己<div class="text center">至多' + get.cnNumber(list[3]) + "张</div>"]],
			]);
			next.set("filterMove", function (from, to, moved) {
				var info = lib.skill.yuqi.getInfo(_status.event.player);
				if (to == 1) {
					return moved[1].length < info[2];
				}
				if (to == 2) {
					return moved[2].length < info[3];
				}
				return true;
			});
			next.set("processAI", function (list) {
				var cards = list[0][1].slice(0).sort(function (a, b) {
						return get.value(b, "raw") - get.value(a, "raw");
					}),
					player = _status.event.player,
					target = _status.event.getTrigger().player;
				var info = lib.skill.yuqi.getInfo(_status.event.player);
				var cards1 = cards.splice(0, Math.min(info[3], cards.length - 1));
				var card2;
				if (get.attitude(player, target) > 0) {
					card2 = cards.shift();
				} else {
					card2 = cards.pop();
				}
				return [cards, [card2], cards1];
			});
			next.set("filterOk", function (moved) {
				return moved[1].length > 0;
			});
			const result = await next.forResult();
			if (result.bool) {
				const moved = result.moved;
				cards.removeArray(moved[1]);
				cards.removeArray(moved[2]);
				if (cards.length) {
					await game.cardsGotoPile(cards.slice().reverse(), "insert");
				}
				const list = [[target, moved[1]]];
				if (moved[2].length) {
					list.push([player, moved[2]]);
				}
				await game
					.loseAsync({
						gain_list: list,
						giver: player,
						animate: "draw",
					})
					.setContent("gaincardMultiple");
			}
		},
		mark: true,
		intro: {
			content(storage, player) {
				var info = lib.skill.yuqi.getInfo(player);
				return '<div class="text center"><span class=thundertext>蓝色：' + info[0] + "</span>　<span class=firetext>红色：" + info[1] + "</span><br><span class=greentext>绿色：" + info[2] + "</span>　<span class=yellowtext>黄色：" + info[3] + "</span></div>";
			},
		},
		ai: {
			threaten: 8.8,
		},
		init(player, skill) {
			const list = lib.skill.yuqi.getInfo(player);
			player.addTip(skill, get.translation(skill) + " " + list.slice().join(" "));
		},
		onremove: (player, skill) => player.removeTip(skill),
	},
	shanshen: {
		audio: 2,
		trigger: { global: "die" },
		async cost(event, trigger, player) {
			const bool = !player.hasAllHistory("sourceDamage", function (evt) {
				return evt.player == trigger.player;
			});
			const list = get.info("yuqi").getInfo(player);
			const result = await player
				.chooseControl("<span class=thundertext>蓝色(" + list[0] + ")</span>", "<span class=firetext>红色(" + list[1] + ")</span>", "<span class=greentext>绿色(" + list[2] + ")</span>", "<span class=yellowtext>黄色(" + list[3] + ")</span>", "cancel2")
				.set("prompt", get.prompt(event.skill))
				.set("prompt2", "令〖隅泣〗中的一个数字+2" + (bool ? "并回复1点体力" : ""))
				.set("ai", function () {
					const player = _status.event.player,
						info = lib.skill.yuqi.getInfo(player);
					if (
						info[0] < info[3] &&
						game.countPlayer(function (current) {
							return get.distance(player, current) <= info[0];
						}) < Math.min(3, game.countPlayer())
					) {
						return 0;
					}
					if (info[3] < info[1] - 1) {
						return 3;
					}
					if (info[1] < 5) {
						return 1;
					}
					if (
						info[0] < 5 &&
						game.hasPlayer(function (current) {
							return current != player && get.distance(player, current) > info[0];
						})
					) {
						return 0;
					}
					return 2;
				})
				.forResult();
			if (result.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: [result.control, result.index],
				};
			}
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				targets,
				cost_data: [control, index],
			} = event;
			const name = "yuqi";
			const list = get.info(name).getInfo(player);
			list[index] = Math.min(5, list[index] + 2);
			game.log(player, "将", control, "数字改为", "#y" + list[index]);
			player.markSkill(name);
			get.info(name).init(player, name);
			if (
				!player.hasAllHistory("sourceDamage", function (evt) {
					return evt.player == targets[0];
				})
			) {
				await player.recover();
			}
		},
		ai: {
			combo: "yuqi",
		},
	},
	xianjing: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		async cost(event, trigger, player) {
			const list = get.info("yuqi").getInfo(player);
			const result = await player
				.chooseControl("<span class=thundertext>蓝色(" + list[0] + ")</span>", "<span class=firetext>红色(" + list[1] + ")</span>", "<span class=greentext>绿色(" + list[2] + ")</span>", "<span class=yellowtext>黄色(" + list[3] + ")</span>", "cancel2")
				.set("prompt", get.prompt(event.skill))
				.set("prompt2", "令〖隅泣〗中的一个数字+1")
				.set("ai", function () {
					const player = _status.event.player,
						info = lib.skill.yuqi.getInfo(player);
					if (
						info[0] < info[3] &&
						game.countPlayer(function (current) {
							return get.distance(player, current) <= info[0];
						}) < Math.min(3, game.countPlayer())
					) {
						return 0;
					}
					if (info[3] < info[1] - 1) {
						return 3;
					}
					if (info[1] < 5) {
						return 1;
					}
					if (
						info[0] < 5 &&
						game.hasPlayer(function (current) {
							return current != player && get.distance(player, current) > info[0];
						})
					) {
						return 0;
					}
					return 2;
				})
				.forResult();
			if (result.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: [result.control, result.index],
				};
			}
		},
		async content(event, trigger, player) {
			const {
				cost_data: [control, index],
			} = event;
			const name = "yuqi";
			const list = get.info(name).getInfo(player);
			list[index] = Math.min(5, list[index] + 1);
			game.log(player, "将", control, "数字改为", "#y" + list[index]);
			player.markSkill(name);
			get.info(name).init(player, name);
			if (player.isDamaged()) {
				return;
			}
			const result = await player
				.chooseControl("<span class=thundertext>蓝色(" + list[0] + ")</span>", "<span class=firetext>红色(" + list[1] + ")</span>", "<span class=greentext>绿色(" + list[2] + ")</span>", "<span class=yellowtext>黄色(" + list[3] + ")</span>", "cancel2")
				.set("prompt", get.prompt(event.skill))
				.set("prompt2", "令〖隅泣〗中的一个数字+1")
				.set("ai", function () {
					const player = _status.event.player,
						info = lib.skill.yuqi.getInfo(player);
					if (
						info[0] < info[3] &&
						game.countPlayer(function (current) {
							return get.distance(player, current) <= info[0];
						}) < Math.min(3, game.countPlayer())
					) {
						return 0;
					}
					if (info[3] < info[1] - 1) {
						return 3;
					}
					if (info[1] < 5) {
						return 1;
					}
					if (
						info[0] < 5 &&
						game.hasPlayer(function (current) {
							return current != player && get.distance(player, current) > info[0];
						})
					) {
						return 0;
					}
					return 2;
				})
				.forResult();
			if (result.control != "cancel2") {
				const { control, index } = result;
				list[index] = Math.min(5, list[index] + 1);
				game.log(player, "将", control, "数字改为", "#y" + list[index]);
				player.markSkill(name);
				get.info(name).init(player, name);
			}
		},
		ai: {
			combo: "yuqi",
		},
	},
};
