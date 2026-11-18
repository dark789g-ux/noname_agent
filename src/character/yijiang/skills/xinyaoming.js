import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinyaoming" | "xinfuli" | "xindangxian" | "xinjunxing" | "xinzhige" | "xinzongzuo">} */
export const groupSkills = {
	xinyaoming: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player) {
			const storage = player.getStorage("xinyaoming_used");

			const items = ["摸牌", "弃牌", "制衡"].filter(control => !storage.includes(control));
			if (items.length === 0) {
				return false;
			}

			return game.hasPlayer(target => {
				return items.some(control => {
					switch (control) {
						case "摸牌":
							return target !== player;
						case "弃牌":
							return target !== player && target.countCards("h") > 0;
						case "制衡":
							return true;
						default:
							return false;
					}
				});
			});
		},
		async cost(event, trigger, player) {
			if (player === game.me) {
				availableControlsPrompt(player);
			} else {
				player.send(availableControlsPrompt, player);
			}

			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("xinyaoming"),
					filterTarget(card, player, target) {
						const storage = player.getStorage("xinyaoming_used");
						if (!storage.includes("制衡")) {
							return true;
						}

						if (target === player) {
							return false;
						}
						return !storage.includes("摸牌") || target.countCards("h") > 0;
					},
					ai(target) {
						const player = get.player();
						const storage = player.getStorage("xinyaoming_used");
						if (get.attitude(player, target) > 0 && !storage.includes("摸牌") && target !== player) {
							return get.effect(target, { name: "draw" }, player, player);
						}
						if (get.attitude(player, target) < 0 && !storage.includes("弃牌") && target !== player && target.countCards("h") > 0) {
							return get.effect(target, { name: "guohe_copy2" }, player, player);
						}
						if (get.attitude(player, target) > 0 && !storage.includes("制衡")) {
							return get.effect(target, { name: "kaihua" }, player, player);
						}
						return 0;
					},
				})
				.forResult();

			return;

			function availableControlsPrompt(player) {
				const storage = player.getStorage("xinyaoming_used");
				const controls = ["摸牌", "弃牌", "制衡"].filter(control => !storage.includes(control));

				for (const target of game.filterPlayer()) {
					const prompt = controls
						.filter(control => {
							switch (control) {
								case "摸牌":
									return target !== player;
								case "弃牌":
									return target !== player && target.countCards("h") > 0;
								case "制衡":
									return true;
								default:
									return false;
							}
						})
						.join("<br/>");
					target.prompt(prompt);
				}
			}
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];

			const storage = player.getStorage("xinyaoming_used");
			const controls = ["摸牌", "弃牌", "制衡"]
				.filter(control => !storage.includes(control))
				.filter(control => {
					switch (control) {
						case "摸牌":
							return target !== player;
						case "弃牌":
							return target !== player && target.countCards("h") > 0;
						case "制衡":
							return true;
						default:
							return false;
					}
				});

			/** @type {Partial<Result>} */
			let result;
			if (controls.length > 1) {
				const targetName = get.translation(target);
				const controlMap = {
					摸牌: `令${targetName}摸一张牌`,
					弃牌: `弃置${targetName}一张手牌`,
					制衡: `令${targetName}弃置至多两张牌，然后其摸等量的牌`,
				};

				const choiceList = ["摸牌", "弃牌", "制衡"].map(control => (controls.includes(control) ? controlMap[control] : `<span style="opacity:0.5">${controlMap[control]}</span>`));
				result = await player
					.chooseControl({
						controls,
						choiceList,
						ai() {
							const { player, target, controls } = get.event();
							const map = {
								摸牌: get.effect(target, { name: "draw" }, player, player),
								弃牌: get.effect(target, { name: "guohe_copy2" }, player, player),
								制衡: get.effect(target, { name: "kaihua" }, player, player),
							};
							return controls.toSorted((a, b) => map[b] - map[a])[0];
						},
					})
					.set("target", target)
					.forResult();
			} else {
				result = { control: controls[0] };
			}

			player.addTempSkill("xinyaoming_used");
			player.markAuto("xinyaoming_used", [result.control]);
			switch (result.control) {
				case "摸牌":
					await target.draw();
					break;
				case "弃牌":
					await player.discardPlayerCard({
						target,
						position: "h",
						forced: true,
					});
					break;
				case "制衡":
					result = await target
						.chooseToDiscard({
							prompt: "邀名：弃置至多两张牌，然后摸等量的牌",
							selectCard: [1, 2],
							position: "he",
							forced: true,
							ai(card) {
								return lib.skill.zhiheng.check(card);
							},
						})
						.forResult();

					if (result.bool && result.cards?.length) {
						await target.draw(result.cards.length);
					}
					break;
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	xinfuli: {
		audio: 2,
		skillAnimation: true,
		animationColor: "soil",
		limited: true,
		enable: "chooseToUse",
		filter(event, player) {
			if (event.type != "dying") {
				return false;
			}
			if (player != event.dying) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const num = game.countGroup();
			await player.recoverTo(num);
			await player.drawTo(num);
			if (num > 2) {
				await player.turnOver();
			}
		},
		ai: {
			save: true,
			skillTagFilter(player, arg, target) {
				return player == target;
			},
			result: { player: 10 },
			threaten(player, target) {
				if (!target.storage.xinfuli) {
					return 0.9;
				}
			},
		},
	},
	xindangxian: {
		derivation: "xinfuli",
		trigger: { player: "phaseBegin" },
		forced: true,
		audio: "dangxian",
		audioname: ["xin_liaohua", "re_liaohua"],
		audioname2: {
			dc_guansuo: "dangxian_guansuo",
			guansuo: "dangxian_guansuo",
		},
		async content(event, trigger, player) {
			trigger.phaseList.splice(trigger.num, 0, `phaseUse|${event.name}`);
		},
		group: "xindangxian_rewrite",
		subSkill: {
			rewrite: {
				trigger: { player: "phaseUseBegin" },
				forced: true,
				popup: false,
				filter(kagari) {
					return kagari._extraPhaseReason == "xindangxian";
				},
				async content(event, trigger, player) {
					const result = player.storage.xinfuli
						? await player
								.chooseBool("是否失去1点体力并获得一张【杀】？")
								.set("choice", player.hp > 2 && !player.hasSha())
								.forResult()
						: { bool: true };
					if (!result?.bool) {
						return;
					}
					await player.loseHp();
					const card = get.discardPile(card => card.name == "sha");
					if (card) {
						await player.gain(card, "gain2");
					}
					game.updateRoundNumber();
				},
			},
		},
		ai: {
			combo: "xinfuli",
			halfneg: true,
		},
	},
	xinjunxing: {
		inherit: "junxing",
		audio: "junxing",
		async content(event, trigger, player) {
			const { cards, target } = event;
			const types = new Set(cards.map(card => get.type(card, "trick", player)));
			const result = await target
				.chooseToDiscard({
					filterCard(card) {
						const { types } = get.event();
						return !types.has(get.type(card, "trick"));
					},
					ai(card) {
						const player = get.player();
						if (player.isTurnedOver()) {
							return -1;
						}
						return 8 - get.value(card);
					},
				})
				.set("types", types)
				.set("dialog", [`弃置一张与${get.translation(player)}弃置的牌类别均不同的牌，或将武将牌翻面`, "hidden", cards])
				.forResult();
			if (result.bool) {
				return;
			}

			await target.turnOver();
			const num = 4 - target.countCards("h");
			if (num) {
				await target.draw(num);
			}
		},
	},
	xinzhige: {
		enable: "phaseUse",
		usable: 1,
		audio: "zhige",
		position: "he",
		selectTarget: 2,
		multitarget: true,
		targetprompt: ["出杀人", "出杀目标"],
		filterTarget(card, player, target) {
			if (ui.selected.targets.length == 0) {
				return target != player && target.inRange(player);
			} else {
				return ui.selected.targets[0].inRange(target);
			}
		},
		async content(event, trigger, player) {
			const { targets } = event;

			const result = await targets[0]
				.chooseCard({
					prompt: `"交给${get.translation(player)}一张【杀】或武器牌，否则视为对${get.translation(targets[1])}使用一张【杀】"`,
					filterCard(card) {
						return get.name(card) === "sha" || get.subtype(card) === "equip1";
					},
					position: "he",
					ai(card) {
						const player = _status.event.player;
						const target = _status.event.getParent("xinzhige").targets[1];
						return get.effect(target, { name: "sha" }, player, player) >= 0 ? -1 : 9 - get.value(card);
					},
				})
				.forResult();
			if (result.bool && result.cards?.length) {
				await targets[0].give(result.cards, player, true);
			} else {
				if (targets[0].canUse("sha", targets[1])) {
					await targets[0].useCard({
						card: get.autoViewAs({ name: "sha", isCard: true }),
						targets: [targets[1]],
					});
				}
			}
		},
		ai: {
			result: {
				target(player, target) {
					if (ui.selected.targets.length) {
						var from = ui.selected.targets[0];
						return get.effect(target, { name: "sha" }, from, target);
					}
					var effs = [0, 0];
					game.countPlayer(function (current) {
						if (current != target && target.canUse("sha", current)) {
							var eff = get.effect(current, { name: "sha" }, target, target);
							if (eff > effs[0]) {
								effs[0] = eff;
							}
							if (eff < effs[1]) {
								effs[1] = eff;
							}
						}
					});
					return effs[get.attitude(player, target) > 0 ? 0 : 1];
				},
			},
			order: 8.5,
			expose: 0.2,
		},
	},
	xinzongzuo: {
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		audio: "zongzuo",
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async content(event, trigger, player) {
			const num = game.countGroup();
			await player.gainMaxHp({ num });
			await player.recover({ num });
		},
		group: "xinzongzuo_lose",
		subSkill: {
			lose: {
				trigger: { global: "dieAfter" },
				forced: true,
				audio: "zongzuo",
				filter(event, player) {
					if (!lib.group.includes(event.player.group)) {
						return false;
					}
					if (
						game.hasPlayer(function (current) {
							return current.group == event.player.group;
						})
					) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					await player.loseMaxHp();
					await player.draw(2);
				},
			},
		},
	},
};
