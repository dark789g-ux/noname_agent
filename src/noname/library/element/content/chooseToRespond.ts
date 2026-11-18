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

export const chooseToRespondContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	chooseToRespond: [
		async (event, trigger, player) => {
			if (event.responded) {
				delete event.dialog;
				return;
			}

			const skills = player.getSkills("invisible").concat(lib.skill.global);
			game.expandSkills(skills);
			for (const skill of skills) {
				const info = getRegisteredSkill(lib.skill, skill);
				if (info && info.onChooseToRespond) {
					info.onChooseToRespond(event);
				}
			}
			if (_status.noclearcountdown !== "direct") {
				_status.noclearcountdown = true;
			}
			if (!_status.connectMode && lib.config.skip_shan && event.autochoose && event.autochoose()) {
				event.result = { bool: false };
			} else {
				if (game.modeSwapPlayer && !_status.auto && player.isUnderControl()) {
					game.modeSwapPlayer(player);
				}
				if (event.isMine()) {
					if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
						ui.click.cancel();
						return;
					}
					const ok = game.check();
					const cardinfo = get.info(get.card()) || {};
					const skillinfo = event.skill ? get.info(event.skill) : undefined;
					if (!ok || !lib.config.auto_confirm || cardinfo?.manualConfirm || skillinfo?.manualConfirm) {
						game.pause();
						if (event.openskilldialog) {
							event.skillDialog = ui.create.dialog(event.openskilldialog);
							delete event.openskilldialog;
							event.dialog = event.prompt;
						} else {
							if (event.prompt) {
								event.dialog = ui.create.dialog(event.prompt);
							}
							if (event.prompt2) {
								event.dialog.addText(event.prompt2);
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
			} else if (ai.basic.chooseCard(event.ai1 || event.ai) || forced) {
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
				game.delayx();
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			event.resume();
			if (!event.result) {
				return;
			}

			if (event.result._sendskill) {
				lib.skill[event.result._sendskill[0]] = event.result._sendskill[1];
			}
			if (typeof event.result.skill === "string" && event.result.skill) {
				const info = get.info(event.result.skill);
				if (info && info.chooseButton) {
					if (event.dialog && typeof event.dialog == "object") {
						event.dialog.close();
					}
					const chooseButton = info.chooseButton;
					if (typeof chooseButton.dialog != "function") {
						return;
					}
					const dialog = chooseButton.dialog(event, player);

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
						next.set("filterOk", chooseButton.filterOk || (() => true));
						attachChooseButtonSelectionSpec(next, info, event, player);
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
						next.set("allowChooseAll", chooseButton.allowChooseAll);
					}
					event.buttoned = event.result.skill;

					return next.forResult();
				} else if (info && info.precontent && !game.online) {
					const next = game.createEvent(`pre_${event.result.skill}`);
					next.setContent(info.precontent);
					next.set("result", event.result);
					next.set("player", player);
					return next.forResult();
				}
			}
		},
		async (event, trigger, player, result) => {
			if (!event.buttoned) {
				return;
			}

			if (result.bool || (result.control && result.control != "cancel2")) {
				const sourceInfo = get.info(event.buttoned);
				const info = sourceInfo?.chooseButton;
				if (!info || typeof info.backup != "function") {
					event.goto(0);
					delete event.buttoned;
					return;
				}
				const links = info.chooseControl ? result : (result.links ?? []);
				const backup = info.backup(links, player);
				if (sourceInfo?.selectionSpec !== undefined && backup.selectionSpec === undefined) {
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
					event.openskilldialog = info.prompt(links, player);
				}
			} else {
				ui.control.addTempClass("nozoom", 100);
				event._aiexclude.add(event.buttoned);
			}
			event.goto(0);
			delete event.buttoned;
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string" || isImportModePayload(event.result)) event.result = {};
			delete _status.noclearcountdown;
			if (event.skillDialog && "close" in event.skillDialog && typeof event.skillDialog.close == "function") {
				event.skillDialog.close();
			}
			if (event.result.bool && !game.online) {
				let info;
				if (event.result._sendskill) {
					lib.skill[event.result._sendskill[0]] = event.result._sendskill[1];
				}
				if (event.onresult) {
					event.onresult(event.result);
				}
				if (!event.result?.bool || event.result?._noHidingTimer) {
					const skill = getLogSkillName(event.result, event.logSkill);
					if (skill) {
						info = get.info(skill);
						if (info.direct && !info.clearTime) {
							_status.noclearcountdown = "direct";
						}
					}
				}
				if (event.logSkill) {
					if (typeof event.logSkill == "string") {
						player.logSkill(event.logSkill);
					} else if (Array.isArray(event.logSkill)) {
						forwardEventLogSkill(player, event.logSkill);
					}
				}
				if (!event.result.card && typeof event.result.skill === "string") {
					event.result.used = event.result.skill;
					player.useSkill({ skill: event.result.skill, cards: event.result.cards, targets: event.result.targets });
				} else if (event.result?.cancel) {
					event.goto(0);
				} else {
					if (info && info.prerespond) {
						info.prerespond(event.result, player);
					}
					const next = player.respond({
						cards: event.result.cards,
						card: event.result.card,
						animate: event.animate,
						skill: typeof event.result.skill === "string" ? event.result.skill : undefined,
						source: event.source,
					});
					if (event.result.noanimate) {
						next.animate = false;
					}
					const parent = event.parent;
					if (!parent) {
						throw new Error("chooseToRespond requires a parent event.");
					}
					if (parent.card && parent.type == "card") {
						next.set("respondTo", [parent.player, parent.card]);
					}
					if (event.noOrdering) {
						next.noOrdering = true;
					}
					if (event.result._apply_args) {
						for (const i in event.result._apply_args) {
							next[i] = event.result._apply_args[i];
						}
					}
				}
			} else if (event._sendskill) {
				event.result._sendskill = event._sendskill;
			}
			if (event.dialog && event.dialog.close) {
				event.dialog.close();
			}
			if (!_status.noclearcountdown) {
				game.stopCountChoose();
			}
		},
	],
};
