import { _status, game, get, lib, ui, ai } from "noname";
import { GameEvent, initializeEvent, type RawGameDrawEvent } from "../gameEvent.js";
import { Player } from "../player.js";
import type { LegacyChooseButtonCreateDialog } from "../Player/legacyParams";
import { delay } from "@/util/index.js";
import { tryLLMDecide } from "@/llm/index.js";
import { forwardEventLogSkill, getLogSkillName } from "../GameEvent/logSkill.js";
import { getButtonSubtypes } from "../GameEvent/buttonSubtypes.js";
import { isImportModePayload, isSelectionResultObject as isBoundarySelectionResultObject, normalizeSelectionResult as normalizeBoundarySelectionResult, type SelectionResultRuntime } from "../GameEvent/resultBoundary.js";
import { getRegisteredSkill, requireRegisteredSkill } from "../../skillRegistry.js";
import { isRecord, isAIResult, isSelectionResultObject, normalizeSelectionResult, isCardLinks, isVCardLinks, isCardMatrix, normalizeChooseButtonTargetResult, applyLLMDecision, attachChooseButtonSelectionSpec } from "./selectionResults.js";

export const gameDrawContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async gameDraw(event: RawGameDrawEvent, trigger, player: Player | null | undefined) {
		const { num } = event;
		if (_status.brawl && _status.brawl.noGameDraw) {
			return;
		}
		if (!player) {
			throw new Error("gameDraw requires an initialized player.");
		}
		const targets = event.getTargets();

		const end = player;

		const waitings: GameEvent[] = [];
		do {
			if (targets.includes(player)) {
				const numx = typeof num == "function" ? num(player) : num;

				/*otherPile主要是针对那些用专属牌堆，不从一般牌堆摸牌的角色（如陈寿），该属性目前只有两个键值对，且都为函数
				 *getCards函数与获得牌相关，只传入要获得的牌数num作为参数
				 *discard与手气卡换牌后弃置牌相关，只传入要弃置的牌card作为参数
				 */
				const cards: Card[] = [];
				const playerid = player.playerid;
				const otherGetCards = playerid ? event.otherPile?.[playerid]?.getCards : undefined;
				//先看有没有专属牌堆，再看其他的
				if (otherGetCards) {
					cards.addArray(otherGetCards(numx));
				} else if (player.getTopCards) {
					cards.addArray(player.getTopCards(numx));
				} else {
					cards.addArray(get.cards(numx));
				}
				//别问，问就是初始手牌要有标记 by 星の语
				//event.gaintag支持函数、字符串、数组。数组就是添加一连串的标记；函数的返回格式为[[cards1,gaintag1],[cards2,gaintag2]...]
				if (playerid && event.gaintag?.[playerid]) {
					const gaintag = event.gaintag[playerid];
					const list = typeof gaintag == "function" ? gaintag(numx, cards) : [[cards, gaintag]];
					game.broadcastAll(
						(player, list) => {
							for (let i = list.length - 1; i >= 0; i--) {
								player.directgain(list[i][0], null, list[i][1]);
							}
						},
						player,
						list
					);
				} else {
					player.directgain(cards);
				}
			}

			if (player.singleHp === true && get.mode() != "guozhan" && (lib.config.mode != "doudizhu" || _status.mode != "online")) {
				const next = player.doubleDraw();
				waitings.push(next);
			}

			player._start_cards = player.getCards("h");
			player = player.next;
		} while (player != end);

		event.changeCard = get.config("change_card");
		if (_status.connectMode || (lib.config.mode == "single" && _status.mode != "wuxianhuoli") || (lib.config.mode == "doudizhu" && _status.mode == "online") || (lib.config.mode != "identity" && lib.config.mode != "guozhan" && lib.config.mode != "doudizhu" && lib.config.mode != "single")) {
			event.changeCard = "disabled";
		}

		await Promise.all(waitings);

		const me = game.me;
		if (!me || !targets.includes(me) || event.changeCard == "disabled" || _status.auto || !me.countCards("h")) {
			return;
		}

		event.dialog = ui.create.dialog("是否使用手气卡？");
		ui.create.confirm("oc");
		event.custom.replace.confirm = bool => {
			_status.event.bool = bool;
			game.resume();
		};

		while (true) {
			if (event.changeCard == "once") {
				event.changeCard = "disabled";
			} else if (event.changeCard == "twice") {
				event.changeCard = "once";
			} else if (event.changeCard == "disabled") {
				event.bool = false;
				_status.imchoosing = false;
				break;
			}

			_status.imchoosing = true;
			event.switchToAuto = () => {
				_status.event.bool = false;
				game.resume();
			};
			await game.pause();
			_status.imchoosing = false;
			if (!event.bool) {
				break;
			}

			if (game.changeCoin) {
				game.changeCoin(-3);
			}
			/*otherPile主要是针对那些用专属牌堆，不从一般牌堆摸牌的角色（如陈寿），该属性目前只有两个键值对，且都为函数
			 *getCards函数与获得牌相关，只传入要获得的牌数num作为参数
			 *discard与手气卡换牌后弃置牌相关，只传入要弃置的牌card作为参数
			 */
			const hs = game.getMe().getCards("h");
			const cards: Card[] = [];
			const gameMePlayerid = game.getMe().playerid;
			const otherGetCards = gameMePlayerid ? event.otherPile?.[gameMePlayerid]?.getCards : undefined;
			const otherDiscacrd = gameMePlayerid ? event.otherPile?.[gameMePlayerid]?.discard : undefined;
			//先弃牌
			game.addVideo("lose", game.getMe(), [get.cardsInfo(hs), [], [], []]);
			for (const card of hs) {
				card.removeGaintag(true);
				if (otherDiscacrd) {
					otherDiscacrd(card);
				} else {
					card.discard(false);
				}
			}
			//再摸牌，先看有没有专属牌堆
			if (otherGetCards) {
				cards.addArray(otherGetCards(hs.length));
			} else {
				cards.addArray(get.cards(hs.length));
			}
			//添加标记相关
			//别问，问就是初始手牌要有标记 by 星の语
			//event.gaintag支持函数、字符串、数组。数组就是添加一连串的标记；函数的返回格式为[[cards1,gaintag1],[cards2,gaintag2]...]
			if (gameMePlayerid && event.gaintag?.[gameMePlayerid]) {
				const gaintag = event.gaintag[gameMePlayerid];
				const list = typeof gaintag == "function" ? gaintag(hs.length, cards) : [[cards, gaintag]];
				for (let i = list.length - 1; i >= 0; i--) {
					game.getMe().directgain(list[i][0], null, list[i][1]);
				}
			} else {
				game.getMe().directgain(cards);
			}
			game.getMe()._start_cards = game.getMe().getCards("h");
		}

		if (event.dialog) {
			event.dialog.close();
		}
		if (ui.confirm) {
			ui.confirm.close();
		}
		game.getMe()._start_cards = game.getMe().getCards("h");
	},
	async phaseLoop(event, trigger, player) {
		let num = 1;
		let current = player;
		while (current.getSeatNum() === 0) {
			current.setSeatNum(num);
			current = current.next;
			num++;
		}
		while (true) {
			const phasePlayer = event.player;
			if (phasePlayer && game.players.includes(phasePlayer)) {
				lib.onphase.forEach(i => i());
				const phase = event.getPlayer().phase();
				event.next.remove(phase);
				let isRoundEnd: boolean | undefined = false;
				if (lib.onround.every(i => i(phase, event.getPlayer()))) {
					isRoundEnd = _status.roundSkipped;
					if (_status.isRoundFilter) {
						isRoundEnd = _status.isRoundFilter(phase, event.getPlayer());
					} else if (_status.seatNumSettled) {
						const seatNum = event.getPlayer().getSeatNum();
						if (seatNum != 0) {
							const lastPhasedPlayer = _status.lastPhasedPlayer;
							if (!lastPhasedPlayer || seatNum < lastPhasedPlayer.getSeatNum()) {
								isRoundEnd = true;
							}
						}
					} else if (event.getPlayer() == _status.roundStart) {
						isRoundEnd = true;
					}
					if (isRoundEnd && _status.globalHistory.some(i => "isRound" in i && i.isRound)) {
						game.log();
						await event.trigger("roundEnd");
					}
				}
				event.next.push(phase);
				await phase;
			}
			await event.trigger("phaseOver");
			const findNext = current => {
				const players = game.players
					.slice(0)
					.concat(game.dead)
					.sort((a, b) => {
						const aPosition = a.dataset.position;
						const bPosition = b.dataset.position;
						return aPosition === undefined || bPosition === undefined ? 0 : parseInt(aPosition) - parseInt(bPosition);
					});
				const position = current.dataset.position;
				if (position === undefined) {
					return players[0];
				}
				for (const player of players) {
					const playerPosition = player.dataset.position;
					if (playerPosition !== undefined && parseInt(playerPosition) > parseInt(position)) {
						return player;
					}
				}
				return players[0];
			};
			event.player = findNext(event.player);
		}
	},
	async loadPackage(event, trigger, player) {
		for (const pack of event.packages) {
			const [path, file] = pack.split("/");
			window.game = game;
			await lib.init.promises.js(lib.assetURL + path, file);
			if (!lib.config.dev) {
				delete window.game;
			}

			const characters = lib.imported.character;
			const cards = lib.imported.card;
			for (const charaPackName in characters) {
				const charaPack = characters[charaPackName];
				if (charaPack.character) {
					const characterPack = lib.characterPack[charaPackName];
					if (characterPack) {
						Object.assign(characterPack, charaPack.character);
					} else {
						lib.characterPack[charaPackName] = charaPack.character;
					}
				}
				if (charaPack.forbid && charaPack.forbid.includes(lib.config.mode)) {
					continue;
				}
				if (charaPack.mode && charaPack.mode.includes(lib.config.mode) == false) {
					continue;
				}

				// ???
				// if (Array.isArray(lib[j]) && Array.isArray(character[i][j])) {
				// 	lib[j].addArray(character[i][j]);
				// 	continue;
				// }
				for (const itemName in charaPack) {
					if (itemName == "name" || itemName == "mode" || itemName == "forbid" || itemName == "characterSort") {
						continue;
					}
					const item = charaPack[itemName];
					for (const termName in item) {
						const term = item[termName];

						if (itemName == "character") {
							const character = get.convertedCharacter(term);

							if (character.isBoss || character.isHiddenBoss) {
								lib.config.forbidai.add(termName);
							}
							if (lib.config[`forbidai_user_${charaPackName}`] && lib.config.forbidai_user?.includes(termName)) {
								lib.config.forbidai.add(termName);
							}
							for (const skill of character.skills) {
								lib.skilllist.add(skill);
							}
						}
						if (itemName == "translate" && termName == charaPackName) {
							lib[itemName][`${termName}_character_config`] = term;
						} else {
							if (lib[itemName][termName] == null) {
								const descriptor = Object.getOwnPropertyDescriptor(item, termName);
								if (descriptor) {
									Object.defineProperty(lib[itemName], termName, descriptor);
								}
							} else if (Array.isArray(lib[itemName][termName]) && Array.isArray(term)) {
								lib[itemName][termName].addArray(term);
							} else {
								console.log(`duplicated ${itemName} in character ${charaPackName}:\n${termName}:\nlib.${itemName}.${termName}`, lib[itemName][termName], `\ncharacter.${charaPackName}.${itemName}.${termName}`, term);
							}
						}
					}
				}

				for (const cardPackName in cards) {
					lib.cardPack[cardPackName] ??= [];
					const cardPack = lib.cardPack[cardPackName];
					if (cards[cardPackName].card) {
						for (const cardName in cards[cardPackName].card) {
							if (!cards[cardPackName].card[cardName].hidden && cards[cardPackName].translate[`${cardName}_info`]) {
								cardPack.push(cardName);
							}
						}
					}
					for (const itemName in cards[cardPackName]) {
						const item = cards[cardPackName][itemName];
						if (itemName == "name" || itemName == "mode" || itemName == "forbid") {
							continue;
						}
						if (itemName == "list") {
							continue;
						}
						for (const termName in item) {
							const term = item[termName];
							if (itemName == "skill" && termName[0] == "_" && !lib.config.cards.includes(cardPackName)) {
								continue;
							}
							if (itemName == "translate" && termName == cardPackName) {
								lib[itemName][`${termName}_card_config`] = term;
							} else {
								if (lib[itemName][termName] == undefined) {
									const descriptor = Object.getOwnPropertyDescriptor(item, termName);
									if (descriptor) {
										Object.defineProperty(lib[itemName], termName, descriptor);
									}
								} else {
									console.log(`duplicated ${itemName} in card ${cardPackName}:\n${termName}\nlib.${itemName}.${termName}`, lib[itemName][termName], `\ncard.${cardPackName}.${itemName}.${termName}`, term);
								}
							}
						}
					}
				}
			}
		}
	},
	async loadMode(event) {
		await game.loadModeAsync(event.mode, exports => {
			event.result = exports;
			const importedMode = lib.imported.mode;
			if (importedMode?.[event.mode]) {
				delete importedMode[event.mode];
			}
		});
	},
	async forceOver(event) {
		while (ui.controls.length) {
			ui.controls[0].close();
		}
		while (ui.dialogs.length) {
			ui.dialogs[0].close();
		}
		if (event.bool != "noover") {
			game.over(event.bool);
		}
		if (event.callback) {
			event.callback();
		}
	},
	async arrangeTrigger(event, trigger, player) {
		const doingList = event.doingList.slice(0);

		while (doingList.length > 0) {
			event.doing = doingList.shift();
			while (true) {
				if (trigger.filterStop && trigger.filterStop()) {
					return;
				}
				const usableSkills = event.doing.todoList.filter(info => lib.filter.filterTrigger(trigger, info.player, event.triggername, info.skill, info.indexedData));
				if (usableSkills.length == 0) {
					break;
				} else {
					event.doing.todoList = event.doing.todoList.filter(i => i.priority <= usableSkills[0].priority);
					//firstDo时机和lastDo时机不进行技能优先级选择
					if (get.itemtype(event.doing.player) !== "player") {
						event.current = usableSkills[0];
					} else {
						event.choice = usableSkills.filter(n => n.priority == usableSkills[0].priority);
						//现在只要找到一个同优先度技能为silent，或没有技能描述的技能 便优先执行该技能
						const silentSkill = event.choice.find(item => {
							const skillInfo = getRegisteredSkill(lib.skill, item.skill);
							return skillInfo && (skillInfo.silent || !lib.translate[item.skill]);
						});
						if (silentSkill) {
							event.current = silentSkill;
						} else {
							const currentChoice = event.choice[0];
							const skillsToChoose = event.choice.map(i => i.skill).unique();
							if (event.choice.length === 1 || skillsToChoose.length === 1) {
								event.current = currentChoice;
							} else {
								const currentPlayer = currentChoice.player;
								const next = currentPlayer.chooseControl(skillsToChoose.map(skill => get.skillTranslation(skill, currentPlayer, true)));
								next.set("prompt", "选择下一个触发的技能");
								next.set("forceDie", true);
								next.set("arrangeSkill", true);
								next.set("includeOut", true);
								const result = await next.forResult();
								//千里走单骑全责，把敌人打死可能会打断chooseControl
								if (result) {
									event.current = usableSkills.find(info => info.skill == skillsToChoose[result.index]);
								} else {
									event.current = usableSkills[0];
								}
							}
						}
					}
					event.doing.doneList.push(event.current);
					event.doing.todoList.remove(event.current);
					const triggerEvent = game.createTrigger(event.triggername, event.current.skill, event.current.player, trigger, event.current.indexedData);
					if (!triggerEvent) {
						continue;
					}
					const result = await triggerEvent.forResult();
					if (get.itemtype(event.doing.player) === "player" && result === "cancelled") {
						for (let i = 0; i < event.doing.todoList.length; i++) {
							if (event.current.skill === event.doing.todoList[i].skill) {
								event.doing.doneList.push(event.doing.todoList.splice(i--, 1)[0]);
							}
						}
					}
				}
			}
		}
	},
};
