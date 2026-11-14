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

export const createTriggerContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async createTrigger(event, trigger, player) {
		const requireSkill = () => {
			if (!event.skill) {
				throw new TypeError("createTrigger requires an event skill");
			}
			return event.skill;
		};
		let skill = requireSkill();
		const info = get.info(skill);

		if (!game.expandSkills(player.getSkills().concat(lib.skill.global)).includes(skill) && !event.uncheckHasSkill) {
			const hidden = player.hiddenSkills.slice(0);
			const invisible = player.invisibleSkills.slice(0);
			game.expandSkills(hidden);
			game.expandSkills(invisible);
			if (hidden.includes(skill)) {
				if (!info.silent && player.hasSkillTag("nomingzhi", false, null, true)) {
					return;
				} else if ((!info.direct && typeof info.cost !== "function") || (get.is.locked(skill, player) && typeof info.cost == "function")) {
					await event.trigger("triggerHidden");
				} else {
					event.skillHidden = true;
				}
			} else if (invisible.includes(skill)) {
				await event.trigger("triggerInvisible");
			} else {
				let flag = true;
				for (const skill in player.additionalSkills) {
					if (skill.startsWith("hidden:")) {
						continue;
					}

					if (!game.expandSkills(player.additionalSkills[skill]).includes(skill)) {
						continue;
					}

					flag = false;
					break;
				}
				if (flag) {
					return;
				}
			}
		}
		skill = requireSkill();

		if (event.cancelled) {
			return;
		}
		if (skill.startsWith("player_when_")) {
			requireRegisteredSkill(lib.skill, skill).triggered = true;
		}

		let result: EventResult;
		if (event.revealed || info.forced) {
			result = { bool: true };
		} else {
			const checkFrequent = info => {
				if (player.hasSkillTag("nofrequent", false, skill)) {
					return false;
				}
				if (typeof info.frequent == "boolean") {
					return info.frequent;
				}
				if (typeof info.frequent == "function") {
					return info.frequent(trigger, player, event.triggername, event.indexedData);
				}
				if (info.frequent == "check" && typeof info.check == "function") {
					return info.check(trigger, player, event.triggername, event.indexedData);
				}
				return false;
			};

			if (info.direct) {
				if (player.isUnderControl()) {
					game.swapPlayerAuto(player);
				}
				result = { bool: true };
				event._direct = true;
			} else if (typeof info.cost === "function") {
				if (checkFrequent(info)) {
					event.frequentSkill = true;
				}
				if (player.isUnderControl()) {
					game.swapPlayerAuto(player);
				}
				//创建cost事件
				const next = game.createEvent(`${skill}_cost`);
				next.player = player;
				if (event.frequentSkill) {
					next.set("frequentSkill", skill);
				}
				next.set("forceDie", true);
				next.set("includeOut", true);
				next._trigger = trigger;
				next.triggername = event.triggername;
				next.skillHidden = event.skillHidden;
				next.indexedData = event.indexedData;
				if (info.forceDie) {
					next.forceDie = true;
				}
				if (info.forceOut) {
					next.includeOut = true;
				}
				next.skill = skill;
				next.setContent(info.cost);

				result = normalizeSelectionResult(await next.forResult());
			} else {
				if (checkFrequent(info)) {
					event.frequentSkill = true;
				}
				let str;
				const check = info.check;
				if (info.prompt) {
					str = info.prompt;
				} else if (typeof info.logTarget == "string") {
					const logTarget = trigger[info.logTarget];
					str = logTarget && !Array.isArray(logTarget) && typeof logTarget !== "string" ? get.prompt(skill, logTarget, player) : get.prompt(skill, undefined, player);
				} else if (typeof info.logTarget == "function") {
					const logTarget = info.logTarget(trigger, player, event.triggername, event.indexedData);
					if (logTarget && !Array.isArray(logTarget) && typeof logTarget !== "string") {
						str = get.prompt(skill, logTarget, player);
					} else {
						str = get.prompt(skill, undefined, player);
					}
				} else {
					str = get.prompt(skill, undefined, player);
				}
				if (typeof str == "function") {
					str = str(trigger, player, event.triggername, event.indexedData);
				}

				const next = player.chooseBool(str);
				if (event.frequentSkill) {
					next.set("frequentSkill", skill);
				}
				next.set("forceDie", true);
				next.set("includeOut", true);
				next.set("ai", () => !check || check(trigger, player, event.triggername, event.indexedData));

				if (typeof info.prompt2 == "function") {
					next.set("prompt2", info.prompt2(trigger, player, event.triggername, event.indexedData));
				} else if (typeof info.prompt2 == "string") {
					next.set("prompt2", info.prompt2);
				} else if (info.prompt2 != false) {
					if (lib.dynamicTranslate[skill]) {
						next.set("prompt2", lib.dynamicTranslate[skill](player, skill));
					} else if (lib.translate[`${skill}_info`]) {
						next.set("prompt2", lib.translate[`${skill}_info`]);
					}
				}

				if (trigger.skillwarn) {
					if (next.prompt2) {
						next.set("prompt2", `<span class="thundertext">${trigger.skillwarn}。</span>${next.prompt2}`);
					} else {
						next.set("prompt2", trigger.skillwarn);
					}
				}

				result = normalizeSelectionResult(await next.forResult());
			}
		}
		skill = requireSkill();

		if (typeof result !== "string" && result.control) {
			result.bool = !result.control.includes("cancel");
		}
		if (typeof result === "string" || !result.bool) {
			if (info.oncancel) {
				info.oncancel(trigger, player);
			}
			if (event.indexedData === true) {
				event.result = "cancelled";
			}
			return;
		}

		let autodelay = info.autodelay;
		if (typeof autodelay == "function") {
			autodelay = autodelay(trigger, player);
		}
		if (autodelay && (info.forced || !event.isMine())) {
			if (typeof autodelay == "number") {
				await game.delayx(autodelay);
			} else {
				await game.delayx();
			}
		}
		skill = requireSkill();

		let targets: Player | Player[] | null | undefined = null;
		if (Array.isArray(result.targets) && result.targets.length > 0) {
			targets = result.targets.slice(0);
		} else if (info.logTarget) {
			if (typeof info.logTarget === "string") {
				const logTarget = trigger[info.logTarget];
				if (Array.isArray(logTarget)) {
					targets = logTarget;
				} else if (logTarget && typeof logTarget !== "string") {
					targets = logTarget;
				}
			} else if (typeof info.logTarget === "function") {
				const logTarget = info.logTarget(trigger, player, event.triggername, event.indexedData);
				if (Array.isArray(logTarget)) {
					targets = logTarget;
				} else if (logTarget && typeof logTarget !== "string") {
					targets = logTarget;
				}
			}
		}
		if (targets && !Array.isArray(targets)) {
			targets = [targets];
		}
		if (info.popup != false && !info.direct && !("skill_popup" in result && !result["skill_popup"])) {
			const popup_info = typeof info.popup === "string" ? [skill, info.popup] : skill;
			const args = [trigger, player, event.triggername, event.indexedData, result];
			player.logSkill(popup_info, info.logLine === false ? null : targets, info.line, null, args);
		}
		if (info.usable !== undefined) {
			player.getStat("triggerSkill")[skill] ??= 0;
			player.getStat("triggerSkill")[skill]++;
		}

		const finalizeTrigger = async () => {
			const finalizedSkill = requireSkill();
			if (finalizedSkill.startsWith("player_when_")) {
				player.removeSkill(finalizedSkill);
				game.broadcastAll(skill => {
					delete lib.skill[skill];
					delete lib.translate[skill];
				}, finalizedSkill);
			}
			if (!player._hookTrigger) {
				return;
			}
			if (
				player._hookTrigger.some(i => {
					const info = requireRegisteredSkill(lib.skill, i).hookTrigger;
					return info && info.after && info.after(event, player, event.triggername);
				})
			) {
				await event.trigger("triggerAfter");
			}
		};
		if (!info.content) {
			await finalizeTrigger();
			return;
		}
		const next = game.createEvent(skill);
		next.player = player;
		next._trigger = trigger;
		next.triggername = event.triggername;
		next.setContent(info.content);

		next.skillHidden = event.skillHidden;
		if (info.forceDie) {
			next.forceDie = true;
		}
		if (info.forceOut) {
			next.includeOut = true;
		}
		//传入数据
		if (Array.isArray(targets)) {
			next.targets = targets.slice(0);
		}
		if (typeof result !== "string" && Array.isArray(result.cards)) {
			next.cards = result.cards.slice(0);
		}
		//语法糖部分
		if (typeof result !== "string" && result.cost_data !== undefined) {
			next.cost_data = result.cost_data;
		}
		next.indexedData = event.indexedData;

		await next;

		await finalizeTrigger();
	},
	async playVideoContent(event, trigger, player) {
		await game.delay(0, 500);

		if (!game.chess) {
			ui.control.innerHTML = "";
			const nodes = [...ui.arena.childNodes];
			for (const node of nodes) {
				if (node == ui.canvas) {
					continue;
				}
				if (node == ui.control) {
					continue;
				}
				if (node == ui.mebg) {
					continue;
				}
				if (node == ui.me) {
					continue;
				}
				if (node == ui.roundmenu) {
					continue;
				}
				node.remove();
			}
			ui.sidebar.innerHTML = "";
			ui.cardPile.innerHTML = "";
			ui.discardPile.innerHTML = "";
			ui.special.innerHTML = "";
			ui.ordering.innerHTML = "";
		}

		const systemFirst = ui.system.firstElementChild;
		const systemLast = ui.system.lastElementChild;
		if (!(systemFirst instanceof HTMLElement) || !(systemLast instanceof HTMLElement)) {
			return;
		}
		systemFirst.innerHTML = "";
		systemLast.innerHTML = "";
		systemFirst.appendChild(ui.config2);
		if (ui.updateVideoMenu) {
			ui.updateVideoMenu();
		}

		_status.videoDuration = 1 / parseFloat(lib.config.video_default_play_speed.slice(0, -1));
		ui.create.system("返回", () => {
			const mode = localStorage.getItem(`${lib.configprefix}playbackmode`);
			if (mode) {
				game.saveConfig("mode", mode);
			}
			game.reload();
		});
		ui.create.system("重播", () => {
			_status.replayvideo = true;
			const mode = lib.config.mode;
			const playback = _status.playback;
			if (mode && playback) {
				game.playVideo(playback, mode);
			}
		});
		ui.create.system("暂停", ui.click.pause, true).id = "pausebutton";
		const atempo = ui.create.system(
			"原速",
			() => {
				_status.videoDuration = 1;
				updateDuration();
			},
			true
		);
		const slow = ui.create.system(
			"减速",
			() => {
				_status.videoDuration *= 1.5;
				updateDuration();
			},
			true
		);
		const fast = ui.create.system(
			"加速",
			() => {
				_status.videoDuration /= 1.5;
				updateDuration();
			},
			true
		);
		const updateDuration = () => {
			atempo.innerHTML = `原速(当前${Math.round(100 / _status.videoDuration) / 100}倍速)`;
			if (_status.videoDuration > 1) {
				slow.classList.add("glow");
			} else {
				slow.classList.remove("glow");
			}
			if (_status.videoDuration < 1) {
				fast.classList.add("glow");
			} else {
				fast.classList.remove("glow");
			}
		};
		updateDuration();
		ui.system.style.display = "";
		ui.refresh(ui.system);
		ui.system.show();
		ui.window.show();
		if (lib.config.mode != "versus" && lib.config.mode != "boss") {
			ui.arena.style.display = "";
			ui.refresh(ui.arena);
			ui.arena.show();
		}
		if (!game.chess) {
			game.playerMap = {};
		}
		game.finishCards();

		// 不确定，但录像年久失修，还是加上吧
		await event.waitNext();

		while (event.video.length) {
			const content = event.video.shift();
			// console.log(content);
			if (content.type == "delay") {
				await game.delay(content.content);
			} else if (content.type == "play") {
				window.play = {};
				if (!event.playtoload) {
					event.playtoload = 1;
				} else {
					event.playtoload++;
				}
				const script = lib.init.js(`${lib.assetURL}play`, content.name);
				let cleaned = false;
				const cleanup = () => {
					if (cleaned) {
						return;
					}
					cleaned = true;
					if (event.playtoload > 0) {
						event.playtoload--;
					}
					if (event.playtoload == 0) {
						delete window.play;
					}
				};
				if (!script) {
					cleanup();
					continue;
				}
				script.addEventListener(
					"load",
					() => {
						const play = window.play;
						const video = play?.[content.name];
						try {
							video?.video?.(content.init);
						} finally {
							cleanup();
						}
					},
					{ once: true }
				);
				script.addEventListener("error", cleanup, { once: true });
			} else if (typeof content.player == "string" && game.playerMap[content.player] && game.playerMap[content.player].classList && !game.playerMap[content.player].classList.contains("obstacle")) {
				await game.videoContent[content.type](game.playerMap[content.player], content.content);
			} else {
				await game.videoContent[content.type](content.content);
			}
			if (event.video.length) {
				await game.delay(0, _status.videoDuration * Math.min(2000, event.video[0].delay));
			}

			// 同上，~~早知道不改成Async Content了~~
			await event.waitNext();
		}

		_status.over = true;
		const finalSystem = ui.system.lastElementChild;
		if (finalSystem && "hide" in finalSystem && typeof finalSystem.hide === "function") {
			finalSystem.hide();
			delay(500).then(() => void (finalSystem.innerHTML = ""));
		}
	},
};
