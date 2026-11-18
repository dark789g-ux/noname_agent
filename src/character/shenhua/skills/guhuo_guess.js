import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "guhuo_guess" | "chanyuan" | "guhuo_phase">} */
export const groupSkills = {
	guhuo_guess: {
		audio: 2,
		trigger: {
			player: ["useCardBefore", "respondBefore"],
		},
		forced: true,
		silent: true,
		popup: false,
		firstDo: true,
		charlotte: true,
		filter(event, player) {
			return event.skill && (event.skill.indexOf("guhuo_") == 0 || event.skill.indexOf("xinfu_guhuo_") == 0);
		},
		async content(event, trigger, player) {
			player.addTempSkill("guhuo_phase");
			event.fake = false;
			event.betrayer = null;
			const [card] = trigger.cards;
			if (card.name != trigger.card.name || (card.name == "sha" && !get.is.sameNature(trigger.card, card))) {
				event.fake = true;
			}
			player.popup(trigger.card.name, "metal");
			const next = player.lose(card, ui.ordering);
			next.relatedEvent = trigger;
			await next;
			// player.line(trigger.targets,trigger.card.nature);
			trigger.throw = false;
			trigger.skill = "xinfu_guhuo_backup";
			game.log(player, "声明", trigger.targets && trigger.targets.length ? "对" : "", trigger.targets || "", trigger.name == "useCard" ? "使用" : "打出", trigger.card);
			event.prompt = get.translation(player) + "声明" + (trigger.targets && trigger.targets.length ? "对" + get.translation(trigger.targets) : "") + (trigger.name == "useCard" ? "使用" : "打出") + (get.translation(trigger.card.nature) || "") + get.translation(trigger.card.name) + "，是否质疑？";
			event.targets = game
				.filterPlayer(function (current) {
					return current != player && !current.hasSkill("chanyuan");
				})
				.sortBySeat(_status.currentPhase);
			game.broadcastAll(
				function (card, player) {
					_status.guhuoNode = card.copy("thrown");
					if (lib.config.cardback_style != "default") {
						_status.guhuoNode.style.transitionProperty = "none";
						ui.refresh(_status.guhuoNode);
						_status.guhuoNode.classList.add("infohidden");
						ui.refresh(_status.guhuoNode);
						_status.guhuoNode.style.transitionProperty = "";
					} else {
						_status.guhuoNode.classList.add("infohidden");
					}
					_status.guhuoNode.style.transform = "perspective(600px) rotateY(180deg) translateX(0)";
					player.$throwordered2(_status.guhuoNode);
				},
				trigger.cards[0],
				player
			);
			event.onEnd01 = function () {
				_status.guhuoNode.removeEventListener("webkitTransitionEnd", _status.event.onEnd01);
				setTimeout(function () {
					_status.guhuoNode.style.transition = "all ease-in 0.3s";
					_status.guhuoNode.style.transform = "perspective(600px) rotateY(270deg)";
					const onEnd = function () {
						_status.guhuoNode.classList.remove("infohidden");
						_status.guhuoNode.style.transition = "all 0s";
						ui.refresh(_status.guhuoNode);
						_status.guhuoNode.style.transform = "perspective(600px) rotateY(-90deg)";
						ui.refresh(_status.guhuoNode);
						_status.guhuoNode.style.transition = "";
						ui.refresh(_status.guhuoNode);
						_status.guhuoNode.style.transform = "";
						_status.guhuoNode.removeEventListener("webkitTransitionEnd", onEnd);
					};
					_status.guhuoNode.listenTransition(onEnd);
				}, 300);
			};
			for (const target of event.targets) {
				const { links } = await target
					.chooseButton([event.prompt, [["reguhuo_ally", "reguhuo_betray"], "vcard"]], true)
					.set("ai", function (button) {
						const player = _status.event.player;
						const evt = _status.event.getParent("guhuo_guess"),
							evtx = evt.getTrigger();
						if (!evt) {
							return Math.random();
						}
						const card = { name: evtx.card.name, nature: evtx.card.nature, isCard: true };
						const ally = button.link[2] == "reguhuo_ally";
						if (ally && (player.hp <= 1 || get.attitude(player, evt.player) >= 0)) {
							return 1.1;
						}
						if (!ally && get.attitude(player, evt.player) < 0 && evtx.name == "useCard") {
							let eff = 0;
							const targetsx = evtx.targets || [];
							for (const target of targetsx) {
								const isMe = target == evt.player;
								eff += get.effect(target, card, evt.player, player) / (isMe ? 1.5 : 1);
							}
							eff /= 1.5 * targetsx.length || 1;
							if (eff > 0) {
								return 0;
							}
							if (eff < -7) {
								return Math.random() + Math.pow(-(eff + 7) / 8, 2);
							}
							return Math.pow((get.value(card, evt.player, "raw") - 4) / (eff == 0 ? 5 : 10), 2);
						}
						return Math.random();
					})
					.forResult();
				if (links[0][2] == "reguhuo_betray") {
					target.addExpose(0.2);
					game.log(target, "#y质疑");
					target.popup("质疑！", "fire");
					event.betrayer = target;
					break;
				} else {
					game.log(target, "#g不质疑");
					target.popup("不质疑", "wood");
				}
			}
			await game.delayx();
			game.broadcastAll(function (onEnd) {
				_status.event.onEnd01 = onEnd;
				if (_status.guhuoNode) {
					_status.guhuoNode.listenTransition(onEnd, 300);
				}
			}, event.onEnd01);
			await game.delay(2);
			if (!event.betrayer) {
				return;
			}
			if (event.fake) {
				event.betrayer.popup("质疑正确", "wood");
				game.log(player, "声明的", trigger.card, "作废了");
				trigger.cancel();
				trigger.getParent().goto(0);
				trigger.line = false;
			} else {
				event.betrayer.popup("质疑错误", "fire");
				await event.betrayer.addSkills("chanyuan");
			}
			await game.delay(2);
			if (event.fake) {
				game.broadcastAll(() => ui.clear());
			} // game.broadcastAll(ui.clear); 原来的代码抽象喵
		},
	},
	chanyuan: {
		init(player, skill) {
			if (player.hp == 1) {
				player.logSkill(skill);
			}
			player.addSkillBlocker(skill);
		},
		onremove(player, skill) {
			player.removeSkillBlocker(skill);
		},
		skillBlocker(skill, player) {
			return skill != "chanyuan" && skill != "rechanyuan" && !lib.skill[skill].charlotte && !lib.skill[skill].persevereSkill && player.hp == 1;
		},
		mark: true,
		intro: {
			content(storage, player, skill) {
				let str = "<li>锁定技。你不能于〖蛊惑〗的结算流程中进行质疑。当你的体力值为1时，你的其他技能失效。";
				const list = player.getSkills(null, false, false).filter(function (i) {
					return lib.skill.rechanyuan.skillBlocker(i, player);
				});
				if (list.length) {
					str += "<br><li>失效技能：" + get.translation(list);
				}
				return str;
			},
		},
		audio: 2,
		trigger: { player: "changeHp" },
		filter(event, player) {
			if (event.changedHp == 0) {
				return false;
			}
			return player.hp == 1;
		},
		forced: true,
		async content(event, trigger, player) {},
	},
	guhuo_phase: {},
};
