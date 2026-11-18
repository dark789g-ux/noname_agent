import type { IdentityPlayerAI } from "../runtimeTypes.js";
import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createStratagemContents() {
	return {
		stratagemInsight: [
			async (event, _trigger, player) => {
				const { target } = event;

				game.log(player, "洞察了", target, "与其的阵营关系");

				const storage = player.storage;
				storage.zhibi ??= [];

				const zhibi = storage.zhibi;
				if (!zhibi.includes(target)) {
					zhibi.push(target);
				}
				const insightResult = (event.insightResult = get.insightResult!(player, target));
				event.videoId = lib.status.videoId++;

				const send = (clientTarget, clientInsightResult, id) => {
					const classList = clientTarget.classList;
					const nonStratagemInsightFlashing = classList.contains("flash-animation-iteration-count-infinite");
					if (nonStratagemInsightFlashing) {
						clientTarget.nonStratagemInsightFlashing = true;
					} else {
						classList.add("flash-animation-iteration-count-infinite");
					}
					const identity = get.translation(`${clientInsightResult}2`);
					clientTarget.prompt(identity, clientInsightResult);
					const dialog = ui.create.dialog(`${get.translation(clientTarget)}是${identity}<br>`, "forcebutton");
					ui.create.spinningIdentityCard(clientInsightResult, dialog);
					const control = ui.create.control("ok", () => {
						dialog.close();
						control.close();
						_status.imchoosing = false;
						_status.event._result = {
							bool: true,
						};
						game.resume();
					});
					dialog.videoId = id;
					game.pause();
					game.countChoose();
				};
				game.broadcastAll(
					(clientPlayer, clientTarget, id) => {
						if (clientPlayer != game.me) {
							ui.create.dialog(`${get.translation(clientPlayer)}正在洞察${get.translation(clientTarget)}的阵营...<br>`).videoId = id;
						}
					},
					player,
					target,
					event.videoId
				);
				if (event.isMine()) {
					send(target, insightResult, event.videoId);
					game.pause();
				} else if (event.isOnline()) {
					player.send(send, target, insightResult, event.videoId);
					player.wait();
					game.pause();
				}
			},
			async (event, _trigger, player) => {
				const { target } = event;

				game.broadcastAll("closeDialog", event.videoId);
				if (!_status.connectMode && get.config("auto_mark_identity", undefined) && !(target.node.identity.firstChild as HTMLElement).innerHTML.length) {
					game.broadcastAll(
						(clientPlayer, clientTarget, currentInsightResult) => {
							if (clientPlayer.isUnderControl(true)) {
								clientTarget.setIdentity(currentInsightResult);
							}
						},
						player,
						target,
						event.insightResult
					);
				}
				const afterInsight = clientTarget => {
					clientTarget.unprompt();
					if (clientTarget.nonStratagemInsightFlashing) {
						delete clientTarget.nonStratagemInsightFlashing;
						return;
					}
					const classList = clientTarget.classList;
					if (classList.contains("flash-animation-iteration-count-infinite")) {
						classList.remove("flash-animation-iteration-count-infinite");
					}
				};
				if (event.isMine()) {
					afterInsight(target);
				} else if (event.isOnline()) {
					player.send(afterInsight, target);
				}
			},
		],

		async stratagemCamouflage(event) {
			const targets = game.players.filter(current => current.identity == "fan" && !(current.ai as IdentityPlayerAI).stratagemCamouflage).randomGets(Math.max(Math.round(get.population(undefined) / 6), 1));

			for (const target of targets) {
				(target.ai as IdentityPlayerAI).stratagemCamouflage = true;
			}

			let choosing: GameEvent | null = null;
			const me = game.me;
			if (event.players.includes(me) && me!.identity === "nei") {
				event.videoId = lib.status.videoId++;
				const rebel = get.translation("fan2");
				const dialog = ui.create.dialog(`${get.translation(targets)}是${rebel}<br>`, "forcebutton");
				ui.create.spinningIdentityCard("fan", dialog);
				dialog.videoId = event.videoId;
				for (const victim of targets) {
					const classList = victim.classList;
					const nonCamouflageFlashing = classList.contains("flash-animation-iteration-count-infinite");
					if (nonCamouflageFlashing) {
						victim.nonCamouflageFlashing = true;
					} else {
						classList.add("flash-animation-iteration-count-infinite");
					}
					victim.prompt(rebel, "fan");
				}
				choosing = me!.chooseControl("ok").set("dialog", dialog);
			}
			for (const current of game.filterPlayer(current => (current as unknown) === "nei")) {
				const storage = current.storage;
				storage.zhibi ??= [];
				storage.zhibi.addArray(targets);
			}

			if (choosing != null) {
				await choosing;
			}

			for (const current of targets) {
				if (game.me!.identity == "nei" && get.config("nei_auto_mark_camouflage", undefined)) {
					current.setIdentity();
				}
				current.unprompt();
				if (current.nonCamouflageFlashing) {
					delete current.nonCamouflageFlashing;
					continue;
				}
				const classList = current.classList;
				if (classList.contains("flash-animation-iteration-count-infinite")) {
					classList.remove("flash-animation-iteration-count-infinite");
				}
			}
		},

		stratagemCamouflageOL: [
			async event => {
				const send = (clientCamouflaged, id, online) => {
					const me = game.me;
					let choosing;
					if (me!.identity == "nei") {
						const storage = me!.storage;
						storage.zhibi ??= [];
						storage.zhibi.addArray(clientCamouflaged);
						const rebel = get.translation("fan2");
						const dialog = ui.create.dialog(`${get.translation(clientCamouflaged)}是${rebel}<br>`, "forcebutton");
						ui.create.spinningIdentityCard("fan", dialog);
						dialog.videoId = id;
						clientCamouflaged.forEach(victim => {
							const classList = victim.classList;
							const nonCamouflageFlashing = classList.contains("flash-animation-iteration-count-infinite");
							if (nonCamouflageFlashing) {
								victim.nonCamouflageFlashing = true;
							} else {
								classList.add("flash-animation-iteration-count-infinite");
							}
							victim.prompt(rebel, "fan");
						});
						choosing = me!.chooseControl("ok").set("dialog", dialog);
					} else {
						ui.create.dialog("请等待内奸身份确认...").videoId = id;
					}
					if (online) {
						game.resume();
					}
					return choosing;
				};
				const camouflaged = (event.targets = game.players.filter(current => current.identity == "fan" && !(current.ai as IdentityPlayerAI).stratagemCamouflage).randomGets(Math.max(Math.round(get.population(undefined) / 6), 1)));
				camouflaged.forEach(current => ((current.ai as IdentityPlayerAI).stratagemCamouflage = true));
				event.videoId = lib.status.videoId++;
				let time = 10000;
				if (lib.configOL && lib.configOL.choose_timeout) {
					time = parseInt(lib.configOL.choose_timeout) * 1000;
				}
				const aiTargets: Player[] = (event.aiTargets = []);
				let localChoosing;
				event.players.forEach(current => {
					current.showTimer(time);
					if (current.isOnline()) {
						current.send(send, camouflaged, event.videoId, true);
						if (current.identity == "nei") {
							current.wait();
							event.withOL = true;
						}
						return;
					}
					const me = game.me;
					if (current == me) {
						event.withMe = true;
						localChoosing = send(camouflaged, event.videoId, undefined);
						if (me!.identity == "nei") {
							me!.wait();
						} else {
							event._result = {
								bool: true,
								_noHidingTimer: true,
							};
						}
						return;
					}
					if (current.identity == "nei") {
						aiTargets.push(current);
					}
				});
				if (aiTargets.length) {
					aiTargets.randomSort();
					new Promise(resolve => setTimeout(resolve, Math.ceil(3000 + 5000 * Math.random()))).then(() => {
						const interval = setInterval(
							() => {
								aiTargets.shift();
								if (aiTargets.length) {
									return;
								}
								clearInterval(interval);
								if (event.withAI) {
									game.resume();
								}
							},
							Math.ceil(500 + 500 * Math.random())
						);
					});
				}
				if (event.withMe) {
					let result = event._result;
					if (localChoosing) {
						result = (await localChoosing.forResult()) as Result;
						event._result = result;
					}
					game.me!.unwait(result);
				}
				if (event.withOL && !event.resultOL) {
					game.pause();
				}
			},
			async event => {
				if (event.aiTargets.length) {
					event.withAI = true;
					game.pause();
				}
			},
			async event => {
				game.broadcastAll("closeDialog", event.videoId);
				event.players.forEach(current => current.hideTimer());
				const afterCamouflage = clientCamouflaged =>
					clientCamouflaged.forEach(victim => {
						victim.unprompt();
						if (victim.nonCamouflageFlashing) {
							delete victim.nonCamouflageFlashing;
							return;
						}
						const classList = victim.classList;
						if (classList.contains("flash-animation-iteration-count-infinite")) {
							classList.remove("flash-animation-iteration-count-infinite");
						}
					});
				const { targets } = event;
				event.players.forEach(current => {
					if (current.isOnline()) {
						current.send(afterCamouflage, targets);
						return;
					}
					const me = game.me;
					if (current == me && me!.identity == "nei") {
						afterCamouflage(targets);
					}
				});
			},
		],
	};
}
