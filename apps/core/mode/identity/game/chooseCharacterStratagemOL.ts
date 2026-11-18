import html from "dedent";
import { createChooseCharacter } from "../choose/chooseCharacter.js";
import { createOnlineCharacterSelection } from "../choose/chooseCharacterOL.js";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createCharacterSelectionMethods() {
	return {
		/**
		 * @this {Game}
		 */
		chooseCharacterStratagemOL() {
			const next = game.createEvent("chooseCharacter");
			/** @type { ContentFuncsByAll } */
			const contents = [
				// step 0
				async (event, trigger, player) => {
					ui.arena.classList.add("choose-character");

					const identityList = get.identityList(game.players.length);
					if (lib.configOL.double_nei) {
						switch (lib.configOL.number) {
							case 8:
								identityList.remove("fan");
								identityList.push("nei");
								break;
							case 7:
								identityList.remove("zhong");
								identityList.push("nei");
								break;
							case 6:
								identityList.remove("fan");
								identityList.push("nei");
								break;
							case 5:
								identityList.remove("fan");
								identityList.push("nei");
								break;
							case 4:
								identityList.remove("zhong");
								identityList.push("nei");
								break;
							case 3:
								identityList.remove("fan");
								identityList.push("nei");
								break;
						}
					}
					identityList.randomSort();
					for (const [current, identity] of Iterator.zip([game.players, identityList])) {
						current.identity = identity;
						current.setIdentity("cai");
						current.node.identity.classList.add("guessing");
						if (identity === "zhu") {
							game.zhu = current;
						}
						current.identityShown = false;
					}
					game.me!.setIdentity();
					game.me!.node.identity.classList.remove("guessing");

					for (const current of game.players) {
						current.send(
							(zhu, zhuid, me, identity) => {
								for (let i in lib.playerOL) {
									lib.playerOL[i].setIdentity("cai");
									lib.playerOL[i].node.identity.classList.add("guessing");
								}
								zhu.identity = zhuid;
								if (zhuid == "zhu") {
									zhu.isZhu = true;
								}
								me.node.identity.classList.remove("guessing");
								ui.arena.classList.add("choose-character");
							},
							game.zhu,
							game.zhu.identity,
							current,
							current.identity
						);
					}

					const characters: any[] = [];
					event.list = [];
					event.list2 = [];

					const libCharacter = {};
					for (const name of lib.configOL.characterPack) {
						const pack = lib.characterPack[name];
						for (const item in pack) {
							if (lib.character[item]) {
								libCharacter[item] = pack[item];
							}
						}
					}
					for (const name in lib.characterReplace) {
						const names = lib.characterReplace[name];
						for (let j = 0; j < names.length; ++j) {
							if (!libCharacter[names[j]] || lib.filter.characterDisabled(names[j])) {
								names.splice(j--, 1);
							}
						}
						if (names.length) {
							event.list.push(name);
							event.list2.push(name);
							characters.addArray(names);
						}
					}
					game.broadcast(list => {
						for (const name in lib.characterReplace) {
							const names = lib.characterReplace[name];
							for (let j = 0; j < names.length; ++j) {
								if (!list.includes(names[j])) {
									names.splice(j--, 1);
								}
							}
						}
					}, characters);
					for (const name in libCharacter) {
						if (characters.includes(name)) {
							continue;
						}
						if (lib.filter.characterDisabled(name, libCharacter)) {
							continue;
						}
						event.list.push(name);
						event.list2.push(name);
						characters.push(name);
					}
					_status.characterlist = characters.slice(0);
				},
				// step 1
				async (event, trigger, player) => {
					const list: any[] = [];

					const num = Math.floor(event.list.length / (game.players.length - 1));
					const selectButton = lib.configOL.double_character ? 2 : 1;
					for (const current of game.players) {
						const num2 = lib.configOL["choice_" + current.identity];
						const str = "选择角色";
						list.push([current, [str, [event.list.randomRemove(Math.min(num, num2)), "characterx"]], selectButton, true]);
					}

					/** @type { Record<string, Partial<Result>> } */
					const rawResult = (await game
						.me!.chooseButtonOL(list, function (player, result) {
							if (game.online || player == game.me) {
								player.init(result.links[0], result.links[1]);
							}
						})
						.forResult()) as Record<string, Result | "ai">;
					// The wire map is rewritten in place into character lists.
					const result = rawResult as unknown as Record<string, string[]>;

					const shen: any[] = [];
					for (const id in result) {
						if (rawResult[id] && (rawResult[id] as Result).links) {
							for (const character of (rawResult[id] as Result).links) {
								event.list2.remove(get.sourceCharacter(character));
							}
						}
					}
					for (const id in result) {
						if (rawResult[id] === "ai") {
							result[id] = event.list2.randomRemove(lib.configOL.double_character ? 2 : 1);
							for (let j = 0; j < result[id].length; j++) {
								const listx = lib.characterReplace[result[id][j]];
								if (listx && listx.length) {
									result[id][j] = listx.randomGet();
								}
							}
						} else {
							result[id] = (rawResult[id] as Result).links;
						}
						if (get.selectGroup(result[id][0], undefined).length > 1) {
							shen.push(lib.playerOL[id]);
						}
					}
					event.result2 = result;

					if (shen.length) {
						for (let i = 0; i < shen.length; i++) {
							const name = result[shen[i].playerid][0];
							const groups = get.selectGroup(name, undefined).map(group => ["", "", `group_${group}`]);
							const type = get.selectGroup(name, true);
							shen[i]._groupChosen = type;
							shen[i] = [shen[i], ["请选择你的势力", [groups, "vcard"]], 1, true];
						}
						game.me!.chooseButtonOL(shen, (player, result) => {
							if (player === game.me) {
								player.changeGroup(result.links[0][2].slice(6), false, false);
							}
						})
							.set("switchToAuto", () => {
								_status.event.result = "ai";
							})
							.set("processAI", () => {
								return {
									bool: true,
									links: [_status.event.dialog!.buttons.randomGet().link],
								};
							});
					} else {
						event._result = {};
					}
				},
				// step 2
				async (event, trigger, player, result) => {
					if (!result) {
						result = {};
					}
					for (const id in result) {
						if (result[id] && result[id].links) {
							result[id] = result[id].links[0][2].slice(6);
						} else if (result[id] === "ai") {
							result[id] = ["wei", "shu", "wu", "qun", "jin", "key"].randomGet();
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

					for (let i = 0; i < game.players.length; i++) {
						_status.characterlist!.remove(game.players[i].name);
						_status.characterlist!.remove(game.players[i].name1);
						_status.characterlist!.remove(game.players[i].name2);
					}

					["stratagem_gain", "stratagem_insight", "stratagem_expose"].forEach(globalSkill => game.addGlobalSkill(globalSkill));
					game.players.forEach(current => {
						current.storage.zhibi = [];
						current.storage.stratagem_expose = [];
						current.markSkill("stratagem_fury");
					});

					setTimeout(() => {
						ui.arena.classList.remove("choose-character");
					}, 500);
				},
			];
			next.setContent(contents);
		},
		chooseCharacter: createChooseCharacter(),
		chooseCharacterOL: createOnlineCharacterSelection(),

		stratagemCamouflage() {
			const next = game.createEvent("stratagemCamouflage");
			next.players = game.players.slice();
			if (_status.connectMode) {
				next.setContent("stratagemCamouflageOL");
			} else {
				next.setContent("stratagemCamouflage");
			}
			return next;
		},
	};
}
