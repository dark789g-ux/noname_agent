import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdfunan" | "stdjiexun" | "stdwuyan" | "stdjujian" | "stdxiaofan" | "stdtuishi" | "oldjuejing" | "oldlonghun" | "stdxiemu" | "stdnaman">} */
export const groupSkills = {
	//薛总
	stdfunan: {
		audio: "funan",
		trigger: {
			target: "shaMiss",
			global: "eventNeutralized",
		},
		usable: 1,
		filter(event, player, name) {
			if (event.type != "card" || event.player == player) {
				return false;
			}
			if (name != "shaMiss" && event._neutralize_event.player != player) {
				return false;
			}
			return event.cards && event.cards.someInD();
		},
		async content(event, trigger, player) {
			await player.gain(trigger.cards.filterInD(), "gain2");
		},
	},
	stdjiexun: {
		audio: "jiexun",
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return target.countCards("h");
				})
				.set("ai", function (target) {
					const player = _status.event.player;
					let eff = get.effect(target, { name: "guohe_copy2" }, player, player);
					if (target == player) {
						return player.countCards("h", { suit: "diamod" }) ? 2 : -2;
					}
					return eff * (target.countCards("h") > 4 ? -1 : 1);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await target
				.chooseToDiscard("h", 1, true)
				.set("ai", card => {
					if (get.suit(card) == "diamond") {
						return 11 - get.value(card);
					}
					return 5 - get.value(card);
				})
				.forResult();
			if (!result.bool) {
				return;
			}
			if (get.suit(result.cards[0]) == "diamond") {
				await target.draw(2);
			}
		},
	},
	//徐庶
	stdwuyan: {
		audio: "wuyan",
		trigger: {
			player: "useCard",
		},
		forced: true,
		filter(event, player) {
			if (!event.cards || event.cards.length != 1 || get.type2(event.cards[0]) != "trick") {
				return false;
			}
			return event.card.name == "wuxie";
		},
		async content(_) {},
		mod: {
			cardname(card, player) {
				let info = lib.card[card.name];
				if (info && ["trick", "delay"].includes(info.type)) {
					return "wuxie";
				}
			},
		},
	},
	stdjujian: {
		audio: "jujian",
		trigger: { player: "useCardAfter" },
		usable: 1,
		filter(event, player) {
			return event.cards && event.cards.length && event.card.name == "wuxie";
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.player();
					return target.getUseValue(_status.event.getTrigger().cards[0]) * get.attitude(player, target);
				})
				.forResult();
			event.result.cards = trigger.cards;
		},
		async content(event, trigger, player) {
			await event.targets[0].gain(event.cards, "gain2");
		},
	},
	//牢彭羕
	stdxiaofan: {
		audio: "olxiaofan",
		trigger: {
			player: "useCardAfter",
		},
		forced: true,
		filter(event, player) {
			const num = Math.min(3, lib.skill.olxiaofan.getNum(player)),
				pos = "jeh".slice(0, num);
			return num > 0 && player.countCards(pos);
		},
		async content(event, trigger, player) {
			const num = Math.min(3, lib.skill.olxiaofan.getNum(player)),
				pos = "jeh".slice(0, num);
			let index = 0;
			while (index < num) {
				const posi = pos[index];
				const hs = player.countCards(posi);
				if (hs > 0) {
					await player.chooseToDiscard(hs, posi, true);
				}
				index++;
			}
		},
		ai: {
			effect: {
				player_use(card, player) {
					if (get.type(card) == "equip") {
						return [0, -5];
					}
				},
			},
			neg: true,
		},
	},
	stdtuishi: {
		audio: "oltuishi",
		mod: {
			wuxieJudgeEnabled: () => false,
			wuxieEnabled: () => false,
			cardEnabled: card => {
				if (card.name == "wuxie") {
					return false;
				}
			},
			aiValue: (player, card, val) => {
				if (card.name == "wuxie") {
					return 0;
				}
				var num = get.number(card);
				if (typeof get.strNumber(num, false) === "string") {
					return 0;
				}
			},
			aiUseful: (player, card, val) => {
				if (card.name == "wuxie") {
					return 0;
				}
				var num = get.number(card);
				if (typeof get.strNumber(num, false) === "string") {
					return 0;
				}
			},
			aiOrder: (player, card, order) => {
				var num = get.number(card);
				if (typeof get.strNumber(num, false) === "string") {
					return 0;
				}
				return order;
			},
		},
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			return typeof get.strNumber(get.number(event.card), false) === "string";
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.targets.length = 0;
			trigger.all_excluded = true;
			game.log(trigger.card, "被无效了");
		},
	},
	//牢赵云
	oldjuejing: {
		audio: "xinjuejing",
		trigger: { player: "phaseDrawBegin2" },
		filter(event, player) {
			return !event.numFixed && player.getHp() < player.maxHp;
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.num += player.getDamagedHp();
		},
		mod: {
			maxHandcard: (player, num) => num + 2,
			aiOrder(player, card, num) {
				if (num <= 0 || !player.isPhaseUsing() || !get.tag(card, "recover")) {
					return num;
				}
				if (player.needsToDiscard() > 1) {
					return num;
				}
				return 0;
			},
		},
	},
	oldlonghun: {
		audio: "relonghun",
		inherit: "xinlonghun",
		prompt: () => `将${get.cnNumber(Math.max(1, get.player().getHp()))}张♦牌当做杀，♥牌当做桃，♣牌当做闪，♠牌当做无懈可击使用或打出`,
		selectCard: () => Math.max(1, get.player().getHp()),
		complexCard: true,
		log: false,
		async precontent(event, trigger, player) {
			player.logSkill("oldlonghun");
		},
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag) {
				var name;
				switch (tag) {
					case "respondSha":
						name = "diamond";
						break;
					case "respondShan":
						name = "club";
						break;
					case "save":
						name = "heart";
						break;
				}
				if (!player.countCards("hes", { suit: name })) {
					return false;
				}
			},
			order(item, player) {
				if (player && _status.event.type == "phase") {
					var max = 0;
					var list = ["sha", "tao"];
					var map = { sha: "diamond", tao: "heart" };
					for (var i = 0; i < list.length; i++) {
						var name = list[i];
						if (
							player.countCards("hes", function (card) {
								return (name != "sha" || get.value(card) < 5) && get.suit(card, player) == map[name];
							}) >= Math.max(1, player.getHp()) &&
							player.getUseValue({
								name: name,
								nature: name == "sha" ? "fire" : null,
							}) > 0
						) {
							var temp = get.order({
								name: name,
								nature: name == "sha" ? "fire" : null,
							});
							if (temp > max) {
								max = temp;
							}
						}
					}
					max /= 1.1;
					return max;
				}
				return 2;
			},
		},
		hiddenCard(player, name) {
			if (name == "wuxie" && _status.connectMode && player.countCards("hes") > 0) {
				return true;
			}
			if (name == "wuxie") {
				return player.countCards("hes", { suit: "spade" }) >= Math.max(1, get.player().getHp());
			}
			if (name == "tao") {
				return player.countCards("hes", { suit: "heart" }) >= Math.max(1, get.player().getHp());
			}
		},
	},
	//马良
	stdxiemu: {
		audio: "xiemu",
		global: "stdxiemu_global",
		subSkill: {
			global: {
				audio: "xiemu",
				enable: "phaseUse",
				usable: 1,
				filter(event, player) {
					if (!player.countCards("he", card => get.type(card) == "basic")) {
						return false;
					}
					return game.hasPlayer(current => current.hasSkill("stdxiemu") && current != player);
				},
				filterTarget(card, player, target) {
					return target.hasSkill("stdxiemu") && target != player;
				},
				selectTarget() {
					const num = game.countPlayer(current => current.hasSkill("stdxiemu") && current != get.player());
					return num > 1 ? 1 : -1;
				},
				filterCard(card) {
					return get.type(card) == "basic";
				},
				chessForceAll: true,
				position: "he",
				check(card) {
					return 4 - get.value(card);
				},
				prompt() {
					const list = game.filterPlayer(current => {
						return current.hasSkill("stdxiemu");
					});
					return `将一张牌交给${get.translation(list)}${list.length > 1 ? "中的一人" : ""}，然后你本回合攻击范围+1。`;
				},
				log: false,
				discard: false,
				lose: false,
				async content(event, trigger, player) {
					const card = event.cards[0],
						target = event.target;
					player.logSkill("stdxiemu", target);
					await player.showCards(card, get.translation(player) + "发动了【协穆】");
					await player.give(card, target, true);
					player.addTempSkill("stdxiemu_range");
					player.addMark("stdxiemu_range", 1, false);
				},
				ai: {
					order: 7,
					result: {
						target: 1,
					},
				},
			},
			range: {
				charlotte: true,
				onremove: true,
				mod: {
					attackRange(player, num) {
						return num + player.countMark("stdxiemu_range");
					},
				},
				intro: {
					content: "本回合攻击范围+#",
				},
			},
		},
	},
	stdnaman: {
		audio: "naman",
		enable: "phaseUse",
		usable: 1,
		viewAs: {
			name: "nanman",
		},
		viewAsFilter(player) {
			if (!player.countCards("he", card => get.type(card) == "basic")) {
				return false;
			}
		},
		filterCard(card) {
			return get.type(card) == "basic";
		},
		position: "he",
		selectCard: [1, Infinity],
		selectTarget() {
			return ui.selected.cards.length;
		},
		complexSelect: true,
	},
};
