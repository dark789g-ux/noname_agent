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

export const chooseCardContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	chooseCard: [
		async (event, trigger, player) => {
			if (event.directresult) {
				event.result = {
					buttons: [],
					cards: event.directresult.slice(0),
					targets: [],
					confirm: "ok",
					bool: true,
					links: [],
				};
			} else if (event.autochoose()) {
				event.result = {
					bool: true,
					autochoose: true,
					cards: player.getCards(event.position),
					confirm: "ok",
					buttons: [],
					targets: [],
					links: [],
				};
			} else {
				if (event.isMine()) {
					game.check();
					game.pause();
					if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
						ui.click.cancel();
						return;
					}
					if (event.custom === undefined) {
						event.custom = {
							add: {},
							replace: {},
						};
					}
					ui.create.cardChooseAll();
					if (event.prompt != false) {
						let str;
						if (typeof event.prompt == "string") {
							str = event.prompt;
						} else {
							str = "请选择";
							const range = get.select(event.selectCard);
							if (range[0] == range[1]) {
								str += get.cnNumber(range[0]);
							} else if (range[1] == Infinity) {
								str += `至少${get.cnNumber(range[0])}`;
							} else {
								str += `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
							}
							str += "张";
							if (event.position == "h" || event.position == undefined) {
								str += "手";
							}
							if (event.position == "e") {
								str += "装备";
							}
							str += "牌";
						}
						event.dialog = ui.create.dialog(str);
						if (event.prompt2) {
							event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
						}
						if (Array.isArray(event.promptx)) {
							for (const prompt of event.promptx) {
								event.dialog.add(prompt);
							}
						}
						if (Array.isArray(event.selectCard)) {
							event.promptbar = event.dialog.add(`0/${get.numStr(event.selectCard[1], "card")}`);
							if (event.custom.add.card === undefined) {
								event.custom.add.card = () => {
									_status.event.promptbar.innerHTML = `${ui.selected.cards.length}/${get.numStr(_status.event.selectCard[1], "card")}`;
								};
							}
						}
					}
				} else if (event.isOnline()) {
					event.send();
				} else {
					event.result = "ai";
				}
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result != "ai") {
				return;
			}
			if (await applyLLMDecision(event)) {
				return;
			} else if (event.processAI) {
				event.result = event.processAI();
			} else {
				game.check();
				if ((ai.basic.chooseCard(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
					ui.click.ok();
				} else if (event.skill) {
					const skill = event.skill;
					ui.click.cancel();
					event._aiexclude.add(skill);
					event.redo();
					game.resume();
				} else {
					ui.click.cancel();
				}
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			event.resume();
			if (event.cardChooseAll) {
				event.cardChooseAll.close();
			}
			if (event.glow_result && event.result.cards && !event.directresult) {
				for (const card of event.result.cards) {
					card.classList.add("glow");
				}
			}
			if (event.dialog) {
				event.dialog.close();
			}
		},
	],
	chooseTarget: [
		async (event, trigger, player) => {
			const skills = player.getSkills("invisible").concat(lib.skill.global);
			game.expandSkills(skills);
			for (const skill of skills) {
				const info = getRegisteredSkill(lib.skill, skill);
				if (info?.onChooseTarget) {
					info.onChooseTarget(event, player);
				}
			}
			if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				}
				game.check();
				game.pause();
				if (event.createDialog && !event.dialog && Array.isArray(event.createDialog)) {
					event.dialog = ui.create.dialog.apply(this, event.createDialog);
				} else if (event.prompt != false) {
					let str;
					if (typeof event.prompt == "string") {
						str = event.prompt;
					} else {
						str = "请选择";
						const range = get.select(event.selectTarget);
						if (range[0] == range[1]) {
							str += get.cnNumber(range[0]);
						} else if (range[1] == Infinity) {
							str += `至少${get.cnNumber(range[0])}`;
						} else {
							str += `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
						}
						str += "个目标";
					}
					event.dialog = ui.create.dialog(str);
					if (event.prompt2) {
						event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
					}
					if (event.promptbar != "none") {
						event.promptbar = event.dialog.add(`0/${get.numStr(get.select(event.selectTarget)[1], "target")}`);
						event.custom.add.target = () => {
							_status.event.promptbar.innerHTML = `${ui.selected.targets.length}/${get.numStr(get.select(event.selectTarget)[1], "target")}`;
						};
					}
				} else if (get.itemtype(event.dialog) == "dialog") {
					event.dialog.open();
				}
			} else if (event.isOnline()) {
				event.send();
			} else {
				event.result = "ai";
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (isAIResult(event.result)) {
				if (await applyLLMDecision(event)) {
					// Keep target animation and dialog cleanup below.
				} else if (event.processAI) {
					event.result = event.processAI();
				} else {
					game.check();
					if ((ai.basic.chooseTarget(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
						ui.click.ok();
					} else {
						ui.click.cancel();
					}
				}
			}
			if (typeof event.result === "string" || isImportModePayload(event.result)) event.result = {};
			if (event.result.bool && event.animate !== false && Array.isArray(event.result.targets)) {
				for (const target of event.result.targets) {
					target.addTempClass("target");
				}
			}
			if (event.dialog) {
				event.dialog.close();
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event.onresult) {
				event.onresult(event.result);
			}
			if (typeof event.result === "string") event.result = {};
			if (event.result.bool && event.autodelay && !event.isMine()) {
				if (typeof event.autodelay == "number") {
					await game.delayx(event.autodelay);
				} else {
					await game.delayx();
				}
			}
		},
	],
	chooseCardTarget: [
		async (event, trigger, player) => {
			if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				}
				ui.create.cardChooseAll();
				game.check();
				game.pause();
				if (event.prompt != false) {
					event.dialog = ui.create.dialog(event.prompt || "请选择卡牌和目标");
					if (event.prompt2) {
						event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
					}
				}
			} else if (event.isOnline()) {
				event.send();
			} else {
				event.result = "ai";
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result != "ai") {
				return;
			}
			if (await applyLLMDecision(event)) {
				return;
			} else if (event.processAI) {
				event.result = event.processAI();
			} else {
				game.check();
				if (ai.basic.chooseCard(event.ai1) || forced) {
					if ((ai.basic.chooseTarget(event.ai2) || forced) && (!event.filterOk || event.filterOk())) {
						ui.click.ok();
						_status.event._aiexclude.length = 0;
					} else {
						ui.click.cancel();
					}
				} else {
					ui.click.cancel();
				}
			}
		},
		async (event, trigger, player) => {
			event.resume();
			if (event.cardChooseAll) {
				event.cardChooseAll.close();
			}
			if (typeof event.result !== "string" && event.result.bool && event.animate !== false && Array.isArray(event.result.targets)) {
				for (const target of event.result.targets) {
					target.addTempClass("target");
				}
			}
			if (event.dialog) {
				event.dialog.close();
			}
		},
	],
	//先选择按钮再选择目标的函数，可以简化一些交互流程，目前可以隐藏弹窗
	//该事件目前采用async contents的写法
	chooseButtonTarget: [
		async (event, _trigger, player) => {
			//根据player.chooseButtonTarget获取到的dialog信息创建对话框，也支持createDialog
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
			if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				}
				if (event.canHidden) {
					//增加隐藏窗口的按钮
					const func = (_event: GameEvent) => {
						const event = get.event();
						const controls: Array<string | ((link: string) => void)> = [
							link => {
								ui.selected.buttons.length = 0;
								game.check();
								return;
							},
						];
						event.controls = [
							ui.create.control(
								controls.concat([
									"隐藏窗口",
									"stayleft",
									link => {
										const control = event.controls[0];
										if (event.dialog.style.display == "none") {
											control.childNodes[0].innerHTML = "隐藏窗口";
											event.dialog.style.display = "";
										} else {
											control.childNodes[0].innerHTML = "显示窗口";
											event.dialog.style.display = "none";
										}
									},
								])
							),
						];
					};
					if (event.isMine()) {
						func(event);
					} else if (event.isOnline()) {
						event.getPlayer().send(func, event);
					}
					if (event.custom == undefined) {
						event.custom = {
							add: {},
							replace: {},
						};
					}
					const addConfirm = event.custom.add.confirm;
					event.custom.add.confirm = bool => {
						if (typeof bool != "boolean") {
							return;
						}
						const event = get.event();
						if (event.controls) {
							event.controls.forEach(i => i.close());
						}
						if (ui.confirm) {
							ui.confirm.close();
						}
						if (typeof addConfirm == "function") {
							addConfirm.call(this, bool);
						}
						game.uncheck();
					};
				}
				ui.create.buttonChooseAll();
				game.check();
				game.pause();
			} else if (event.isOnline()) {
				const result = await event.sendAsync();
				event.result = normalizeChooseButtonTargetResult(result);
			} else {
				//考虑中途托管的情况
				event.result = "ai";
			}
		},
		async (event, _trigger, player, result) => {
			//处理ai的选择结果
			if (event.result != "ai") {
				return;
			}

			if (await applyLLMDecision(event)) {
				return;
			} else if (event.processAI) {
				event.result = event.processAI();
			} else {
				game.check();
				if (ai.basic.chooseButton(event.ai1) || event.forced) {
					if ((ai.basic.chooseTarget(event.ai2) || event.forced) && (!event.filterOk || event.filterOk())) {
						ui.click.ok();
						_status.event._aiexclude.length = 0;
					} else {
						ui.click.cancel();
					}
				} else {
					ui.click.cancel();
				}
			}
		},
		async (event, _trigger, player, result) => {
			//处理选择的结果
			event.resume();
			if (typeof event.result !== "string" && event.result.bool && event.animate !== false && Array.isArray(event.result.targets)) {
				for (const target of event.result.targets) {
					target.addTempClass("target");
				}
			}
			if (event.dialog) {
				event.dialog.close();
			}
		},
	],
};
