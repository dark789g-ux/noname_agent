import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dclieqiong">} */
export const groupSkills = {
	//神黄忠
	//丁真神将，赤矢神将，爆头神将，吃人神将
	dclieqiong: {
		audio: 2,
		trigger: { source: "damageSource" },
		filter(event, player) {
			return event.player.isIn() && event.source != event.player;
		},
		frequent: true,
		logTarget: "player",
		prompt2: (event, player) => "击伤其一个部位",
		async cost(event, trigger, player) {
			const target = trigger.player;
			let places = lib.skill["dclieqiong"].derivation.slice();
			if (target.hasSex("male")) {
				places.push("dclieqiong_place8");
			}
			places = places.filter(i => {
				let storage = target.getStorage("dclieqiong_injury");
				if (!storage.length && i == "dclieqiong_place1") {
					return false;
				}
				return true;
			});
			if (!places.length) {
				return;
			}
			//射击部位-by 鸽子
			await Promise.all(event.next);
			event.videoId = lib.status.videoId++;
			if (player.isUnderControl()) {
				game.swapPlayerAuto(player);
			}
			const switchToAuto = function () {
				_status.imchoosing = false;
				if (event.dialog) {
					event.dialog.close();
				}
				if (event.control) {
					event.control.close();
				}
				game.resume();
				return Promise.resolve({
					bool: true,
					hurt: places.randomGet(),
				});
			};
			const chooseButton = (places, target) => {
				const { promise, resolve } = Promise.withResolvers();
				const event = _status.event;
				event.switchToAuto = function () {
					_status.imchoosing = false;
					resolve({
						bool: true,
						hurt: places.randomGet(),
					});
					if (event.dialog) {
						event.dialog.close();
					}
					if (event.control) {
						event.control.close();
					}
					if (event.control2) {
						event.control2.close();
					}
				};
				event.control = ui.create.control("cancel2", function (link) {
					event.dialog.close();
					event.control.close();
					if (event.control2) {
						event.control2.close();
					}
					game.resume();
					_status.imchoosing = false;
					event._result = { bool: false };
					resolve(event._result);
				});
				event.control2 = ui.create.control("ok", function (link) {
					event.dialog.close();
					event.control.close();
					event.control2.close();
					game.resume();
					_status.imchoosing = false;
					resolve(event._result);
				});
				event.control2.close();
				const dialog = ui.create.dialog("forcebutton", "hidden");
				event.dialog = dialog;
				//白底大图不加textPrompt了
				dialog.textPrompt = dialog.add('<div class="text center">裂穹：是否击伤' + get.translation(target) + "的一个部位？</div>");
				dialog.style.display = "flex";
				dialog.style.justifyContent = "center";
				dialog.style.alignItems = "center";
				dialog.style.position = "relative";
				dialog.style.width = "100%";
				dialog.style.height = "100%";
				dialog.id = "dclieqiong";
				dialog.classList.add("fixed");
				dialog.classList.add("scroll1");
				dialog.classList.add("scroll2");
				dialog.classList.add("center");
				dialog.classList.add("scroll3");
				dialog.classList.add("fullwidth");
				dialog.classList.add("fullheight");
				const target_img = document.createElement("div");
				const position = lib.skill["dclieqiong"].derivation.slice();
				if (target.hasSex("male")) {
					position.push("dclieqiong_place8");
				}
				target_img.style.width = "50%";
				target_img.style.height = "100%";
				target_img.style.position = "relative";
				target_img.style.overflow = "visible";
				target_img.style.boxSizing = "border-box";
				target_img.style.border = "1px solid black";
				target_img.style.backgroundColor = "rgb(255,178,102,0.5)";
				dialog.appendChild(target_img);
				target_img.style.backgroundImage = "url(" + lib.assetURL + "image/card/yiwu_" + (target.hasSex("male") ? "male" : "female") + ".png)";
				target_img.style.backgroundSize = "cover";
				target_img.style.backgroundRepeat = "no-repeat";
				target_img.style.backgroundSize = "contain";
				target_img.style.backgroundRepeat = "no-repeat";
				target_img.style.backgroundPosition = "center center";
				const number = target.hasSex("male")
					? [
							["7", "1"],
							//["5", "3"],
							//["4", "7"],
							["9", "5"],
							["9", "13"],
							["7", "3"],
							["7", "6"],
							["7", "8"],
						]
					: [
							["7", "1"],
							//["8", "3"],
							//["4", "7"],
							["9", "5"],
							["9", "13"],
							["6", "3"],
							["6", "6"],
						];
				let list = [];
				for (let i = 0; i < position.length; i++) {
					const num_px = document.createElement("div");
					num_px.classList.add("nodeintro");
					num_px.nodeTitle = get.translation(position[i]);
					num_px.nodeContent = get.skillInfoTranslation(position[i], null, false);
					num_px.style.width = "15%";
					num_px.style.height = "15%";
					num_px.id = position[i];
					num_px.style.position = "absolute";
					num_px.style.left = `${number[i][0] * 6}%`;
					num_px.style.top = `${number[i][1] * 6}%`;
					num_px.style.boxSizing = "border-box";
					num_px.style.backgroundImage = "url(" + lib.assetURL + "image/card/yiwu_click.png)";
					num_px.style.backgroundSize = "cover";
					num_px.style.backgroundRepeat = "no-repeat";
					num_px.style.backgroundSize = "contain";
					num_px.style.backgroundRepeat = "no-repeat";
					num_px.style.backgroundPosition = "center center";
					num_px.addEventListener(lib.config.touchscreen ? "touchend" : "click", a => {
						let hurt = event._result?.position;
						event._result = {
							bool: true,
							hurt: a.target.id,
							position: a.target,
						};
						let bool = true;
						if (hurt) {
							hurt.style.backgroundImage = "url(" + lib.assetURL + "image/card/yiwu_click.png)";
							if (hurt == a.target) {
								event._result = { bool: false };
								if (event.control2) {
									event.control2.close();
								}
								if (event.control) {
									event.control.open();
								}
								bool = false;
							}
						}
						if (bool) {
							a.target.style.backgroundImage = "url(" + lib.assetURL + "image/card/yiwu_click_chosen.png)";
							if (event.control) {
								event.control.close();
							}
							if (!lib.config.autoskilllist.includes("dclieqiong")) {
								event.dialog.close();
								game.resume();
								_status.imchoosing = false;
								resolve(event._result);
							} else if (event.control2) {
								event.control2.open();
							}
						}
					});
					if (!lib.config.touchscreen) {
						if (lib.config.hover_all) {
							lib.setHover(num_px, ui.click.hoverplayer);
						}
						if (lib.config.right_info) {
							num_px.oncontextmenu = ui.click.rightplayer;
						}
					}
					list.push(num_px);
				}
				const selectedList = list.filter(i => places.includes(i.id));
				for (const i of selectedList) {
					target_img.appendChild(i);
				}
				dialog.open();
				game.pause();
				game.countChoose();
				return promise;
			};
			let next;
			if (event.isMine()) {
				next = chooseButton(places, target);
			} else if (event.isOnline()) {
				const { promise, resolve } = Promise.withResolvers();
				event.player.send(chooseButton, places, target);
				event.player.wait(async result => {
					if (result == "ai") {
						result = await switchToAuto();
					}
					resolve(result);
				});
				game.pause();
				next = promise;
			} else {
				next = switchToAuto();
			}
			const result = await next;
			if (event.control2) {
				event.control2.close();
			}
			game.resume();
			event.result = {
				bool: result.bool,
				targets: [target],
				cost_data: result.hurt,
			};
			event.result.targets = [target];
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const place = event.cost_data;
			player.popup(place, "fire");
			game.log(player, "击伤了", target, "的", "#y" + get.translation(place));
			target.addTempSkill("dclieqiong_injury");
			target.markAuto("dclieqiong_injury", [place]);
			switch (parseInt(place.slice("dclieqiong_place".length))) {
				case 1:
					if (target.getHp() > 0) {
						await target.loseHp(target.getHp());
						if (
							game.getGlobalHistory("everything", evt => {
								if (evt.name != "die" || evt.player != target) {
									return false;
								}
								return evt.reason?.getParent() == event;
							}).length > 0
						) {
							await player.gainMaxHp();
						}
					}
					break;
				case 2: {
					const cards = target.getEquips(1).slice().concat(target.getEquips("equip3_4"));
					if (cards.length) {
						await target.modedDiscard(cards, player);
					}
					break;
				}
				case 3:
					target.addTempSkill("dclieqiong_maxhand", { player: "phaseEnd" });
					break;
				case 4: {
					const cardx = target.getDiscardableCards(target, "h");
					const num = Math.ceil(cardx.length / 2);
					if (cardx.length) {
						await target.discard(cardx.randomGets(num));
					}
					break;
				}
				case 5:
					target.addTempSkill("dclieqiong_damage", { player: "phaseEnd" });
					break;
				case 6:
					target.addTempSkill("dclieqiong_use", { player: "phaseEnd" });
					break;
				case 7:
					target.addTempSkill("dclieqiong_respond", { player: "phaseEnd" });
					break;
				case 8: {
					game.broadcastAll(
						(player, sex) => {
							player.sex = sex;
						},
						target,
						"female"
					);
					game.log(target, "将性别变为了", "#y女性");
					const nvzhuang = get.cardPile("nvzhuang") || game.createCard("nvzhuang", "diamond", 6);
					await game.delayx();
					if (target.canEquip(nvzhuang, true)) {
						await target.equip(nvzhuang);
					}
					await target.gainMaxHp();
					break;
				}
			}
		},
		marktext: "赤",
		intro: { content: "mark" },
		// frequent: true,
		derivation: ["dclieqiong_place1", "dclieqiong_place4", "dclieqiong_place5", "dclieqiong_place6", "dclieqiong_place7"],
		subSkill: {
			injury: {
				charlotte: true,
				onremove: true,
			},
			maxhand: {
				charlotte: true,
				mark: true,
				marktext: "伤",
				intro: {
					name: "中伤 - 手部",
					content: "手牌上限变为原来的一半（向下取整）",
				},
				mod: {
					maxHandcard(player, num) {
						if (_status["dclieqiong_maxhand"]) {
							return;
						}
						_status["dclieqiong_maxhand"] = true;
						const numx = player.getHandcardLimit();
						delete _status["dclieqiong_maxhand"];
						return num - Math.ceil(numx);
					},
				},
			},
			damage: {
				charlotte: true,
				mark: true,
				marktext: "伤",
				intro: {
					name: "中伤 - 地机",
					content: "下次受到的伤害+1",
				},
				trigger: { player: "damageBegin2" },
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					trigger.num++;
					player.removeSkill(event.name);
				},
			},
			use: {
				charlotte: true,
				forced: true,
				mark: true,
				marktext: "伤",
				intro: {
					name: "中伤 - 中枢",
					content: (_, player) => (_status.currentPhase === player ? "" : "下回合") + "使用的下一张牌无效",
				},
				trigger: {
					player: "useCard",
				},
				async content(event, trigger, player) {
					trigger.all_excluded = true;
					trigger.targets.length = 0;
					player.removeSkill("dclieqiong_use");
				},
			},
			respond: {
				charlotte: true,
				mark: true,
				marktext: "伤",
				intro: {
					name: "中伤 - 气海",
					content: (_, player) => "不能使用或打出红桃牌",
				},
				mod: {
					cardEnabled(card) {
						if (get.suit(card) == "heart") {
							return false;
						}
					},
					cardSavable(card) {
						if (get.suit(card) == "heart") {
							return false;
						}
					},
					cardRespondable(card) {
						if (get.suit(card) == "heart") {
							return false;
						}
					},
				},
			},
		},
	},
};
