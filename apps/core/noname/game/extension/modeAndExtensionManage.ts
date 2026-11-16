import { _status, lib, get, ui } from "noname";
import { getRegisteredSkill } from "../../library/skillRegistry.js";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const modeAndExtensionManageMethods = {
	addMode(this: Game, name: string, info: any, info2: { translate: string; config: { [key: string]: object }; extension?: string }) {
		lib.config.all.mode.push(name);
		lib.translate[name] = info2.translate;
		let imgsrc: string;
		const extname = String(_status.extension || info2.extension);
		if (info.splash) {
			imgsrc = info.splash;
		} else if (_status.evaluatingExtension) {
			imgsrc = "extension-" + extname + ":" + name + ".jpg";
		} else {
			imgsrc = "ext:" + extname + "/" + name + ".jpg";
		}
		lib.mode[name] = {
			name: info2.translate,
			config: info2.config,
			splash: imgsrc,
			fromextension: true,
		};
		lib.init["setMode_" + name] = async () => {
			await game.import("mode", () => {
				info.name = name;
				return info;
			});
		};
		if (!lib.config.extensionInfo[extname]) {
			lib.config.extensionInfo[extname] = {};
		}
		if (!lib.config.extensionInfo[extname].mode) {
			lib.config.extensionInfo[extname].mode = [];
		}
		if (lib.config.extensionInfo[extname].mode.indexOf(name) == -1) {
			lib.config.extensionInfo[extname].mode.push(name);
		}
		game.saveConfig("extensionMode", lib.config.extensionInfo);
	},
	addGlobalSkill(this: Game, skill: string, player?: Player) {
		const info = getRegisteredSkill(lib.skill, skill);
		if (!info) {
			return false;
		}
		lib.skill.global.add(skill);
		if (player) {
			if (!lib.skill.globalmap[skill]) {
				lib.skill.globalmap[skill] = [];
			}
			lib.skill.globalmap[skill].add(player);
		}
		if (info.trigger) {
			const setTrigger = function (i: string, evt: string) {
				const name = i + "_" + evt;
				if (!lib.hook.globalskill[name]) {
					lib.hook.globalskill[name] = [];
				}
				lib.hook.globalskill[name].add(skill);
				lib.hookmap[evt] = true;
			};
			const map = lib.relatedTrigger,
				names = Object.keys(map);
			for (const i in info.trigger) {
				const evts: string[] = [];
				if (typeof info.trigger[i] == "string") {
					evts.add(info.trigger[i]);
				} else if (Array.isArray(info.trigger[i])) {
					evts.addArray(info.trigger[i]);
				}
				evts.forEach(evt => {
					names
						.reduce<string[]>((list, name) => {
							if (evt.startsWith(name)) {
								return list.addArray(map[name].map(j => j + evt.slice(name.length)));
							}
							return list;
						}, [])
						.forEach(evtx => setTrigger(i, evtx));
					setTrigger(i, evt);
				});
			}
		}
		return true;
	},
	removeGlobalSkill(this: Game, skill: string, player?: Player) {
		const players = lib.skill.globalmap[skill];
		if (player && Array.isArray(players)) {
			lib.skill.globalmap[skill].remove(player);
			if (players.length) {
				return;
			}
		}
		lib.skill.global.remove(skill);
		delete lib.skill.globalmap[skill];
		for (const i in lib.hook.globalskill) {
			lib.hook.globalskill[i].remove(skill);
		}
	},
	resetSkills(this: Game) {
		for (let i = 0; i < game.players.length; i++) {
			for (const j in game.players[i].tempSkills) {
				game.players[i].removeSkill(j);
			}
			const skills = game.players[i].getSkills();
			for (let j = 0; j < skills.length; j++) {
				if (getRegisteredSkill(lib.skill, skills[j])?.vanish) {
					game.players[i].removeSkill(skills[j]);
				}
			}
			game.players[i].in(true);
		}
		ui.clear();
	},
	hasExtension(this: Game, extensionName: string) {
		if (this.hasExtensionInstalled(extensionName)) {
			if (typeof lib.config[`extension_${extensionName}_enable`] != "boolean") {
				game.saveExtensionConfig(extensionName, "enable", true);
			}
			return lib.config[`extension_${extensionName}_enable`] === true;
		}
		return false;
	},
	hasExtensionInstalled(this: Game, extensionName: string) {
		return lib.config.extensions.includes(extensionName);
	},
	hasExtensionLoaded(this: Game, extensionName?: string) {
		return extensionName !== void 0 && !!_status.extensionLoaded && _status.extensionLoaded.includes(extensionName);
	},
	removeExtension(this: Game, extensionName: string, keepFile?: boolean) {
		const prefix = `extension_${extensionName}`;
		Object.keys(lib.config).forEach(key => {
			if (key.startsWith(prefix)) {
				game.saveConfig(key);
			}
		});
		localStorage.removeItem(`${lib.configprefix}${prefix}`);
		game.deleteDB("data", prefix);
		lib.config.extensions.remove(extensionName);
		game.saveConfig("extensions", lib.config.extensions);
		const modeList = lib.config.extensionInfo[extensionName];
		if (modeList) {
			if (modeList.file) {
				Object.values(modeList.file).forEach(filePath => game.deleteDB("image", `extension-${extensionName}:${filePath}`));
			}
			if (modeList.mode) {
				Object.values(modeList.mode).forEach(game.clearModeConfig);
			}
			delete lib.config.extensionInfo[extensionName];
			game.saveConfigValue("extensionInfo");
		}
		if (!game.readFile || keepFile) {
			return;
		}
		game.promises.removeDir(`extension/${extensionName}`).catch(console.error);
	},
	addRecentCharacter(this: Game, ...args: string[]) {
		const list: string[] = get.config("recentCharacter") || [];
		for (let i = 0; i < args.length; i++) {
			if (lib.character[args[i]]) {
				list.remove(args[i]);
				list.unshift(args[i]);
			}
		}
		const num = parseInt(lib.config.recent_character_number);
		if (list.length > num) {
			list.splice(num);
		}
		game.saveConfig("recentCharacter", list, true);
	},
	createCard(this: Game, name: Card | VCard | Record<string, any> | string, suit?: string | null, number?: number | string | null, nature?: string | boolean | null): Card {
		if (typeof name == "object") {
			nature = name.nature;
			number = name.number;
			suit = name.suit;
			name = name.name;
		}
		if (typeof name != "string") {
			name = "sha";
		}
		let noclick = false;
		if (suit == "noclick") {
			noclick = true;
			suit = null;
		}
		if (!suit && lib.card[name].cardcolor) {
			suit = lib.card[name].cardcolor;
		}
		if (!nature && lib.card[name].cardnature) {
			nature = lib.card[name].cardnature;
		}
		if (typeof suit != "string") {
			suit = "none";
		} else if (suit == "black") {
			suit = Math.random() < 0.5 ? "club" : "spade";
		} else if (suit == "red") {
			suit = Math.random() < 0.5 ? "diamond" : "heart";
		}
		if (typeof number != "number" && typeof number != "string") {
			number = 0;
		}
		const card = noclick ? ui.create.card(ui.special, "noclick", true) : ui.create.card(ui.special);
		card.storage.vanish = true;
		return card.init([suit, number, name, nature]);
	},
	createCard2(this: Game, ...args: Parameters<Game["createCard"]>): Card {
		const card = game.createCard.apply(this, args);
		delete card.storage.vanish;
		return card;
	},
};
