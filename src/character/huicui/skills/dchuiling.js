import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dchuiling" | "dcchongxu" | "dctaji" | "dcqinghuang">} */
export const groupSkills = {
	//孙寒华
	dchuiling: {
		audio: 2,
		trigger: { player: "useCard" },
		forced: true,
		direct: true,
		filter() {
			return ui.discardPile.childNodes.length > 0;
		},
		onremove: true,
		mark: true,
		marktext: "灵",
		intro: {
			name2: "灵",
			mark(dialog, storage, player) {
				dialog.addText("共有" + (storage || 0) + "个标记");
				dialog.addText("注：图标的颜色代表弃牌堆中较多的颜色");
			},
		},
		global: "dchuiling_hint",
		async content(event, trigger, player) {
			let mark = false;
			let red = 0,
				black = 0;
			for (let i = 0; i < ui.discardPile.childNodes.length; i++) {
				const color = get.color(ui.discardPile.childNodes[i]);
				if (color == "red") {
					red++;
				}
				if (color == "black") {
					black++;
				}
			}
			if (red == black) {
				return;
			} else if (red > black) {
				player.logSkill("dchuiling");
				await player.recover();
				if (get.color(trigger.card) == "black") {
					mark = true;
				}
				event.logged = true;
			} else {
				if (!event.isMine() && !event.isOnline()) {
					game.delayx();
				}
				if (get.color(trigger.card) == "red") {
					mark = true;
				}
				if (game.hasPlayer(current => current != player && current.hasDiscardableCards(player, "he"))) {
					const result = await player
						.chooseTarget(get.prompt("dchuiling"), "你可以弃置一名其他角色的一张牌", (card, player, target) => {
							return target != player && target.hasDiscardableCards(player, "he");
						})
						.set("ai", target => {
							return get.effect(target, { name: "guohe_copy2" }, _status.event.player);
						})
						.forResult();

					if (result?.bool) {
						const target = result.targets[0];
						if (!event.logged) {
							player.logSkill("dchuiling", target);
						} else {
							player.line(target);
						}
						await player.discardPlayerCard(target, "he", true);
					}
				}
			}
			if (mark) {
				if (!event.logged) {
					player.logSkill("dchuiling");
				}
				player.addMark("dchuiling", 1);
				event.logged = true;
			}
		},
		subSkill: {
			hint: {
				trigger: {
					global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter", "equipAfter"],
				},
				forced: true,
				popup: false,
				lastDo: true,
				forceDie: true,
				forceOut: true,
				filter(event, player) {
					if (event._dchuiling_checked) {
						return false;
					}
					event._dchuiling_checked = true;
					var cards = event.getd();
					if (!cards.filterInD("d").length) {
						return false;
					}
					return true;
				},
				markColor: [
					["rgba(241, 42, 42, 0.75)", "black"],
					["", ""],
					["rgba(18, 4, 4, 0.75)", "rgb(200, 200, 200)"],
				],
				async content(event, trigger, player) {
					let red = 0,
						black = 0;
					for (let i = 0; i < ui.discardPile.childNodes.length; i++) {
						const color = get.color(ui.discardPile.childNodes[i]);
						if (color == "red") {
							red++;
						}
						if (color == "black") {
							black++;
						}
					}
					if (trigger.name.indexOf("lose") == 0) {
						const cards = trigger.getd().filterInD("d");
						for (let i = 0; i < cards.length; i++) {
							const color = get.color(cards[i]);
							if (color == "red") {
								red++;
							}
							if (color == "black") {
								black++;
							}
						}
					}
					game.broadcastAll(
						function (ind) {
							var bgColor = lib.skill.dchuiling_hint.markColor[ind][0],
								text = '<span style="color: ' + lib.skill.dchuiling_hint.markColor[ind][1] + '">灵</span>';
							for (var player of game.players) {
								if (player.marks.dchuiling) {
									player.marks.dchuiling.firstChild.style.backgroundColor = bgColor;
									player.marks.dchuiling.firstChild.innerHTML = text;
								}
							}
						},
						Math.sign(black - red) + 1
					);
				},
			},
		},
		mod: {
			aiOrder(player, card, num) {
				if (get.itemtype(card) != "card") {
					return;
				}
				var len = ui.discardPile.childNodes.length;
				if (!len) {
					var type = get.type(card);
					if (type == "basic" || type == "trick") {
						if (player.getDamagedHp() > 0) {
							return num + (get.color(card) == "red" ? 15 : 10);
						}
						return num + 10;
					}
					return;
				}
				if (len > 40) {
					return;
				}
				var red = 0,
					black = 0;
				for (var i = 0; i < ui.discardPile.childNodes.length; i++) {
					var color = get.color(ui.discardPile.childNodes[i]);
					if (color == "red") {
						red++;
					}
					if (color == "black") {
						black++;
					}
				}
				if (red == black) {
					var type = get.type(card);
					if (type == "basic" || type == "trick") {
						if (player.getDamagedHp() > 0) {
							return num + (get.color(card) == "red" ? 15 : 10);
						}
						return num + 10;
					}
					return;
				} else {
					var color = get.color(card);
					if ((color == "red" && red < black) || (color == "black" && red > black)) {
						return num + 10;
					}
				}
			},
		},
	},
	dcchongxu: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "wood",
		derivation: ["dctaji", "dcqinghuang"],
		manualConfirm: true,
		prompt() {
			return "限定技。你可以失去〖汇灵〗，增加" + Math.min(game.players.length, _status.event.player.countMark("dchuiling")) + "点体力上限，然后获得〖踏寂〗和〖青荒〗。";
		},
		filter(event, player) {
			return player.countMark("dchuiling") >= 4;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const num = Math.min(game.players.length, player.countMark("dchuiling"));
			await player.removeSkills("dchuiling");
			await player.gainMaxHp(num);
			await player.addSkills(["dctaji", "dcqinghuang"]);
		},
		ai: {
			combo: "dchuiling",
			order(itemp, player) {
				if (
					player.hasCard(card => {
						return get.type(card) != "equip" && player.getUseValue(card) > 1;
					}, "h")
				) {
					return 12;
				}
				return 0.1;
			},
			result: {
				player(player) {
					var count = player.countMark("dchuiling");
					if (count >= game.countPlayer() - 1) {
						return 1;
					}
					return count >= 6 || player.hp <= 2 ? 1 : 0;
				},
			},
		},
	},
	dctaji: {
		audio: 2,
		trigger: {
			player: "loseEnd",
			global: ["equipEnd", "addJudgeEnd", "gainEnd", "loseAsyncEnd", "addToExpansionEnd"],
		},
		forced: true,
		locked: false,
		filter(event, player) {
			var evt = event.getl(player);
			return evt && evt.hs && evt.hs.length;
		},
		async content(event, trigger, player) {
			const evt = trigger.getParent();
			const effects = [
				[
					"useCard",
					async (event, trigger, player) => {
						const targets = game.filterPlayer(current => {
							return current.countDiscardableCards(player, "he") && current != player;
						});
						if (!targets.length) {
							return;
						}
						const result = await player
							.chooseTarget("踏寂：弃置其他角色一张牌", true, (card, player, target) => {
								return _status.event.targets.includes(target);
							})
							.set("targets", targets)
							.set("ai", target => {
								return get.effect(target, { name: "guohe_copy2" }, _status.event.player);
							})
							.forResult();

						if (result?.bool) {
							const target = result.targets[0];
							player.line(target);
							await player.discardPlayerCard(target, "he", true);
						}
					},
				],
				[
					"respond",
					async (event, trigger, player) => {
						await player.draw();
					},
				],
				[
					"discard",
					async (event, trigger, player) => {
						await player.recover();
					},
				],
				[
					"other",
					async (event, trigger, player) => {
						player.addSkill("dctaji_damage");
						player.addMark("dctaji_damage", 1, false);
						game.log(player, "下一次对其他角色造成的伤害", "#g+1");
					},
				],
			];
			let name = evt.name;
			if (trigger.name == "loseAsync") {
				name = evt.type;
			}
			const list = ["useCard", "respond", "discard", "other"];
			if (!list.includes(name)) {
				name = "other";
			}
			for (let i = 0; i < 1 + player.countMark("dcqinghuang_add"); i++) {
				if (!list.length) {
					break;
				}
				if (!list.includes(name)) {
					name = list.randomRemove(1)[0];
				}
				if (name == "useCard") {
					list.remove("useCard");
				}
				for (const effect of effects) {
					if (effect[0] == name) {
						list.remove(name);
						const next = game.createEvent("dctaji_" + name);
						next.player = player;
						next.setContent(effect[1]);
						await next;
						break;
					}
				}
			}
		},
		subSkill: {
			damage: {
				audio: "dctaji",
				trigger: { source: "damageBegin1" },
				forced: true,
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return event.player != player;
				},
				async content(event, trigger, player) {
					trigger.num += player.countMark(event.name);
					player.removeSkill(event.name);
				},
				intro: {
					content: "下次对其他角色造成伤害时，此伤害+#",
				},
			},
		},
	},
	dcqinghuang: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.maxHp > 1;
		},
		check(event, player) {
			var num1 = player.countCards("h");
			var num2 = player.countCards("h", card => player.hasValueTarget(card));
			var num3 = player.getHandcardLimit();
			if (player.isDamaged()) {
				return num2 > 1 || num1 - num2 - num3 > 0;
			} else {
				return num2 > 2 + Math.max(0, 3 - player.hp) || (player.hp > 2 && num1 - num2 - num3 > 2);
			}
		},
		async content(event, trigger, player) {
			player.loseMaxHp();
			player.addTempSkill("dcqinghuang_add");
			player.addMark("dcqinghuang_add", 1, false);
		},
		ai: {
			combo: "dctaji",
		},
		subSkill: {
			add: {
				charlotte: true,
				onremove: true,
			},
		},
	},
};
