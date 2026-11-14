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

export const discoverCardContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async discoverCard(event, trigger, player) {
		if (typeof event.result === "string") event.result = {};
		const { num = 3 } = event;

		let choice;
		if (typeof event.list == "string" || typeof event.list == "function") {
			choice = get.inpile(event.list).randomGets(num);
		} else if (Array.isArray(event.list)) {
			choice = event.list.randomGets(num);
		} else {
			choice = Array.from(event.list).randomGets(num);
		}

		if (!choice.length) {
			return;
		}

		let prompt = event.prompt;
		if (!prompt) {
			prompt = "选择一张牌";
			if (event.use) {
				prompt += "使用之";
			} else if (!event.nogain) {
				prompt += "获得之";
			}
		}

		let next;
		if (typeof choice[0] === "string") {
			next = player.chooseVCardButton(choice, prompt, event.forced);
			if (event.ai) {
				next.set("ai", event.ai);
			}
		} else if (get.itemtype(choice[0]) == "card") {
			next = player.chooseCardButton(choice, prompt, event.forced);
			if (event.ai) {
				next.set("ai", event.ai);
			}
		} else {
			return;
		}

		const result = await next.forResult();
		if (typeof result === "string" || !result.bool || !Array.isArray(result.links) || !result.links.length) {
			event.result = { bool: typeof result !== "string" && result.bool === true, card: undefined, choice: undefined };
			return;
		}

		event.result = {
			bool: true,
			card: undefined,
			choice: undefined,
		};
		if (result.links.length) {
			const link = result.links[0];
			let togain: Card | undefined;
			if (get.itemtype(link) == "card") {
				event.result.card = link;
				togain = link;
			} else if (Array.isArray(link)) {
				const choiceName = link[2];
				if (typeof choiceName == "string") {
					event.result.choice = choiceName;
					togain = game.createCard(choiceName);
				}
			}
			if (togain) {
				if (event.use) {
					await player.chooseUseTarget({ card: togain });
				} else if (!event.nogain) {
					game.log(player, "获得了一张牌");
					await player.gain({ cards: [togain], animate: "draw" });
				}
			}
		}
	},
	chooseButton: [
		async (event, trigger, player) => {
			if (typeof event.dialog == "number") {
				event.dialog = get.idDialog(event.dialog);
			}
			if (event.createDialog && !event.dialog) {
				if (Array.isArray(event.createDialog)) {
					event.createDialog.add("hidden");
					event.dialog = ui.create.dialog.apply(this, event.createDialog);
				}
				event.closeDialog = true;
			}
			if (event.dialog == undefined) {
				event.dialog = ui.dialog;
			}
			if (event.isMine() || event.dialogdisplay) {
				event.dialog.style.display = "";
				event.dialog.open();
			}

			const filterButton = event.filterButton ?? (() => true);
			const selectButton = get.select(event.selectButton);
			const buttons = event.dialog.buttons;
			const buttonsx: Button[] = [];
			let num = 0;
			for (const button of buttons) {
				if (filterButton(button, player)) {
					num++;
					buttonsx.add(button);
				}
			}
			if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				} else if ((event.direct && num == selectButton[0]) || event.forceDirect) {
					const buttons = buttonsx.slice(0, num);
					event.result = {
						bool: true,
						button: [buttons],
						links: get.links(buttons),
					};
					event.dialog.close();
				} else {
					ui.create.buttonChooseAll();
					game.check();
					game.pause();
				}
			} else if (event.isOnline()) {
				if ((event.direct && num == 1) || event.forceDirect) {
					const buttons = buttonsx.slice(0, num);
					event.result = {
						bool: true,
						button: [buttons],
						links: get.links(buttons),
					};
					event.dialog.close();
				} else {
					event.send();
				}
				delete event.callback;
			} else {
				event.result = "ai";
			}
			if (event.onfree) {
				lib.init.onfree();
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result == "ai") {
				if (await applyLLMDecision(event)) {
					// Keep callback, dialog cleanup and resume behavior below.
				} else if (event.processAI) {
					event.result = event.processAI();
				} else {
					game.check();
					const aiResult = typeof event.ai == "function" ? ai.basic.chooseButton(event.ai) : false;
					if ((aiResult || forced) && (!event.filterOk || event.filterOk())) {
						ui.click.ok();
					} else {
						ui.click.cancel();
					}
				}
			}
			if (event.closeDialog) {
				event.dialog.close();
			}
			if (event.callback) {
				event.callback(event.player, event.result);
			}
			event.resume();
		},
	],
	async chooseCardOL(event, trigger, player) {
		const targets: Player[] = event.list;
		event.targets = targets.slice(0);
		// chooseCardOL only starts chooseCard events. The sole "viewed" producer is
		// viewCards, whose event never enters this aggregation protocol.
		type ChooseCardOLResult = Exclude<EventResult, "viewed">;
		const applySet = (next, set) => {
			for (const [key, value] of set) {
				next.set(key, value);
			}
			return next;
		};
		const chooseRemote = (args, set) => {
			const next = game.getMe().chooseCard(...args);
			for (const [key, value] of set) {
				next.set(key, value);
			}
			game.resume();
		};
		const chooseLocal = (current: Player) => {
			return applySet(current.chooseCard(...event._args), event._set);
		};
		const resolveAiCard = (target: Player): Partial<Result> => {
			try {
				return event.aiCard ? event.aiCard(target) : { bool: false, cards: [] };
			} catch {
				return {};
			}
		};
		const choose = (current: Player) => {
			return new Promise<ChooseCardOLResult>(resolve => {
				if (current.isOnline()) {
					current.wait(result => resolve(result ?? {}));
					current.send(chooseRemote, event._args, event._set);
					return;
				} else if (current === game.me) {
					const next = chooseLocal(game.getMe());
					game.getMe().wait(result => resolve(result ?? {}));
					next.forResult()
						.then(result => game.getMe().unwait(result))
						.catch(() => resolve({}));
				} else {
					const next = chooseLocal(current);
					next.forResult()
						.then(resolve)
						.catch(() => resolve({}));
				}
			});
		};
		const toCardResult = (result: ChooseCardOLResult, target: Player): Partial<Result> => {
			if (result === "ai") {
				return resolveAiCard(target);
			}
			if (result === "cancelled") {
				return { bool: false, cards: [] };
			}
			return result;
		};

		let results: Partial<Result>[];
		if (_status.connectMode) {
			const events: Promise<Partial<Result>>[] = targets.map(async target => {
				try {
					const result = await choose(target);
					return toCardResult(result, target);
				} catch {
					return {};
				}
			});
			results = await Promise.all(events);
		} else {
			results = [];
			for (const target of targets) {
				const result = await chooseLocal(target)
					.forResult()
					.catch(() => ({}));
				results.push(toCardResult(result, target));
			}
		}

		event.result = results;
	},
	async chooseButtonOL(event, trigger, player) {
		const list = event.list;

		const chooseRemote = (args, callback, switchToAuto, processAI) => {
			const next = game.getMe().chooseButton(...args);
			next.callback = callback;
			next.switchToAuto = switchToAuto;
			next.processAI = processAI;
			next.complexSelect = true;
			game.resume();
		};
		const chooseLocal = (current: Player, args) => {
			const next = current.chooseButton(...args);
			next.callback = event.callback;
			next.switchToAuto = event.switchToAuto;
			next.processAI = event.processAI;
			return next;
		};
		const choose = (current: Player, args) => {
			return new Promise<EventResult>(resolve => {
				let settled = false;
				const finish = (result: EventResult) => {
					if (settled) {
						return;
					}
					settled = true;
					resolve(result);
				};
				const chooseAuto = () => {
					if (settled) {
						return;
					}
					const next = chooseLocal(current, args);
					next.forResult()
						.then(result => finish(normalizeSelectionResult(result)))
						.catch(() => finish({}));
				};
				if (current.isOnline()) {
					current.wait(result => {
						if (result === "ai") {
							chooseAuto();
							return () => game.resume();
						}
						finish(result ?? {});
					});
					current.send(chooseRemote, args, event.callback, event.switchToAuto, event.processAI);
					return;
				} else if (current === game.me) {
					const next = chooseLocal(game.getMe(), args);
					game.getMe().wait(result => finish(result ?? {}));
					next.forResult()
						.then(result => game.getMe().unwait(result))
						.catch(() => finish({}));
				} else {
					const next = chooseLocal(current, args);
					next.forResult()
						.then(result => finish(normalizeSelectionResult(result)))
						.catch(() => finish({}));
				}
			});
		};

		let results: Record<string, Partial<Result>>;
		if (_status.connectMode) {
			const events = list.map(async ([target, ...args]) => {
				try {
					const result = await choose(target, args);
					return { target, result };
				} catch {
					return { target, result: {} };
				}
			});
			results = {};
			for (const { target, result } of await Promise.all(events)) {
				if (typeof target.playerid == "string") {
					results[target.playerid] = result === "cancelled" ? { bool: false, buttons: [] } : result;
				}
			}
		} else {
			results = {};
			for (const [target, ...args] of list) {
				const result = await chooseLocal(target, args)
					.forResult()
					.catch(() => ({}));
				if (typeof target.playerid == "string") {
					results[target.playerid] = result === "cancelled" ? { bool: false, buttons: [] } : result;
				}
			}
		}

		event.result = results;
	},
	async chooseAnyOL(event, trigger, player) {
		const { func, args } = event;
		const targets = event.getTargets();
		const map = new Map();
		const locals = targets.slice();
		const humans = targets.filter(current => current === game.me || current.isOnline());
		//分别处理人类玩家和其他玩家
		locals.removeArray(humans);
		const eventId = get.id();
		const send = (...sendArgs) => {
			const [func, ...args] = sendArgs;
			func(...args);
			game.resume();
		};
		//让读条不消失
		event._global_waiting = true;
		let time = 10000;
		if (lib.configOL && lib.configOL.choose_timeout) {
			time = parseInt(lib.configOL.choose_timeout) * 1000;
		}
		targets.forEach(current => current.showTimer(time));
		if (humans.length > 0) {
			const solve = (resolve, reject) => (result, player) => {
				if (result) {
					map.set(player, result);
				}
				resolve();
			};
			await Promise.all(
				humans.map(
					current =>
						new Promise((resolve, reject) => {
							if (current.isOnline()) {
								current.send(send, func, current, ...args, eventId);
								current.wait(solve(resolve, reject));
							} else {
								const next = func(current, ...args, eventId);
								const solver = solve(resolve, reject);
								if (_status.connectMode) {
									game.getMe().wait(solver);
								}
								return next.forResult().then(result => {
									if (_status.connectMode) {
										game.getMe().unwait(result, current);
									} else {
										solver(result, current);
									}
								});
							}
						})
				)
			).catch(() => {});
			game.broadcastAll("cancel", eventId);
		}
		if (locals.length > 0) {
			//模拟ai先后作答
			for (const current of locals.randomSort()) {
				const result = await func(current, ...args, eventId).forResult();
				if (result) {
					map.set(current, result);
				}
			}
		}
		//清除读条
		delete event._global_waiting;
		targets.forEach(current => current.hideTimer(time));
		event.result = map;
	},
};
