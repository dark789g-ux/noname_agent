import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createPurpleSelectionMethods() {
	return {
		/**
		 * @this {Game}
		 */
		chooseCharacterPurpleOL() {
			const next = game.createEvent("chooseCharacter");
			/** @type { ContentFuncsByAll } */
			const contents = [
				// step 0
				async (event, trigger, player) => {
					ui.arena.classList.add("choose-character");
				},
				// step 1
				async (event, trigger, player) => {
					const list = ["rZhu", "rZhong", "rNei", "rYe"];
					const list2 = ["bZhu", "bZhong", "bNei", "bYe"];
					list.randomSort();
					list2.randomSort();
					const identityList = list.concat(list2);

					const num = get.rand(0, 7);
					const players = game.players.slice(num).concat(game.players.slice(0, num));

					game.broadcastAll(
						/**
						 * @param { Player[] } players
						 * @param { string[] } identityList
						 * @param { string[] } list
						 */
						(players, identityList, list) => {
							_status.mode = "purple";
							if (game.online) {
								ui.arena.classList.add("choose-character");
							}
							for (const [current, identity] of Iterator.zip([players, identityList])) {
								current.node.identity.classList.add("guessing");
								current.identity = identity;
								current.setIdentity(list.includes(identity) ? "cai2" : "cai");
								if (identity == "rZhu" || identity == "bZhu") {
									game[identity] = current;
									current.setIdentity(identity);
									current.identityShown = true;
									current.node.identity.classList.remove("guessing");
								}
							}
							game.zhu = game.rZhu!;
							game.rZhu!.isZhu = true;
							game.bZhu!.isZhu = true;
							game.me!.setIdentity();
							game.me!.node.identity.classList.remove("guessing");
						},
						players,
						identityList,
						list
					);

					players.sortBySeat(game.zhu);
					for (const [i, current] of players.entries()) {
						current.seatNum = i;
					}
				},
				// step 2
				async (event, trigger, player) => {
					const map = {};
					const map_zhu = {};
					event.mapNum = {};
					const list: any[] = [];
					const libCharacter = {};
					for (const name of lib.configOL.characterPack) {
						const pack = lib.characterPack[name];
						for (const name in pack) {
							if (lib.character[name]) {
								libCharacter[name] = pack[name];
							}
						}
					}
					for (const name in libCharacter) {
						if (lib.filter.characterDisabled(name, libCharacter)) {
							continue;
						}
						if (name.indexOf("lingju") != -1 || get.is.double(name)) {
							continue;
						}
						const group = lib.character[name][1];
						if (lib.selectGroup.includes(group)) {
							continue;
						}
						if (!map[group]) {
							map[group] = [];
							list.push(group);
						}
						map[group].push(name);
						if (lib.character[name].isZhugong) {
							if (!map_zhu[group]) {
								map_zhu[group] = [];
							}
							map_zhu[group].push(name);
						}
					}
					for (const group in map) {
						if (map[group].length < 12) {
							delete map[group];
							list.remove(group);
						} else {
							event.mapNum[group] = map[group].length > 15 ? 5 : 3;
						}
					}
					list.sort((a, b) => lib.group.indexOf(a) - lib.group.indexOf(b));
					event.list = list;
					event.map = map;
					event.map_zhu = map_zhu;

					let result = (await game
						.bZhu!.chooseControl(list)
						.set("prompt", "请选择冷方武将势力")
						.set("ai", function () {
							return _status.event.choice;
						})
						.set("choice", event.list.randomGet())
						.forResult()) as Result;
					event.bZhu = result.control;
					event.list.remove(event.bZhu);

					result = (await game
						.rZhu!.chooseControl(event.list)
						.set("prompt", "请选择暖方武将的势力")
						.set("ai", function () {
							return _status.event.choice;
						})
						.set("choice", event.list.randomGet())
						.forResult()) as Result;
					event.rZhu = result.control;
				},
				// step 3
				async (event, trigger, player) => {
					const players = [game.rZhu, game.bZhu];
					const list: any[] = [];
					for (const current of players) {
						let group = event[current!.identity];
						let str = "选择角色";
						let list2 = event.map[group].randomGets(4);
						if (event.map_zhu[group]) {
							list2.addArray(event.map_zhu[group].randomGets(2));
						}
						event.map[current!.playerid!] = list2;
						list.push([current, [str, [list2, "character"]], true]);
					}
					game.me!.chooseButtonOL(list, (player, result) => {
						if (game.online || player === game.me) {
							player.init(result.links[0]);
							if (!player.isInitFilter("noZhuHp")) {
								player.hp++;
								player.maxHp++;
								player.update();
							}
						}
					});
				},
				// step 4
				async (event, trigger, player, result) => {
					for (const current in result) {
						if (result[current] === "ai" || !result[current] || !result[current].links) {
							result[current] = event.map[current].randomGet();
						} else {
							result[current] = result[current].links;
						}
						const group = lib.character[result[current][0]][1];
						event.map[group].remove(result[current][0]);
						if (!lib.playerOL[current].name) {
							lib.playerOL[current].init(result[current][0]);
						}
					}
					game.broadcast(result => {
						for (const current in result) {
							if (!lib.playerOL[current].name) {
								lib.playerOL[current].init(result[current][0], result[current][1]);
								if (!lib.playerOL[current].isInitFilter("noZhuHp")) {
									lib.playerOL[current].hp!++;
									lib.playerOL[current].maxHp!++;
									lib.playerOL[current].update();
								}
							}
						}
					}, result);

					const list: any[] = [];
					const players = game.players.slice(0);
					players.removeArray([game.rZhu!, game.bZhu!]);
					for (const current of players) {
						let group = event[current.identity.slice(0, 1) + "Zhu"];
						let str = "选择角色";
						let list2 = event.map[group].randomRemove(event.mapNum[group]);
						event.map[current.playerid!] = list2;
						list.push([current, [str, [list2, "character"]], true]);
					}
					game.me!.chooseButtonOL(list, (player, result) => {
						if (game.online || player === game.me) {
							player.init(result.links[0]);
						}
					});
				},
				// step 5
				async (event, trigger, player, result) => {
					for (const current in result) {
						if (result[current] == "ai" || !result[current] || !result[current].links) {
							result[current] = event.map[current].randomGet();
						} else {
							result[current] = result[current].links;
						}
						const group = lib.character[result[current][0]][1];
						event.map[group].remove(result[current][0]);
						if (!lib.playerOL[current].name) {
							lib.playerOL[current].init(result[current][0]);
						}
					}
					game.broadcast(result => {
						for (const current in result) {
							if (!lib.playerOL[current].name) {
								lib.playerOL[current].init(result[current][0], result[current][1]);
							}
						}
						setTimeout(() => {
							ui.arena.classList.remove("choose-character");
						}, 500);
					}, result);
					setTimeout(() => {
						ui.arena.classList.remove("choose-character");
					}, 500);
				},
			];
			next.setContent(contents);
		},

		/**
		 * @this {Game}
		 */
		chooseCharacterPurple() {
			const next = game.createEvent("chooseCharacter");
			/** @type { ContentFuncsByAll } */
			const contents = [
				// step 0
				async (event, trigger, player) => {
					ui.arena.classList.add("choose-character");
					game.no_continue_game = true;
					lib.init.onfree();
				},
				// step 1
				async (event, trigger, player) => {
					const list = ["rZhu", "rZhong", "rNei", "rYe"];
					const list2 = ["bZhu", "bZhong", "bNei", "bYe"];
					list.randomSort();
					list2.randomSort();
					const identityList = list.concat(list2);
					const num = get.rand(0, 7);

					const players = game.players.slice(num).concat(game.players.slice(0, num));
					for (const [current, identity] of Iterator.zip([players, identityList])) {
						current.node.identity.classList.add("guessing");
						current.identity = identity;
						current.setIdentity(list.includes(identity) ? "cai2" : "cai");
						if (identity === "rZhu" || identity === "bZhu") {
							game[identity] = current;
							current.setIdentity(identity);
							current.identityShown = true;
							current.node.identity.classList.remove("guessing");
						}
					}
					game.zhu = game.rZhu!;
					game.rZhu!.isZhu = true;
					game.bZhu!.isZhu = true;
					game.me!.setIdentity();
					game.me!.node.identity.classList.remove("guessing");
					players.sortBySeat(game.zhu);
					for (const [i, current] of players.entries()) {
						current.seatNum = i;
					}
				},
				// step 2
				async (event, trigger, player) => {
					const map = {};
					const map_zhu = {};
					const list: any[] = [];
					for (const charaName in lib.character) {
						if (lib.filter.characterDisabled(charaName)) {
							continue;
						}
						if (charaName.indexOf("lingju") != -1 || get.is.double(charaName)) {
							continue;
						}
						const group = lib.character[charaName][1];
						if (lib.selectGroup.includes(group)) {
							continue;
						}
						if (!map[group]) {
							map[group] = [];
							list.push(group);
						}
						map[group].push(charaName);
						if (lib.character[charaName].isZhugong) {
							if (!map_zhu[group]) {
								map_zhu[group] = [];
							}
							map_zhu[group].push(charaName);
						}
					}
					for (const group in map) {
						if (map[group].length < 12) {
							delete map[group];
							list.remove(group);
						}
					}
					list.sort((a, b) => lib.group.indexOf(a) - lib.group.indexOf(b));
					event.list = list;
					event.map = map;
					event.map_zhu = map_zhu;

					let result = (await game
						.bZhu!.chooseControl(list)
						.set("prompt", "请选择冷方武将势力")
						.set("ai", function () {
							return _status.event.choice;
						})
						.set("choice", event.list.randomGet())
						.forResult()) as Result;
					event.bZhu = result.control;
					event.list.remove(event.bZhu);

					result = (await game
						.rZhu!.chooseControl(event.list)
						.set("prompt", "请选择暖方武将的势力")
						.set("ai", function () {
							return _status.event.choice;
						})
						.set("choice", event.list.randomGet())
						.forResult()) as Result;
					event.rZhu = result.control;
				},
				// step 3
				async (event, trigger, player) => {
					if (game.me === game.rZhu || game.me === game.bZhu) {
						event.isZhu = true;
						const list = event.map[event[game.me!.identity]].randomGets(4);
						if (event.map_zhu[event[game.me!.identity]]) {
							list.addArray(event.map_zhu[event[game.me!.identity]].randomGets(2));
						}
						game.me!.chooseButton(true, ["请选择您的武将牌", [list, "character"]]);
					}
				},
				// step 4
				async (event, trigger, player, result) => {
					if (event.isZhu) {
						event.map[event[game.me!.identity]].remove(result.links[0]);
						game.me!.init(result.links[0]);
					}
					if (!game.rZhu!.name) {
						const list = event.map[event.rZhu].randomGets(3);
						if (event.map_zhu[event.rZhu]) {
							list.addArray(event.map_zhu[event.rZhu]);
						}
						const character = list.randomGet();
						event.map[event.rZhu].remove(character);
						game.rZhu!.init(character);
					}
					if (!game.bZhu!.name) {
						const list = event.map[event.bZhu].randomGets(4);
						if (event.map_zhu[event.bZhu]) {
							list.addArray(event.map_zhu[event.bZhu].randomGets(2));
						}
						const character = list.randomGet();
						event.map[event.bZhu].remove(character);
						game.bZhu!.init(character);
					}
					if (!game.rZhu!.isInitFilter("noZhuHp")) {
						game.rZhu!.maxHp!++;
						game.rZhu!.hp!++;
						game.rZhu!.update();
					}
					if (!game.bZhu!.isInitFilter("noZhuHp")) {
						game.bZhu!.maxHp!++;
						game.bZhu!.hp!++;
						game.bZhu!.update();
					}
					if (!event.isZhu) {
						let group = game.me!.identity.indexOf("r") == 0 ? event.rZhu : event.bZhu;
						game.me!.chooseButton(true, ["请选择您的武将牌", [event.map[group].randomRemove(5), "character"]]);
					}
				},
				// step 5
				async (event, trigger, player, result) => {
					if (!event.isZhu) {
						game.me!.init(result.links[0]);
					}
					for (const current of game.filterPlayer()) {
						if (!current.name) {
							const group = current.identity.indexOf("r") === 0 ? event.rZhu : event.bZhu;
							current.init(event.map[group].randomRemove(1)[0]);
						}
					}
				},
				// step 6
				async (event, trigger, player) => {
					setTimeout(() => {
						ui.arena.classList.remove("choose-character");
					}, 500);
				},
			];
			next.setContent(contents);
		},
	};
}
