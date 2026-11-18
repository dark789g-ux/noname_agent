import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twgongge">} */
export const groupSkills = {
	//好萌
	twgongge: {
		audio: 3,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!event.isFirstTarget || !event.targets) {
				return false;
			}
			return get.tag(event.card, "damage");
		},
		usable: 1,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.name.slice(0, -5)), (card, player, target) => {
					const trigger = _status.event.getTrigger();
					return trigger.targets.includes(target);
				})
				.set("ai", target => {
					var player = _status.event.player;
					var trigger = _status.event.getTrigger();
					var att = get.attitude(player, target);
					var damageNum = trigger.getParent().baseDamage;
					var map = trigger.getParent().customArgs,
						id = target.playerid;
					if (map[id]) {
						if (typeof map[id].baseDamage == "number") {
							damageNum = map[id].baseDamage;
						}
						if (typeof map[id].extraDamage == "number") {
							damageNum += map[id].extraDamage;
						}
					}
					if (
						target.hasSkillTag("filterDamage", null, {
							player: trigger.player,
							card: trigger.card,
						})
					) {
						damageNum = 1;
					}
					var num =
						target.getSkills(null, false, false).filter(function (skill) {
							var info = get.info(skill);
							return info && !info.charlotte;
						}).length + 1;
					var list = [0, 0, 0];
					var player = _status.event.player;
					list[0] = num;
					list[1] =
						get.effect(target, { name: "guohe_copy2" }, player, player) > 0
							? target.hp - damageNum < player.hp
								? num
								: num - Math.min(player.getCards("he"), num - 1)
							: 0;
					if (_status.event.yimie(trigger, player, target, damageNum)) {
						list[2] =
							(get.recoverEffect(target, player, player) > get.damageEffect(target, player, player)
								? Math.min(num - 1, target.getDamagedHp())
								: num - 1) * 2;
					}
					return Math.max.apply(Math, list);
				})
				.set("yimie", (trigger, player, target, damageNum) => {
					var hit = true;
					var att = get.attitude(player, target);
					if (get.type(trigger.card) == "trick" && trigger.player.countCards("hs", { name: "wuxie" })) {
						hit = false;
					}
					if (
						trigger.card.name == "huogong" &&
						trigger.player.countCards("h", card => {
							var list = [];
							for (var i of player.getCards("h")) {
								list.push(get.suit(i));
							}
							return !list.includes(get.suit(card));
						})
					) {
						hit = false;
					}
					var key;
					switch (trigger.card.name) {
						case "sha":
						case "wanjian":
							key = ["shan"];
							break;
						case "juedou":
						case "nanman":
						case "jiedao":
							key = ["sha"];
							break;
						default:
							key = [];
							break;
					}
					if (get.type(trigger.card) == "trick") {
						key.push("wuxie");
					}
					key.push("caochuan");
					var bool1 = get.recoverEffect(target, player, player) > 0 ? 1 : -1;
					const directHit = trigger.getParent()?.directHit;
					var bool2 =
						(att > 0 && !hit) || (target.countCards("hs", { name: key }) && !(directHit === true || (Array.isArray(directHit) && directHit.includes(target)))) ? 1 : -1;
					if (att <= 0 && target.hp - damageNum > 0) {
						return false;
					}
					return (bool1 = bool2 && att != 0);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const num =
				target.getSkills(null, false, false).filter(skill => {
					const info = get.info(skill);
					return info && !info.charlotte;
				}).length + 1;
			event.num = num;
			const list = [];
			const choiceList = [
				`摸${get.cnNumber(num)}张牌，若${get.translation(target)}响应此牌，则你跳过下个摸牌阶段`,
				`弃置${get.translation(target)}${get.cnNumber(num)}张牌，此牌结算完毕后，若${get.translation(target)}的体力值不小于你，你交给其${get.cnNumber(num - 1)}张牌`,
				`令此牌对${get.translation(target)}造成的伤害+${num - 1}，此伤害结算完成后，其回复等量的体力值`,
			];
			list.push("摸牌");
			if (target.countDiscardableCards(player, "he")) {
				list.push("拆牌");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			list.push("加伤");
			const { control } = await player
				.chooseControl(list)
				.set("prompt", "攻阁：请选择一项（" + get.translation(target) + "对应X值：" + (num - 1) + "）")
				.set("ai", () => _status.event.choice)
				.set(
					"choice",
					(function () {
						var att = get.attitude(player, target);
						var damageNum = trigger.getParent().baseDamage;
						var map = trigger.getParent().customArgs,
							id = target.playerid;
						if (map[id]) {
							if (typeof map[id].baseDamage == "number") {
								damageNum = map[id].baseDamage;
							}
							if (typeof map[id].extraDamage == "number") {
								damageNum += map[id].extraDamage;
							}
						}
						if (
							target.hasSkillTag("filterDamage", null, {
								player: trigger.player,
								card: trigger.card,
							})
						) {
							damageNum = 1;
						}
						var yimie = function () {
							if (damageNum == 1) {
								return false;
							}
							var hit = true;
							if (get.type(trigger.card) == "trick" && trigger.player.countCards("hs", { name: "wuxie" })) {
								hit = false;
							}
							if (
								trigger.card.name == "huogong" &&
								trigger.player.countCards("h", function (card) {
									var list = [];
									for (var i of player.getCards("h")) {
										list.push(get.suit(i));
									}
									return !list.includes(get.suit(card));
								})
							) {
								hit = false;
							}
							var key;
							switch (trigger.card.name) {
								case "sha":
								case "wanjian":
									key = ["shan"];
									break;
								case "juedou":
								case "nanman":
								case "jiedao":
									key = ["sha"];
									break;
								default:
									key = [];
									break;
							}
							key.push("caochuan");
							var bool1 = get.recoverEffect(target, player, player) > 0 ? 1 : -1;
							const directHit = trigger.getParent()?.directHit;
							var bool2 =
								(att > 0 && !hit) || (target.countCards("hs", { name: key }) && !(directHit === true || (Array.isArray(directHit) && directHit.includes(target))))
									? 1
									: -1;
							if (att <= 0 && target.hp - damageNum > 0) {
								return false;
							}
							return (bool1 = bool2 && att != 0);
						};
						if (yimie()) {
							return "加伤";
						}
						if (
							list.includes("拆牌") &&
							get.effect(target, { name: "guohe_copy2" }, player, player) > 0 &&
							target.hp - damageNum < player.hp
						) {
							return "拆牌";
						}
						return "摸牌";
					})()
				)
				.set("choiceList", choiceList)
				.forResult();
			game.log(player, "选择了", "#y" + control);
			switch (control) {
				case "摸牌": {
					await player.draw(num);
					player.addTempSkill("twgongge_buff1");
					const evt = {
						card: trigger.card,
						target: target,
					};
					player.storage.twgongge_buff1 = evt;
					break;
				}
				case "拆牌": {
					await player.discardPlayerCard(num, target, "he", true);
					player.addTempSkill("twgongge_buff2");
					const evt = {
						card: trigger.card,
						target: target,
						num: num - 1,
					};
					player.storage.twgongge_buff2 = evt;
					break;
				}

				case "加伤": {
					player.addTempSkill("twgongge_buff3");
					const evt = {
						card: trigger.card,
						target: target,
						num: num - 1,
					};
					player.storage.twgongge_buff3 = evt;
					break;
				}
			}
		},
		subSkill: {
			//摸牌后续
			buff1: {
				charlotte: true,
				onremove: true,
				trigger: { global: ["useCard", "respond"] },
				filter(event, player) {
					if (player.skipList.includes("phaseDraw")) {
						return false;
					}
					if (!Array.isArray(event.respondTo) || player != event.respondTo[0]) {
						return false;
					}
					var evt = player.storage.twgongge_buff1;
					if (evt.target == event.player && evt.card == event.respondTo[1]) {
						return true;
					}
					return false;
				},
				direct: true,
				popup: false,
				content() {
					player.skip("phaseDraw");
					game.log(player, "跳过了下个", "#g摸牌阶段");
					player.addTempSkill("twgongge_buff1_mark", "phaseDrawSkipped");
				},
			},
			//拆牌后续
			buff2: {
				charlotte: true,
				onremove: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					if (!player.countCards("he")) {
						return false;
					}
					const evt = player.storage.twgongge_buff2;
					return evt.card == event.card && evt.target.isIn() && evt.target.hp >= player.hp;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const evt = player.storage.twgongge_buff2;
					const { target } = evt;
					const num = Math.min(evt.num, player.countCards("he"));
					await player.chooseToGive("he", target, `攻阁：交给${get.translation(target)}${get.cnNumber(num)}张牌`, num, true);
				},
			},
			//加伤后续
			buff3: {
				charlotte: true,
				onremove: true,
				trigger: { source: "damageBegin1", player: "useCardAfter" },
				filter(event, player) {
					if (!event.card) {
						return false;
					}
					var evt = player.storage.twgongge_buff3;
					if (evt.card == event.card && evt.target.isIn() && (event.name == "useCard" || event.player == evt.target)) {
						return true;
					}
					return false;
				},
				direct: true,
				popup: false,
				content() {
					var evt = player.storage.twgongge_buff3;
					if (trigger.name == "damage") {
						trigger.num += evt.num;
					} else if (evt.target.isIn()) {
						evt.target.recover(evt.num);
					}
				},
			},
			buff1_mark: {
				mark: true,
				charlotte: true,
				intro: { content: "跳过下一个摸牌阶段" },
			},
		},
	},
};
