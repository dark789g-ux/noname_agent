import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "pyzhuren_diamond" | "pyzhuren_club" | "pyzhuren_spade" | "pyzhuren_shandian">} */
export const groupSkills = {
	pyzhuren_diamond: {
		audio: true,
		trigger: { source: "damageBegin1" },
		usable: 2,
		equipSkill: true,
		locked: false,
		mod: {
			cardUsable(card, player, num) {
				var cardx = player.getEquip("pyzhuren_diamond");
				if (card.name == "sha" && (!cardx || player.hasSkill("pyzhuren_diamond", null, false) || (!_status.pyzhuren_diamond_temp && !ui.selected.cards.includes(cardx)))) {
					return num + 1;
				}
			},
			cardEnabled2(card, player) {
				if (!_status.event.addCount_extra || player.hasSkill("pyzhuren_diamond", null, false)) {
					return;
				}
				if (card && card == player.getEquip("pyzhuren_diamond")) {
					_status.pyzhuren_diamond_temp = true;
					var bool = lib.filter.cardUsable(get.autoViewAs({ name: "sha" }, ui.selected.cards.concat([card])), player);
					delete _status.pyzhuren_diamond_temp;
					if (!bool) {
						return false;
					}
				}
			},
		},
		filter(event, player) {
			if (event.getParent().name != "sha") {
				return false;
			}
			return (
				player.countCards("he", card => {
					return card != player.getEquip("pyzhuren_diamond");
				}) > 0
			);
		},
		async cost(event, trigger, player) {
			const next = player.chooseToDiscard(
				"he",
				(card, player) => {
					return card != player.getEquip("pyzhuren_diamond");
				},
				get.prompt(event.name.slice(0, -5), trigger.player),
				"弃置一张牌，令即将对其造成的伤害+1"
			);
			next.set("target", trigger.player);
			next.set("ai", card => {
				const { goon, target } = get.event();
				if (goon) {
					return 30 / (1 + target.hp) - get.value(card);
				}
				return -1;
			});
			next.set(
				"goon",
				get.attitude(player, trigger.player) < 0 &&
					!trigger.player.hasSkillTag("filterDamage", null, {
						player: player,
						card: trigger.card,
					}) &&
					get.damageEffect(trigger.player, player, player, get.natureList(trigger)) > 0
			);
			event.result = await next.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.num++;
		},
		ai: {
			expose: 0.25,
			equipValue(card, player) {
				return Math.min(7, 3.6 + player.countCards("h") / 2);
			},
			basic: { equipValue: 4.5 },
		},
	},
	pyzhuren_club: {
		audio: true,
		trigger: { player: "useCard2" },
		equipSkill: true,
		filter(event, player) {
			if (event.card.name != "sha" && get.type(event.card) != "trick") {
				return false;
			}
			var info = get.info(event.card);
			if (info.allowMultiple == false) {
				return false;
			}
			if (event.targets && !info.multitarget) {
				if (
					game.hasPlayer(function (current) {
						return lib.filter.targetEnabled2(event.card, player, current) && lib.filter.targetInRange(event.card, player, current) && !event.targets.includes(current);
					})
				) {
					return true;
				}
			}
			return false;
		},
		usable: 2,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), `为${get.translation(trigger.card)}额外指定一个目标`, (card, player, target) => {
					if (_status.event.targets.includes(target)) {
						return false;
					}
					return lib.filter.targetEnabled2(_status.event.card, player, target) && lib.filter.targetInRange(_status.event.card, player, target);
				})
				.set("ai", target => {
					const trigger = _status.event.getTrigger();
					const player = _status.event.player;
					return get.effect(target, trigger.card, player, player);
				})
				.set("targets", trigger.targets)
				.set("card", trigger.card)
				.forResult();
		},
		async content(event, trigger, player) {
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			trigger.targets.addArray(event.targets);
		},
		ai: {
			equipValue(card, player) {
				if (player.getEnemies().length < 2) {
					if (player.isDamaged()) {
						return 0;
					}
					return 1;
				}
				return 4.5;
			},
			basic: {
				equipValue: 4.5,
			},
		},
		subSkill: {
			lose: {
				audio: "pyzhuren_club",
				forced: true,
				charlotte: true,
				equipSkill: true,
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter: (event, player) => {
					return player.isDamaged() && !player.hasSkillTag("unequip2");
				},
				getIndex(event, player) {
					const evt = event.getl(player);
					const lostCards = [];
					evt.es.forEach(card => {
						const VEquip = evt.vcard_map.get(card);
						if (VEquip.name === "pyzhuren_club") {
							lostCards.add(VEquip);
						}
					});
					return lostCards.length;
				},
				async content(event, trigger, player) {
					await player.recover();
				},
			},
		},
	},
	pyzhuren_spade: {
		audio: true,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha"; //&&event.targets.length==1&&get.color(event.card)=='black';
		},
		check(event, player) {
			return get.attitude(player, event.target) <= 0;
		},
		equipSkill: true,
		logTarget: "target",
		content() {
			var num = player.getHistory("useSkill", function (evt) {
				return evt.skill == "pyzhuren_spade";
			}).length;
			trigger.target.loseHp(Math.min(num, 5)); //.set('source',player);
		},
		ai: {
			equipValue(card, player) {
				return 1 + 4 * Math.min(5, player.getCardUsable("sha"));
			},
			basic: {
				equipValue: 5,
			},
			jueqing: true,
			unequip_ai: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "unequip_ai") {
					return arg && arg.name === "sha";
				}
			},
		},
	},
	pyzhuren_shandian: {
		audio: true,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha"; //&&event.targets.length==1;
		},
		check(event, player) {
			return get.attitude(player, event.target) <= 0;
		},
		equipSkill: true,
		logTarget: "target",
		content() {
			"step 0";
			trigger.target.judge(function (card) {
				var suit = get.suit(card);
				if (suit == "spade") {
					return -10;
				}
				if (suit == "club") {
					return -5;
				}
				return 0;
			}).judge2 = function (result) {
				return result.color == "black" ? true : false;
			};
			"step 1";
			if (result.suit == "spade") {
				trigger.target.damage(3, "thunder");
				//trigger.getParent().excluded.add(trigger.target);
			} else if (result.suit == "club") {
				trigger.target.damage("thunder");
				player.recover();
				player.draw();
			}
		},
		ai: {
			equipValue(card, player) {
				if (player.isDamaged()) {
					return 6;
				}
				return 4.8;
			},
			basic: {
				equipValue: 5,
			},
		},
	},
};
