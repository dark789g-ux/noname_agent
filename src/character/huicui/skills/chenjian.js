import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "chenjian" | "xixiu" | "tongli" | "shezang">} */
export const groupSkills = {
	//滕胤
	chenjian: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		prompt2(event, player) {
			return "亮出牌堆顶的" + get.cnNumber(3 + player.countMark("chenjian")) + "张牌，然后执行以下一至两项：⒈弃置一张牌，然后令一名角色获得与你弃置牌花色相同的牌。⒉使用其中剩余的一张牌。若你执行了所有选项，则你获得一枚“陈见”并重铸所有手牌";
		},
		async content(event, trigger, player) {
			const cards = get.cards(3 + player.countMark("chenjian"));
			event.cards = cards;
			await player.showCards(cards, get.translation(player) + "发动了【陈见】");

			const list = [];
			if (
				player.countCards("he", i => {
					return lib.filter.cardDiscardable(i, player, "chenjian");
				})
			) {
				list.push("选项一");
			}
			if (
				event.cards.some(i => {
					return player.hasUseTarget(i);
				})
			) {
				list.push("选项二");
			}

			let control;
			if (list.length === 1) {
				control = list[0];
			} else if (list.length > 1) {
				const result = await player
					.chooseControl(list)
					.set("choiceList", ["弃置一张牌，然后令一名角色获得与你弃置牌花色相同的牌", "使用" + get.translation(event.cards) + "中的一张牌"])
					.set("prompt", "陈见：请选择一项")
					.set("ai", () => {
						let player = _status.event.player,
							cards = _status.event.getParent().cards;
						if (
							cards.some(i => {
								return player.getUseValue(i) > 0;
							})
						) {
							return "选项二";
						}
						return "选项一";
					})
					.forResult();
				control = result.control;
			} else {
				return;
			}

			let goon = 0;
			const choosed = control;
			if (choosed === "cancel2") {
				return;
			}

			let step = choosed === "选项二" ? 6 : 3;
			let shouldEnd = false;
			while (true) {
				if (step === 3) {
					if (
						player.countCards("he", i => {
							return lib.filter.cardDiscardable(i, player, "chenjian");
						})
					) {
						const result = await player
							.chooseToDiscard("he", !goon)
							.set("ai", function (card) {
								let evt = _status.event.getParent(),
									val = goon && evt.player.countMark("chenjian") < 2 ? 0 : -get.value(card),
									suit = get.suit(card);
								for (let i of evt.cards) {
									if (get.suit(i, false) == suit) {
										val += get.value(i, "raw");
									}
								}
								return val;
							})
							.set("prompt", "陈见：" + (goon ? "是否" : "请") + "弃置一张牌，然后令一名角色获得" + get.translation(event.cards) + "中花色与之相同的牌" + (goon ? "？" : ""))
							.forResult();
						if (!result.bool) {
							return;
						}

						goon++;
						const suit = get.suit(result.cards[0], player);
						const cards2 = event.cards.filter(function (i) {
							return get.suit(i, false) == suit;
						});
						if (cards2.length) {
							const targetResult = await player
								.chooseTarget(true, "选择一名角色获得" + get.translation(cards2))
								.set("ai", function (target) {
									let att = get.attitude(_status.event.player, target);
									if (att > 0) {
										return att + Math.max(0, 5 - target.countCards("h"));
									}
									return att;
								})
								.forResult();
							if (targetResult.bool) {
								const target = targetResult.targets[0];
								player.line(target, "green");
								await target.gain(cards2, "gain2");
								event.cards.removeArray(cards2);
							}
							if (choosed === "选项二") {
								shouldEnd = true;
								break;
							}
							step = 6;
							continue;
						}
						if (choosed === "选项一") {
							step = 6;
							continue;
						}
						shouldEnd = true;
						break;
					}
					if (choosed === "选项一") {
						step = 6;
						continue;
					}
					return;
				}

				const cards2 = cards.filter(function (i) {
					return player.hasUseTarget(i);
				});
				if (cards2.length) {
					const result = await player
						.chooseButton(["陈见：" + (goon ? "是否" : "请") + "使用其中一张牌" + (goon ? "？" : ""), cards2], !goon)
						.set("ai", function (button) {
							return player.getUseValue(button.link);
						})
						.forResult();
					if (!result.bool) {
						return;
					}

					await player.chooseUseTarget(true, result.links[0], false);
					event.cards.removeArray(result.links);
					goon += 2;
					if (choosed === "选项二") {
						step = 3;
						continue;
					}
					shouldEnd = true;
					break;
				}

				if (choosed === "选项二") {
					step = 3;
					continue;
				}
				return;
			}

			if (shouldEnd && goon > 2) {
				if (player.countMark("chenjian") < 2) {
					player.addMark("chenjian", 1, false);
				}
				await player.recast(player.getCards("h", lib.filter.cardRecastable));
			}
		},
		marktext: "见",
		intro: { content: "展示牌数量+#" },
	},
	xixiu: {
		mod: {
			canBeDiscarded(card, player, target) {
				if (player != target && get.position(card) == "e" && target.countCards("e") == 1) {
					return false;
				}
			},
		},
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		forced: true,
		filter(event, player) {
			if (player == event.player || !player.countCards("e")) {
				return false;
			}
			var suit = get.suit(event.card, false);
			if (suit == "none") {
				return false;
			}
			return player.hasCard(function (card) {
				return get.suit(card, player) == suit;
			}, "e");
		},
		async content(event, trigger, player) {
			player.draw();
		},
		ai: {
			effect: {
				target_use(card, player, target) {
					if (typeof card == "object" && player != target) {
						var suit = get.suit(card);
						if (suit == "none") {
							return;
						}
						if (
							player.hasCard(function (card) {
								return get.suit(card, player) == suit;
							}, "e")
						) {
							return [1, 0.08];
						}
					}
				},
			},
		},
	},
	//张嫙
	tongli: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!event.isFirstTarget || (event.card.storage && event.card.storage.tongli)) {
				return false;
			}
			var type = get.type(event.card);
			if (type != "basic" && type != "trick") {
				return false;
			}
			var hs = player.getCards("h");
			if (!hs.length) {
				return false;
			}
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != player) {
				return false;
			}
			var num1 = player.getHistory("useCard", function (evtx) {
				if (evtx.getParent("phaseUse") != evt) {
					return false;
				}
				return !evtx.card.storage || !evtx.card.storage.tongli;
			}).length;
			if (hs.length < num1) {
				return false;
			}
			var list = [];
			for (var i of hs) {
				list.add(get.suit(i, player));
			}
			return list.length == num1;
		},
		prompt2(event, player) {
			var evt = event.getParent("phaseUse");
			var num = player.getHistory("useCard", function (evtx) {
				if (evtx.getParent("phaseUse") != evt) {
					return false;
				}
				return !evtx.card.storage || !evtx.card.storage.tongli;
			}).length;
			//var str='视为额外使用'+get.cnNumber(num)+'张'
			var str = "额外结算" + get.cnNumber(num) + "次";
			if (event.card.name == "sha" && game.hasNature(event.card)) {
				str += get.translation(event.card.nature);
			}
			return str + "【" + get.translation(event.card.name) + "】";
		},
		check(event, player) {
			return !get.tag(event.card, "norepeat");
		},
		async content(event, trigger, player) {
			//player.addTempSkill('tongli_effect');
			var evt = trigger.getParent("phaseUse");
			var num = player.getHistory("useCard", function (evtx) {
				if (evtx.getParent("phaseUse") != evt) {
					return false;
				}
				return true;
				//return !evtx.card.storage||!evtx.card.storage.tongli;
			}).length;
			trigger.getParent().effectCount += num;
		},
		/*subSkill:{
			effect:{
				trigger:{player:'useCardAfter'},
				forced:true,
				charlotte:true,
				filter:function(event,player){
					return event.tongli_effect!=undefined;
				},
				content:function(){
					'step 0'
					event.card=trigger.tongli_effect[0];
					event.count=trigger.tongli_effect[1];
					'step 1'
					event.count--;
					for(var i of trigger.targets){
						if(!i.isIn()||!player.canUse(card,i,false)) return;
					}
					if(trigger.addedTarget&&!trigger.addedTarget.isIn()) return;
					if(trigger.addedTargets&&trigger.addedTargets.length){
						for(var i of trigger.addedTargets){
							if(!i.isIn()) return;
						}
					}
					var next=player.useCard(get.copy(card),trigger.targets,false);
					if(trigger.addedTarget) next.addedTarget=trigger.addedTarget;
					if(trigger.addedTargets&&trigger.addedTargets.length) next.addedTargets=trigger.addedTargets.slice(0);
					if(event.count>0) event.redo();
				},
			},
		},*/
	},
	shezang: {
		audio: 2,
		round: 1,
		trigger: { global: "dying" },
		frequent: true,
		filter(event, player) {
			return event.player == player || player == _status.currentPhase;
		},
		async content(event, trigger, player) {
			var cards = [];
			for (var i of lib.suit) {
				var card = get.cardPile2(function (card) {
					return get.suit(card, false) == i;
				});
				if (card) {
					cards.push(card);
				}
			}
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
	},
};
