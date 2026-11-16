import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twshelun" | "twfayi" | "twjishan" | "twzhuhuan" | "twzhenglve" | "twzhenglve2" | "twzhenglve3" | "twzhenglve4">} */
export const groupSkills = {
	//外服起王允
	twshelun: {
		audio: "jsrgshelun",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") && game.hasPlayer(current => current != player && player.inRange(current));
		},
		filterTarget(card, player, target) {
			return player != target && player.inRange(target);
		},
		multitarget: true,
		multiline: true,
		selectTarget: [1, 2],
		async content(event, trigger, player) {
			const { targets: targetsx } = event;
			const num = player.countCards("h"),
				targets = game.filterPlayer(target => {
					return target.countCards("h") <= num && !targetsx.includes(target);
				});
			if (!targets?.length) {
				return;
			}
			await player
				.chooseToDebate(targets)
				.set("callback", async function (event, trigger, player) {
					const result = event.debateResult;
					if (result.bool && result.opinion) {
						const opinion = result.opinion;
						const targets = event.getParent().targetsx;
						if (opinion && ["red", "black"].includes(opinion)) {
							player.logSkill("twshelun", targets, null, null, [opinion == "red" ? 3 : 4]);
							if (opinion == "red") {
								await game.doAsyncInOrder(targets, async target => player.discardPlayerCard(target, "he", true, 2));
							} else {
								await game.doAsyncInOrder(targets, async target => target.damage());
							}
						}
					}
				})
				.set("ai", card => {
					const player = get.player();
					const targets = get.event().getParent(2).targetsx;
					const color =
						player == _status.event.source || targets.reduce((sum, target) => sum + get.damageEffect(target, player, player), 0) > 0
							? "black"
							: "red";
					let val = 5 - get.value(card);
					if (get.color(card) == color) {
						val += 10;
					}
					return val;
				})
				.set("aiCard", target => {
					const targets = get.event().getParent(2).targetsx;
					const color =
						target == _status.event.source || targets.reduce((sum, target) => sum + get.damageEffect(target, player, player), 0) > 0
							? "black"
							: "red";
					let hs = target.getCards("h", { color: color });
					if (!hs.length) {
						hs = target.getCards("h");
					}
					return { bool: true, cards: [hs.randomGet()] };
				})
				.set("targetsx", targetsx);
		},
		ai: {
			order: 8,
			expose: 0.2,
			result: { target: -1 },
		},
	},
	twfayi: {
		audio: "jsrgfayi",
		trigger: { global: "chooseToDebateAfter" },
		filter(event, player) {
			if (!event.targets.includes(player)) {
				return false;
			}
			if (event.red.map(i => i[0]).includes(player)) {
				return event.black.length;
			}
			if (event.black.map(i => i[0]).includes(player)) {
				return event.red.length;
			}
			return false;
		},
		async cost(event, trigger, player) {
			let targets = [];
			if (trigger.red.map(i => i[0]).includes(player)) {
				targets = trigger.black;
			}
			if (trigger.black.map(i => i[0]).includes(player)) {
				targets = trigger.red;
			}
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, 2], (card, player, target) => {
					return _status.event.targets.includes(target);
				})
				.set(
					"targets",
					targets.map(i => i[0])
				)
				.set("ai", target => {
					const player = _status.event.player;
					return get.damageEffect(target, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const func = async target => await target.damage();
			await game.doAsyncInOrder(event.targets, func);
		},
	},
	//外服起刘备
	twjishan: {
		audio: "jsrgjishan",
		trigger: {
			source: "damageSource",
			global: "damageBegin4",
		},
		filter(event, player, name) {
			if (player.getStorage("twjishan_used").includes(name)) {
				return false;
			}
			if (name == "damageBegin4") {
				return player.hp > 0;
			}
			return game.hasPlayer(current => current.isMinHp() && player.getStorage("twjishan").includes(current) && current.isDamaged());
		},
		async cost(event, trigger, player) {
			const { triggername, skill } = event,
				{ player: target } = trigger;
			if (triggername == "damageBegin4") {
				const result = await player
					.chooseBool(get.prompt(skill, target), "失去2点体力并防止此伤害，然后你与其各摸一张牌")
					.set("choice", get.info(skill).check(trigger, player))
					.forResult();
				event.result = {
					bool: result?.bool,
					targets: [target],
				};
			} else {
				event.result = await player
					.chooseTarget(get.prompt(skill), "令一名体力值最小且你对其发动过〖积善①〗的角色回复1点体力", (card, player, target) => {
						return target.isMinHp() && player.getStorage("twjishan").includes(target) && target.isDamaged();
					})
					.set("ai", target => {
						const player = get.player();
						return get.recoverEffect(target, player, player);
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			const {
				triggername,
				name,
				targets: [target],
			} = event;
			player.addTempSkill(name + "_used");
			player.markAuto(name + "_used", [triggername]);
			if (triggername == "damageBegin4") {
				player.markAuto(name, [target]);
				trigger.cancel();
				await player.loseHp(2);
				await game.asyncDraw([player, target].sortBySeat(_status.currentPhase));
			} else {
				await target.recover();
			}
		},
		onremove: true,
		check(event, player) {
			return (
				get.damageEffect(event.player, event.source, _status.event.player, event.nature) * event.num <
				get.effect(player, { name: "losehp" }, player, _status.event.player) * 1.5 +
					get.effect(player, { name: "draw" }, player, _status.event.player) +
					get.effect(event.player, { name: "draw" }, player, _status.event.player) / 2
			);
		},
		logAudio(event, player, name) {
			if (name == "damageBegin4") {
				return 2;
			}
			return ["jsrgjishan3.mp3", "jsrgjishan4.mp3"];
		},
		intro: { content: "已帮助$抵挡过伤害" },
		ai: { expose: 0.2 },
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	//外服起何进
	twzhuhuan: {
		audio: "jsrgzhuhuan",
		inherit: "jsrgzhuhuan",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.player();
					const num = player.countCards("h", "sha") + 1;
					const eff3 =
						get.damageEffect(target, target, player) +
						get.effect(target, { name: "guohe_copy2" }, target, player) * Math.min(num, target.countDiscardableCards(target, "he"));
					if (player.isHealthy()) {
						return eff3;
					}
					const eff1 = [
						0,
						get.damageEffect(target, target, target) +
							get.effect(target, { name: "guohe_copy2" }, target, target) * Math.min(num, target.countDiscardableCards(target, "he")),
					];
					const eff2 = [1, get.recoverEffect(player, player, target) + get.effect(player, { name: "draw" }, player, target) * num];
					return [eff3, get.recoverEffect(player, player, player) + get.effect(player, { name: "draw" }, player, player) * num][
						eff1[1] > eff2[1] ? 0 : 1
					];
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.showHandcards();
			const hs = player.getCards("h", "sha");
			await player.discard(hs);
			const num = hs.length + 1;
			const result = player.isDamaged()
				? await target
						.chooseControl()
						.set("choiceList", [
							`受到1点伤害，然后弃置${get.cnNumber(num)}张牌`,
							`令${get.translation(player)}回复1点体力，然后${get.translation(player)}摸${get.cnNumber(num)}张牌`,
						])
						.set("ai", () => {
							const num = get.event().num;
							const {
								targets: [target],
								player,
							} = get.event().getParent();
							const eff1 =
								get.damageEffect(target, target, target) +
								get.effect(target, { name: "guohe_copy2" }, target, target) *
									Math.min(num, target.countDiscardableCards(target, "he"));
							const eff2 = get.recoverEffect(player, player, target) + get.effect(player, { name: "draw" }, player, target) * num;
							return eff1 > eff2 ? 0 : 1;
						})
						.set("num", num)
						.forResult()
				: { index: 0 };
			if (result.index === 0) {
				await target.damage();
				await target.chooseToDiscard("he", num, true);
			} else {
				await player.recover();
				await player.draw(num);
			}
		},
	},
	//外服起曹操
	twzhenglve: {
		audio: "jsrgzhenglve",
		inherit: "jsrgzhenglve",
		filter(event, player) {
			return !game.hasPlayer(current => {
				let history = current.actionHistory;
				for (let num = history.length - 1; num >= 0; num--) {
					if (history[num].isRound) {
						break;
					}
					if (history[num].isSkipped) {
						continue;
					}
					return true;
				}
				return false;
			});
		},
		prompt2(event, player) {
			const num = Math.min(
				event.player.hasHistory("sourceDamage") ? 1 : 2,
				game.countPlayer(current => !current.hasMark("jsrgzhenglve_mark"))
			);
			let str = `你可以摸两张牌`;
			if (num) {
				str += `并令${get.cnNumber(num)}名角色获得“猎”标记`;
			}
			return str;
		},
		drawNum: 2,
		group: ["twzhenglve_damage", "twzhenglve2", "twzhenglve4"],
		mod: {
			targetInRange(card, player, target) {
				if (target.hasMark("jsrgzhenglve_mark")) {
					return true;
				}
			},
		},
		init(player, skill) {
			const evt = _status.event.getParent("phaseUse");
			if (evt.player === player && player.hasHistory("useCard", evtx => evtx.getParent("phaseUse") === evt)) {
				player.addTempSkill(`${skill}3`, "phaseUseAfter");
			}
		},
	},
	twzhenglve2: {
		audio: "jsrgzhenglve",
		sourceSkill: "twzhenglve",
		trigger: { player: "useCard" },
		filter(event, player) {
			return event.addCount !== false && event._twzhenglve;
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			trigger.addCount = false;
			const stat = player.getStat().card;
			const name = trigger.card.name;
			if (typeof stat[name] == "number") {
				stat[name]--;
			}
			game.log(trigger.card, "不计入次数");
		},
		mod: {
			cardUsableTarget(card, player, target) {
				if (player.isPhaseUsing() && !player.hasSkill("twzhenglve3") && target.hasMark("jsrgzhenglve_mark")) {
					return true;
				}
			},
		},
	},
	twzhenglve3: {
		charlotte: true,
	},
	twzhenglve4: {
		charlotte: true,
		sourceSkill: "twzhenglve",
		trigger: { player: "useCard1" },
		filter(event, player) {
			return event.isPhaseUsing(player) && !player.hasSkill("twzhenglve3");
		},
		silent: true,
		async content(event, trigger, player) {
			player.addTempSkill("twzhenglve3", "phaseUseAfter");
			if (trigger.targets?.some(i => i.hasMark("jsrgzhenglve_mark"))) {
				trigger._twzhenglve = true;
			}
		},
	},
};
