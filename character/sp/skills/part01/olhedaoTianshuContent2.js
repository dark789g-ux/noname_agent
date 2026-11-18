import { lib, game, ui, get, ai, _status } from "noname";

export const olhedaoTianshuContent2 = [
	{
		toIndex: 2,
		name: "你可以获得此判定牌",
		filter: item => item.includes("判定牌生效后"),
		effect: {
			filter(event, player) {
				return get.position(event.result.card, true) === "o";
			},
			check(event, player) {
				return get.value(event.result.card) > 0;
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.gain(trigger.result.card, "gain2");
			},
		},
	},
	{
		toIndex: 2,
		name: "若你不是体力上限最高的角色，则你可以增加1点体力上限",
		filter: item => item.includes("判定牌生效后"),
		effect: {
			filter(event, player) {
				return game.hasPlayer(t => t.maxHp > player.maxHp);
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.gainMaxHp();
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以与一名已受伤角色拼点，若你赢，你获得其两张牌",
		effect: {
			filter(event, player) {
				return game.hasPlayer(target => target.isDamaged() && player.canCompare(target));
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
						return target.isDamaged() && player.canCompare(target);
					})
					.set("ai", target => {
						if (!get.event().goon) {
							return 0;
						}
						const player = get.player();
						return -get.attitude(player, target) * (1 + target.countCards("he"));
					})
					.set(
						"goon",
						player.hasCard(card => {
							const val = get.value(card);
							if (val < 0) {
								return true;
							}
							if (val <= 5) {
								return card.number >= 12;
							}
							if (val <= 6) {
								return card.number >= 13;
							}
							return false;
						}, "h")
					)
					.forResult();
			},
			async content(event, trigger, player) {
				const target = event.targets[0];
				lib.skill.olhedao.tianshuClear(event.name, player);
				const result = await player.chooseToCompare(target).forResult();
				if (result.bool) {
					await player.gainPlayerCard(target, 2, "he", true);
				}
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以令至多两名角色各摸一张牌",
		effect: {
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill), [1, 2])
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, { name: "draw" }, player, player);
					})
					.forResult();
			},
			async content(event, trigger, player) {
				const { targets } = event;
				lib.skill.olhedao.tianshuClear(event.name, player);
				if (targets.length === 1) {
					await targets[0].draw();
				} else {
					await game.asyncDraw(targets);
					await game.delayx();
				}
			},
		},
	},
	{
		toIndex: 1,
		name: "你可以令一名角色的手牌上限+2直到其回合结束",
		effect: {
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill))
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, { name: "draw" }, player, player) * (1 + target.countCards("h"));
					})
					.forResult();
			},
			async content(event, trigger, player) {
				const target = event.targets[0];
				lib.skill.olhedao.tianshuClear(event.name, player);
				target.addTempSkill("olhedao_hand", { player: "phaseEnd" });
				target.addMark("olhedao_hand", 2, false);
			},
		},
	},
	{
		toIndex: 3,
		name: "你可以获得两张非基本牌",
		effect: {
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				let list = [];
				while (list.length < 2) {
					const card = get.cardPile(card => get.type(card) !== "basic" && !list.includes(card));
					if (card) {
						list.push(card);
					} else {
						break;
					}
				}
				if (list.length) {
					player.gain(list, "gain2");
				}
			},
		},
	},
	{
		toIndex: 3,
		name: "你可以获得两张锦囊牌",
		effect: {
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				let list = [];
				while (list.length < 2) {
					const card = get.cardPile(card => get.type2(card) === "trick" && !list.includes(card));
					if (card) {
						list.push(card);
					} else {
						break;
					}
				}
				if (list.length) {
					player.gain(list, "gain2");
				}
			},
		},
	},
	{
		toIndex: 3,
		name: "你可以摸三张牌并将武将牌翻面",
		effect: {
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.draw(3);
				player.turnOver();
			},
		},
	},
	{
		toIndex: 3,
		name: "你可令你对一名角色使用牌无距离和任何次数限制直到回合结束",
		effect: {
			filter(event, player) {
				return game.hasPlayer(target => !player.getStorage("olhedao_effect").includes(target));
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
						return !player.getStorage("olhedao_effect").includes(target);
					})
					.set("ai", target => {
						const player = get.player();
						return 1145141919810 - get.attitude(player, target);
					})
					.forResult();
			},
			async content(event, trigger, player) {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.addTempSkill("olhedao_effect", { player: "phaseEnd" });
				player.markAuto("olhedao_effect", event.targets);
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以弃置两张牌，令你与一名其他角色各回复1点体力",
		effect: {
			filter(event, player) {
				return (
					player.countCards("he", card => {
						if (get.position(card) === "h" && _status.connectMode) {
							return true;
						}
						return lib.filter.cardDiscardable(card, player);
					}) >= 2 && game.hasPlayer(target => target != player)
				);
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseCardTarget({
						prompt: get.prompt2(event.skill),
						filterTarget: lib.filter.notMe,
						filterCard: lib.filter.cardDiscardable,
						selectCard: 2,
						position: "he",
						ai1(card) {
							return 7 - get.value(card);
						},
						ai2(target) {
							const player = get.player();
							return get.recoverEffect(target, player, player) + get.recoverEffect(player, player, player);
						},
					})
					.forResult();
			},
			async content(event, trigger, player) {
				const { targets, cards } = event,
					[target] = targets;
				lib.skill.olhedao.tianshuClear(event.name, player);
				await player.discard(cards);
				await player.recover();
				await target.recover();
			},
		},
	},
	{
		toIndex: 2,
		name: "你可令此伤害+1",
		filter: item => item.includes("伤害时"),
		effect: {
			logTarget: "player",
			check(event, player) {
				const target = event.player;
				return get.damageEffect(target, event.source, player) > 0 && !target.hasSkillTag("filterDamage", null, { player: event.source, card: event.card });
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				trigger.num++;
				game.log(trigger.player, "受到的伤害", "#y+1");
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以失去1点体力并摸三张牌",
		effect: {
			check(event, player) {
				return player.countCards("hs", card => player.canSaveCard(card, player)) + player.getHp() - 1 > 0;
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.loseHp();
				player.draw(3);
			},
		},
	},
	{
		toIndex: 3,
		name: "你可以交换两名角色的手牌",
		effect: {
			filter(event, player) {
				return game.hasPlayer(target => target.countCards("h"));
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(
						get.prompt2(event.skill),
						(card, player, target) => {
							if (!ui.selected.targets.length) {
								return true;
							}
							return target.countCards("h") + ui.selected.targets[0].countCards("h") > 0;
						},
						2
					)
					.set("complexTarget", true)
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, "dimeng", player, player);
					})
					.forResult();
			},
			content() {
				const { targets } = event;
				lib.skill.olhedao.tianshuClear(event.name, player);
				targets[0].swapHandcards(targets[1]);
			},
		},
	},
	{
		toIndex: 3,
		name: "你可以交换两名角色装备区的牌",
		effect: {
			filter(event, player) {
				return game.hasPlayer(target => target.countVCards("e"));
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(
						get.prompt2(event.skill),
						(card, player, target) => {
							if (!ui.selected.targets.length) {
								return true;
							}
							return target.countVCards("e") + ui.selected.targets[0].countVCards("e") > 0;
						},
						2
					)
					.set("complexTarget", true)
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, "ganlu", player, player);
					})
					.forResult();
			},
			content() {
				const { targets } = event;
				lib.skill.olhedao.tianshuClear(event.name, player);
				targets[0].swapEquip(targets[1]);
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以防止此伤害，令伤害来源摸三张牌",
		filter: item => item.includes("伤害时"),
		effect: {
			filter(event, player) {
				return event.source?.isIn();
			},
			check(event, player) {
				if (get.attitude(player, event.player) > 0) {
					return true;
				}
				if (get.effect(event.source, { name: "draw" }, player, player) * 3 + event.num * get.damageEffect(player, event.source, player, event.nature) > 0) {
					return true;
				}
				return event.source.hasSkillTag("nogain");
			},
			logTarget: "source",
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				trigger.cancel();
				trigger.source.draw(3);
			},
		},
	},
];
