import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rehuashenSkills = {
	rehuashen: {
		unique: true,
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: ["enterGame", "phaseBegin", "phaseEnd"],
		},
		filter(event, player, name) {
			if (event.name != "phase") {
				return true;
			}
			if (name == "phaseBefore") {
				return game.phaseNumber == 0;
			}
			return player.storage.rehuashen?.character?.length > 0;
		},
		async cost(event, trigger, player) {
			if (trigger.name !== "phase" || event.triggername === "phaseBefore") {
				event.result = { bool: true, cost_data: ["替换当前化身"] };
				return;
			}
			const prompt = "###" + get.prompt(event.skill) + '###<div class="text center">替换当前化身牌或制衡至多两张其他化身牌</div>';
			const result = await player
				.chooseControl("替换当前化身", "制衡其他化身", "cancel2")
				.set("ai", () => {
					const { player, cond } = get.event();
					let skills = player.storage.rehuashen.character.map(i => get.character(i).skills).flat();
					skills.randomSort();
					skills.sort((a, b) => get.skillRank(b, cond) - get.skillRank(a, cond));
					if (skills[0] === player.storage.rehuashen.current2 || get.skillRank(skills[0], cond) < 1) {
						return "制衡其他化身";
					}
					return "替换当前化身";
				})
				.set("cond", event.triggername)
				.set("prompt", prompt)
				.forResult();
			const control = result.control;
			event.result = { bool: typeof control === "string" && control !== "cancel2", cost_data: control };
		},
		async content(event, trigger, player) {
			let choice = event.cost_data;
			if (Array.isArray(choice)) {
				lib.skill.rehuashen.addHuashens(player, 3);
				[choice] = choice;
			}
			_status.noclearcountdown = true;
			const id = lib.status.videoId++,
				prompt = choice === "替换当前化身" ? "化身：请选择你要更换的武将牌" : "化身：选择制衡至多两张武将牌";
			const cards = player.storage.rehuashen.character;
			if (player.isOnline2()) {
				player.send(
					(cards, prompt, id) => {
						const dialog = ui.create.dialog(prompt, [cards, lib.skill.rehuashen.$createButton]);
						dialog.videoId = id;
					},
					cards,
					prompt,
					id
				);
			}
			const dialog = ui.create.dialog(prompt, [cards, lib.skill.rehuashen.$createButton]);
			dialog.videoId = id;
			if (!event.isMine()) {
				dialog.style.display = "none";
			}
			if (choice === "替换当前化身") {
				const buttons = dialog.content.querySelector(".buttons");
				const array = dialog.buttons.filter(item => !item.classList.contains("nodisplay") && item.style.display !== "none");
				const choosed = player.storage.rehuashen.choosed;
				const groups = array
					.map(i => get.character(i.link).group)
					.unique()
					.sort((a, b) => {
						const getNum = g => (lib.group.includes(g) ? lib.group.indexOf(g) : lib.group.length);
						return getNum(a) - getNum(b);
					});
				if (choosed.length > 0 || groups.length > 1) {
					dialog.style.bottom = (parseInt(dialog.style.top || "0", 10) + get.is.phoneLayout() ? 230 : 220) + "px";
					dialog.addPagination({
						data: array,
						totalPageCount: groups.length + Math.sign(choosed.length),
						container: dialog.content,
						insertAfter: buttons,
						onPageChange(state) {
							const { pageNumber, data, pageElement } = state;
							const { groups, choosed } = pageElement;
							data.forEach(item => {
								item.classList[
									(() => {
										const name = item.link,
											goon = choosed.length > 0;
										if (goon && pageNumber === 1) {
											return choosed.includes(name);
										}
										const group = get.character(name).group;
										return groups.indexOf(group) + (1 + goon) === pageNumber;
									})()
										? "remove"
										: "add"
								]("nodisplay");
							});
							ui.update();
						},
						pageLimitForCN: ["←", "→"],
						pageNumberForCN: (choosed.length > 0 ? ["常用"] : []).concat(
							groups.map(i => {
								const isChineseChar = char => {
									const regex = /[\u4e00-\u9fff\u3400-\u4dbf\ud840-\ud86f\udc00-\udfff\ud870-\ud87f\udc00-\udfff\ud880-\ud88f\udc00-\udfff\ud890-\ud8af\udc00-\udfff\ud8b0-\ud8bf\udc00-\udfff\ud8c0-\ud8df\udc00-\udfff\ud8e0-\ud8ff\udc00-\udfff\ud900-\ud91f\udc00-\udfff\ud920-\ud93f\udc00-\udfff\ud940-\ud97f\udc00-\udfff\ud980-\ud9bf\udc00-\udfff\ud9c0-\ud9ff\udc00-\udfff]/u;
									return regex.test(char);
								}; //友情提醒：regex为基本汉字区间到扩展G区的Unicode范围的正则表达式，非加密/混淆
								const str = get.plainText(lib.translate[i + "2"] || lib.translate[i] || "无");
								return isChineseChar(str.slice(0, 1)) ? str.slice(0, 1) : str;
							})
						),
						changePageEvent: "click",
						pageElement: {
							groups: groups,
							choosed: choosed,
						},
					});
				}
			}
			const finish = () => {
				if (player.isOnline2()) {
					player.send("closeDialog", id);
				}
				dialog.close();
				delete _status.noclearcountdown;
				if (!_status.noclearcountdown) {
					game.stopCountChoose();
				}
			};
			while (true) {
				const next = player.chooseButton(true).set("dialog", id);
				if (choice === "制衡其他化身") {
					next.set("selectButton", [1, 2]);
					next.set("filterButton", button => button.link !== get.event().current);
					next.set("current", player.storage.rehuashen.current);
				} else {
					next.set("ai", button => {
						const { player, cond } = get.event();
						let skills = player.storage.rehuashen.character.map(i => get.character(i).skills).flat();
						skills.randomSort();
						skills.sort((a, b) => get.skillRank(b, cond) - get.skillRank(a, cond));
						return player.storage.rehuashen.map[button.link].includes(skills[0]) ? 2.5 : 1 + Math.random();
					});
					next.set("cond", event.triggername);
				}
				const result = await next.forResult();
				if (choice === "制衡其他化身") {
					finish();
					lib.skill.rehuashen.removeHuashen(player, result.links);
					lib.skill.rehuashen.addHuashens(player, result.links.length);
					return;
				} else {
					const card = result.links[0];
					const func = function (card, id) {
						const dialog = get.idDialog(id);
						if (dialog) {
							//禁止翻页
							const paginationInstance = dialog.paginationMap?.get(dialog.content.querySelector(".buttons"));
							if (paginationInstance?.state) {
								paginationInstance.state.pageRefuseChanged = true;
							}
							for (let i = 0; i < dialog.buttons.length; i++) {
								if (dialog.buttons[i].link == card) {
									dialog.buttons[i].classList.add("selectedx");
								} else {
									dialog.buttons[i].classList.add("unselectable");
								}
							}
						}
					};
					if (player.isOnline2()) {
						player.send(func, card, id);
					} else if (event.isMine()) {
						func(card, id);
					}
					const result2 = await player
						.chooseControl(player.storage.rehuashen.map[card], "返回")
						.set("ai", () => {
							const { player, cond, controls } = get.event();
							let skills = controls.slice();
							skills.randomSort();
							skills.sort((a, b) => get.skillRank(b, cond) - get.skillRank(a, cond));
							return skills[0];
						})
						.set("cond", event.triggername)
						.forResult();
					const control = result2.control;
					if (control === "返回") {
						const func2 = function (card, id) {
							const dialog = get.idDialog(id);
							if (dialog) {
								//允许翻页
								const paginationInstance = dialog.paginationMap?.get(dialog.content.querySelector(".buttons"));
								if (paginationInstance?.state) {
									paginationInstance.state.pageRefuseChanged = false;
								}
								for (let i = 0; i < dialog.buttons.length; i++) {
									dialog.buttons[i].classList.remove("selectedx");
									dialog.buttons[i].classList.remove("unselectable");
								}
							}
						};
						if (player.isOnline2()) {
							player.send(func2, card, id);
						} else if (event.isMine()) {
							func2(card, id);
						}
					} else {
						finish();
						player.storage.rehuashen.choosed.add(card);
						if (player.storage.rehuashen.current != card) {
							const old = player.storage.rehuashen.current;
							player.storage.rehuashen.current = card;
							game.broadcastAll(
								(player, character, old) => {
									player.tempname.remove(old);
									player.tempname.add(character);
									player.sex = lib.character[character][0];
								},
								player,
								card,
								old
							);
							game.log(player, "将性别变为了", "#y" + get.translation(get.character(card).sex) + "性");
							player.changeGroup(get.character(card).group);
						}
						player.storage.rehuashen.current2 = control;
						if (!player.additionalSkills.rehuashen?.includes(control)) {
							player.flashAvatar("rehuashen", card);
							player.syncStorage("rehuashen");
							player.updateMarks("rehuashen");
							await player.addAdditionalSkills("rehuashen", control);
							// lib.skill.rehuashen.createAudio(card,link,'re_zuoci');
						}
						return;
					}
				}
			}
		},
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = {
					character: [],
					choosed: [],
					map: {},
				};
			}
		},
		banned: ["lisu", "sp_xiahoudun", "xushao", "jsrg_xushao", "zhoutai", "old_zhoutai", "shixie", "xin_zhoutai", "dc_shixie", "old_shixie"],
		bannedType: ["Charlotte", "主公技", "觉醒技", "限定技", "隐匿技", "使命技"],
		addHuashen(player) {
			if (!player.storage.rehuashen) {
				return;
			}
			if (!_status.characterlist) {
				game.initCharacterList();
			}
			_status.characterlist.randomSort();
			for (let i = 0; i < _status.characterlist.length; i++) {
				let name = _status.characterlist[i];
				if (name.indexOf("zuoci") != -1 || name.indexOf("key_") == 0 || name.indexOf("sp_key_") == 0 || get.is.double(name) || lib.skill.rehuashen.banned.includes(name) || player.storage.rehuashen.character.includes(name)) {
					continue;
				}
				let skills = lib.character[name][3].filter(skill => {
					const categories = get.skillCategoriesOf(skill, player);
					return !categories.some(type => lib.skill.rehuashen.bannedType.includes(type));
				});
				if (skills.length) {
					player.storage.rehuashen.character.push(name);
					player.storage.rehuashen.map[name] = skills;
					_status.characterlist.remove(name);
					return name;
				}
			}
		},
		addHuashens(player, num) {
			var list = [];
			for (var i = 0; i < num; i++) {
				var name = lib.skill.rehuashen.addHuashen(player);
				if (name) {
					list.push(name);
				}
			}
			if (list.length) {
				player.syncStorage("rehuashen");
				player.updateMarks("rehuashen");
				game.log(player, "获得了", get.cnNumber(list.length) + "张", "#g化身");
				lib.skill.rehuashen.drawCharacter(player, list);
			}
		},
		removeHuashen(player, links) {
			player.storage.rehuashen.character.removeArray(links);
			_status.characterlist.addArray(links);
			game.log(player, "移去了", get.cnNumber(links.length) + "张", "#g化身");
		},
		drawCharacter(player, list) {
			game.broadcastAll(
				function (player, list) {
					if (player.isUnderControl(true)) {
						var cards = [];
						for (var i = 0; i < list.length; i++) {
							var cardname = "huashen_card_" + list[i];
							lib.card[cardname] = {
								fullimage: true,
								image: "character:" + list[i],
							};
							lib.translate[cardname] = get.rawName2(list[i]);
							cards.push(game.createCard(cardname, "", ""));
						}
						player.$draw(cards, "nobroadcast");
					}
				},
				player,
				list
			);
		},
		$createButton(item, type, position, noclick, node) {
			node = ui.create.buttonPresets.character(item, "character", position, noclick);
			const info = lib.character[item];
			const skills = info[3].filter(function (skill) {
				const categories = get.skillCategoriesOf(skill, get.player());
				return !categories.some(type => lib.skill.rehuashen.bannedType.includes(type));
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
					capt += `&nbsp;&nbsp;${get.translation(characterInfo.sex)}`;
					let charactergroup;
					const charactergroups = get.is.double(character, true);
					if (charactergroups) {
						charactergroup = charactergroups.map(i => get.translation(i)).join("/");
					} else {
						charactergroup = get.translation(characterInfo.group);
					}
					capt += `&nbsp;&nbsp;${charactergroup}`;
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
		// createAudio:(character,skillx,name)=>{
		// 	var skills=game.expandSkills([skillx]);
		// 	skills=skills.filter(skill=>get.info(skill));
		// 	if(!skills.length) return;
		// 	var skillss=skills.filter(skill=>get.info(skill).derivation);
		// 	if(skillss.length){
		// 		skillss.forEach(skill=>{
		// 			var derivationSkill=get.info(skill).derivation;
		// 			skills[Array.isArray(derivationSkill)?'addArray':'add'](derivationSkill);
		// 		});
		// 	}
		// 	skills.forEach(skill=>{
		// 		var info=lib.skill[skill];
		// 		if(info){
		// 			if(!info.audioname2) info.audioname2={};
		// 			if(info.audioname&&info.audioname.includes(character)){
		// 				if(info.audio){
		// 					if(typeof info.audio=='string') skill=info.audio;
		// 					if(Array.isArray(info.audio)) skill=info.audio[0];
		// 				}
		// 				if(!lib.skill[skill+'_'+character]) lib.skill[skill+'_'+character]={audio:2};
		// 				info.audioname2[name]=(skill+'_'+character);
		// 			}
		// 			else if(info.audioname2[character]){
		// 				info.audioname2[name]=info.audioname2[character];
		// 			}
		// 			else{
		// 				if(info.audio){
		// 					if(typeof info.audio=='string') skill=info.audio;
		// 					if(Array.isArray(info.audio)) skill=info.audio[0];
		// 				}
		// 				info.audioname2[name]=skill;
		// 			}
		// 		}
		// 	});
		// },
		mark: true,
		intro: {
			onunmark(storage, player) {
				_status.characterlist.addArray(storage.character);
				storage.character = [];
				const name = player.name ? player.name : player.name1;
				if (name) {
					const sex = get.character(name).sex;
					const group = get.character(name).group;
					if (player.sex !== sex) {
						game.broadcastAll(
							(player, sex) => {
								player.sex = sex;
							},
							player,
							sex
						);
						game.log(player, "将性别变为了", "#y" + get.translation(sex) + "性");
					}
					if (player.group !== group) {
						game.broadcastAll(
							(player, group) => {
								player.group = group;
								player.node.name.dataset.nature = get.groupnature(group);
							},
							player,
							group
						);
						game.log(player, "将势力变为了", "#y" + get.translation(group + 2));
					}
				}
			},
			mark(dialog, storage, player) {
				if (storage && storage.current) {
					dialog.addSmall([[storage.current], (item, type, position, noclick, node) => lib.skill.rehuashen.$createButton(item, type, position, noclick, node)]);
				}
				if (storage && storage.current2) {
					dialog.add('<div><div class="skill">【' + get.translation(lib.translate[storage.current2 + "_ab"] || get.translation(storage.current2).slice(0, 2)) + "】</div><div>" + get.skillInfoTranslation(storage.current2, player, false) + "</div></div>");
				}
				if (storage && storage.character.length) {
					if (player.isUnderControl(true)) {
						dialog.addSmall([storage.character, (item, type, position, noclick, node) => lib.skill.rehuashen.$createButton(item, type, position, noclick, node)]);
					} else {
						dialog.addText("共有" + get.cnNumber(storage.character.length) + "张“化身”");
					}
				} else {
					return "没有化身";
				}
			},
			content(storage, player) {
				return "共有" + get.cnNumber(storage.character.length) + "张“化身”";
			},
			markcount(storage, player) {
				if (storage && storage.character) {
					return storage.character.length;
				}
				return 0;
			},
		},
	},
	rexinsheng: {
		inherit: "xinsheng",
		async content(event, trigger, player) {
			lib.skill.rehuashen.addHuashens(player, 1);
		},
		ai: { combo: "rehuashen" },
	},
};
