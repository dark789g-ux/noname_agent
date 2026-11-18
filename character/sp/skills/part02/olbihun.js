import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olbihun" | "olchuanwu" | "oljianhe">} */
export const groupSkills = {
	//张华
	olbihun: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		forced: true,
		filter(event, player) {
			return event.isFirstTarget && player.countCards("h") > player.getHandcardLimit() && event.targets.some(target => target != player);
		},
		//group:'olbihun_give',
		content() {
			if (trigger.targets.length == 1) {
				var cards = trigger.cards.filterInD();
				if (cards.length) {
					game.delayx();
					trigger.targets[0].gain(cards, "gain2");
				}
			}
			var targets = trigger.targets.filter(target => target != player);
			trigger.targets.removeArray(targets);
			trigger.getParent().triggeredTargets1.removeArray(targets);
		},
		ai: {
			threaten: 0.8,
			neg: true,
			effect: {
				player(card, player, target) {
					if ((!card.isCard || !card.cards) && get.itemtype(card) != "card") {
						return;
					}
					let cs = 0;
					if (
						target &&
						player != target &&
						player.countCards("h", i => {
							if (card === i || (card.cards && card.cards.includes(i))) {
								cs++;
								return false;
							}
							return true;
						}) > player.getHandcardLimit()
					) {
						let targets = [],
							evt = _status.event.getParent("useCard");
						targets.addArray(ui.selected.targets);
						if (evt && evt.card == card) {
							targets.addArray(evt.targets);
						}
						if (targets.length) {
							if (targets.length > 1 || !targets.includes(target)) {
								return "zeroplayertarget";
							}
							return;
						}
						let info = get.info(card);
						if (!info || info.notarget || !info.filterTarget) {
							return;
						}
						let range,
							select = get.copy(info.selectTarget),
							filter;
						if (select === undefined) {
							range = [1, 1];
						} else if (typeof select === "number") {
							range = [select, select];
						} else if (get.itemtype(select) === "select") {
							range = select;
						} else if (typeof select === "function") {
							range = select(card, player);
							if (typeof range == "number") {
								range = [range, range];
							}
						}
						if (info.singleCard) {
							range = [1, 1];
						}
						game.checkMod(card, player, range, "selectTarget", player);
						if (range[1] < -1) {
							range = [1, 1];
						} else if (range[0] < 0) {
							if (info.filterTarget === true) {
								filter = game.players.length;
							} else {
								filter = game.countPlayer(current => {
									return info.filterTarget(card, player, current);
								});
							}
							range = [filter, filter];
						}
						if (range && range[0] > 1 && range[1] > 1) {
							return "zeroplayertarget";
						}
						return [0, 0, 0, 1];
					}
				},
			},
		},
		/*subSkill:{
			give:{
				trigger:{player:'useCardAfter'},
				filter:function(event,player){
					return event._olbihun&&event._olbihun.isIn()&&event.cards.filterInD().length;
				},
				forced:true,
				popup:false,
				content:function(){
					trigger._olbihun.gain(trigger.cards.filterInD(),'gain2');
				}
			}
		}*/
	},
	olchuanwu: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		forced: true,
		filter(event, player) {
			return player.getAttackRange() > 0;
		},
		content() {
			var skills = game.filterSkills(
				player.getStockSkills(true, true).filter(skill => {
					const info = get.info(skill);
					return !info.persevereSkill || !info.charlotte;
				}),
				player
			);
			var num = Math.min(player.getAttackRange(), skills.length);
			skills = skills.slice(0, num);
			player.disableSkill("olchuanwu", skills);
			player.addTempSkill("olchuanwu_restore");
			var str = "";
			for (var i of skills) {
				str += "【" + get.translation(i) + "】、";
				player.popup(i);
			}
			str = str.slice(0, -1);
			game.log(player, "的技能", "#g" + str, "失效了");
			player.draw(num);
		},
		subSkill: {
			restore: {
				charlotte: true,
				forced: true,
				popup: false,
				onremove(player) {
					player.enableSkill("olchuanwu");
					game.log(player, "恢复了技能");
				},
			},
		},
	},
	oljianhe: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return !player.getStorage("oljianhe_used").includes(target);
		},
		filterCard(card, player) {
			if (ui.selected.cards.length) {
				var cardx = ui.selected.cards[0];
				if (get.type(cardx) == "equip") {
					return get.type(card) == "equip";
				}
				return get.name(card) == get.name(cardx);
			}
			var cards = player.getCards("he");
			for (var cardx of cards) {
				if (card != cardx) {
					if (get.type(cardx) == "equip" && get.type(card) == "equip") {
						return true;
					}
					if (get.name(card) == get.name(cardx)) {
						return true;
					}
				}
			}
			return false;
		},
		selectCard: [2, Infinity],
		position: "he",
		complexCard: true,
		discard: false,
		lose: false,
		delay: 0.5,
		check(card) {
			if (get.type(card) == "equip") {
				return 10 - get.value(card);
			}
			return 7 - get.value(card);
		},
		content() {
			"step 0";
			event.type = get.type2(cards[0], player);
			player.recast(cards);
			player.addTempSkill("oljianhe_used", "phaseUseAfter");
			player.markAuto("oljianhe_used", [target]);
			"step 1";
			const type = event.type;
			target
				.chooseCard(get.translation(player) + "对你发动了【剑合】", "请重铸" + get.cnNumber(cards.length) + "张" + get.translation(type) + "牌，或点“取消”受到1点雷电伤害", cards.length, "he", (card, player) => {
					return get.type2(card) == _status.event.type && player.canRecast(card);
				})
				.set("ai", card => {
					if (_status.event.goon) {
						return (get.type(card) == "equip" ? 15 : 7) - get.value(card);
					}
					return 0;
				})
				.set("type", type)
				.set("goon", get.damageEffect(target, player, target, "thunder") < 0);
			"step 2";
			if (result.bool) {
				target.recast(result.cards);
			} else {
				target.damage(player, "thunder");
			}
			"step 3";
			game.delayx();
		},
		ai: {
			order(item, player) {
				if (player.hasSkill("olbihun") && player.countCards("h") > player.getHandcardLimit()) {
					return 11;
				}
				return 4;
			},
			threaten: 2.4,
			expose: 0.1,
			result: {
				player: 1,
				target(player, target) {
					const cards = ui.selected.cards,
						type = get.type2(cards[0]),
						damage = get.damageEffect(target, player, target, "thunder");
					if (player === target) {
						if (
							target.countCards("he", card => {
								return !cards.includes(card) && get.type(card) === type && get.value(card) < 6;
							}) >= cards.length
						) {
							return Math.max(2, damage);
						}
						return damage;
					}
					const he = target.getCards("he"),
						known = target.getKnownCards(player);
					let num = 0;
					if (type === "basic") {
						num = 0.42;
					} else if (type === "equip") {
						num = 0.1;
					} else if (type === "trick") {
						num = 0.25;
					}
					if (
						known.filter(card => {
							return get.type(card) === type && get.value(card) < 6;
						}).length +
							(he - known.length) * num >=
						cards.length
					) {
						return Math.max(3, damage);
					}
					return damage;
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "本阶段已对$发动过技能" },
			},
		},
	},
};
