import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createOnlineCharacterSelection() {
	return {
		/**
		 * @this {Game}
		 */
		chooseCharacterOL() {
			if (_status.mode === "purple") {
				game.chooseCharacterPurpleOL();
				return;
			} else if (_status.mode === "stratagem") {
				game.chooseCharacterStratagemOL();
				return;
			}

			const next = game.createEvent("chooseCharacter");

			/** @type { ContentFuncsByAll } */
			const contents = [
				// "step 0"
				async (event, trigger, player) => {
					ui.arena.classList.add("choose-character");
					let identityList;
					if (_status.mode === "zhong") {
						event.zhongmode = true;
						identityList = ["zhu", "zhong", "mingzhong", "nei", "fan", "fan", "fan", "fan"];
					} else {
						identityList = get.identityList(game.players.length);
					}
					identityList.randomSort();
					let playerIndex = 0;
					for (const currentPlayer of game.players) {
						const identity = identityList[playerIndex];
						playerIndex++;
						currentPlayer.identity = identity;
						currentPlayer.setIdentity("cai");
						currentPlayer.node.identity.classList.add("guessing");
						if (event.zhongmode) {
							if (identity === "mingzhong") {
								game.zhu = currentPlayer;
							} else if (identity === "zhu") {
								game.zhu2 = currentPlayer;
							}
						} else if (identity === "zhu") {
							game.zhu = currentPlayer;
						}
						currentPlayer.identityShown = false;
					}
					if (lib.configOL.special_identity && !event.zhongmode && game.players.length === 8) {
						const map: Partial<Record<"identity_zeishou" | "identity_dajiang" | "identity_junshi", Player>> = {};
						const zhongs = game.filterPlayer(current => current.identity === "zhong");
						const fans = game.filterPlayer(current => current.identity === "fan");
						if (fans.length >= 1) {
							map.identity_zeishou = fans.randomRemove();
						}
						if (zhongs.length > 1) {
							map.identity_dajiang = zhongs.randomRemove();
							map.identity_junshi = zhongs.randomRemove();
						} else if (zhongs.length === 1) {
							if (Math.random() < 0.5) {
								map.identity_dajiang = zhongs.randomRemove();
							} else {
								map.identity_junshi = zhongs.randomRemove();
							}
						}
						game.broadcastAll(
							(zhu, map) => {
								for (const identity in map) {
									map[identity].special_identity = identity;
								}
							},
							game.zhu,
							map
						);
						event.special_identity = map;
					}

					game.zhu.setIdentity();
					game.zhu.identityShown = true;
					game.zhu.isZhu = game.zhu.identity === "zhu";
					game.zhu.node.identity.classList.remove("guessing");
					game.me!.setIdentity();
					game.me!.node.identity.classList.remove("guessing");
					if (game.me!.special_identity) {
						(game.me!.node.identity.firstChild! as HTMLElement).innerHTML = get.translation(`${game.me!.special_identity}_bg`);
					}

					for (const currentPlayer of game.players) {
						currentPlayer.send(
							(zhu, zhuid, me, identity) => {
								for (const id in lib.playerOL) {
									lib.playerOL[id].setIdentity("cai");
									lib.playerOL[id].node.identity.classList.add("guessing");
								}
								zhu.identityShown = true;
								zhu.identity = zhuid;
								if (zhuid === "zhu") {
									zhu.isZhu = true;
								}
								zhu.setIdentity();
								zhu.node.identity.classList.remove("guessing");
								me.setIdentity(identity);
								me.node.identity.classList.remove("guessing");
								if (me.special_identity) {
									(me.node.identity.firstChild! as HTMLElement).innerHTML = get.translation(`${me.special_identity}_bg`);
								}
								ui.arena.classList.add("choose-character");
							},
							game.zhu,
							game.zhu.identity,
							currentPlayer,
							currentPlayer.identity
						);
					}

					let list;
					const list2: any[] = [];
					const list3: any[] = [];
					const list4: any[] = [];
					event.list = [];
					event.list2 = [];

					const libCharacter = {};
					for (const characterPack of lib.configOL.characterPack) {
						const pack = lib.characterPack[characterPack];
						for (const name in pack) {
							// if (name === "zuoci") { continue; }
							if (lib.character[name]) {
								libCharacter[name] = lib.character[name];
							}
						}
					}
					for (const name in lib.characterReplace) {
						const replacements = lib.characterReplace[name];
						for (let index = replacements.length - 1; index >= 0; index--) {
							const replacement = replacements[index];
							if (!libCharacter[replacement] || lib.filter.characterDisabled(replacement)) {
								replacements.splice(index, 1);
							}
						}
						if (!replacements.length) {
							continue;
						}
						event.list.push(name);
						event.list2.push(name);
						list4.addArray(replacements);
						let hasZhugong = false;
						for (const replacement of replacements) {
							if (libCharacter[replacement].isZhugong) {
								hasZhugong = true;
								break;
							}
						}
						(hasZhugong ? list2 : list3).push(name);
					}
					game.broadcast(availableCharacters => {
						for (const name in lib.characterReplace) {
							const replacements = lib.characterReplace[name];
							for (let index = replacements.length - 1; index >= 0; index--) {
								if (!availableCharacters.includes(replacements[index])) {
									replacements.splice(index, 1);
								}
							}
						}
					}, list4);
					for (const name in libCharacter) {
						if (list4.includes(name)) {
							continue;
						}
						if (lib.filter.characterDisabled(name, libCharacter)) {
							continue;
						}
						event.list.push(name);
						event.list2.push(name);
						list4.push(name);
						if (libCharacter[name].isZhugong) {
							list2.push(name);
						} else {
							list3.push(name);
						}
					}
					_status.characterlist = list4.slice(0);
					if (event.zhongmode) {
						list = event.list.randomGets(8);
					} else {
						const getZhuList = zhuList => {
							const limitZhu = lib.configOL.limit_zhu;
							if (!limitZhu || limitZhu === "off") {
								return zhuList.slice(0).sort(lib.sort.character);
							}
							if (limitZhu !== "group") {
								const zhuCount = parseInt(limitZhu) || 6;
								return zhuList.randomGets(zhuCount).sort(lib.sort.character);
							}
							const getGroup = name => {
								if (lib.characterReplace[name]) {
									return lib.character[lib.characterReplace[name][0]][1];
								}
								return lib.character[name][1];
							};
							const zhuListRandom = zhuList.slice(0);
							const zhuListUnique: any[] = [];
							const selectedGroups = new Set();
							zhuListRandom.randomSort();
							for (const name of zhuListRandom) {
								const group = getGroup(name);
								if (selectedGroups.has(group)) {
									continue;
								}
								selectedGroups.add(group);
								zhuListUnique.push(name);
							}
							zhuListUnique.sort(lib.sort.character);
							return zhuListUnique;
						};
						list = getZhuList(list2).concat(list3.randomGets(lib.configOL.choice_zhu));
					}
					const chooseButtonEvent = game.zhu.chooseButton(true);
					chooseButtonEvent.set("selectButton", lib.configOL.double_character ? 2 : 1);
					chooseButtonEvent.set("createDialog", ["选择角色", [list, "characterx"]]);
					chooseButtonEvent.set("ai", () => Math.random());
				},
				// "step 1"
				async (event, trigger, player, result) => {
					if (!game.zhu.name) {
						game.zhu.init(result.links[0], result.links[1]);
					}
					event.list.remove(get.sourceCharacter(game.zhu.name1!));
					event.list.remove(get.sourceCharacter(game.zhu.name2!));
					event.list2.remove(get.sourceCharacter(game.zhu.name1!));
					event.list2.remove(get.sourceCharacter(game.zhu.name2!));

					if (game.players.length > 4 && !game.zhu.isInitFilter("noZhuHp")) {
						game.zhu.maxHp!++;
						game.zhu.hp!++;
						game.zhu.update();
					}
					game.broadcast(
						(zhu, name, name2, addMaxHp) => {
							if (!zhu.name) {
								zhu.init(name, name2);
							}
							if (addMaxHp && !zhu.isInitFilter("noZhuHp")) {
								zhu.maxHp!++;
								zhu.hp!++;
								zhu.update();
							}
						},
						game.zhu,
						result.links[0],
						result.links[1],
						game.players.length > 4
					);
					const groups = get.selectGroup(game.zhu.name1, undefined);
					const type = get.selectGroup(game.zhu.name1, true);
					if (type !== "default") {
						game.zhu._groupChosen = type;
					}
					if (groups.length) {
						const groupResult = (await game.zhu
							.chooseButton(["请选择你的势力", [groups.map(group => ["", "", `group_${group}`]), "vcard"]], true)
							.set("ai", () => Math.random())
							.set("direct", true)
							.forResult()) as Result;

						const name = groupResult.links[0][2].slice(6);
						await game.zhu.changeGroup(name);
					}
				},
				// step 2
				async (event, trigger, player) => {
					const list: any[] = [];
					const selectButton = lib.configOL.double_character ? 2 : 1;

					const num = Math.floor(event.list.length / (game.players.length - 1));
					for (const currentPlayer of game.players) {
						if (currentPlayer === game.zhu) {
							continue;
						}
						const identity = currentPlayer.identity;
						let num2;
						if (event.zhongmode) {
							if (identity === "nei" || identity === "zhu") {
								num2 = 8;
							} else {
								num2 = 6;
							}
						} else {
							num2 = lib.configOL[`choice_${identity}`];
						}
						let str = "选择角色";
						if (currentPlayer.special_identity) {
							str = `选择角色（${get.translation(currentPlayer.special_identity)}）`;
						}
						list.push([currentPlayer, [str, [event.list.randomRemove(Math.min(num, num2)), "characterx"]], selectButton, true]);
					}
					game.me!.chooseButtonOL(list, (player, result) => {
						if (game.online || player === game.me) {
							player.init(result.links[0], result.links[1]);
						}
					});
				},
				// step 3
				async (event, trigger, player, result) => {
					let shen: any[] = [];
					for (const id in result) {
						if (result[id] && result[id].links) {
							for (const link of result[id].links) {
								event.list2.remove(get.sourceCharacter(link));
							}
						}
					}
					for (const id in result) {
						if (result[id] === "ai") {
							result[id] = event.list2.randomRemove(lib.configOL.double_character ? 2 : 1).map(name => {
								const listx = lib.characterReplace[name];
								if (listx && listx.length) {
									return listx.randomGet();
								}
								return name;
							});
						} else {
							result[id] = result[id].links;
						}
						if (get.selectGroup(result[id][0], undefined).length > 0) {
							shen.push(lib.playerOL[id]);
						}
					}
					event.result2 = result;
					if (shen.length) {
						shen = shen.map(currentPlayer => {
							const name = result[currentPlayer.playerid][0];
							const groups = get.selectGroup(name, undefined).map(group => ["", "", `group_${group}`]);
							const type = get.selectGroup(name, true);
							if (type !== "default") {
								currentPlayer._groupChosen = type;
							}
							return [currentPlayer, ["请选择你的势力", [groups, "vcard"]], 1, true, "direct"];
						});
						game.me!.chooseButtonOL(shen, (player, result) => {
							if (player === game.me) {
								player.changeGroup(result.links[0][2].slice(6), false, false);
							}
						})
							.set("switchToAuto", () => {
								_status.event.result = "ai";
							})
							.set("processAI", () => ({
								bool: true,
								links: [_status.event.dialog!.buttons.randomGet().link],
							}));
					} else {
						event._result = {};
					}
				},
				// step 4
				async (event, trigger, player, result) => {
					if (!result) {
						result = {};
					}
					for (const id in result) {
						if (result[id] && result[id].links) {
							result[id] = result[id].links[0][2].slice(6);
						} else if (result[id] === "ai") {
							result[id] = (() => {
								const currentPlayer = lib.playerOL[id];
								const groups = ["wei", "shu", "wu", "qun", "jin", "key"].filter(group => lib.group.includes(group));
								if (_status.mode === "zhong" || !game.zhu || !game.zhu.group) {
									return groups.randomGet();
								}
								if (["re_zhangjiao", "liubei", "re_liubei", "caocao", "re_caocao", "sunquan", "re_sunquan", "zhangjiao", "sp_zhangjiao", "caopi", "re_caopi", "liuchen", "caorui", "sunliang", "sunxiu", "sunce", "re_sunben", "ol_liushan", "re_liushan", "key_akane", "dongzhuo", "re_dongzhuo", "ol_dongzhuo", "jin_simashi", "caomao"].includes(game.zhu.name!)) {
									return game.zhu.group;
								}
								if (game.zhu.name === "yl_yuanshu") {
									if (currentPlayer.identity !== "zhong") {
										return "qun";
									}
									groups.remove("qun");
								}
								if (["sunhao", "xin_yuanshao", "re_yuanshao", "re_sunce", "ol_yuanshao", "yuanshu", "jin_simazhao", "liubian"].includes(game.zhu.name!)) {
									if (currentPlayer.identity === "zhong") {
										return game.zhu.group;
									}
									groups.remove(game.zhu.group);
								}
								return groups.randomGet();
							})();
						}
					}
					const result2 = event.result2;
					game.broadcast(
						(result, result2) => {
							for (const id in result) {
								if (!lib.playerOL[id].name) {
									lib.playerOL[id].init(result[id][0], result[id][1]);
								}
								if (result2[id] && result2[id].length) {
									lib.playerOL[id].changeGroup(result2[id], false, false);
								}
							}
							setTimeout(() => {
								ui.arena.classList.remove("choose-character");
							}, 500);
						},
						result2,
						result
					);

					for (const id in result2) {
						if (!lib.playerOL[id].name) {
							lib.playerOL[id].init(result2[id][0], result2[id][1]);
						}
						if (result[id] && result[id].length) {
							lib.playerOL[id].changeGroup(result[id], false, false);
						}
					}

					if (event.special_identity) {
						for (const specialIdentity in event.special_identity) {
							game.zhu.addSkill(specialIdentity);
						}
					}
					for (const currentPlayer of game.players) {
						_status.characterlist!.remove(currentPlayer.name);
						_status.characterlist!.remove(currentPlayer.name1);
						_status.characterlist!.remove(currentPlayer.name2);
					}
					setTimeout(() => {
						ui.arena.classList.remove("choose-character");
					}, 500);
				},
			];
			next.setContent(contents);
		},
	}.chooseCharacterOL;
}
