import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "redimeng" | "reluanji" | "qimou" | "qimou2" | "xinkuanggu">} */
export const groupSkills = {
	redimeng: {
		audio: "dimeng",
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filterCard() {
			if (ui.selected.targets.length == 2) {
				return false;
			}
			return true;
		},
		selectCard: [0, Infinity],
		selectTarget: 2,
		complexCard: true,
		complexSelect: true,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			if (ui.selected.targets.length == 0) {
				return true;
			}
			return Math.abs(ui.selected.targets[0].countCards("h") - target.countCards("h")) == ui.selected.cards.length;
		},
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			// 改到一半发现又没人用这个技能
			// 心态炸了喵_(:з」∠)_
			const [target, target1] = event.targets;
			const cards = target.getCards("h").concat(target1.getCards("h"));
			event.dialogRef = true;
			const videoId = lib.status.videoId++;
			game.broadcastAll(
				function (cards, id, player, targets) {
					const dialog = ui.create.dialog("缔盟", true);
					if (player.isUnderControl(true) || targets[0].isUnderControl(true) || targets[1].isUnderControl(true)) {
						dialog.add(cards);
						dialog.seeing = true;
					} else {
						dialog.add([cards, "blank"]);
					}
					_status.dieClose.push(dialog);
					dialog.videoId = id;
					if (_status.event.dialogRef) {
						_status.event.dialog = dialog;
					}
				},
				cards,
				videoId,
				player,
				event.targets
			);
			game.addVideo("cardDialog", null, ["缔盟", get.cardsInfo(cards), videoId]);
			delete event.dialogRef;
			const dialog = event.dialog;
			let current = target;
			let num1 = 0;
			let num2 = 0;
			await game.delay();
			while (dialog.buttons.length) {
				let card;
				if (dialog.buttons.length > 1) {
					const next = current.chooseButton(true, function (button) {
						return get.value(button.link, _status.event.player);
					});
					next.set("dialog", get.idDialog(videoId));
					next.set("closeDialog", false);
					next.set("dialogdisplay", true);
					const result = await next.forResult();
					if (!result.bool) {
						return;
					}
					card = result.links[0];
				} else {
					card = dialog.buttons[0].link;
				}
				const button = dialog.buttons.find(button => button.link == card);
				if (button) {
					if (dialog.seeing) {
						button.querySelector(".info").innerHTML = get.translation(current.name);
						if (!_status.connectMode) {
							game.log(current, "选择了", button.link);
						}
					}
					dialog.buttons.remove(button);
				}
				if (card) {
					await current.gain(card);
					if (dialog.seeing) {
						current.$draw(card, "nobroadcast");
					} else {
						current.$draw(1, "nobroadcast");
					}
					game.broadcast(
						function (card, id, current) {
							const dialog = get.idDialog(id);
							if (dialog && dialog.seeing) {
								const button = dialog.buttons.find(button => button.link == card);
								if (button) {
									button.querySelector(".info").innerHTML = get.translation(current.name);
									dialog.buttons.remove(button);
								}
								current.$draw(card, "nobroadcast");
							} else {
								current.$draw(1, "nobroadcast");
							}
						},
						card,
						videoId,
						current
					);
				}
				if (current == target) {
					num1++;
					current = target1;
				} else {
					num2++;
					current = target;
				}
				await game.delay(2);
			}
			if (!_status.connectMode) {
				game.log(event.targets[0], "获得了" + get.cnNumber(num1) + "张牌");
				game.log(event.targets[1], "获得了" + get.cnNumber(num2) + "张牌");
			}
			dialog.close();
			_status.dieClose.remove(dialog);
			game.broadcast(function (id) {
				const dialog = get.idDialog(id);
				if (dialog) {
					dialog.close();
					_status.dieClose.remove(dialog);
				}
			}, videoId);
			game.addVideo("cardDialog", null, videoId);
		},
		targetprompt: ["先拿牌", "后拿牌"],
		find(type) {
			const player = _status.event.player;
			let list = game.filterPlayer(current => current != player && get.attitude(player, current) > 3);
			const num = player.countCards("he", card => get.value(card) < 7);
			let count = null,
				from,
				nh;
			if (list.length == 0) {
				return null;
			}
			list.sort((a, b) => a.countCards("h") - b.countCards("h"));
			if (type == 1) {
				return list[0];
			}
			from = list[0];
			nh = from.countCards("h");
			list = game.filterPlayer(current => current != player && get.attitude(player, current) < 1);
			if (!list.length) {
				return null;
			}
			list.sort((a, b) => b.countCards("h") - a.countCards("h"));
			for (let i = 0; i < list.length; i++) {
				const nh2 = list[i].countCards("h");
				if (nh2 - nh <= num) {
					count = nh2 - nh;
					break;
				}
			}
			if (count == null || count < 0) {
				return null;
			}
			if (type == 3) {
				return count;
			}
			return list[i];
		},
		check(card) {
			const count = lib.skill.redimeng.find(3);
			if (count == null) {
				return -1;
			}
			if (ui.selected.cards.length < count) {
				return 7 - get.value(card);
			}
			return -1;
		},
		ai: {
			order: 8,
			threaten: 1.6,
			expose: 0.5,
			result: {
				player(player, target) {
					if (ui.selected.targets.length == 0) {
						if (target == lib.skill.redimeng.find(1)) {
							return 1;
						}
						return 0;
					} else {
						if (target == lib.skill.redimeng.find(2)) {
							return 1;
						}
						return 0;
					}
				},
			},
		},
	},
	reluanji: {
		audio: 2,
		enable: "phaseUse",
		viewAs: { name: "wanjian" },
		filterCard(card, player) {
			if (!player.storage.reluanji) {
				return true;
			}
			return !player.storage.reluanji.includes(get.suit(card));
		},
		position: "hs",
		selectCard: 2,
		check(card) {
			const player = _status.event.player;
			const targets = game.filterPlayer(function (current) {
				return player.canUse("wanjian", current);
			});
			let num = 0;
			for (let i = 0; i < targets.length; i++) {
				let eff = get.sgn(get.effect(targets[i], { name: "wanjian" }, player, player));
				if (targets[i].hp == 1) {
					eff *= 1.5;
				}
				num += eff;
			}
			if (!player.needsToDiscard(-1)) {
				if (targets.length >= 7) {
					if (num < 2) {
						return 0;
					}
				} else if (targets.length >= 5) {
					if (num < 1.5) {
						return 0;
					}
				}
			}
			return 6 - get.value(card);
		},
		ai: {
			basic: {
				order: 8.9,
			},
		},
		group: ["reluanji_count", "reluanji_reset", "reluanji_respond", "reluanji_damage", "reluanji_draw"],
		subSkill: {
			reset: {
				trigger: { player: "phaseAfter" },
				silent: true,
				async content(event, trigger, player) {
					delete player.storage.reluanji;
					delete player.storage.reluanji2;
				},
			},
			count: {
				trigger: { player: "useCard" },
				silent: true,
				filter(event) {
					return event.skill == "reluanji";
				},
				async content(event, trigger, player) {
					player.storage.reluanji2 = trigger.card;
					if (!player.storage.reluanji) {
						player.storage.reluanji = [];
					}
					player.storage.reluanji.addArray(trigger.cards.map(c => get.suit(c)));
				},
			},
			respond: {
				trigger: { global: "respond" },
				silent: true,
				filter(event) {
					return event.getParent(2).skill == "reluanji";
				},
				async content(event, trigger, player) {
					await trigger.player.draw();
				},
			},
			damage: {
				trigger: { source: "damage" },
				forced: true,
				silent: true,
				popup: false,
				filter(event, player) {
					return player.storage.reluanji2 && event.card == player.storage.reluanji2;
				},
				async content(event, trigger, player) {
					delete player.storage.reluanji2;
				},
			},
			draw: {
				trigger: { player: "useCardAfter" },
				forced: true,
				silent: true,
				popup: false,
				filter(event, player) {
					return player.storage.reluanji2 && event.card == player.storage.reluanji2;
				},
				async content(event, trigger, player) {
					await player.draw(trigger.targets.length);
					delete player.storage.reluanji2;
				},
			},
		},
	},
	qimou: {
		limited: true,
		audio: 2,
		enable: "phaseUse",
		skillAnimation: true,
		animationColor: "orange",
		async content(event, trigger, player) {
			const shas = player.getCards("h", "sha");
			let num;
			if (player.hp >= 4 && shas.length >= 3) {
				num = 3;
			} else if (player.hp >= 3 && shas.length >= 2) {
				num = 2;
			} else {
				num = 1;
			}
			const map = {};
			const list = [];
			for (let i = 1; i <= player.hp; i++) {
				const cn = get.cnNumber(i, true);
				map[cn] = i;
				list.push(cn);
			}
			player.awakenSkill(event.name);
			player.storage.qimou = true;
			const result = await player
				.chooseControl(list, function () {
					return get.cnNumber(_status.event.goon, true);
				})
				.set("prompt", "失去任意点体力")
				.set("goon", num)
				.forResult();
			num = map[result.control] || 1;
			player.storage.qimou2 = num;
			player.addTempSkill("qimou2");
			await player.loseHp(num);
		},
		ai: {
			order: 2,
			result: {
				player(player) {
					if (player.hp == 1) {
						return 0;
					}
					const shas = player.getCards("h", "sha");
					if (!shas.length) {
						return 0;
					}
					const card = shas[0];
					if (!lib.filter.cardEnabled(card, player)) {
						return 0;
					}
					if (lib.filter.cardUsable(card, player)) {
						return 0;
					}
					let mindist;
					if (player.hp >= 4 && shas.length >= 3) {
						mindist = 4;
					} else if (player.hp >= 3 && shas.length >= 2) {
						mindist = 3;
					} else {
						mindist = 2;
					}
					if (
						game.hasPlayer(function (current) {
							return current.hp <= mindist - 1 && get.distance(player, current, "attack") <= mindist && player.canUse(card, current, false) && get.effect(current, card, player, player) > 0;
						})
					) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	qimou2: {
		onremove: true,
		mod: {
			cardUsable(card, player, num) {
				if (typeof player.storage.qimou2 == "number" && card.name == "sha") {
					return num + player.storage.qimou2;
				}
			},
			globalFrom(from, to, distance) {
				if (typeof from.storage.qimou2 == "number") {
					return distance - from.storage.qimou2;
				}
			},
		},
	},
	xinkuanggu: {
		audio: "kuanggu",
		audioname: ["re_weiyan", "ol_weiyan"],
		trigger: { source: "damageSource" },
		filter(event, player) {
			return event.checkKuanggu && event.num > 0;
		},
		getIndex(event, player, triggername) {
			return event.num;
		},
		preHidden: true,
		async cost(event, trigger, player) {
			let choice;
			if (
				player.isDamaged() &&
				get.recoverEffect(player) > 0 &&
				player.countCards("hs", function (card) {
					return card.name == "sha" && player.hasValueTarget(card);
				}) >= player.getCardUsable("sha")
			) {
				choice = "recover_hp";
			} else {
				choice = "draw_card";
			}
			const next = player.chooseDrawRecover("###" + get.prompt(event.skill) + "###摸一张牌或回复1点体力");
			next.set("choice", choice);
			next.set("ai", function () {
				return _status.event.getParent().choice;
			});
			next.set("logSkill", event.skill);
			next.setHiddenSkill(event.skill);
			const { control } = await next.forResult();
			if (control == "cancel2") {
				return;
			}
			event.result = { bool: true, skill_popup: false }; // 好像在content里面不能中断getIndex喵
		},
		async content(event, trigger, player) {},
	},
};
