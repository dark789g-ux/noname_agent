import { _status, game, get, lib, ui } from "noname";
import { requireRegisteredSkill } from "../skillRegistry.js";

/** @satisfies {Pick<import("../skillRegistry.js").BuiltinSkillRegistry, "equipEnable" | "stratagem_fury" | "_stratagem_add_buff" | "expandedSlots" | "nocount" | "zf_anyDamage">} */
export const equipmentSkills = {
	equipEnable: {
		chalotte: true,
		mod: {
			globalFrom(from, to, distance) {
				let num = from
					.getVCards("j", vcard => {
						if (get.type(vcard) != "delay") {
							false;
						} else if (!vcard.storage?.equipEnable) {
							return false;
						}
						return vcard.cards.some(card => get.type(card) == "equip");
					})
					.map(vcard => {
						const sum = vcard.cards?.reduce((sum, card) => {
							if (get.type(card) != "equip") {
								return sum;
							}
							let globalFrom = get.info(card)?.distance?.globalFrom || 0;
							return sum + globalFrom;
						}, 0);
						return sum || 0;
					})
					.reduce((a, b) => a + b, 0);
				return distance + num;
			},
			globalTo(from, to, distance) {
				let num = to
					.getVCards("j", vcard => {
						if (get.type(vcard) != "delay") {
							false;
						} else if (!vcard.storage?.equipEnable) {
							return false;
						}
						return vcard.cards.some(card => get.type(card) == "equip");
					})
					.map(vcard => {
						const sum = vcard.cards?.reduce((sum, card) => {
							if (get.type(card) != "equip") {
								return sum;
							}
							let globalTo = get.info(card)?.distance?.globalTo || 0;
							return sum + globalTo;
						}, 0);
						return sum || 0;
					})
					.reduce((a, b) => a + b, 0);
				return distance + num;
			},
			attackRangeBase(player) {
				let num = player
					.getVCards("j", vcard => {
						if (get.type(vcard) != "delay") {
							false;
						} else if (!vcard.storage?.equipEnable) {
							return false;
						}
						return vcard.cards.some(card => get.type(card) == "equip");
					})
					.map(vcard => {
						const num = vcard.cards?.reduce((sum, card) => {
							if (get.type(card) != "equip") {
								return sum;
							}
							let attackFrom = get.info(card)?.distance?.attackFrom || 0;
							return sum + attackFrom;
						}, 0);
						return num || 0;
					})
					.reduce((a, b) => a + b, 0);
				return Math.max(player.getEquipRange(player.getCards("e")), 1 - num);
			},
		},
	},
	stratagem_fury: {
		marktext: "🔥",
		intro: {
			name: "怒气",
			content: (storage, player) => {
				const stratagemFuryMax = _status.stratagemFuryMax,
					fury = storage || 0;
				return `当前怒气值：${typeof stratagemFuryMax == "number" ? `${fury}/${stratagemFuryMax}` : fury}`;
			},
		},
	},
	_stratagem_add_buff: {
		log: false,
		enable: "chooseToUse",
		filter: (event, player) => {
			const fury = player.storage.stratagem_fury;
			if (!fury) {
				return false;
			}
			const stratagemSettings = event.stratagemSettings;
			if (!stratagemSettings || (!stratagemSettings.roundOneUseFury && game.roundNumber < 2)) {
				return false;
			}
			const cards = player.getCards("hs");
			if (!cards.length) {
				return false;
			}
			const cost = lib.stratagemBuff.cost,
				names = Array.from(cost.keys());
			if (!names.length) {
				return false;
			}
			return cards.some(
				card =>
					game.checkMod(card, player, event, "unchanged", "cardEnabled2", player) &&
					names.some(availableName => {
						const availableCost = cost.get(availableName);
						return (
							typeof availableCost == "number" &&
							availableName == get.name(card, player) &&
							event.filterCard(
								new lib.element.VCard({
									name: availableName,
									nature: get.nature(card, player),
									isCard: true,
									cards: [card],
								}),
								player,
								event
							) &&
							fury >= availableCost
						);
					})
			);
		},
		onChooseToUse: event => {
			const player = event.getPlayer(),
				fury = player.storage.stratagem_fury;
			if (!fury) {
				return;
			}
			if (!event.stratagemSettings && !game.online) {
				event.set("stratagemSettings", {
					roundOneUseFury: _status.connectMode ? lib.configOL.round_one_use_fury : get.config("round_one_use_fury"),
				});
			}
			const cost = lib.stratagemBuff.cost.get("shan");
			if (typeof cost != "number" || !event.shanRequired) {
				return;
			}
			if (!event.shanIgnored) {
				event.shanIgnored = 0;
			}
			const stratagemBuff = requireRegisteredSkill(lib.skill, "_stratagem_add_buff");
			event.shanIgnored += Math.min(
				player.countCards(stratagemBuff.position, {
					name: "shan",
				}),
				Math.floor(fury / cost)
			);
		},
		check: card => {
			const player = _status.event.getPlayer();
			if (_status.event.type == "phase") {
				const cardName = get.name(card, player);
				if (cardName == "sha") {
					if (
						game.hasPlayer(current => {
							if (!player.canUse(card, current)) {
								return false;
							}
							const storage = player.storage,
								zhibi = storage.zhibi;
							return ((zhibi && !zhibi.includes(current)) || get.effect(current, card, player, player) >= 2 - Math.max(0, (storage.stratagem_fury || 0) - 1)) && current.mayHaveShan(player, "use") && player.hasSkill("jiu");
						})
					) {
						return 1;
					}
					return 0;
				}
				if (cardName == "tao") {
					if (Number(player.hp) <= 2 && player.getDamagedHp() >= 2) {
						return 1;
					}
					return 0;
				}
				return 1;
			}
			if (_status.event.type == "dying") {
				return get.attitude(player, _status.event.dying) > 3 ? 1 : 0;
			}
			return (_status.event.getParent().shanRequired || 1) > 1 && get.damageEffect(player, _status.event.getParent().player || player, player) < 0 ? 1 : 0;
		},
		position: "hs",
		filterCard: (card, player, event) => {
			if (!event) {
				event = _status.event;
			}
			const filterCard = event._backup?.filterCard;
			if (typeof filterCard != "function") {
				return false;
			}
			const cost = lib.stratagemBuff.cost;
			const fury = player.storage.stratagem_fury;
			if (typeof fury != "number") {
				return false;
			}
			return Array.from(cost.keys()).some(availableName => {
				const availableCost = cost.get(availableName);
				return (
					typeof availableCost == "number" &&
					availableName == get.name(card, player) &&
					filterCard(
						new lib.element.VCard({
							name: availableName,
							nature: get.nature(card, player),
							isCard: true,
							cards: [card],
						}),
						player,
						event
					) &&
					fury >= availableCost
				);
			});
		},
		viewAs: (cards, player) => {
			if (cards.length) {
				const cardName = get.name(cards[0], player);
				return cardName
					? new lib.element.VCard({
							name: cardName,
							nature: get.nature(cards[0], player),
							suit: get.suit(cards[0], player),
							number: get.number(cards[0], player),
							isCard: true,
							cards: [cards[0]],
							storage: {
								stratagem_buffed: 1,
							},
						})
					: new lib.element.VCard();
			}
			return null;
		},
		prompt: () => {
			const span = document.createElement("span");
			span.classList.add("text");
			span.style.fontFamily = "yuanli";
			const stratagemBuff = lib.stratagemBuff,
				cost = stratagemBuff.cost;
			stratagemBuff.prompt.forEach((prompt, cardName) => {
				const li = document.createElement("li");
				li.innerHTML = `【${get.translation(cardName)}】：${cost.get(cardName)}点怒气。${prompt()}`;
				span.appendChild(li);
			});
			return `当你需要使用位于“强化表”内的非虚拟卡牌时，你可以消耗对应数量的怒气将其强化并使用。${document.createElement("hr").outerHTML}${span.outerHTML}`;
		},
		onuse: (result, player) => {
			player.logSkill(result.skill);
			const stratagemBuff = lib.stratagemBuff,
				cardName = result.card?.name;
			if (!cardName) {
				return;
			}
			const cost = stratagemBuff.cost.get(cardName);
			if (typeof cost != "number") {
				return;
			}
			player.changeFury(-cost, true);
			const gameEvent = get.event(),
				effect = stratagemBuff.effect.get(cardName);
			if (typeof effect == "function") {
				gameEvent.getHandler("onNextUseCard").push(effect);
			}
			gameEvent.getHandler("onNextUseCard").push((event, option) => {
				if (event.step == 0 && option.state == "end") {
					game.broadcastAll(cards => cards.forEach(card => card.clone.classList.add("stratagem-fury-glow")), event.cards);
				}
			});
		},
		ai: {
			order: (item, player) => {
				if (!player) {
					player = _status.event.getPlayer();
				}
				if (_status.event.type == "phase") {
					for (const card of player.getCards("hs")) {
						if (!game.checkMod(card, player, _status.event, "unchanged", "cardEnabled2", player)) {
							continue;
						}
						const cardName = get.name(card, player);
						if (cardName == "sha") {
							if (
								game.hasPlayer(current => {
									if (!player.canUse(card, current)) {
										return false;
									}
									const storage = player.storage,
										zhibi = storage.zhibi;
									return ((zhibi && !zhibi.includes(current)) || get.effect(current, card, player, player) >= 2 - Math.max(0, (storage.stratagem_fury || 0) - 1)) && current.mayHaveShan(player, "use");
								})
							) {
								return get.order(card, player) + 0.5;
							}
						} else if (cardName == "tao" && Number(player.hp) <= 2 && player.getDamagedHp() >= 2) {
							return get.order(card, player) + 0.5;
						}
						return 8;
					}
				}
				return 3.5;
			},
			directHit_ai: true,
			skillTagFilter: (player, tag, arg) => {
				if (!arg?.card) {
					return false;
				}
				const card = get.autoViewAs(arg.card);
				if (card.name != "sha" || !card.storage.stratagem_buffed) {
					return false;
				}
				const target = arg.target;
				if (target.countCards("h", "shan") >= 1 && !target.storage.stratagem_fury) {
					return false;
				}
			},
		},
	},
	expandedSlots: {
		markimage: "image/card/expandedSlots.png",
		intro: {
			markcount: function (storage, player) {
				var all = 0;
				let storageMap = player.expandedSlots;
				if (!storageMap) {
					return 0;
				}
				for (var key in storageMap) {
					var num = storageMap[key];
					if (typeof num == "number" && num > 0) {
						all += num;
					}
				}
				return all;
			},
			content: function (storage, player) {
				storage = player.expandedSlots;
				if (!storage) {
					return "当前没有扩展装备栏";
				}
				const keys = Object.keys(storage).sort(),
					combined = get.is.mountCombined();
				let str = "";
				for (const key of keys) {
					const num = storage[key];
					if (typeof num == "number" && num > 0) {
						let trans = get.translation(key);
						if (combined && key == "equip3") {
							trans = "坐骑";
						}
						str += "<li>" + trans + "栏：" + num + "个<br>";
					}
				}
				if (str.length) {
					return str.slice(0, str.length - 4);
				}
				return "当前没有扩展装备栏";
			},
		},
	},
	//不计入次数模版
	nocount: {
		charlotte: true,
		forced: true,
		popup: false,
		firstDo: true,
		trigger: { player: "useCard1" },
		filter(event, player) {
			return event.addCount !== false;
		},
		async content(event, trigger, player) {
			trigger.addCount = false;
			const stat = player.getStat().card,
				name = trigger.card.name;
			if (typeof stat[name] == "number") {
				stat[name]--;
			}
			game.log(trigger.card, "不计入次数");
		},
	},
	//战法的模版技能
	//某个条件下造成的伤害+X（X默认为1）
	zf_anyDamage: {
		trigger: { source: "damageBegin1" },
		filter(event, player) {
			return true;
		},
		num: 1,
		async content(event, trigger, player) {
			let num = get.info(event.name).num;
			if (typeof num == "function") {
				num = num(event, trigger, player);
			}
			trigger.num += num;
		},
	},
};
