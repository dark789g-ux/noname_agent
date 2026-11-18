import { lib, game, ui, get, ai, _status } from "noname";

export const olhedaoTianshuContent1 = [
	{
		toIndex: 1,
		name: "你可以摸一张牌",
		effect: {
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.draw();
			},
		},
	},
	{
		toIndex: 1,
		name: "你可以弃置一名角色区域内的一张牌",
		effect: {
			filter(event, player) {
				return game.hasPlayer(target => target.countCards("hej"));
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
						return target.countCards("hej");
					})
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, { name: "guohe" }, player, player);
					})
					.forResult();
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.discardPlayerCard(event.targets[0], "hej", true);
			},
		},
	},
	{
		toIndex: 1,
		name: "你可以观看牌堆顶三张牌，然后将这些牌以任意顺序置于牌堆顶或牌堆底",
		effect: {
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.chooseToGuanxing(3);
			},
		},
	},
	{
		toIndex: 1,
		name: "你可以弃置任意张牌并摸等量张牌",
		effect: {
			filter(event, player) {
				return player.hasCard(card => {
					if (get.position(card) === "h" && _status.connectMode) {
						return true;
					}
					return lib.filter.cardDiscardable(card, player);
				}, "he");
			},
			async cost(event, trigger, player) {
				const name = event.skill;
				event.result = await player.chooseToDiscard(get.prompt2(name), "he", [1, Infinity], "chooseonly").set("ai", lib.skill.zhiheng.check).set("logSkill", name).forResult();
			},
			popup: false,
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.discard(event.cards);
				player.draw(event.cards.length);
			},
		},
	},
	{
		toIndex: 1,
		name: "你可以获得造成伤害的牌",
		filter: item => item.includes("伤害"),
		effect: {
			filter(event, player) {
				return get.itemtype(event.cards) === "cards" && event.cards.someInD();
			},
			prompt2(event, player) {
				return "获得" + get.translation(event.cards.filterInD());
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.gain(trigger.cards.filterInD(), "gain2");
			},
		},
	},
	{
		toIndex: 1,
		name: "你可以视为使用一张无距离和次数限制的【杀】",
		effect: {
			filter(event, player) {
				const card = new lib.element.VCard({ name: "sha", isCard: true });
				return player.hasUseTarget(card, false);
			},
			direct: true,
			async content(event, trigger, player) {
				const card = new lib.element.VCard({ name: "sha", isCard: true });
				event.result = await player
					.chooseUseTarget(get.prompt2(event.name), card, false, "nodistance")
					.set("oncard", () => {
						const event = _status.event.getParent(2);
						lib.skill.olhedao.tianshuClear(event.name, event.player);
					})
					.set("logSkill", event.name)
					.forResult();
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以获得一名角色区域内的一张牌",
		effect: {
			filter(event, player) {
				return game.hasPlayer(target => target.countCards("hej"));
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
						return target.countCards("hej");
					})
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, { name: "shunshou" }, player, player);
					})
					.forResult();
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.gainPlayerCard(event.targets[0], "hej", true);
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以回复1点体力",
		effect: {
			filter(event, player) {
				return player.isDamaged();
			},
			check(event, player) {
				return get.recoverEffect(player, player, player) > 0;
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.recover();
			},
		},
	},
	{
		toIndex: 3,
		name: "你可以摸三张牌，然后弃置一张牌",
		effect: {
			async content(event, trigger, player) {
				lib.skill.olhedao.tianshuClear(event.name, player);
				await player.draw(3);
				await player.chooseToDiscard("he", true);
			},
		},
	},
	{
		toIndex: 3,
		name: "你可以将手牌摸至体力上限（至多摸五张）",
		effect: {
			filter(event, player) {
				return player.countCards("h") < player.maxHp;
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				player.drawTo(Math.min(player.maxHp, player.countCards("h") + 5));
			},
		},
	},
	{
		toIndex: 3,
		name: "你可以令一名角色的非锁定技失效直到其下个回合开始",
		effect: {
			filter(event, player) {
				return game.hasPlayer(target => !target.hasSkill("fengyin"));
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
						return !target.hasSkill("fengyin");
					})
					.set("ai", target => {
						const player = get.player();
						return (
							-get.sgn(get.attitude(player, target)) *
							(target.getSkills(null, false, false).filter(skill => {
								return !get.is.locked(skill);
							}).length +
								1) *
							(target === _status.currentPhase ? 10 : 1)
						);
					})
					.forResult();
			},
			content() {
				const target = event.targets[0];
				lib.skill.olhedao.tianshuClear(event.name, player);
				target.addTempSkill("fengyin", { player: "phaseBegin" });
			},
		},
	},
	{
		toIndex: 3,
		name: "你可以令一名角色摸两张牌并将武将牌翻面",
		effect: {
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill))
					.set("ai", target => {
						const player = get.player(),
							draw = 2;
						if (target.hasSkillTag("noturn")) {
							return 0;
						}
						const att = get.attitude(player, target),
							current = _status.currentPhase;
						const dis = current ? get.distance(current, target, "absolute") : 1;
						if (att == 0) {
							return target.hasJudge("lebu") ? Math.random() / 3 : Math.sqrt(get.threaten(target)) / 5 + Math.random() / 2;
						}
						if (att > 0) {
							if (target.isTurnedOver()) {
								return att + draw;
							}
							if (current && target.getSeatNum() > current.getSeatNum()) {
								return att + draw / 3;
							}
							return (10 * Math.sqrt(Math.max(0.01, get.threaten(target)))) / (3.5 - draw) + dis / (2 * game.countPlayer());
						} else {
							if (target.isTurnedOver()) {
								return att - draw;
							}
							if (current && target.getSeatNum() <= current.getSeatNum()) {
								return -att + draw / 3;
							}
							return (4.25 - draw) * 10 * Math.sqrt(Math.max(0.01, get.threaten(target))) + (2 * game.countPlayer()) / dis;
						}
					})
					.forResult();
			},
			content() {
				const target = event.targets[0];
				lib.skill.olhedao.tianshuClear(event.name, player);
				target.draw(2);
				target.turnOver();
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以令此牌对你无效",
		filter: item => item.includes("你成为") && (item.includes("的目标时") || item.includes("的目标后")),
		effect: {
			prompt2(event, player) {
				return "令" + get.translation(event.card) + "对你无效";
			},
			check(event, player) {
				return get.effect(player, event.card, event.player, player) < 0;
			},
			content() {
				lib.skill.olhedao.tianshuClear(event.name, player);
				trigger.getParent().excluded.add(player);
				game.log(trigger.card, "对", player, "无效");
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以令一名其他角色判定，若判定结果为黑桃，则其受到2点雷属性伤害",
		effect: {
			filter(event, player) {
				return game.hasPlayer(target => target !== player);
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
					.set("ai", target => {
						const player = get.player();
						if (target.hasSkill("hongyan")) {
							return 0;
						}
						return get.damageEffect(target, player, player, "thunder");
					})
					.forResult();
			},
			async content(event, trigger, player) {
				const target = event.targets[0];
				lib.skill.olhedao.tianshuClear(event.name, player);
				const result = await target
					.judge(card => {
						return get.suit(card) === "spade" ? -4 : 0;
					})
					.set("judge2", result => (result.bool === false ? true : false))
					.forResult();
				if (result.bool === false) {
					await target.damage(2, "thunder");
				}
			},
		},
	},
	{
		toIndex: 2,
		name: "你可以打出一张手牌替换此判定牌",
		filter: item => item.includes("判定牌生效前"),
		effect: {
			filter(event, player) {
				return player.countCards("hs");
			},
			async cost(event, trigger, player) {
				event.result = await player
					.chooseCard(`${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`, "hs", card => {
						const player = get.player();
						const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
						if (mod2 != "unchanged") {
							return mod2;
						}
						const mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
						if (mod != "unchanged") {
							return mod;
						}
						return true;
					})
					.set("ai", card => {
						const trigger = get.event().getTrigger();
						const { player, judging } = get.event();
						const result = trigger.judge(card) - trigger.judge(judging);
						const attitude = get.attitude(player, trigger.player);
						if (attitude == 0 || result == 0) {
							return 0;
						}
						if (attitude > 0) {
							return result - get.value(card) / 2;
						} else {
							return -result - get.value(card) / 2;
						}
					})
					.set("judging", trigger.player.judging[0])
					.forResult();
			},
			popup: false,
			async content(event, trigger, player) {
				lib.skill.olhedao.tianshuClear(event.name, player);
				const next = player.respond(event.cards, event.name, "highlight", "noOrdering");
				await next;
				const { cards } = next;
				if (cards?.length) {
					if (trigger.player.judging[0].clone) {
						trigger.player.judging[0].clone.classList.remove("thrownhighlight");
						game.broadcast(card => {
							if (card.clone) {
								card.clone.classList.remove("thrownhighlight");
							}
						}, trigger.player.judging[0]);
						game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
					}
					player.$gain2(trigger.player.judging);
					await player.gain(trigger.player.judging);
					trigger.player.judging[0] = cards[0];
					trigger.orderingCards.addArray(cards);
					game.log(trigger.player, "的判定牌改为", cards);
					await game.delay(2);
				}
			},
			ai: {
				rejudge: true,
				tag: { rejudge: 1 },
			},
		},
	},
];
