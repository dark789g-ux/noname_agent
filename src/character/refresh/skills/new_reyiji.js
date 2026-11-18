import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const new_reyijiSkills = {
	new_reyiji: {
		audio: "reyiji",
		audioname: ["yj_sb_guojia", "yj_sb_guojia_shadow"],
		audioname2: { sxrm_caocao: "reyiji_sxrm_caocao" },
		trigger: {
			player: "damageEnd",
		},
		frequent: true,
		filter(event) {
			return event.num > 0;
		},
		getIndex(event, player, triggername) {
			return event.num;
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			result = await player.draw(2).forResult();
			if (_status.connectMode) {
				game.broadcastAll(() => {
					_status.noclearcountdown = true;
				});
			}
			event.given_map = {};
			event.num = 2;

			// step 1..2 (loop until all cards assigned or player cancels)
			while (event.num > 0) {
				result = await player
					.chooseCardTarget({
						filterCard(card) {
							return get.itemtype(card) == "card" && !card.hasGaintag("reyiji_tag");
						},
						filterTarget: lib.filter.notMe,
						selectCard: [1, event.num],
						prompt: "请选择要分配的卡牌和目标",
						ai1(card) {
							return ui.selected.cards.length ? 0 : 1;
						},
						ai2(target) {
							const player = _status.event.player;
							const card = ui.selected.cards[0];
							const val = target.getUseValue(card);
							if (val > 0) return val * get.attitude(player, target) * 2;
							return get.value(card, target) * get.attitude(player, target);
						},
					})
					.forResult();

				if (result.bool) {
					const res = result.cards;
					const targetId = result.targets[0].playerid;
					player.addGaintag(res, "reyiji_tag");
					event.num -= res.length;
					if (!event.given_map[targetId]) event.given_map[targetId] = [];
					event.given_map[targetId].addArray(res);
					// continue loop if still cards to give
					continue;
				}

				// player cancelled at the very first choice -> cleanup and exit
				if (event.num === 2) {
					if (_status.connectMode) {
						game.broadcastAll(() => {
							delete _status.noclearcountdown;
							game.stopCountChoose();
						});
					}
					return;
				}
				// otherwise break and proceed to distribution
				break;
			}

			// step 3 cleanup for connect mode
			if (_status.connectMode) {
				game.broadcastAll(() => {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}

			// prepare gain map & cards list
			const map = [];
			const cards = [];
			for (const id of Object.keys(event.given_map)) {
				const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
				player.line(source, "green");
				if (player !== source && (get.mode() !== "identity" || player.identity !== "nei")) {
					player.addExpose(0.18);
				}
				map.push([source, event.given_map[id]]);
				cards.addArray(event.given_map[id]);
			}

			// perform the async give
			await game
				.loseAsync({
					gain_list: map,
					player,
					cards,
					giver: player,
					animate: "giveAuto",
				})
				.setContent("gaincardMultiple");
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						let num = 1;
						if (get.attitude(player, target) > 0) {
							if (player.needsToDiscard()) {
								num = 0.7;
							} else {
								num = 0.5;
							}
						}
						if (target.hp >= 4) {
							return [1, num * 2];
						}
						if (target.hp == 3) {
							return [1, num * 1.5];
						}
						if (target.hp == 2) {
							return [1, num * 0.5];
						}
					}
				},
			},
			threaten: 0.6,
		},
	},
	new_rejianxiong: {
		audio: "rejianxiong",
		audioname: ["shen_caopi", "mb_caocao"],
		audioname2: { caoying: "lingren_jianxiong" },
		trigger: { player: "damageEnd" },
		async content(event, trigger, player) {
			if (get.itemtype(trigger.cards) == "cards" && get.position(trigger.cards[0], true) == "o") {
				await player.gain(trigger.cards, "gain2");
			}
			await player.draw("nodelay");
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1];
					}
					if (get.tag(card, "damage") && player != target) {
						var cards = card.cards,
							evt = _status.event;
						if (evt.player == target && card.name == "damage" && evt.getParent().type == "card") {
							cards = evt.getParent().cards.filterInD();
						}
						if (target.hp <= 1) {
							return;
						}
						if (get.itemtype(cards) != "cards") {
							return;
						}
						for (var i of cards) {
							if (get.name(i, target) == "tao") {
								return [1, 4.5];
							}
						}
						if (get.value(cards, target) >= 7 + target.getDamagedHp()) {
							return [1, 2.5];
						}
						return [1, 0.6];
					}
				},
			},
		},
	},
	new_reluoyi: {
		audio: "reluoyi",
		trigger: {
			player: "phaseDrawBegin1",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			const cards = get.cards(3, true);
			await player.showCards(cards, "裸衣", true);

			const cardsx = [];
			for (const c of cards) {
				const type = get.type(c);
				if (type == "basic" || c.name == "juedou" || (type == "equip" && get.subtype(c) == "equip1")) {
					cardsx.push(c);
				}
			}

			event.cards = cardsx;
			const prompt = "是否放弃摸牌" + (cardsx.length ? "，改为获得" + get.translation(cardsx) : "") + "？";
			const result = await player
				.chooseBool(prompt)
				.set("choice", cardsx.length >= trigger.num)
				.forResult();

			if (result.bool) {
				if (cardsx.length) {
					await player.gain(cardsx, "gain2");
				}
				player.addTempSkill("new_reluoyi_buff", { player: "phaseBeforeStart" });
				trigger.changeToZero();
			}
		},
		subSkill: { buff: { inherit: "reluoyi2", sourceSkill: "new_reluoyi" } },
	},
	new_rewusheng: {
		selectionSpec: true,
		mod: {
			targetInRange(card) {
				if (get.suit(card) == "diamond" && card.name == "sha") {
					return true;
				}
			},
		},
		locked: false,
		audio: "wusheng",
		audioname: ["re_guanyu", "jsp_guanyu", "re_guanzhang", "dc_jsp_guanyu"],
		audioname2: {
			dc_guansuo: "wusheng_guansuo",
			guanzhang: "wusheng_guanzhang",
			guansuo: "wusheng_guansuo",
			gz_jun_liubei: "shouyue_wusheng",
			std_guanxing: "wusheng_guanzhang",
			ty_guanxing: "wusheng_guanzhang",
			ol_guanzhang: "wusheng_ol_guanzhang",
			re_baosanniang: "wusheng_re_baosanniang",
		},
		enable: ["chooseToRespond", "chooseToUse"],
		filterCard(card, player) {
			if (get.zhu(player, "shouyue")) {
				return true;
			}
			return get.color(card) == "red";
		},
		position: "hes",
		viewAs: {
			name: "sha",
		},
		viewAsFilter(player) {
			if (get.zhu(player, "shouyue")) {
				if (!player.countCards("hes")) {
					return false;
				}
			} else {
				if (!player.countCards("hes", { color: "red" })) {
					return false;
				}
			}
		},
		prompt: "将一张红色牌当杀使用或打出",
		check(card) {
			var val = get.value(card);
			if (_status.event.name == "chooseToRespond") {
				return 1 / Math.max(0.1, val);
			}
			return 5 - val;
		},
		ai: {
			respondSha: true,
			skillTagFilter(player) {
				if (get.zhu(player, "shouyue")) {
					if (!player.countCards("hes")) {
						return false;
					}
				} else {
					if (!player.countCards("hes", { color: "red" })) {
						return false;
					}
				}
			},
		},
	},
	wusheng_ol_guanzhang: { audio: 1 },
	new_yijue: {
		selectionSpec: true,
		initSkill(skill) {
			if (!lib.skill[skill]) {
				lib.skill[skill] = {
					charlotte: true,
					onremove: true,
					mark: true,
					marktext: "绝",
					intro: {
						markcount: () => 0,
						content: storage => `本回合不能使用或打出手牌、非锁定技失效且受到${get.translation(storage[1])}红桃【杀】的伤害+1`,
					},
					group: "new_yijue_ban",
				};
				lib.translate[skill] = "义绝";
				lib.translate[skill + "_bg"] = "绝";
			}
		},
		audio: "yijue",
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player != target && target.countCards("h");
		},
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		check(card) {
			return 8 - get.value(card);
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (!target.countCards("h")) {
				return;
			}
			const result = await target
				.chooseCard(true, "h")
				.set("ai", card => {
					const player = get.player();
					if (get.color(card) == "black") {
						return 18 - get.event().black - get.value(card);
					}
					return 18 - get.value(card);
				})
				.set(
					"black",
					(() => {
						if (get.attitude(target, player) > 0) {
							return 18;
						}
						if (
							target.hasCard(card => {
								const name = get.name(card, target);
								return name === "shan" || name === "tao" || (name === "jiu" && target.hp < 3);
							})
						) {
							return 18 / target.hp;
						}
						if (target.hp < 3) {
							return 12 / target.hp;
						}
						return 0;
					})()
				)
				.forResult();
			if (result?.bool && result?.cards?.length) {
				const { cards } = result;
				await target.showCards(cards);
				const [card] = cards;
				if (get.color(card) == "black") {
					if (!target.hasSkill("fengyin")) {
						target.addTempSkill("fengyin");
					}
					const skill = "new_yijue_" + player.playerid;
					game.broadcastAll(lib.skill.new_yijue.initSkill, skill);
					target.addTempSkill(skill);
					target.storage[skill] ??= [0, player];
					target.storage[skill][0]++;
					target.markSkill(skill);
					player.addTempSkill("new_yijue_effect");
				} else if (get.color(card) == "red") {
					await player.gain(card, target, "give", "bySelf");
					if (target.isDamaged()) {
						const result = await player
							.chooseBool(`是否让${get.translation(target)}回复1点体力？`)
							.set("choice", get.recoverEffect(target, player, player) > 0)
							.forResult();
						if (result?.bool) {
							await target.recover();
						}
					}
				}
			}
		},
		ai: {
			result: {
				target(player, target) {
					var hs = player.getCards("h");
					if (hs.length < 3) {
						return 0;
					}
					if (target.countCards("h") > target.hp + 1 && get.recoverEffect(target) > 0) {
						return 1;
					}
					if (player.canUse("sha", target) && (player.countCards("h", "sha") || player.countCards("he", { color: "red" }))) {
						return -2;
					}
					return -0.5;
				},
			},
			order: 9,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (!arg?.target?.hasSkill("new_yijue_" + player.playerid)) {
					return false;
				}
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return event.card?.name == "sha" && get.suit(event.card) == "heart" && event.notLink() && event.player.storage["new_yijue_" + player.playerid]?.[1] == player;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					trigger.num += trigger.player.storage["new_yijue_" + player.playerid][0];
				},
			},
			ban: {
				charlotte: true,
				mod: {
					cardEnabled2(card) {
						if (get.position(card) == "h") {
							return false;
						}
					},
				},
			},
		},
	},
	paoxiao_re_zhangfei: { audio: 2 },
	new_repaoxiao: {
		audio: "paoxiao",
		firstDo: true,
		audioname2: {
			old_guanzhang: "old_fuhun",
			xin_zhangfei: "paoxiao_re_zhangfei",
			old_zhangfei: "paoxiao_re_zhangfei",
		},
		audioname: ["re_zhangfei", "guanzhang", "xiahouba", "re_guanzhang"],
		trigger: { player: "useCard1" },
		forced: true,
		filter(event, player) {
			return event.card.name == "sha" && (!event.audioed || !player.hasSkill("new_repaoxiao2"));
		},
		async content(event, trigger, player) {
			trigger.audioed = true;
			player.addTempSkill("new_repaoxiao2");
		},
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return Infinity;
				}
			},
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (!get.zhu(player, "shouyue")) {
					return false;
				}
				if (arg && arg.name == "sha") {
					return true;
				}
				return false;
			},
		},
	},
};
