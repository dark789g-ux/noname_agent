import { lib, get, ui } from "noname";
import { getRegisteredSkill } from "../../library/skillRegistry.js";
import { game } from "../index.js";

export function createVideoContentPlayerState() {
	return {
		bossSwap: function (player, name) {
			if (player && name) {
				player.delete();
				let noboss = false;
				if (name[0] == "_") {
					name = name.slice(1);
					noboss = true;
				}
				let boss = ui.create.player().init(name);
				if (!boss) {
					return;
				}
				boss.dataset.position = player.dataset.position;
				game.playerMap[player.dataset.position] = boss;
				if (game.me == player) {
					game.me = boss;
				}
				game.players.push(boss);
				game.arrangePlayers();
				if (!noboss) {
					game.boss = boss;
					boss.setIdentity("zhu");
					boss.identity = "zhu";
				} else {
					boss.setIdentity("zhong");
					boss.identity = "zhong";
				}
				ui.arena.appendChild(boss.addTempClass("zoominanim"));
			}
		},
		stoneSwap: function (info) {
			const position = info.position;
			if (typeof position != "string") {
				return;
			}
			let player = ui.create.player();
			player.classList.add("noidentity");
			player.dataset.position = position;
			player.addTempClass(info.me ? "replaceme" : "replaceenemy");
			player.actcount = info.actcount;
			player.init(info.name, info.name2);
			game.players.push(player);
			player.updateActCount(null, info.actcount, 0);
			ui.arena.appendChild(player);
			game.playerMap[position] = player;
			game.arrangePlayers();
		},
		chess_tongshuai: function (player, content) {
			if (player && player.storage) {
				player.storage.tongshuai.owned = content;
			} else {
				console.log(player);
			}
		},
		chess_tongshuai_skill: function (player, content) {
			if (player && content) {
				if (player.marks.tongshuai.firstChild) {
					player.marks.tongshuai.firstChild.remove();
				}
				player.marks.tongshuai.setBackground(content[0], "character");
				player.additionalSkills.tongshuai = content[1];
			} else {
				console.log(player);
			}
		},
		smoothAvatar: function (player, vice) {
			if (player && player.node) {
				if (vice) {
					if (player.node.avatar2) {
						player.smoothAvatar(vice);
					}
				} else {
					if (player.node.avatar) {
						player.smoothAvatar(vice);
					}
				}
			}
		},
		setAvatar: function (player, content) {
			if (player && content && content.length == 2) {
				player.setAvatar(content[0], content[1]);
			}
		},
		setAvatarQueue: function (player, content) {
			if (player && content && content.length == 2) {
				player.setAvatarQueue(content[0], content[1]);
			}
		},
		addSubPlayer: function (player, content) {
			if (player && content && content[0] && content[1] && content[2] && content[3] && content[4]) {
				let skill = content[0],
					list = content[3];
				lib.skill[skill] = content[1];
				lib.character[skill] = content[2];
				for (let i = 0; i < list.length; i++) {
					if (!list[i]) {
						continue;
					}
					lib.translate[skill + ["", "_prefix", "_ab"][i]] = list[i];
				}
				player.storage[skill] = content[4];
			}
		},
		arenaNumber: function (content) {
			ui.arena.dataset.number = content;
		},
		reinit: function (source, content) {
			if (source && content) {
				source.uninit();
				source.init(content[0]);
				source.node.identity.dataset.color = content[1];
			} else {
				console.log(source);
			}
		},
		reinit2: function (source, name) {
			if (source && name) {
				source.init(name);
			} else {
				console.log(source);
			}
		},
		reinit3: function (source, content) {
			if (source && content) {
				let info1 = lib.character[content.from];
				let info2 = lib.character[content.to];
				if (content.avatar2) {
					source.name2 = content.to;
					if (source.isUnseen(0)) {
						source.sex = info2[0];
					}
					source.node.avatar2.setBackground(content.to, "character");
					source.node.name2.innerHTML = get.slimName(content.to);
				} else {
					source.name = content.to;
					source.sex = info2[0];
					source.node.avatar.setBackground(content.to, "character");
					source.node.name.innerHTML = get.slimName(content.to);
				}
				source.maxHp = content.hp;
				this.update();
				for (let i = 0; i < info1[3].length; i++) {
					source.removeSkill(info1[3][i]);
				}
				for (let i = 0; i < info2[3].length; i++) {
					source.addSkill(info2[3][i]);
				}
			}
		},
		changeSkin: function (player: (Player & { skin: NonNullable<Player["skin"]> }) | undefined, map: { from: string; to: string; name: "name" | "name2"; list: [string, string[]][]; avatar2: boolean } | undefined) {
			if (!player || !map) {
				return;
			}
			const tempname = player.tempname;
			if (!tempname) throw new TypeError("Skin changes require initialized temporary names");
			tempname.remove(map.from);
			tempname.add(map.to);
			player.skin[map.name] = map.to;
			const goon = !lib.character[map.to];
			if (goon) {
				lib.character[map.to] = get.convertedCharacter(["", "", 0, [], (map.list.find(i => i[0] == map.to) || [map.to, []])[1]]);
			}
			player.smoothAvatar(map.avatar2);
			const skinImg = !lib.config.skin[map.to] && lib.character[map.to]?.img;
			skinImg ? player.node["avatar" + map.name.slice(4)].setBackgroundImage(skinImg) : player.node["avatar" + map.name.slice(4)].setBackground(map.to, "character");
			player.node["avatar" + map.name.slice(4)].show();
			if (goon) {
				delete lib.character[map.to];
			}
		},
		changeGroup: function (player, targetGroup) {
			if (!player || !targetGroup) {
				return;
			}
			player.group = targetGroup;
			player.node.name.dataset.nature = get.groupnature(targetGroup);
		},
		skill: function (player, content) {
			if (typeof content == "string") {
				const skill = getRegisteredSkill(lib.skill, content);
				if (skill) {
					skill.video?.(player, undefined);
				}
			} else if (Array.isArray(content)) {
				const skill = getRegisteredSkill(lib.skill, content[0]);
				if (skill) {
					skill.video?.(player, content[1]);
				}
			} else {
				console.log(player, content);
			}
		},
		addTempTag: function (content) {
			if (!lib.translate[content[0]]) {
				lib.translate[content[0]] = content[1];
			}
		},
		addFellow: function (content) {
			let player = game.addFellow(content[0], content[1], content[2]);
			const playerMap = game.playerMap;
			const position = player.dataset.position;
			const positionKey = position === undefined ? "undefined" : position;
			playerMap[positionKey] = player;
		},
		windowzoom1: function () {
			ui.window.style.transition = "all 0.5s";
			ui.window.classList.add("zoomout3");
			ui.window.hide();
		},
		windowzoom2: function () {
			ui.window.style.transition = "all 0s";
			ui.refresh(ui.window);
		},
		windowzoom3: function () {
			ui.window.classList.remove("zoomout3");
			ui.window.classList.add("zoomin3");
		},
		windowzoom4: function () {
			ui.window.style.transition = "all 0.5s";
			ui.refresh(ui.window);
			ui.window.show();
			ui.window.classList.remove("zoomin3");
		},
		windowzoom5: function () {
			ui.window.style.transition = "";
		},
		updateActCount: function (player, content) {
			if (player && content) {
				player.updateActCount(content[0], content[1], content[2]);
			} else {
				console.log(player);
			}
		},
		showIdentity: function (player, identity) {
			identity = identity || (player ? player.identity : null);
			if (player && player.identity) {
				player.showIdentity(identity);
			} else {
				console.log(player);
			}
		},
		setIdentity: function (player, identity) {
			if (player && identity) {
				player.setIdentity(identity);
			} else {
				// ?
				// console.log(num);
			}
		},
		showCharacter: function (player, num) {
			if (player && player.classList) {
				switch (num) {
					case 0:
						player.classList.remove("unseen_v");
						break;
					case 1:
						player.classList.remove("unseen2_v");
						break;
					case 2:
						player.classList.remove("unseen_v");
						player.classList.remove("unseen2_v");
						break;
				}
				if (!player.classList.contains("unseen_v") && (!player.name2 || !player.classList.contains("unseen2_v")) && player.storage.nohp) {
					delete player.storage.nohp;
					player.node.hp.show();
					player.update();
				}
			} else {
				console.log(num);
			}
		},
	};
}
