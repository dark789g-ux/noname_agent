import { _status, game, get, lib, ui } from "noname";
import { requireRegisteredSkill } from "../skillRegistry.js";

/** @satisfies {Pick<import("../skillRegistry.js").BuiltinSkillRegistry, "dongcha" | "sheshen" | "identity_mingcha" | "_sxrm_connect">} */
export const identitySkills = {
	dongcha: {
		mode: ["identity"],
		available(mode) {
			if (mode == "identity" && _status.mode !== "zhong") {
				return false;
			}
		},
		trigger: { player: "phaseZhunbeiBegin" },
		unique: true,
		filter(event, player) {
			return game.hasPlayer(current => current.countDiscardableCards(player, "ej") > 0);
		},
		charlotte: true,
		forceunique: true,
		async cost(event, trigger, player) {
			if (!event.skill) {
				throw new TypeError("guohe_copy cost requires an event skill");
			}
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill),
					prompt2: "弃置场上的一张牌",
					filterTarget: (card, player, target) => target.countDiscardableCards(player, "ej") > 0,
				})
				.set("ai", target => {
					const player = get.player() ?? undefined;
					const card = { name: "guohe_copy", position: "ej" };
					return get.effect(target, card, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets;
			if (!targets) {
				throw new TypeError("dongcha content requires targets");
			}
			const [target] = targets;
			if (!target) {
				throw new TypeError("dongcha content requires a target");
			}
			target.addExpose(0.1);
			await game.delayx();
			await player.discardPlayerCard({ position: "ej", forced: true, target });
		},
		group: ["dongcha_begin", "dongcha_log"],
		subSkill: {
			begin: {
				charlotte: true,
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				forced: true,
				popup: false,
				filter(event, player) {
					return game.hasPlayer(current => current.identity == "fan") && (event.name != "phase" || game.phaseNumber == 0);
				},
				async content(event, trigger, player) {
					const list = game.filterPlayer(current => current.identity == "fan");
					const target = list.randomGet();
					player.storage.dongcha = target;
					if (!_status.connectMode) {
						if (player == game.me) {
							target.setIdentity("fan");
							target.node.identity.classList.remove("guessing");
							target.fanfixed = true;
							player.line(target, "green");
							player.popup("dongcha");
						}
					} else {
						await player.chooseControl({ controls: ["ok"] }).set("dialog", [get.translation(target) + "是反贼", [[target.name], "character"]]);
					}
				},
			},
			log: {
				charlotte: true,
				trigger: { player: "useCard" },
				forced: true,
				popup: false,
				filter(event, player) {
					const targets = event.targets;
					if (!targets || targets.length !== 1) {
						return false;
					}
					const [target] = targets;
					const shown = target?.ai?.shown;
					return target != null && target == player.storage.dongcha && typeof shown === "number" && shown < 0.95;
				},
				async content(event, trigger, player) {
					const target = trigger.getTargets()[0];
					if (!target) {
						throw new TypeError("dongcha target is required");
					}
					target.addExpose(0.2);
				},
			},
		},
	},
	sheshen: {
		mode: ["identity"],
		available(mode) {
			if (mode == "identity" && _status.mode !== "zhong") {
				return false;
			}
		},
		trigger: { global: "dieBefore" },
		forced: true,
		unique: true,
		charlotte: true,
		forceunique: true,
		filter(event, player) {
			return event.player == game.zhu && Number(player.hp) > 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.getPlayer();
			await target.gainMaxHp();
			await target.recoverTo(player.hp);
			const cards = player.getCards("he");
			if (cards.length) {
				await target.gain({ cards, source: player, animate: "giveAuto" });
			}
			trigger.cancel();
			await player.die();
		},
	},
	identity_mingcha: {
		mode: ["identity"],
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return game.hasPlayer(current => current !== player) && (event.name != "phase" || game.phaseNumber == 0);
		},
		unique: true,
		charlotte: true,
		forceunique: true,
		async cost(event, trigger, player) {
			if (!event.skill) {
				throw new TypeError("identity reveal cost requires an event skill");
			}
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill),
					prompt2: "请选择一名你要查看身份的目标",
					filterTarget: lib.filter.notMe,
				})
				.set("ai", target => {
					const player = get.player();
					return get.threaten(target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets;
			if (!targets) {
				throw new TypeError("identity reveal content requires targets");
			}
			const [target] = targets;
			if (!target) {
				throw new TypeError("identity reveal content requires a target");
			}
			target.addExpose(0.15);
			await game.delayx();
			const { identity } = target;
			if (identity == "fan") {
				game.broadcastAll(player => {
					player.showIdentity();
				}, target);
				event.videoId = lib.status.videoId++;
				const createDialog = (player, target, identity, id) => {
					const dialog = ui.create.dialog(`${get.translation(player)}展示了${get.translation(target)}的身份牌<br>`, "forcebutton");
					dialog.videoId = id;
					ui.create.spinningIdentityCard(identity, dialog);
				};
				game.broadcastAll(createDialog, player, target, identity, event.videoId);
				game.log(target, "的身份为", `#g${get.translation(identity + "2")}`);
				await game.delay(3);
				game.broadcastAll(lib.message.client.closeDialog, event.videoId);
			}
		},
	},
	_sxrm_connect: {
		marktext: "🔗",
		intro: {
			name: "连接",
			markcount(storage, player) {
				return player.countConnectedCards();
			},
			mark(dialog, content, player) {
				const cards = player.getConnectedCards();
				if (cards.length) {
					dialog.addAuto(cards);
				} else {
					return "无连接牌";
				}
			},
		},
		isConnect(cards) {
			if (get.itemtype(cards) === "cards") {
				return cards.filter(card => get.is.connectedCard(card));
			}
			return get.is.connectedCard(cards);
		},
		addConnect(cards) {
			game.addConnectedCards(cards);
		},
		removeConnect(cards) {
			game.removeConnectedCards(cards);
		},
		refreshMark() {
			game.updateConnectedCards();
		},
		trigger: {
			player: "loseAfter",
			global: ["loseAsyncAfter", "equipAfter", "addJudgeAfter", "addToExpansionAfter", "gainAfter"],
		},
		firstDo: true,
		forceDie: true,
		filter(event, player) {
			if (!event.getl) {
				return false;
			}
			return game.hasPlayer2(current => {
				const cards = event.getl(current)?.hs ?? [];
				return cards.some(card => get.is.connectedCard(card));
			});
		},
		async cost(event, trigger, player) {
			const lose_map = new Map();
			const cards = game
				.filterPlayer2()
				.map(current => {
					const lose = (trigger.getl(current).hs ?? []).filter(card => get.is.connectedCard(card));
					if (lose.length) {
						lose_map.set(current, lose);
					}
					return lose;
				})
				.flat();
			if (!cards.length) {
				return;
			}
			game.removeConnectedCards(cards);
			const bool1 = ["useCard", "respond"].includes((trigger.relatedEvent || trigger.getParent()).name),
				bool2 = trigger.type == "discard" && trigger.getlx !== false && !trigger.getParent(event.skill, true);
			if (["lose", "loseAsync"].includes(trigger.name) && (bool1 || bool2)) {
				const map = game.filterPlayer2().reduce((map, current) => {
					const cards = current.getConnectedCards();
					if (cards.length) {
						map.set(current, cards);
						const lose = lose_map.get(current) ?? [];
						lose.addArray(cards);
						lose_map.set(current, lose);
					}
					return map;
				}, new Map());
				if (map.size) {
					event.result = {
						bool: true,
						skill_popup: false,
						targets: Array.from(map.keys()),
						cost_data: map,
					};
				}
			}
			if (lose_map.size) {
				trigger.set("sxrmConnectCardsMap", lose_map);
			}
		},
		async content(event, trigger, player) {
			const targets = event.getTargets(),
				{ cost_data: map } = event;
			for (const target of targets.sortBySeat()) {
				const cards = map.get(target);
				if (cards?.length) {
					await target.modedDiscard(cards);
				}
			}
		},
	},
};
