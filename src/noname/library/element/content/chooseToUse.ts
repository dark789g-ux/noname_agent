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

export const chooseToUseContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	chooseToUse: [
		async (event, trigger, player) => {
			if (event.responded) {
				return;
			}
			if (game.modeSwapPlayer && !_status.auto && player.isUnderControl() && !lib.filter.wuxieSwap(event)) {
				game.modeSwapPlayer(player);
			}
			const skills = player.getSkills("invisible").concat(lib.skill.global);
			game.expandSkills(skills);
			for (const name of skills) {
				const info = getRegisteredSkill(lib.skill, name);
				if (info && info.onChooseToUse) {
					info.onChooseToUse(event);
				}
			}
			if (_status.noclearcountdown !== "direct") {
				_status.noclearcountdown = true;
			}
			if (event.type == "phase") {
				if (event.isMine()) {
					event.endButton = ui.create.control("结束回合", "stayleft", () => {
						const evt = _status.event;
						if (evt.name != "chooseToUse" || evt.type != "phase") {
							return;
						}
						if (evt.skill) {
							ui.click.cancel();
						}
						ui.click.cancel();
					});
					event.fakeforce = true;
				} else {
					if (event.endButton) {
						event.endButton.close();
						delete event.endButton;
					}
					event.fakeforce = false;
				}
			}
			if (event.getPlayer().isUnderControl() && !_status.auto) {
				event.result = {
					bool: false,
				};
				return;
			} else if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				}
				if (event.type == "wuxie") {
					if (ui.tempnowuxie) {
						const triggerevent = event.getTrigger();
						if (triggerevent && triggerevent.targets && triggerevent.num == triggerevent.targets.length - 1) {
							ui.tempnowuxie.close();
						}
					}
					if (lib.filter.wuxieSwap(event)) {
						event.result = {
							bool: false,
						};
						return;
					}
				}
				const ok = game.check();
				const cardinfo = get.info(get.card()) || {};
				const skillinfo = event.skill ? get.info(event.skill) : undefined;
				if (!ok || !lib.config.auto_confirm || cardinfo?.manualConfirm || skillinfo?.manualConfirm) {
					game.pause();
					if (lib.config.enable_vibrate && player._noVibrate) {
						delete player._noVibrate;
						game.vibrate();
					}
					if (typeof event.prompt == "string") {
						if (event.openskilldialog) {
							event.skillDialog = ui.create.dialog(event.openskilldialog);
							delete event.openskilldialog;
							event.dialog = event.prompt;
						} else {
							event.dialog = ui.create.dialog(event.prompt);
							if (event.prompt2) {
								event.dialog.addText(event.prompt2);
							}
						}
					} else if (typeof event.prompt == "function") {
						event.dialog = ui.create.dialog(event.prompt(event));
					} else if (event.prompt == undefined) {
						let str;
						if (typeof event.filterCard == "object") {
							const filter = event.filterCard;
							str = `请使用${get.cnNumber(event.selectCard[0])}张`;
							if (filter.name) {
								str += get.translation(filter.name);
							} else {
								str += "牌";
							}
						} else {
							str = "请选择要使用的牌";
						}
						if (event.openskilldialog) {
							event.skillDialog = ui.create.dialog(event.openskilldialog);
							delete event.openskilldialog;
							event.dialog = str;
						} else if (typeof event.skillDialog != "string") {
							event.dialog = ui.create.dialog(str);
						} else {
							event.dialog = str;
						}
					}
				} else {
					delete event.openskilldialog;
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

			// LLM 失败或拒绝该事件时保持既有本地 AI 降级。
			if (await applyLLMDecision(event)) {
				return;
			}

			const ok = game.check();
			if (ok) {
				ui.click.ok();
			} else if (ai.basic.chooseCard(event.ai1) || forced) {
				if ((ai.basic.chooseTarget(event.ai2) || forced) && (!event.filterOk || event.filterOk())) {
					ui.click.ok();
					event._aiexcludeclear = true;
				} else {
					if (!event.norestore) {
						if (event.skill) {
							const skill = event.skill;
							ui.click.cancel();
							event._aiexclude.add(skill);
							const info = get.info(skill);
							if (info.sourceSkill) {
								event._aiexclude.add(info.sourceSkill);
							}
						} else {
							get.card(true).aiexclude();
							game.uncheck();
						}
						event.redo();
						game.resume();
					} else {
						ui.click.cancel();
					}
				}
			} else if (event.skill && !event.norestore) {
				const skill = event.skill;
				ui.click.cancel();
				event._aiexclude.add(skill);
				const info = get.info(skill);
				if (info.sourceSkill) {
					event._aiexclude.add(info.sourceSkill);
				}
				event.redo();
				game.resume();
			} else {
				ui.click.cancel();
			}
			const result: EventResult = event.result;
			const hasBoolResult = (value: EventResult): value is Partial<Result> => typeof value == "object" && value != null && "bool" in value;
			if (event.aidelay && hasBoolResult(result) && result.bool) {
				await game.delayx();
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event.endButton) {
				event.endButton.close();
				delete event.endButton;
			}
			event.resume();

			if (!event.result) {
				return;
			}

			if (event.result._sendskill) {
				lib.skill[event.result._sendskill[0]] = event.result._sendskill[1];
			}

			if (typeof event.result.skill !== "string" || !event.result.skill) {
				return;
			}

			const info = get.info(event.result.skill);
			if (info && info.chooseButton) {
				const chooseButton = info.chooseButton;
				if (event.dialog && typeof event.dialog == "object") {
					event.dialog.close();
				}
				const dialogFactory = chooseButton.dialog;
				const dialog = typeof dialogFactory == "function" ? dialogFactory(event, player) : dialogFactory;
				if (!dialog) {
					event.result = { bool: false };
					return;
				}

				let next;
				if (chooseButton.chooseControl) {
					next = player.chooseControl({ controls: chooseButton.chooseControl(event, player) });
					if (dialog.direct) {
						next.direct = true;
					}
					if (dialog.forceDirect) {
						next.forceDirect = true;
					}
					next.dialog = dialog;
					next.set("ai", chooseButton.check || (() => 0));
					if (event.id) {
						next._parent_id = event.id;
					}
					next.type = "chooseToUse_button";
				} else {
					next = player.chooseButton(dialog);
					if (dialog.direct) {
						next.direct = true;
					}
					if (dialog.forceDirect) {
						next.forceDirect = true;
					}
					next.set("ai", chooseButton.check || (() => 1));
					next.set("filterButton", chooseButton.filter || (() => true));
					next.set("selectButton", chooseButton.select || 1);
					next.set(
						"complexSelect",
						(() => {
							if (chooseButton.complexSelect !== false) {
								if (chooseButton.complexSelect === undefined && chooseButton.allowChooseAll === true) {
									// 如果complexSelect没有被显式的定义但是全选被显式要求了，那么我们默认认为调用者需要全选而不是complexSelect喵
									return false;
								} else {
									return true;
								}
							}
							return false;
						})()
					);
					next.set("filterOk", chooseButton.filterOk || (() => true));
					attachChooseButtonSelectionSpec(next, info, event, player);
					next.set("allowChooseAll", chooseButton.allowChooseAll);
					if (event.id) {
						next._parent_id = event.id;
					}
					next.type = "chooseToUse_button";
				}
				event.buttoned = event.result.skill;

				return next.forResult();
			} else if (info && info.precontent && !game.online && !event.nouse) {
				const next = game.createEvent(`pre_${event.result.skill}`);

				next.setContent(info.precontent);
				next.set("result", event.result);
				next.set("player", player);

				return next.forResult();
			}
		},
		async (event, trigger, player, result) => {
			if (!event.buttoned) {
				return;
			}

			if (result.bool || (result.control && result.control != "cancel2")) {
				const sourceInfo = get.info(event.buttoned);
				const info = sourceInfo?.chooseButton;
				const hasControl = typeof result.control == "string" && result.control != "cancel2";
				const links = result.links;
				const backupInput = info?.chooseControl ? result : links;
				if (!info || typeof info.backup != "function" || backupInput === undefined || (!info.chooseControl && !Array.isArray(backupInput)) || (info.chooseControl && !hasControl)) {
					event.goto(0);
					delete event.buttoned;
					return;
				}
				const backup = info.backup(backupInput, player);
				if (sourceInfo.selectionSpec !== undefined && backup.selectionSpec === undefined) {
					backup.selectionSpec = sourceInfo.selectionSpec === false ? false : true;
				}
				lib.skill[`${event.buttoned}_backup`] = backup;
				backup.sourceSkill = event.buttoned;
				if (game.online) {
					event._sendskill = [`${event.buttoned}_backup`, backup];
				} else {
					game.broadcast(
						(skill, audio) => {
							let info = lib.skill[skill];
							if (!info) {
								info = {};
								lib.skill[skill] = info;
							}
							if (Array.isArray(info)) {
								throw new TypeError("A backup skill must not be an array");
							}
							info.audio = audio;
						},
						`${event.buttoned}_backup`,
						backup.audio
					);
				}
				event.backup(`${event.buttoned}_backup`);
				if (backup.selectionSpec) {
					event.selectionSpec = { finalPredicate: () => true };
				}
				if (typeof info.prompt == "function") {
					event.openskilldialog = info.prompt(backupInput, player);
				}
			} else {
				ui.control.addTempClass("nozoom", 100);
				event._aiexclude.add(event.buttoned);
			}

			event.goto(0);
			delete event.buttoned;
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event._aiexcludeclear) {
				delete event._aiexcludeclear;
				event._aiexclude.length = 0;
			}
			delete _status.noclearcountdown;
			const skillDialog = event.skillDialog;
			if (skillDialog && (typeof skillDialog == "object" || typeof skillDialog == "function") && "close" in skillDialog && typeof skillDialog.close == "function") {
				skillDialog.close();
			}
			if (event.result && event.result.bool && !game.online && !event.nouse) {
				if (event.result?.cancel) {
					event.goto(0);
				} else {
					const oldLogSkill = event.logSkill;
					if (event.chooseonly) {
						event.logSkill = false;
					}
					if (!event.chooseonly) {
						//event.done = player.useResult(event.result, event);
						const next = player.useResult(event.result, event);
					} else {
						event.result.cost_data = { result: event.result };
						if (oldLogSkill) {
							event.result.cost_data.logSkill = oldLogSkill;
						}
					}
				}
			} else if (event._sendskill) {
				event.result._sendskill = event._sendskill;
			}
			if (!event.result?.bool || event.result?._noHidingTimer) {
				const skill = getLogSkillName(event.result, event.logSkill);
				if (skill) {
					const info = get.info(skill);
					if (info.direct && !info.clearTime) {
						_status.noclearcountdown = "direct";
					}
				}
			}
			if (event.dialog && typeof event.dialog == "object") {
				event.dialog.close();
			}
			if (!_status.noclearcountdown) {
				game.stopCountChoose();
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event._result && event.result) {
				event.result.result = event._result;
			}
		},
	],
};
