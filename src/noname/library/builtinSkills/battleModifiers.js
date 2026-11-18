import { _status, game, get, lib, ui } from "noname";
import { requireRegisteredSkill } from "../skillRegistry.js";

/** @satisfies {Pick<import("../skillRegistry.js").BuiltinSkillRegistry, "zf_anyGain" | "zf_phaseDraw" | "zf_anyDraw" | "zf_cardDamage" | "zf_maxHandcard" | "zf_cardUsable" | "zf_directDamage" | "zf_directGain" | "zf_onAdd" | "zf_loseMaxHp" | "zf_extraEff" | "zhanfa" | "danqi_hufu" | "charge">} */
export const battleModifiersSkills = {
	//某个时机检索并获得X张特定的牌（X默认为1），时机默认为回合开始时
	zf_anyGain: {
		trigger: { player: "phaseBegin" },
		cardFilter: card => true, //用法其实类似getCards那些的过滤器
		num: 1,
		pos: void 0, //从哪个区域获得牌，其实就是get.cardPile的一个参数
		async content(event, trigger, player) {
			const info = get.info(event.name);
			const num = info.num;
			const cardFilter = info.cardFilter;
			let filter = cardFilter;
			const pos = info.pos;

			if (typeof cardFilter == "string") {
				filter = card => get.name(card) == cardFilter;
			} else if (Array.isArray(cardFilter)) {
				filter = card => cardFilter.includes(get.name(card));
			} else if (typeof cardFilter == "object") {
				filter = card => {
					for (let j in cardFilter) {
						var value;
						if (j == "type" || j == "subtype" || j == "color" || j == "suit" || j == "number" || j == "type2") {
							value = get[j](card);
						} else if (j == "name") {
							value = get.name(card);
						} else {
							value = card[j];
						}
						if ((typeof cardFilter[j] == "string" && value != cardFilter[j]) || (Array.isArray(cardFilter[j]) && !cardFilter[j].includes(value))) {
							return false;
						}
					}
					return true;
				};
			}

			const cards = [];
			while (cards.length < num) {
				const card = get.cardPile(card => filter(card) && !cards.includes(card), pos, "random");
				if (card) {
					cards.push(card);
				} else {
					break;
				}
			}
			if (cards.length) {
				game.log(player, "获得了", get.cnNumber(cards.length), "张牌");
				await player.gain(cards, "draw");
			}
		},
	},
	//某个条件下摸牌阶段摸牌数+X（X默认为1）
	zf_phaseDraw: {
		trigger: { player: "phaseDrawBegin2" },
		num: 1,
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			trigger.num += get.info(event.name).num;
		},
	},
	//某个时机后摸X张牌（默认为造成伤害后，X默认为1）
	zf_anyDraw: {
		trigger: { source: "damageSource" },
		num: 1,
		async content(event, trigger, player) {
			await player.draw(get.info(event.name).num);
		},
	},
	//使用的特定的牌伤害+X（X默认为1）
	zf_cardDamage: {
		trigger: { player: "useCard" },
		num: 1,
		async content(event, trigger, player) {
			let num = get.info(event.name).num;
			if (typeof num == "function") {
				num = num(event, trigger, player);
			}
			game.log(trigger.card, `基础伤害+${num}`);
			trigger.baseDamage += num;
		},
	},
	//特定条件下手牌上限+X（X默认为1）
	zf_maxHandcard: {
		modNum: 1, //可以是有player和num参数的函数，但最后必须返回数字；若填写了数字则是直接与mod的num返回值相加
		init(player, skill) {
			game.broadcastAll(
				(player, skill) => {
					const info = get.info(skill);
					if (info?.mod?.maxHandcard) {
						return;
					}
					const func = info.modNum;
					const mod = function (player, num) {
						if (typeof func == "number") {
							return num + func;
						}
						if (typeof func == "function") {
							return func(player, num);
						}
					};
					const skillMod = lib.requireSkill(skill).mod;
					if (!skillMod) throw new TypeError("maxHandcard skill must initialize its mod object");
					skillMod.maxHandcard = mod;
				},
				player,
				skill
			);
		},
		mod: {},
	},
	//特定条件下使用某些牌次数+X（主要就是针对酒和杀，X默认为1）
	zf_cardUsable: {
		cardFilter: card => true, //用法其实类似getCards那些的过滤器
		modNum: 1, //可以是有card、player和num参数的函数，但最后必须返回数字；若填写了数字则是直接与mod的num返回值相加
		numFixed: false,
		init(player, skill) {
			game.broadcastAll(
				(player, skill) => {
					const info = get.info(skill);
					if (info?.mod?.cardUsable) {
						return;
					}
					const func = info.modNum;
					const cardFilter = info.cardFilter;
					let filter = cardFilter;

					if (typeof cardFilter == "string") {
						filter = card => get.name(card) == cardFilter;
					} else if (Array.isArray(cardFilter)) {
						filter = card => cardFilter.includes(get.name(card));
					} else if (typeof cardFilter == "object") {
						filter = card => {
							for (let j in cardFilter) {
								var value;
								if (j == "type" || j == "subtype" || j == "color" || j == "suit" || j == "number" || j == "type2") {
									value = get[j](card);
								} else if (j == "name") {
									value = get.name(card);
								} else {
									value = card[j];
								}
								if ((typeof cardFilter[j] == "string" && value != cardFilter[j]) || (Array.isArray(cardFilter[j]) && !cardFilter[j].includes(value))) {
									return false;
								}
							}
							return true;
						};
					}

					const mod = function (card, player, num) {
						if (typeof func == "function") {
							return func(card, player, num);
						}
						if (typeof func == "number") {
							if (filter(card)) {
								return num + func;
							}
						}
					};
					const skillMod = lib.requireSkill(skill).mod;
					if (!skillMod) throw new TypeError("cardUsable skill must initialize its mod object");
					skillMod.cardUsable = mod;
				},
				player,
				skill
			);
		},
		mod: {},
	},
	//某个条件下，对敌方造成X点伤害（默认是受到伤害后随机一名敌方，且X默认为1）
	zf_directDamage: {
		trigger: { player: "damageEnd" },
		num: 1,
		nature: null,
		select: 1,
		targetFilter: target => true, //getEnemies的过滤器
		async content(event, trigger, player) {
			const info = get.info(event.name);
			let num = info.num;
			let nature = info.nature;
			const filter = info.targetFilter;
			const select = info.select;
			let targets;
			if (nature == "event") {
				nature = event.nature;
			}
			if (num == "event") {
				num = event.num;
			}
			if (typeof select == "string" && select !== "all") {
				targets = [trigger[select]];
			} else {
				targets = player.getEnemies(filter, false);
				if (select !== "all" && typeof select == "number") {
					targets = targets.randomGets(select);
				}
			}
			if (targets.length) {
				player.line(targets, nature || "yellow");
				await game.doAsyncInOrder(targets, (target, i) => target.damage(num, nature));
			}
		},
	},
	//获得战法后立即获得对应的牌
	zf_directGain: {
		cardFilter: card => true, //用法其实类似getCards那些的过滤器
		num: 1,
		pos: "cardPile", //从哪个区域获得牌，其实就是get.cardPile的一个参数
		init(player, skill) {
			const info = get.info(skill);
			const num = info.num;
			const cardFilter = info.cardFilter;
			let filter = cardFilter;
			const pos = info.pos;

			if (typeof cardFilter == "string") {
				filter = card => get.name(card) == cardFilter;
			} else if (Array.isArray(cardFilter)) {
				filter = card => cardFilter.includes(get.name(card));
			} else if (typeof cardFilter == "object") {
				filter = card => {
					for (let j in cardFilter) {
						var value;
						if (j == "type" || j == "subtype" || j == "color" || j == "suit" || j == "number" || j == "type2") {
							value = get[j](card);
						} else if (j == "name") {
							value = get.name(card);
						} else {
							value = card[j];
						}
						if ((typeof cardFilter[j] == "string" && value != cardFilter[j]) || (Array.isArray(cardFilter[j]) && !cardFilter[j].includes(value))) {
							return false;
						}
					}
					return true;
				};
			}

			const cards = [];
			while (cards.length < num) {
				const card = get.cardPile(card => filter(card) && !cards.includes(card), pos, "random");
				if (card) {
					cards.push(card);
				} else {
					break;
				}
			}
			if (cards.length) {
				game.log(player, "获得了", get.cnNumber(cards.length), "张牌");
				player.$draw(cards.length);
				player.directgain(cards);
				//await player.gain(cards, "draw");
			}
		},
	},
	//获得战法后执行某个操作
	zf_onAdd: {
		trigger: {
			player: "addZhanfa",
		},
		silent: true,
		async content(event, trigger, player) {
			if (trigger.zhanfaId != event.name) {
				return;
			}
			const { callback } = get.info(event.name);
			await callback(event, trigger, player);
		},
		async callback(event, trigger, player) {
			return;
		},
	},
	//获得战法后减少体力上限
	zf_loseMaxHp: {
		trigger: {
			player: "addZhanfa",
		},
		silent: true,
		//获取要执行操作的目标
		getTargets(event, player) {
			return [player];
		},
		//每个目标要减少的上限
		getNum(event, player, target) {
			return target.maxHp > 1 ? 1 : 0;
		},
		async callback(event, player, target) {
			return;
		},
		async content(event, trigger, player) {
			if (trigger.zhanfaId != event.name) {
				return;
			}
			let { getNum, getTargets, callback } = get.info(event.name);
			const targets = (event.targets = getTargets(event, player));
			const map = (event.map = new Map());
			await game.doAsyncInOrder(targets, async target => {
				const num = getNum(event, player, target);
				if (num > 0) {
					map.set(target, num);
					await target.loseMaxHp({ num });
				}
				await callback(event, player, target);
			});
			player.setStorage(event.name, map);
		},
		onremove(player, skill) {
			player.addTempSkill(`${skill}_onremove`);
		},
		subSkill: {
			onremove: {
				charlotte: true,
				silent: true,
				trigger: {
					player: "removeZhanfa",
				},
				onremove(player, skill) {
					delete player.storage[skill.slice(0, -9)];
				},
				async content(event, trigger, player) {
					const skill = event.name.slice(0, -9);
					if (trigger.zhanfaId != skill) {
						return;
					}
					const map = new Map(player.getStorage(skill));
					player.removeSkill(event.name);
					const targets = Array.from(map.keys());
					await game.doAsyncInOrder(targets, async target => {
						const num = map.get(target);
						if (num) {
							return target.gainMaxHp({ num });
						}
					});
				},
			},
		},
	},
	//某个条件下使用牌额外结算
	zf_extraEff: {
		trigger: { player: "useCard" },
		filter(event, player) {
			return true;
		},
		num: 1,
		async content(event, trigger, player) {
			const { num } = get.info(event.name);
			game.log(trigger.card, "额外结算", `#g${get.cnNumber(num)}`, "次");
			trigger.effectCount += num;
		},
	},
	zhanfa: {
		markimage: "image/card/zhanfa.png",
		intro: {
			markcount(storage, player, skill) {
				return storage?.length || 0;
			},
			mark(dialog, storage, player) {
				const list = storage || [];
				if (!list.length) {
					return "暂无战法";
				}
				dialog.add([list.map(i => [lib.zhanfa.getRarity(i, false), null, i]), "vcard"]);
				//dialog.buttons.forEach(button => button.classList.add(`zf_${lib.zhanfa.getRarity(button.link[2])}`, "zhanfa"));
			},
		},
	},
	danqi_hufu: {
		markimage: "image/card/danqi_hufu.png",
		intro: {
			content: "当前拥有虎符：#",
		},
	},
	charge: {
		markimage: "image/card/charge.png",
		intro: {
			content(storage, player) {
				/** @type {number | string} */
				let max = player.getMaxCharge();
				if (max == Infinity) {
					max = "∞";
				}
				return `当前蓄力值数：${storage || 0}/${max}`;
			},
		},
	},
};
