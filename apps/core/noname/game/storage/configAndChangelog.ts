import { _status, lib, get, ui } from "noname";
import { save } from "@/util/config.js";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const configAndChangelogMethods = {
	save(this: Game, key?: string, value?: any, mode?: string) {
		if (_status.reloading) {
			return;
		}
		const saveMode = mode || lib.config.mode;
		if (lib.db) {
			if (!key) {
				game.putDB("data", saveMode, get.copy(lib.storage));
				return;
			}
			if (saveMode == lib.config.mode) {
				if (value == undefined) {
					delete lib.storage[key];
				} else {
					lib.storage[key] = value;
				}
				lib.storage.version = lib.version;
				game.putDB("data", saveMode, lib.storage);
			} else {
				game.getDB("data", saveMode, (config: any) => {
					if (!config) {
						config = {};
					}
					if (value == undefined) {
						delete config[key];
					} else {
						config[key] = value;
					}
					config.version = lib.version;
					game.putDB("data", saveMode, config);
				});
			}
			return;
		}
		if (!key) {
			localStorage.setItem(`${lib.configprefix}${saveMode}`, JSON.stringify(lib.storage));
			return;
		}
		let config: Record<string, any>;
		try {
			config = JSON.parse(localStorage.getItem(`${lib.configprefix}${saveMode}`) ?? "null");
			if (typeof config != "object") {
				throw new Error("err");
			}
		} catch {
			config = {};
		}
		if (value == undefined) {
			delete config[key];
			if (saveMode == lib.config.mode) {
				delete lib.storage[key];
			}
		} else {
			config[key] = value;
			if (saveMode == lib.config.mode) {
				lib.storage[key] = value;
			}
		}
		config.version = lib.version;
		localStorage.setItem(`${lib.configprefix}${saveMode}`, JSON.stringify(config));
	},
	showChangeLog(this: Game) {
		if (lib.version == lib.config.version && !_status.extensionChangeLog) {
			return;
		}
		const ul = document.createElement("ul");
		ul.style.textAlign = "left";
		const caption = lib.version == lib.config.version ? "扩展更新" : `${lib.version}更新内容`;
		let players: string[] = [];
		let cards: string[] = [];
		if (lib.version != lib.config.version) {
			lib.changeLog.forEach(value => {
				if (value.startsWith("players://")) {
					try {
						const parsed = JSON.parse(value.slice(10));
						if (Array.isArray(parsed)) {
							players = parsed.filter(value => typeof value == "string" && lib.character[value]);
						}
					} catch {
						players = [];
					}
				} else if (value.startsWith("cards://")) {
					try {
						const parsed = JSON.parse(value.slice(8));
						if (Array.isArray(parsed)) {
							cards = parsed.filter(value => typeof value == "string" && lib.card[value]);
						}
					} catch {
						cards = [];
					}
				} else {
					const li = document.createElement("li");
					li.innerHTML = value;
					ul.appendChild(li);
				}
			});
		}
		const dialog = ui.create.dialog(caption, "hidden");
		if (lib.version != lib.config.version) {
			const lic = ui.create.div(dialog.content);
			lic.style.display = "block";
			lic.appendChild(ul);
		}
		game.saveConfig("version", lib.version);
		if (players?.length) {
			dialog.addSmall([players, "character"]);
			dialog.classList.add("forcebutton");
			dialog.classList.add("withbg");
		}
		if (cards?.length) {
			dialog.addSmall([cards.map(value => [get.translation(get.type(value)), "", value]), "vcard"]);
			dialog.classList.add("forcebutton");
			dialog.classList.add("withbg");
		}
		if (_status.extensionChangeLog) {
			const changeLog = _status.extensionChangeLog;
			Object.keys(changeLog).forEach(extname => {
				dialog.add(ui.create.div(".placeholder"));
				dialog.add(`${extname} ${lib.extensionPack[extname].version} 更新内容`);
				dialog.add(ui.create.div(".placeholder"));
				const changeLogList = changeLog[extname];
				if (!Array.isArray(changeLogList)) {
					return;
				}
				changeLogList.forEach(item => {
					if (!item || typeof item != "object") {
						return;
					}
					switch (item.type) {
						case "text": {
							const list = Array.isArray(item.data) ? item.data : [item.data];
							if (item.addText) {
								list.forEach(value => {
									dialog.addText(value);
								});
							} else {
								list.forEach(value => {
									const li = document.createElement("li");
									li.innerHTML = value;
									const textAlign = "textAlign" in item && typeof item.textAlign == "string" ? item.textAlign : "center";
									li.style.textAlign = textAlign;
									dialog.content.appendChild(li);
								});
							}
							break;
						}
						case "players": {
							if (!Array.isArray(item.data)) {
								return;
							}
							const playerList = item.data.filter(value => typeof value == "string");
							dialog.addSmall([playerList, "character"]);
							dialog.classList.add("forcebutton");
							dialog.classList.add("withbg");
							break;
						}
						case "cards": {
							if (!Array.isArray(item.data)) {
								return;
							}
							const cardList = item.data.filter(value => typeof value == "string");
							dialog.addSmall([cardList.map(value => [get.translation(get.type(value)), "", value]), "vcard"]);
							dialog.classList.add("forcebutton");
							dialog.classList.add("withbg");
							break;
						}
						default:
							return;
					}
				});
			});
		}
		dialog.open();
		let hidden = false;
		if (!ui.auto.classList.contains("hidden")) {
			ui.auto.hide();
			hidden = true;
		}
		game.pause();
		const control = ui.create.control("确定", () => {
			dialog.close();
			control.close();
			if (hidden) {
				ui.auto.show();
			}
			game.resume();
		});
		lib.init.onfree();
	},
	showExtensionChangeLog(this: Game, str: string | Array<{ type: string; data: string | string[]; addText?: boolean }> | { type: string; data: string | string[]; addText?: boolean } | null, extname?: string) {
		const extensionName = extname || _status.extension;
		if (!extensionName) {
			return;
		}
		const cfg = `extension_${extensionName}_changelog`;
		if (!lib.extensionPack[extensionName] || lib.extensionPack[extensionName].version == lib.config[cfg]) {
			return;
		}
		game.saveConfig(cfg, lib.extensionPack[extensionName].version);
		_status.extensionChangeLog ??= {};
		if (typeof str === "string") {
			_status.extensionChangeLog[extensionName] = [{ type: "text", data: str }];
		} else if (Array.isArray(str)) {
			_status.extensionChangeLog[extensionName] = str;
		} else if (str !== null && typeof str == "object") {
			_status.extensionChangeLog[extensionName] = [str];
		}
	},
	saveConfig(this: Game, key: string, value?: any, local?: string | boolean, callback?: () => void) {
		if (_status.reloading) {
			return;
		}

		let storeKey = key;
		let base = lib.config;

		if (local) {
			const localmode = typeof local == "string" ? local : lib.config.mode;

			if (!lib.config.mode_config[localmode]) {
				lib.config.mode_config[localmode] = {};
			}
			base = lib.config.mode_config[localmode];
			storeKey += `_mode_config_${localmode}`;
		}

		if (typeof value == "undefined") {
			delete base[key];
		} else {
			base[key] = value;
		}

		return save(storeKey, "config", value).then(callback);
	},
	saveConfigValue(this: Game, key: string) {
		return game.saveConfig(key, lib.config[key]);
	},
	saveExtensionConfig(this: Game, extension: string, key: string, value?: any) {
		return game.saveConfig(`extension_${extension}_${key}`, value);
	},
	saveExtensionConfigValue(this: Game, extension: string, key: string) {
		return game.saveExtensionConfig(extension, key, game.getExtensionConfig(extension, key));
	},
	getExtensionConfig(this: Game, extension: string, key: string) {
		return lib.config[`extension_${extension}_${key}`];
	},
	clearModeConfig(this: Game, mode: string) {
		if (_status.reloading) {
			return;
		}
		if (lib.db) {
			game.getDB("config", null, (config: Record<string, any>) =>
				Object.keys(config).forEach(value => {
					if (value.substr(value.indexOf("_mode_config") + 13) == mode) {
						game.saveConfig(value);
					}
				})
			);
			return;
		}
		let config: Record<string, any>;
		try {
			config = JSON.parse(localStorage.getItem(`${lib.configprefix}config`) ?? "{}");
			if (!config || typeof config != "object") {
				throw new Error("err");
			}
		} catch {
			config = {};
		}
		Object.keys(config).forEach(value => {
			if (value.substr(value.indexOf("_mode_config") + 13) == mode) {
				delete config[value];
			}
		});
		localStorage.setItem(`${lib.configprefix}config`, JSON.stringify(config));
		localStorage.removeItem(`${lib.configprefix}${mode}`);
	},
};
