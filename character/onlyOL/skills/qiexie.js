import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "qiexie" | "cuijue" | "caopi_xingdong">} */
export const groupSkills = {
	qiexie: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			return player.countEmptySlot(1) > 0;
		},
		async content(event, trigger, player) {
			if (!_status.characterlist) {
				game.initCharacterList();
			}
			_status.characterlist.randomSort();

			const list = [];
			for (const name of _status.characterlist) {
				if (
					get.character(name, 3).some(skill => {
						const info = get.plainText(get.skillInfoTranslation(skill));
						if (!info.includes("【杀】")) {
							return false;
						}
						const list = get.skillCategoriesOf(skill, player);
						list.remove("锁定技");
						return list.length == 0;
					})
				) {
					list.push(name);
					if (list.length >= 5) {
						break;
					}
				}
			}
			const num = player.countEmptySlot(1);
			if (!list.length || !num) {
				return;
			}
			const result = await player
				.chooseButton(
					[
						"挈挟：选择" + (num > 1 ? "至多" : "") + get.cnNumber(num) + "张武将置入武器栏",
						[
							list,
							(item, type, position, noclick, node) => {
								return lib.skill.qiexie.$createButton(item, type, position, noclick, node);
							},
						],
					],
					[1, num],
					true
				)
				.set("ai", button => {
					const name = button.link;
					const skills = get.character(name, 3).filter(skill => {
						const info = get.plainText(get.skillInfoTranslation(skill));
						if (!info.includes("【杀】")) {
							return false;
						}
						const list = get.skillCategoriesOf(skill, get.player());
						list.remove("锁定技");
						return list.length == 0;
					});
					let eff = 0.2;
					for (const skill of skills) {
						eff += get.skillRank(skill, "in");
					}
					return eff;
				})
				.forResult();
			if (result?.bool) {
				const list = result.links;
				game.addVideo("skill", player, [event.name, [list]]);
				_status.characterlist.removeArray(list);
				game.broadcastAll(
					(player, list) => {
						player.tempname.addArray(list);
						for (var name of list) {
							lib.skill.qiexie.createCard(name);
						}
					},
					player,
					list
				);
				const cards = list.map(name => {
					const card = game.createCard(`qiexie_${name}`, "none", "none");
					return card;
				});
				player.$gain2(cards);
				await game.delayx();
				for (const card of cards) {
					await player.equip(card);
				}
			}
		},
		$createButton(item, type, position, noclick, node) {
			node = ui.create.buttonPresets.character(item, "character", position, noclick);
			const info = lib.character[item];
			const skills = info[3].filter(function (skill) {
				var info = get.skillInfoTranslation(skill);
				if (!info.includes("【杀】")) {
					return false;
				}
				var list = get.skillCategoriesOf(skill, get.player());
				list.remove("锁定技");
				return list.length == 0;
			});
			if (skills.length) {
				const skillstr = skills.map(i => `[${get.translation(i)}]`).join("<br>");
				const skillnode = ui.create.caption(`<div class="text" data-nature=${get.groupnature(info[1], "raw")}m style="font-family: ${lib.config.name_font || "xinwei"},xinwei">${skillstr}</div>`, node);
				skillnode.style.left = "2px";
				skillnode.style.bottom = "2px";
			}
			node._customintro = function (uiintro, evt) {
				const character = node.link,
					characterInfo = get.character(node.link);
				let capt = get.translation(character);
				if (characterInfo) {
					const infoHp = get.infoMaxHp(characterInfo[2]);
					capt += `&nbsp;&nbsp;范围：${infoHp}`;
				}
				uiintro.add(capt);
				if (lib.characterTitle[node.link]) {
					uiintro.addText(get.colorspan(lib.characterTitle[node.link]));
				}
				for (let i = 0; i < skills.length; i++) {
					if (lib.translate[skills[i] + "_info"]) {
						let translation = lib.translate[skills[i] + "_ab"] || get.translation(skills[i]).slice(0, 2);
						if (lib.skill[skills[i]] && lib.skill[skills[i]].nobracket) {
							uiintro.add('<div><div class="skilln">' + get.translation(skills[i]) + "</div><div>" + get.skillInfoTranslation(skills[i], null, false) + "</div></div>");
						} else {
							uiintro.add('<div><div class="skill">【' + translation + "】</div><div>" + get.skillInfoTranslation(skills[i], null, false) + "</div></div>");
						}
						if (lib.translate[skills[i] + "_append"]) {
							uiintro._place_text = uiintro.add('<div class="text">' + lib.translate[skills[i] + "_append"] + "</div>");
						}
					}
				}
			};
			return node;
		},
		video(player, info) {
			for (var name of info[0]) {
				lib.skill.qiexie.createCard(name);
			}
		},
		createCard(name) {
			if (!_status.postReconnect.qiexie) {
				_status.postReconnect.qiexie = [
					function (list) {
						for (var name of list) {
							lib.skill.qiexie.createCard(name);
						}
					},
					[],
				];
			}
			_status.postReconnect.qiexie[1].add(name);
			if (!lib.card["qiexie_" + name]) {
				if (lib.translate[name + "_ab"]) {
					lib.translate["qiexie_" + name] = lib.translate[name + "_ab"];
				} else {
					lib.translate["qiexie_" + name] = lib.translate[name];
				}
				var info = lib.character[name];
				var card = {
					fullimage: true,
					image: "character:" + name,
					type: "equip",
					subtype: "equip1",
					enable: true,
					selectTarget: -1,
					filterTarget(card, player, target) {
						if (player != target) {
							return false;
						}
						return target.canEquip(card, true);
					},
					modTarget: true,
					allowMultiple: false,
					content: lib.element.content.equipCard,
					toself: true,
					ai: {},
					skills: ["qiexie_destroy"],
				};
				var maxHp = get.infoMaxHp(info[2]);
				if (maxHp != 1) {
					card.distance = { attackFrom: 1 - maxHp };
				}
				var skills = info[3].filter(function (skill) {
					var info = get.skillInfoTranslation(skill);
					if (!info.includes("【杀】")) {
						return false;
					}
					var list = get.skillCategoriesOf(skill, get.player());
					list.remove("锁定技");
					return list.length == 0;
				});
				var str = "锁定技。";
				if (skills.length) {
					card.skills.addArray(skills);
					str += "你视为拥有技能";
					for (var skill of skills) {
						str += "〖" + get.translation(skill) + "〗";
						str += "、";
					}
					str = str.slice(0, str.length - 1);
					str += "；";
					card.ai.equipValue = function (card, player) {
						let val = maxHp;
						if (player.hasSkill("qiexie")) {
							val *= 0.4;
						} else {
							val *= 0.6;
						}
						return (val += skills.length);
					};
				}
				str += "此牌离开你的装备区后，改为置入剩余武将牌牌堆。";
				lib.translate["qiexie_" + name + "_info"] = str;
				var append = "";
				if (skills.length) {
					for (var skill of skills) {
						if (lib.skill[skill].nobracket) {
							append += '<div class="skilln">' + get.translation(skill) + '</div><div><span style="font-family: yuanli">' + get.skillInfoTranslation(skill) + "</span></div><br><br>";
						} else {
							var translation = lib.translate[skill + "_ab"] || get.translation(skill).slice(0, 2);
							append += '<div class="skill">【' + translation + '】</div><div><span style="font-family: yuanli">' + get.skillInfoTranslation(skill) + "</span></div><br><br>";
						}
					}
					str = str.slice(0, str.length - 8);
				}
				lib.translate["qiexie_" + name + "_append"] = append;
				lib.card["qiexie_" + name] = card;
				game.finishCard("qiexie_" + name);
			}
		},
		subSkill: {
			destroy: {
				trigger: { player: "loseBegin" },
				equipSkill: true,
				forceDie: true,
				charlotte: true,
				forced: true,
				popup: false,
				filter(event, player) {
					return event.cards.some(card => card.name.indexOf("qiexie_") == 0);
				},
				async content(event, trigger, player) {
					for (const card of trigger.cards) {
						if (card.name.indexOf("qiexie_") == 0) {
							card._destroy = true;
							game.log(card, "被放回武将牌堆");
							const name = card.name.slice(7);
							if (player.tempname && player.tempname.includes(name)) {
								game.broadcastAll(
									(player, name) => {
										player.tempname.remove(name);
									},
									player,
									name
								);
							}
							if (lib.character[name]) {
								_status.characterlist.add(name);
							}
						}
					}
				},
			},
		},
	},
	cuijue: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("he") > 0; //&&game.hasPlayer(target=>lib.skill.cuijue.filterTarget('SB',player,target));
		},
		filterCard: true,
		filterTarget(card, player, target) {
			if (player.getStorage("cuijue_used").includes(target) || !player.inRange(target)) {
				return false;
			}
			var distance = get.distance(player, target);
			return !game.hasPlayer(current => current != target && player.inRange(current) && get.distance(player, current) > distance);
		},
		selectTarget: [0, 1],
		filterOk() {
			var player = _status.event.player;
			if (game.hasPlayer(target => lib.skill.cuijue.filterTarget("SB", player, target))) {
				return ui.selected.targets.length > 0;
			}
			return true;
		},
		position: "he",
		complexTarget: true,
		check: card => {
			var player = _status.event.player,
				goon = 0;
			try {
				ui.selected.cards.add(card);
				if (
					game.hasPlayer(target => {
						return lib.skill.cuijue.filterTarget("SB", player, target);
					})
				) {
					goon = 6;
				}
			} catch (e) {
				console.trace(e);
			}
			ui.selected.cards.remove(card);
			return goon - get.value(card);
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (target) {
				player.addTempSkill("cuijue_used", "phaseUseAfter");
				player.markAuto("cuijue_used", [target]);
				target.damage("nocard");
			}
		},
		ai: {
			order: 2,
			result: {
				target: -1.5,
			},
			tag: {
				damage: 1,
			},
		},
		subSkill: {
			used: {
				onremove: true,
				charlotte: true,
			},
		},
	},
	//神曹丕 神甄姬 OL神张辽
	caopi_xingdong: {
		audio: true,
		subSkill: {
			mark: {
				mark: true,
				marktext: "令",
				intro: {
					content: "跳过下个回合的判定阶段和摸牌阶段",
				},
			},
		},
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h", lib.skill.caopi_xingdong.filterCard) > 0;
		},
		filterCard(card) {
			return card.name == "sha" || get.type(card) == "trick";
		},
		check(card) {
			return 1;
		},
		filterTarget: lib.filter.notMe,
		discard: false,
		lose: false,
		delay: 0,
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.give(cards, target);

			let result;
			if (!target.getCards("h").includes(cards[0])) {
				result = { bool: false };
			} else {
				result = await target
					.chooseUseTarget(
						cards[0],
						game.filterPlayer(current => current !== player),
						"请使用得到的牌，或者跳过下回合的判定阶段和摸牌阶段"
					)
					.forResult();
			}
			if (result.bool) {
				await game.asyncDraw([player, target]);
				await game.delay();
			} else {
				target.addTempSkill("caopi_xingdong_mark", "phaseJudgeSkipped");
				target.skip("phaseJudge");
				target.skip("phaseDraw");
			}
		},
		ai: {
			order: 12,
			result: {
				target(player, target) {
					var card = ui.selected.cards[0];
					if (target.hasSkill("pingkou")) {
						return 1;
					}
					if (!card) {
						return 0;
					}
					var info = get.info(card);
					if (info.selectTarget == -1) {
						var eff = 0;
						game.countPlayer(function (current) {
							if (current != player && target.canUse(card, current)) {
								eff += get.effect(current, card, target, target) > 0;
							}
						});
						if (eff > 0 || get.value(card) < 3) {
							return eff;
						}
						return 0;
					} else if (
						game.hasPlayer(function (current) {
							return current != player && target.canUse(card, current) && get.effect(current, card, target, target) > 0;
						})
					) {
						return 1.5;
					} else if (get.value(card) < 3) {
						return -1;
					}
					return 0;
				},
			},
		},
	},
};
