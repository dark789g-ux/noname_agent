import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhenlue" | "jianshu" | "yongdi" | "regushe" | "regushe2" | "rejici" | "rejici2" | "gushe" | "jici">} */
export const groupSkills = {
	zhenlue: {
		trigger: { player: "useCard" },
		forced: true,
		filter(event) {
			return get.type(event.card) == "trick";
		},
		content() {
			trigger.nowuxie = true;
		},
		mod: {
			targetEnabled(card, player, target) {
				if (get.type(card) == "delay") {
					return false;
				}
			},
		},
	},
	jianshu: {
		audio: 2,
		limited: true,
		enable: "phaseUse",
		animationColor: "thunder",
		skillAnimation: "epic",
		filter(event, player) {
			return player.countCards("h", { color: "black" }) > 0;
		},
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			if (ui.selected.targets.length) {
				return ui.selected.targets[0] != target && !ui.selected.targets[0].hasSkillTag("noCompareSource") && target.countCards("h") && !target.hasSkillTag("noCompareTarget");
			}
			return true;
		},
		filterCard: { color: "black" },
		mark: true,
		discard: false,
		lose: false,
		delay: false,
		check(card) {
			if (_status.event.player.hp == 1) {
				return 8 - get.value(card);
			}
			return 6 - get.value(card);
		},
		selectTarget: 2,
		multitarget: true,
		content() {
			"step 0";
			player.awakenSkill(event.name);
			player.storage.jianshu = true;
			player.give(cards, targets[0], "give");
			"step 1";
			if (targets[0].canCompare(targets[1])) {
				targets[0].chooseToCompare(targets[1]);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				targets[0].chooseToDiscard("he", 2, true);
				targets[1].loseHp();
			} else if (result.tie) {
				targets[0].loseHp();
				targets[1].loseHp();
			} else {
				targets[1].chooseToDiscard("he", 2, true);
				targets[0].loseHp();
			}
		},
		ai: {
			expose: 0.4,
			order: 4,
			result: {
				target(player, target) {
					if (player.hasUnknown()) {
						return 0;
					}
					if (ui.selected.targets.length) {
						return -1;
					}
					return -0.5;
				},
			},
		},
	},
	yongdi: {
		audio: 2,
		audioname: ["xinping"],
		limited: true,
		trigger: { player: "phaseBegin" },
		animationColor: "thunder",
		skillAnimation: "legend",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					if (player === target) {
						return false;
					}
					return target.hasSex("male") || target.name == "key_yuri";
				})
				.set("ai", target => {
					if (!_status.event.goon) {
						return 0;
					}
					let player = _status.event.player;
					let att = get.attitude(player, target);
					if (att <= 1) {
						return 0;
					}
					let mode = get.mode();
					if (mode == "identity" || (mode == "versus" && (_status.mode == "four" || _status.mode == "guandu"))) {
						if (
							target.getStockSkills(true, true).some(i => {
								if (target.hasSkill(i)) {
									return false;
								}
								let info = get.info(i);
								return info && info.zhuSkill;
							})
						) {
							return att * 2;
						}
					}
					return att;
				})
				.set("goon", !player.hasUnknown(Math.round(game.players.length / 4 - 0.2)))
				.forResult();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			let target = event.targets[0],
				mode = get.mode();
			if (mode !== "identity" || player.identity !== "nei") {
				player.addExpose(0.25);
			}
			target.gainMaxHp();
			target.recover();
			let skills = target.getStockSkills(true, true).filter(skill => {
				if (target.hasSkill(skill)) {
					return false;
				}
				let info = get.info(skill);
				return info && info.zhuSkill;
			});
			if (skills.length) {
				target.addSkills(skills);
			}
		},
	},
	regushe: {
		audio: "gushe",
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		selectTarget: [1, 3],
		filter(event, player) {
			return player.countMark("regushe") + player.countMark("regushe2") < 7 && player.countCards("h") > 0;
		},
		multitarget: true,
		multiline: true,
		content() {
			player.addTempSkill("regushe2");
			player.chooseToCompare(targets).callback = lib.skill.regushe.callback;
		},
		intro: {
			name: "饶舌",
			content: "mark",
		},
		callback() {
			"step 0";
			if (event.winner !== player) {
				target.chat(lib.skill.gushe.chat[player.countMark("regushe")]);
				game.delay();
				player.addMark("regushe", 1);
				if (player.countMark("regushe") >= 7) {
					player.die();
				}
			} else {
				player.addMark("regushe2", 1, false);
			}
			"step 1";
			if (event.winner !== player) {
				player.chooseToDiscard("he", "弃置一张牌，或摸一张牌").set("ai", function () {
					return -1;
				});
			} else {
				event.goto(3);
			}
			"step 2";
			if (!result.bool) {
				player.draw();
			}
			"step 3";
			if (event.winner !== target) {
				target
					.chooseToDiscard("he", "弃置一张牌，或令" + get.translation(player) + "摸一张牌")
					.set("ai", function (card) {
						if (_status.event.goon) {
							return 6 - get.value(card);
						}
						return 0;
					})
					.set("goon", get.attitude(target, player) < 0);
			} else {
				event.finish();
			}
			"step 4";
			if (!result.bool) {
				player.draw();
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					var num = ui.selected.targets.length + 1;
					if (num + player.countMark("regushe") <= 6) {
						return -1;
					}
					var hs = player.getCards("h");
					for (var i = 0; i < hs.length; i++) {
						if (get.value(hs[i]) <= 6) {
							switch (hs[i].number) {
								case 13:
									return -1;
								case 12:
									if (player.countMark("regushe") + num <= 8) {
										return -1;
									}
									break;
								case 11:
									if (player.countMark("regushe") + num <= 7) {
										return -1;
									}
									break;
								default:
									if (hs[i].number > 5 && player.countMark("regushe") + num <= 6) {
										return -1;
									}
							}
						}
					}
					return 0;
				},
			},
		},
		marktext: "饶",
	},
	regushe2: {
		charlotte: true,
		onremove: true,
	},
	rejici: {
		audio: "jici",
		trigger: {
			player: "compare",
			target: "compare",
		},
		forced: true,
		filter(event, player) {
			// if(player!=event.target&&event.iwhile) return false;
			return (player == event.player ? event.num1 : event.num2) <= player.countMark("regushe");
		},
		content() {
			if (player == trigger.target || !trigger.iwhile) {
				trigger[player == trigger.player ? "num1" : "num2"] += player.countMark("regushe");
				game.log(player, "的拼点牌点数+" + player.countMark("regushe"));
			}
			game.delayx();
			// var cards=[trigger.card1];
			// if(trigger.cardlist) cards.addArray(trigger.cardlist);
			// else cards.push(trigger.card2);
			// cards.sort(function(a,b){
			// 	return get.number(b)-get.number(a);
			// });
			// var num=get.number(cards[0]);
			// for(var i=1;i<cards.length;i++){
			// 	if(get.number(cards[i])<num){
			// 		cards.splice(i);
			// 		break;
			// 	}
			// }
			// cards=cards.filterInD();
			var cards = [];
			if (trigger.num1 > trigger.num2) {
				cards.push(trigger.card1);
			}
			if (trigger.num1 < trigger.num2) {
				cards.push(trigger.card2);
			}
			cards = cards.filterInD();
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
		group: "rejici2",
		ai: {
			combo: "regushe",
		},
	},
	rejici2: {
		audio: "jici",
		trigger: { player: "die" },
		forced: true,
		forceDie: true,
		skillAnimation: true,
		animationColor: "water",
		sourceSkill: "rejici",
		filter(event, player) {
			return event.source && event.source.isIn();
		},
		logTarget: "source",
		content() {
			var num = 7 - player.countMark("regushe");
			if (num > 0) {
				trigger.source.chooseToDiscard(num, true, "he");
			}
			trigger.source.loseHp();
		},
	},
	gushe: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		selectTarget: [1, 3],
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		multitarget: true,
		multiline: true,
		content() {
			player.chooseToCompare(targets).callback = lib.skill.gushe.callback;
		},
		intro: {
			name: "饶舌",
			content: "mark",
		},
		chat: ["粗鄙之语", "天地不容", "谄谀之臣", "皓首匹夫，苍髯老贼", "二臣贼子", "断脊之犬", "我从未见过有如此厚颜无耻之人！"],
		callback() {
			"step 0";
			if (event.winner !== player) {
				target.chat(lib.skill.gushe.chat[player.countMark("gushe")]);
				game.delay();
				player.addMark("gushe", 1);
				if (player.countMark("gushe") >= 7) {
					player.die();
				}
			}
			"step 1";
			if (event.winner !== player) {
				player.chooseToDiscard("he", "弃置一张牌，或摸一张牌").set("ai", function () {
					return -1;
				});
			} else {
				event.goto(3);
			}
			"step 2";
			if (!result.bool) {
				player.draw();
			}
			"step 3";
			if (event.winner !== target) {
				target
					.chooseToDiscard("he", "弃置一张牌，或令" + get.translation(player) + "摸一张牌")
					.set("ai", function (card) {
						if (_status.event.goon) {
							return 6 - get.value(card);
						}
						return 0;
					})
					.set("goon", get.attitude(target, player) < 0);
			} else {
				event.finish();
			}
			"step 4";
			if (!result.bool) {
				player.draw();
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					var num = ui.selected.targets.length + 1;
					if (num > 3) {
						num = 3;
					}
					var hs = player.getCards("h");
					for (var i = 0; i < hs.length; i++) {
						if (get.value(hs[i]) <= 6) {
							switch (hs[i].number) {
								case 13:
									return -1;
								case 12:
									if (player.countMark("gushe") + num <= 8) {
										return -1;
									}
									break;
								case 11:
									if (player.countMark("gushe") + num <= 7) {
										return -1;
									}
									break;
								default:
									if (hs[i].number > 5 && player.countMark("gushe") + num <= 6) {
										return -1;
									}
							}
						}
					}
					return 0;
				},
			},
		},
	},
	jici: {
		audio: 2,
		trigger: { player: "compare" },
		filter(event, player) {
			return event.getParent().name == "gushe" && !event.iwhile && event.num1 <= player.countMark("gushe");
		},
		content() {
			if (trigger.num1 < player.countMark("gushe")) {
				trigger.num1 += player.countMark("gushe");
			} else {
				player.getStat().skill.gushe--;
			}
		},
		ai: {
			combo: "gushe",
		},
	},
};
