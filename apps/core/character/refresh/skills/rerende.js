import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rerendeSkills = {
	rerende: {
		selectionSpec: true,
		audio: 2,
		audioname: ["gz_jun_liubei"],
		audioname2: { shen_caopi: "rerende_shen_caopi" },
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("h") && game.hasPlayer(current => get.info("rerende").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			return !player.getStorage("rerende_targeted").includes(target);
		},
		filterCard: true,
		selectCard: [1, Infinity],
		allowChooseAll: true,
		discard: false,
		lose: false,
		delay: false,
		check(card) {
			if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
				return 0;
			}
			if (!ui.selected.cards.length && card.name == "du") {
				return 20;
			}
			var player = get.owner(card);
			if (ui.selected.cards.length >= Math.max(2, player.countCards("h") - player.hp)) {
				return 0;
			}
			if (player.hp == player.maxHp || player.countMark("rerende") < 0 || player.countCards("h") <= 1) {
				var players = game.filterPlayer();
				for (var i = 0; i < players.length; i++) {
					if (players[i].hasSkill("haoshi") && !players[i].isTurnedOver() && !players[i].hasJudge("lebu") && get.attitude(player, players[i]) >= 3 && get.attitude(players[i], player) >= 3) {
						return 11 - get.value(card);
					}
				}
				if (player.countCards("h") > player.hp) {
					return 10 - get.value(card);
				}
				if (player.countCards("h") > 2) {
					return 6 - get.value(card);
				}
				return -1;
			}
			return 10 - get.value(card);
		},
		async content(event, trigger, player) {
			const { target, cards, name } = event;
			player.addTempSkill(name + "_targeted", "phaseUseAfter");
			player.markAuto(name + "_targeted", [target]);
			let num = 0;
			player.getHistory("lose", evt => {
				if (evt.getParent(2).name == name && evt.getParent("phaseUse") == event.getParent(3)) {
					num += evt.cards.length;
				}
			});
			if (!player.storage[event.name]) {
				player.when({ player: "phaseUseEnd" }).step(async () => {
					player.clearMark(event.name, false);
				});
			}
			player.addMark(event.name, num + cards.length, false);
			await player.give(cards, target);
			const list = get.inpileVCardList(info => {
				return info[0] == "basic" && player.hasUseTarget(new lib.element.VCard({ name: info[2], nature: info[3], isCard: true }), null, true);
			});
			if (num < 2 && num + cards.length > 1 && list.length) {
				const result = await player
					.chooseButton(["是否视为使用一张基本牌？", [list, "vcard"]])
					.set("ai", button => {
						return get.player().getUseValue({ name: button.link[2], nature: button.link[3], isCard: true });
					})
					.forResult();
				if (!result?.links?.length) {
					return;
				}
				await player.chooseUseTarget(get.autoViewAs({ name: result.links[0][2], nature: result.links[0][3], isCard: true }), true);
			}
		},
		ai: {
			fireAttack: true,
			order(skill, player) {
				if (player.hp < player.maxHp && player.countMark("rerende") < 2 && player.countCards("h") > 1) {
					return 10;
				}
				return 4;
			},
			result: {
				target(player, target) {
					if (target.hasSkillTag("nogain")) {
						return 0;
					}
					if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
						if (target.hasSkillTag("nodu")) {
							return 0;
						}
						return -10;
					}
					if (target.hasJudge("lebu")) {
						return 0;
					}
					var nh = target.countCards("h");
					var np = player.countCards("h");
					if (player.hp == player.maxHp || player.countMark("rerende") < 0 || player.countCards("h") <= 1) {
						if (nh >= np - 1 && np <= player.hp && !target.hasSkill("haoshi")) {
							return 0;
						}
					}
					return Math.max(1, 5 - nh);
				},
			},
			effect: {
				target_use(card, player, target) {
					if (player == target && get.type(card) == "equip") {
						if (player.countCards("e", { subtype: get.subtype(card) })) {
							if (game.hasPlayer(current => current != player && get.attitude(player, current) > 0)) {
								return 0;
							}
						}
					}
				},
			},
			threaten: 0.8,
		},
		marktext: "仁",
		onremove: true,
		intro: {
			content: "本阶段已仁德牌数：#",
			onunmark: true,
		},
		subSkill: {
			targeted: {
				onremove: true,
				charlotte: true,
			},
		},
	},
	liyu: {
		audio: 2,
		trigger: { source: "damageSource" },
		forced: true,
		filter(event, player) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.card && event.card.name == "sha" && event.player.isIn() && event.player.countGainableCards(player, "he") > 0;
		},
		check() {
			return false;
		},
		async content(event, trigger, player) {
			// step 0
			const result = await trigger.player
				.chooseTarget(function (card, player, target) {
					var evt = _status.event.getParent();
					return evt.player.canUse({ name: "juedou" }, target) && target != _status.event.player;
				}, get.prompt("liyu"))
				.set("ai", function (target) {
					var evt = _status.event.getParent();
					return get.effect(target, { name: "juedou" }, evt.player, _status.event.player) - 2;
				})
				.forResult();

			// step 1
			if (result.bool) {
				await player.gainPlayerCard(trigger.player, "he", true);
				event.target = result.targets[0];
				trigger.player.line(player, "green");
			} else {
				return;
			}

			// step 2
			if (event.target) {
				await player.useCard({ name: "juedou", isCard: true }, event.target, "noai");
			}
		},
		ai: {
			halfneg: true,
		},
	},
	/*reqicai:{
		trigger:{player:'equipEnd'},
		frequent:true,
		content:function(){
			player.draw();
		},
		mod:{
			targetInRange:function(card,player,target,now){
				var type=get.type(card);
				if(type=='trick'||type=='delay') return true;
			}
		},
	},*/
	retuxi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		direct: true,
		filter(event) {
			return event.num > 0;
		},
		async content(event, trigger, player) {
			// step 0
			const result = await player
				.chooseTarget(
					get.prompt("retuxi"),
					[1, trigger.num],
					function (card, player, target) {
						return target.countCards("h") > 0 && player != target && target.countCards("h") >= player.countCards("h");
					},
					function (target) {
						var att = get.attitude(_status.event.player, target);
						if (target.hasSkill("tuntian")) {
							return att / 10;
						}
						return 1 - att;
					}
				)
				.forResult();
			// step 1
			if (result.bool) {
				player.logSkill("retuxi", result.targets);
				await player.gainMultiple(result.targets);
				trigger.num -= result.targets.length;
			} else {
				event.finish();
				return;
			}
			// step 2
			if (trigger.num <= 0) {
				await game.delay();
			}
		},
		ai: {
			threaten: 1.6,
			expose: 0.2,
		},
	},
	reguicai: {
		audio: 2,
		audioname: ["new_simayi"],
		trigger: { global: "judge" },
		filter(event, player) {
			return player.countCards("hes") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(`${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`, "hes", card => {
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
					let val = get.value(card);
					if (get.subtype(card) == "equip2") {
						val /= 2;
					} else {
						val /= 4;
					}
					if (attitude == 0 || result == 0) {
						return 0;
					}
					if (attitude > 0) {
						return result - val;
					}
					return -result - val;
				})
				.set("judging", trigger.player.judging[0])
				.setHiddenSkill(event.skill)
				.forResult();
		},
		preHidden: true,
		popup: false,
		async content(event, trigger, player) {
			const next = player.respond(event.cards, event.name, "highlight", "noOrdering");
			await next;
			const { cards } = next;
			if (cards?.length) {
				if (trigger.player.judging[0].clone) {
					trigger.player.judging[0].clone.classList.remove("thrownhighlight");
					game.broadcast(function (card) {
						if (card.clone) {
							card.clone.classList.remove("thrownhighlight");
						}
					}, trigger.player.judging[0]);
					game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
				}
				await game.cardsDiscard(trigger.player.judging[0]);
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
	refankui: {
		audio: 2,
		audioname2: { boss_chujiangwang: "boss_chujiangwang_fankui", sxrm_caocao: "refankui_sxrm_caocao" },
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.source && event.source.countGainableCards(player, event.source != player ? "he" : "e") && event.num > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.choosePlayerCard(get.prompt(event.skill, trigger.source), trigger.source, trigger.source != player ? "he" : "e")
				.set("ai", button => {
					let val = get.buttonValue(button);
					if (get.event().att > 0) {
						return 1 - val;
					}
					return val;
				})
				.set("att", get.attitude(player, trigger.source))
				.forResult();
		},
		logTarget: "source",
		getIndex(event, player) {
			return event.num;
		},
		async content(event, trigger, player) {
			await player.gain(event.cards, trigger.source, "giveAuto", "bySelf");
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.countCards("he") > 1 && get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -1.5];
						}
						if (get.attitude(target, player) < 0) {
							return [1, 1];
						}
					}
				},
			},
		},
	},
	reluoyi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		filter(event, player) {
			return !event.numFixed;
		},
		check(event, player) {
			if (player.countCards("h", "sha")) {
				return true;
			}
			return Math.random() < 0.5;
		},
		async content(event, trigger, player) {
			// step 0
			player.addTempSkill("reluoyi2", { player: "phaseBefore" });
			trigger.changeToZero();

			// step 1
			event.cards = get.cards(3);
			await player.showCards(event.cards, "裸衣");

			// step 2
			const cards = event.cards;
			for (let i = 0; i < cards.length; i++) {
				if (get.type(cards[i]) != "basic" && cards[i].name != "juedou" && (get.type(cards[i]) != "equip" || get.subtype(cards[i]) != "equip1")) {
					cards[i].discard();
					cards.splice(i--, 1);
				}
			}
			await player.gain(cards, "gain2");
		},
	},
	reluoyi2: {
		trigger: { source: "damageBegin1" },
		sourceSkill: "reluoyi",
		filter(event) {
			return event.card && (event.card.name == "sha" || event.card.name == "juedou") && event.notLink();
		},
		forced: true,
		charlotte: true,
		async content(event, trigger, player) {
			trigger.num++;
		},
		ai: {
			damageBonus: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "damageBonus") {
					return arg && arg.card && (arg.card.name === "sha" || arg.card.name === "juedou");
				}
			},
		},
	},
	reganglie: {
		audio: 2,
		audioname2: { sxrm_caocao: "reganglie_sxrm_caocao" },
		trigger: { player: "damageEnd" },
		getIndex(event, player, triggername) {
			if (get.mode() == "guozhan") {
				return 1;
			}
			return event.num;
		},
		filter(event) {
			return event.num > 0;
		},
		check(event, player) {
			if (!event.source?.isIn()) {
				return Math.random() < 0.5;
			}
			return get.attitude(player, event.source) <= 0;
		},
		prompt2(event, player) {
			let str = "你可以判定";
			if (event.source?.isIn()) {
				str += `，若结果为：红色，你对${get.translation(event.source)}造成1点伤害；黑色，你弃置${get.translation(event.source)}一张牌。`;
			} else {
				str += "。";
			}
			return str;
		},
		preHidden: true,
		async content(event, trigger, player) {
			const { source } = trigger;
			const result = await player
				.judge(card => {
					if (get.color(card) == "red") {
						return 1;
					}
					return 0;
				})
				.forResult();
			if (!source?.isIn()) {
				return;
			}
			switch (result?.color) {
				case "black":
					if (source.countDiscardableCards(player, "he")) {
						await player.discardPlayerCard(source, "he", true);
					}
					break;

				case "red":
					await source.damage();
					break;
				default:
					break;
			}
		},
		ai: {
			maixie_defend: true,
			expose: 0.4,
		},
	},
};
