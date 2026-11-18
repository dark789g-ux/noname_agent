import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "sghuishi" | "dingzhou" | "tamo" | "zhimeng">} */
export const groupSkills = {
	sghuishi: {
		onChooseToUse(event) {
			event.targetprompt2.add(target => {
				if (event.skill !== "sghuishi" || !target.classList.contains("selectable")) {
					return;
				}
				if (
					target.getSkills(null, false, false).some(skill => {
						const info = get.info(skill);
						return info?.juexingji && !target.awakenedSkills.includes(skill);
					})
				) {
					return "觉醒";
				} else {
					return "摸牌";
				}
			});
		},
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "water",
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target } = event;
			player.awakenSkill(event.name);
			const list = target.getSkills(null, false, false).filter(skill => {
				const info = get.info(skill);
				return info?.juexingji && !target.awakenedSkills.includes(skill);
			});
			if (list.length) {
				target.addMark(event.name, 1, false);
				for (const skill of list) {
					const info = get.info(skill);
					if (info.filter && !info.charlotte && !info.sghuishi_filter) {
						info.sghuishi_filter = info.filter;
						info.filter = function (event, player) {
							if (player.hasMark("sghuishi")) {
								return true;
							}
							return this.sghuishi_filter.apply(this, arguments);
						};
					}
				}
			} else {
				await target.draw(4);
			}
			await player.loseMaxHp(2);
		},
		intro: { content: "发动非Charlotte觉醒技时无视条件" },
		ai: {
			order: 0.1,
			expose: 0.2,
			result: {
				target(player, target) {
					if (player.hasUnknown() || player.maxHp < 5) {
						return 0;
					}
					var list = target.getSkills(null, false, false).filter(function (skill) {
						var info = lib.skill[skill];
						return info && info.juexingji;
					});
					if (list.length || target.hasJudge("lebu") || target.hasSkillTag("nogain")) {
						return 0;
					}
					return 4;
				},
			},
		},
	},
	//神鲁肃
	dingzhou: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			const num = player.countCards("he");
			return game.hasPlayer(current => {
				if (current == player) {
					return false;
				}
				const total = current.countCards("ej");
				return total > 0 && num >= total;
			});
		},
		filterCard: true,
		selectCard() {
			return [1, Math.max(...game.filterPlayer(i => i != get.player()).map(i => i.countCards("ej")))];
		},
		check(card) {
			return 7 - get.value(card);
		},
		filterTarget(card, player, target) {
			const num = target.countCards("ej");
			if (!num) {
				return false;
			}
			return ui.selected.cards.length == num && player != target;
		},
		filterOk() {
			return ui.selected.cards.length == ui.selected.targets[0].countCards("ej");
		},
		position: "he",
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.give(event.cards, target);
			const cards = target.getGainableCards(player, "ej");
			if (cards.length) {
				player.gain(cards, "give", target);
			}
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					let eff = 0;
					if (ui.selected.cards.length) {
						eff = ui.selected.cards.map(card => get.value(card)).reduce((p, c) => p + c, 0);
					}
					if (player.hasSkill("zhimeng") && (get.mode() == "identity" || player.countCards("h") - target.countCards("h") > 2 * ui.selected.cards.length)) {
						eff *= 1 + get.sgnAttitude(player, target) * 0.15;
					}
					const es = target.getCards("e"),
						js = target.getCards("j");
					es.forEach(card => {
						eff -= get.value(card, target);
					});
					js.forEach(card => {
						eff -= get.effect(
							target,
							{
								name: card.viewAs || card.name,
								cards: [card],
							},
							target,
							target
						);
					});
					return eff;
				},
			},
		},
	},
	tamo: {
		available(mode) {
			// 走另外的phaseLoop的模式/子模式/设置
			if (["boss", "stone", "tafang"].includes(mode) || ["jiange", "standard", "three", "leader"].includes(_status.mode) || get.config("seat_order") === "指定") {
				return false;
			}
		},
		getTargets() {
			return game.filterPlayer(current => {
				return !current.isZhu2() && (get.mode() !== "doudizhu" || current.getSeatNum() !== 3);
			});
		},
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && get.info("tamo").getTargets().length > 1;
		},
		seatRelated: "changeSeat",
		derivation: "tamo_faq",
		frequent: true,
		async content(event, trigger, player) {
			const toSortPlayers = get.info(event.name).getTargets();
			toSortPlayers.sortBySeat(game.findPlayer2(current => current.getSeatNum() == 1, true));
			const next = player.chooseToMove(lib.translate[`${event.name}_info`]);
			next.set("list", [["（以下排列的顺序即为发动技能后角色的座次顺序）", [toSortPlayers.map(i => `${i.getSeatNum()}|${i.name}`), lib.skill.tamo.$createButton]]]);
			next.set("toSortPlayers", toSortPlayers.slice(0));
			next.set("processAI", () => {
				const players = get.event().toSortPlayers,
					player = get.player();
				players.randomSort().sort((a, b) => get.attitude(player, b) - get.attitude(player, a));
				return [players.map(i => `${i.getSeatNum()}|${i.name}`)];
			});
			const result = await next.forResult();
			const moved = result?.moved;
			const resultList = moved[0].map(info => {
				return parseInt(info.split("|")[0]);
			});
			const toSwapList = [];
			const cmp = (a, b) => {
				return resultList.indexOf(a) - resultList.indexOf(b);
			};
			for (let i = 0; i < toSortPlayers.length; i++) {
				for (let j = 0; j < toSortPlayers.length; j++) {
					if (cmp(toSortPlayers[i].getSeatNum(), toSortPlayers[j].getSeatNum()) < 0) {
						toSwapList.push([toSortPlayers[i], toSortPlayers[j]]);
						[toSortPlayers[i], toSortPlayers[j]] = [toSortPlayers[j], toSortPlayers[i]];
					}
				}
			}
			game.broadcastAll(toSwapList => {
				for (const list of toSwapList) {
					game.swapSeat(list[0], list[1], false);
				}
			}, toSwapList);
			if (trigger.name === "phase" && !trigger.player.isZhu2() && trigger.player !== toSortPlayers[0] && !trigger._finished) {
				trigger.finish();
				trigger._triggered = 5;
				const evt = toSortPlayers[0].insertPhase();
				delete evt.skill;
				const evt2 = trigger.getParent();
				if (evt2.name == "phaseLoop" && evt2._isStandardLoop) {
					evt2.player = toSortPlayers[0];
				}
				//跳过新回合的phaseBefore
				evt.pushHandler("onPhase", (event, option) => {
					if (event.step === 0 && option.state === "begin") {
						event.step = 1;
					}
				});
			}
			await game.delay();
		},
		$createButton(item, type, position, noclick, node) {
			const info = item.split("|"),
				_item = item;
			const seat = parseInt(info[0]);
			item = info[1];
			if (node) {
				node.classList.add("button");
				node.classList.add("character");
				node.style.display = "";
			} else {
				node = ui.create.div(".button.character", position);
			}
			node._link = item;
			node.link = item;

			const func = function (node, item) {
				const currentPlayer = game.findPlayer(current => current.getSeatNum() == seat);
				if (currentPlayer.classList.contains("unseen_show")) {
					node.setBackground("hidden_image", "character");
				} else if (item != "unknown") {
					node.setBackground(item, "character");
				}
				if (node.node) {
					node.node.name.remove();
					node.node.hp.remove();
					node.node.group.remove();
					node.node.intro.remove();
					if (node.node.replaceButton) {
						node.node.replaceButton.remove();
					}
				}
				node.node = {
					name: ui.create.div(".name", node),
					group: ui.create.div(".identity", node),
					intro: ui.create.div(".intro", node),
				};
				const infoitem = [currentPlayer.sex, currentPlayer.group, `${currentPlayer.hp}/${currentPlayer.maxHp}/${currentPlayer.hujia}`];
				node.node.name.innerHTML = get.slimName(item);
				if (lib.config.buttoncharacter_style == "default" || lib.config.buttoncharacter_style == "simple") {
					if (lib.config.buttoncharacter_style == "simple") {
						node.node.group.style.display = "none";
					}
					node.classList.add("newstyle");
					node.node.name.dataset.nature = get.groupnature(get.bordergroup(infoitem));
					node.node.group.dataset.nature = get.groupnature(get.bordergroup(infoitem), "raw");
				}
				node.node.name.style.top = "8px";
				if (node.node.name.querySelectorAll("br").length >= 4) {
					node.node.name.classList.add("long");
					if (lib.config.buttoncharacter_style == "old") {
						node.addEventListener("mouseenter", ui.click.buttonnameenter);
						node.addEventListener("mouseleave", ui.click.buttonnameleave);
					}
				}
				node.node.intro.innerHTML = lib.config.intro;
				if (!noclick) {
					lib.setIntro(node);
				}
				node.node.group.innerHTML = `<div>${get.cnNumber(seat, true)}号</div>`;
				node.node.group.style.backgroundColor = get.translation(`${get.bordergroup(infoitem)}Color`);
			};
			node.refresh = func;
			node.refresh(node, item);

			node.link = _item;
			node.seatNumber = seat;
			node._customintro = uiintro => {
				uiintro.add(`${get.translation(node._link)}(原${get.cnNumber(node.seatNumber, true)}号位)`);
			};
			return node;
		},
	},
	//什么均贫卡
	zhimeng: {
		audio: 2,
		trigger: { player: "phaseAfter" },
		filter(event, player) {
			return game.hasPlayer(target => {
				if (target == player || target.countCards("h") + player.countCards("h") == 0) {
					return false;
				}
				return true;
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "与一名其他角色平分手牌", (card, player, target) => {
					if (target == player || target.countCards("h") + player.countCards("h") == 0) {
						return false;
					}
					return true;
				})
				.set("ai", target => {
					const player = get.player();
					const pvalue = -player
						.getCards("h")
						.map(card => get.value(card, player))
						.reduce((p, c) => p + c, 0);
					const tvalue =
						-target
							.getCards("h")
							.map(card => get.value(card, target))
							.reduce((p, c) => p + c, 0) * get.sgnAttitude(player, target);
					return (pvalue + tvalue) / 2;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const lose_list = [];
			let cards = [];
			[player, target].forEach(current => {
				const hs = current.getCards("h");
				if (hs.length) {
					cards.addArray(hs);
					current.$throw(hs.length, 500);
					game.log(current, "将", get.cnNumber(hs.length), "张牌置入了处理区");
					lose_list.push([current, hs]);
				}
			});
			if (lose_list.length) {
				await game
					.loseAsync({
						lose_list,
					})
					.setContent("chooseToCompareLose");
			}
			await game.delay();
			cards = cards.filterInD();
			const pcards = cards.randomGets(Math.ceil(cards.length / 2));
			const tcards = cards.removeArray(pcards);
			const list = [];
			if (pcards.length) {
				list.push([player, pcards]);
				game.log(player, "获得了", get.cnNumber(pcards.length), "张牌");
			}
			if (tcards.length) {
				list.push([target, tcards]);
				game.log(target, "获得了", get.cnNumber(tcards.length), "张牌");
			}
			await game
				.loseAsync({
					gain_list: list,
					player,
					animate: "draw",
				})
				.setContent("gaincardMultiple");
		},
		ai: { threaten: 4 },
	},
};
