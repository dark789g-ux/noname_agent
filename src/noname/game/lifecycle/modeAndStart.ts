import { _status, lib, get, ai, ui } from "noname";
import { cloneCardPileEntry } from "../card/cardMoveProducers.js";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const modeAndStartMethods = {
	/**
	 * @todo deprecate
	 */
	loadModeAsync(this: Game, name: string, callback?: (exports: importModeConfig) => any, onerror: (error: unknown) => any = e => console.error(e)) {
		let promise = (async () => {
			window.game = game;
			let exports: any;
			let isESM = true;
			try {
				exports = await import(/* @vite-ignore */ `../../mode/${name}/index.js`);
			} catch {
				try {
					exports = await import(/* @vite-ignore */ `../../mode/${name}.js`);
				} catch {
					isESM = false;
					await lib.init.promises.js(`${lib.assetURL}mode`, name);
				}
			}
			if (isESM) {
				if (!["object", "function"].includes(typeof exports.default)) {
					throw new Error(`导入的模式[${name}]格式不正确！`);
				}
				game.import("mode", exports.default);
			}
			if (_status.importing) await Promise.allSettled(_status.importing.mode);
			if (!lib.config.dev) {
				delete window.game;
			}
			const content = lib.imported && lib.imported.mode ? lib.imported.mode[name] : undefined;
			if (!content) {
				throw new Error(`导入的模式[${name}]格式不正确！`);
			}
			if (lib.imported && lib.imported.mode) {
				delete lib.imported.mode[name];
				if (get.is.empty(lib.imported.mode)) {
					delete lib.imported.mode;
				}
			}
			return content;
		})();
		if (callback) {
			promise = promise.then(callback, onerror);
		}
		return promise;
	},
	switchMode(this: Game, name: string, configx?: any) {
		if (!lib.layoutfixed.includes(name)) {
			if (lib.config.layout != game.layout) {
				lib.init.layout(lib.config.layout);
			} else if (lib.config.mode == "brawl") {
				if (lib.config.player_border == "normal" && (game.layout == "long" || game.layout == "long2")) {
					ui.arena.classList.add("lslim_player");
				}
			}
		}
		game.loadModeAsync(name, async (exports: any) => {
			_status.sourcemode = lib.config.mode;
			lib.config.mode = name;

			for (const i in exports.element) {
				if (!lib.element[i]) {
					lib.element[i] = [];
				}
				for (const j in exports.element[i]) {
					if (j == "init") {
						if (!lib.element[i].inits) {
							lib.element[i].inits = [];
						}
						lib.element[i].inits.push(exports.element[i][j]);
					} else {
						lib.element[i][j] = exports.element[i][j];
					}
				}
			}
			for (const i in exports.ai) {
				if (typeof exports.ai[i] == "object") {
					if (ai[i] == undefined) ai[i] = {};
					for (const j in exports.ai[i]) {
						ai[i][j] = exports.ai[i][j];
					}
				} else {
					ai[i] = exports.ai[i];
				}
			}
			for (const i in exports.ui) {
				if (typeof exports.ui[i] == "object") {
					if (ui[i] == undefined) ui[i] = {};
					for (const j in exports.ui[i]) {
						ui[i][j] = exports.ui[i][j];
					}
				} else {
					ui[i] = exports.ui[i];
				}
			}
			for (const i in exports.game) {
				game[i] = exports.game[i];
			}
			for (const i in exports.get) {
				get[i] = exports.get[i];
			}
			if (game.onwash) {
				lib.onwash.push(game.onwash);
				delete game.onwash;
			}
			if (game.onover) {
				lib.onover.push(game.onover);
				delete game.onover;
			}
			lib.config.banned = lib.config[lib.config.mode + "_banned"] || [];
			lib.config.bannedcards = lib.config[lib.config.mode + "_bannedcards"] || [];

			for (const i in exports) {
				if (["element", "game", "ai", "ui", "get", "config", "start", "startBefore"].includes(i)) {
					continue;
				}
				if (lib[i] == undefined) {
					lib[i] = Array.isArray(exports[i]) ? [] : {};
				}
				for (const j in exports[i]) {
					lib[i][j] = exports[i][j];
				}
			}

			_status.event = lib.element.GameEvent.initialGameEvent();
			_status.paused = false;

			if (_status.connectMode && lib.mode[name].connect) {
				game.saveConfig("connect_mode", name);
				game.clearConnect();
				lib.configOL.mode = name;
				if (configx) {
					for (const i in configx) {
						lib.configOL[i] = configx[i];
					}
				} else {
					for (const i in lib.mode[name].connect) {
						if (i == "update") continue;
						lib.configOL[i.slice(8)] = get.config(i);
					}
					lib.configOL.zhinang_tricks = lib.config.connect_zhinang_tricks;
					lib.configOL.characterPack = lib.connectCharacterPack.slice(0);
					lib.configOL.cardPack = lib.connectCardPack.slice(0);
					for (let i = 0; i < lib.config.connect_characters.length; i++) {
						lib.configOL.characterPack.remove(lib.config.connect_characters[i]);
					}
					for (let i = 0; i < lib.config.connect_cards.length; i++) {
						lib.configOL.cardPack.remove(lib.config.connect_cards[i]);
					}
					lib.configOL.banned = lib.config["connect_" + name + "_banned"];
					lib.configOL.bannedcards = lib.config["connect_" + name + "_bannedcards"];
				}
				lib.configOL.version = lib.versionOL;
				for (const i in lib.cardPackList) {
					if (lib.configOL.cardPack.includes(i)) {
						lib.card.list = lib.card.list.concat(lib.cardPackList[i]);
					}
				}
				for (let i = 0; i < lib.card.list.length; i++) {
					if (lib.card.list[i][2] == "huosha") {
						lib.card.list[i] = cloneCardPileEntry(lib.card.list[i]);
						lib.card.list[i][2] = "sha";
						lib.card.list[i][3] = "fire";
					} else if (lib.card.list[i][2] == "leisha") {
						lib.card.list[i] = cloneCardPileEntry(lib.card.list[i]);
						lib.card.list[i][2] = "sha";
						lib.card.list[i][3] = "thunder";
					}
					if (!lib.card[lib.card.list[i][2]]) {
						lib.card.list.splice(i, 1);
						i--;
					} else if (lib.card[lib.card.list[i][2]].mode && lib.card[lib.card.list[i][2]].mode.includes(lib.config.mode) == false) {
						lib.card.list.splice(i, 1);
						i--;
					}
				}
			}

			if (!lib.config.show_playerids || !game.showIdentity) {
				ui.playerids.style.display = "none";
			} else {
				ui.playerids.style.display = "";
			}

			if (exports.startBefore) {
				exports.startBefore();
			}
			game.createEvent("game", false).setContent(exports.start);
			if (lib.mode[lib.config.mode] && lib.mode[lib.config.mode].fromextension) {
				const startstr = exports.start.toString();
				if (startstr.indexOf("onfree") == -1) {
					setTimeout(lib.init.onfree, 500);
				}
			}

			if (!lib.db) {
				try {
					lib.storage = JSON.parse(localStorage.getItem(lib.configprefix + lib.config.mode) ?? "null");
					if (typeof lib.storage != "object" || lib.storage == null) {
						throw new Error("err");
					}
				} catch {
					lib.storage = {};
					localStorage.setItem(lib.configprefix + lib.config.mode, "{}");
				}
				game.loop();
			} else {
				game.getDB("data", lib.config.mode, obj => {
					lib.storage = obj || {};
					game.loop();
				});
			}
		});
	},
	/**
	 * @todo deprecate
	 */
	loadMode(this: Game, mode: string) {
		const next = game.createEvent("loadMode", false);
		next.mode = mode;
		next.setContent("loadMode");
	},
	loadPackage(this: Game, ...args: string[]) {
		const next = game.createEvent("loadPackage");
		next.packages = [];
		for (let i = 0; i < args.length; i++) {
			if (typeof args[i] == "string") {
				next.packages.push(args[i]);
			}
		}
		next.setContent("loadPackage");
	},
	phaseLoop(this: Game, player: Player) {
		const next = game.createEvent("phaseLoop");
		next.player = player;
		next._isStandardLoop = true;
		next.setContent("phaseLoop");
		return next;
	},
	gameDraw(this: Game, player = game.me, num: number | ((player: Player) => number) = 4, targets = game.players) {
		const next = game.createEvent("gameDraw");
		const initialized = Object.assign(next, { player, num, targets });
		initialized.setContent("gameDraw");
		return initialized;
	},
	updateRoundNumber(this: Game) {
		game.broadcastAll(
			(roundNumber, pileTop, pileNumber) => {
				if (game.roundNumber != roundNumber) {
					game.roundNumber = roundNumber;
				}
				if (_status.pileTop != pileTop) {
					_status.pileTop = pileTop;
				}
				ui.updateRoundNumber(roundNumber, pileNumber);
			},
			game.roundNumber,
			ui.cardPile.firstChild,
			ui.cardPile.childElementCount
		);
	},
	asyncDraw(this: Game, players: Player[], num?: number | number[] | ((player: Player) => number) | null, drawDeck?: { drawDeck: number } | null, bottom?: boolean) {
		return Promise.all(
			players.map((player, index) => {
				let num2 = 1;
				if (typeof num === "number") {
					num2 = num;
				} else if (Array.isArray(num)) {
					num2 = num[index];
				} else if (typeof num === "function") {
					num2 = num(player);
				}

				if (drawDeck && drawDeck.drawDeck) {
					return player.draw(num2, false, drawDeck);
				}
				if (bottom) {
					return player.draw(num2, "nodelay", "bottom");
				}
				return player.draw(num2, "nodelay");
			})
		);
	},
	asyncDrawAuto(this: Game, players: Player[], num: number | number[] | ((player: Player) => number) | null, drawDeck?: { drawDeck: number } | null) {
		if (players.length > 1) {
			Reflect.apply(game.asyncDraw, this, [players, num, drawDeck]);
			return;
		}
		let num2 = 1;
		if (typeof num == "number") {
			num2 = num;
		} else if (Array.isArray(num)) {
			num2 = num[0];
		} else if (typeof num == "function") {
			num2 = num(players[0]);
		}
		if (drawDeck && drawDeck.drawDeck) {
			players[0].draw(num2, drawDeck);
		} else {
			players[0].draw(num2);
		}
	},
};
