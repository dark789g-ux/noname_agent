/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";
import { lib } from "noname";
import type { ClientInitConfig } from "@/library/contracts/runtime.js";
import { requireConnectPlayers } from "@/library/runtime/node.js";

export function createMessageServerHandshake() {
	return {
		cardPile(this: { send(message: string): void }) {
			this.send(
				JSON.stringify({
					type: "cardPile",
					data: {
						drawPile: Array.from(ui.cardPile.children),
						discardPile: Array.from(ui.discardPile.children),
					},
				})
			);
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 * @param {number} version
		 * @param {ClientInitConfig} config
		 * @param {string | undefined} banned_info
		 */
		init(this: import("@/library/element/client.js").Client, version: number, config: ClientInitConfig, banned_info: string | undefined) {
			const node = lib.requireNodeServer();
			/*var show_deckMonitor = false;
				if (lib.config.show_deckMonitor) {
					// && lib.config.show_deckMonitor_online
					show_deckMonitor = true;
				}
				this.send(function (show_deckMonitor) {
					if (show_deckMonitor) {
						ui.deckMonitor.style.display = "";
					} else {
						ui.deckMonitor.style.display = "none";
					}
				}, show_deckMonitor);*/
			this.onlineKey = config.onlineKey;
			var banBlacklist = lib.config.banBlacklist === undefined ? [] : lib.config.banBlacklist;
			if ((typeof banned_info == "string" && node.banned.includes(banned_info)) || (typeof config.onlineKey == "string" && banBlacklist.includes(config.onlineKey))) {
				this.send("denied", "banned");
			} else if (config.id && lib.playerOL && lib.playerOL[config.id]) {
				var player = lib.playerOL[config.id];
				player.setNickname();
				player.ws = this;
				player.isAuto = false;
				this.id = config.id;
				game.broadcast(function (player) {
					player.setNickname();
				}, player);
				const onreconnect = "onreconnect" in _status && Array.isArray(_status.onreconnect) ? _status.onreconnect : undefined;
				this.send("reinit", lib.configOL, get.arenaState(), game.getState ? game.getState() : {}, game.ip, null, onreconnect, _status.cardtag, _status.postReconnect);
			} else if (version != lib.versionOL) {
				this.send("denied", "version");
				node.clients.remove(this);
				this.closed = true;
			} else if (get.config("check_versionLocal", "connect") && config.versionLocal != lib.version) {
				this.send("denied", "version");
				node.clients.remove(this);
				this.closed = true;
			} else if (get.config("check_extension", "connect") && config.extension) {
				this.send("denied", "extension");
			} else if (!_status.waitingForPlayer) {
				if (!config.nickname) {
					this.send("denied", "banned");
					node.clients.remove(this);
					this.closed = true;
				} else if (game.phaseNumber && lib.configOL.observe) {
					node.observing.push(this);
					this.send("reinit", lib.configOL, get.arenaState(), game.getState ? game.getState() : {}, game.ip, game.players[0].playerid, null, _status.cardtag, _status.postReconnect);
					// 没有系统提示的接口喵？
					game.log("玩家 ", `#y${get.plainText(config.nickname)}`, " 进入房间观战");
					game.getMe().chat(`玩家 <span style="font-weight: bold; color: rgb(126, 180, 255)">${get.plainText(config.nickname)}</span> 进入房间观战`);
					if (!ui.removeObserve) {
						ui.removeObserve = ui.create.system(
							"移除旁观",
							/** @this {HTMLElement} */ function (this: HTMLElement) {
								lib.configOL.observe = false;
								if (game.onlineroom) {
									game.send("server", "config", lib.configOL);
								}
								const server = lib.requireNodeServer();
								while (server.observing.length) {
									const observer = server.observing.shift();
									if (observer) {
										observer.ws.close();
									}
								}
								this.remove();
								delete ui.removeObserve;
							},
							true,
							true
						);
					}
				} else {
					this.send("denied", "gaming");
					node.clients.remove(this);
					this.closed = true;
				}
			} else if (node.clients.length >= parseInt(lib.configOL.number)) {
				this.send("denied", "number");
				node.clients.remove(this);
				this.closed = true;
			} else {
				if (config) {
					this.avatar = config.avatar;
					this.nickname = config.nickname;
				}
				const connectPlayers = requireConnectPlayers();
				for (var i = 0; i < connectPlayers.length; i++) {
					if (connectPlayers[i].classList.contains("unselectable2")) {
						continue;
					}
					if (connectPlayers[i] != game.me && !connectPlayers[i].playerid) {
						connectPlayers[i].playerid = this.id;
						connectPlayers[i].initOL(this.nickname, this.avatar);
						connectPlayers[i].ws = this;
						break;
					}
				}
				this.send("init", this.id, lib.configOL, game.ip, false, game.roomId);
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		inited(this: import("@/library/element/client.js").Client) {
			this.inited = true;
			if (_status.waitingForPlayer) {
				game.updateWaiting();
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		reinited(this: import("@/library/element/client.js").Client) {
			this.inited = true;
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		result(this: import("@/library/element/client.js").Client, result) {
			if (lib.requireNodeServer().observing.includes(this)) {
				return;
			}
			var player = lib.playerOL[this.id];
			if (player) {
				player.unwait(result);
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		tempResult(this: import("@/library/element/client.js").Client, result) {
			if (lib.requireNodeServer().observing.includes(this)) {
				return;
			}
			var player = lib.playerOL[this.id];
			if (player) {
				player.tempUnwait(result);
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		startGame(this: import("@/library/element/client.js").Client) {
			if (this.id == game.onlinezhu) {
				game.resume();
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		changeRoomConfig(this: import("@/library/element/client.js").Client, config) {
			if (this.id == game.onlinezhu) {
				game.broadcastAll(function (config) {
					for (var i in config) {
						lib.configOL[i] = config[i];
					}
					if (ui.connectStartBar) {
						const roomLabel = ui.connectStartBar.firstChild;
						if (!(roomLabel instanceof HTMLElement)) {
							throw new TypeError("The connection start bar requires its room label");
						}
						roomLabel.innerHTML = get.modetrans(lib.configOL, true);
					}
				}, config);
				if (lib.configOL.mode == "identity" && lib.configOL.identity_mode == "zhong" && game.connectPlayers) {
					for (var i = 0; i < game.connectPlayers.length; i++) {
						game.connectPlayers[i].classList.remove("unselectable2");
					}
					lib.configOL.number = 8;
					game.updateWaiting();
				}
				if (game.onlineroom) {
					game.send("server", "config", lib.configOL);
				}
				const connectPlayers = requireConnectPlayers();
				for (var i = 0; i < connectPlayers.length; i++) {
					if (connectPlayers[i].playerid == this.id) {
						connectPlayers[i].chat("房间设置已更改");
					}
				}
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		changeNumConfig(this: import("@/library/element/client.js").Client, num, index, bool) {
			if (this.id == game.onlinezhu) {
				lib.configOL.number = num;
				game.send("server", "config", lib.configOL);
				if (game.connectPlayers && game.connectPlayers[index]) {
					if (bool) {
						game.connectPlayers[index].classList.add("unselectable2");
					} else {
						game.connectPlayers[index].classList.remove("unselectable2");
					}
					game.updateWaiting();
				}
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		throwEmotion(this: import("@/library/element/client.js").Client, target, emotion, rotate) {
			if (lib.requireNodeServer().observing.includes(this)) {
				return;
			}
			var player = lib.playerOL[this.id];
			if (player) {
				player.throwEmotion(target, emotion, rotate);
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		emotion(this: import("@/library/element/client.js").Client, id, pack, emotion) {
			if (lib.requireNodeServer().observing.includes(this)) {
				return;
			}
			var that = this;
			if (
				!this.id ||
				(!lib.playerOL[this.id] &&
					(!game.connectPlayers ||
						!(function () {
							for (var i = 0; i < game.connectPlayers.length; i++) {
								if (game.connectPlayers[i].playerid == that.id) {
									return true;
								}
							}
							return false;
						})()))
			) {
				return;
			}
			var player;
			if (lib.playerOL[id]) {
				player = lib.playerOL[id];
			} else if (game.connectPlayers) {
				for (var i = 0; i < game.connectPlayers.length; i++) {
					if (game.connectPlayers[i].playerid == id) {
						player = game.connectPlayers[i];
						break;
					}
				}
			}
			if (player) {
				player.emotion(pack, emotion);
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		chat(this: import("@/library/element/client.js").Client, id, str) {
			if (lib.requireNodeServer().observing.includes(this)) {
				return;
			}
			var that = this;
			if (
				!this.id ||
				(!lib.playerOL[this.id] &&
					(!game.connectPlayers ||
						!(function () {
							for (var i = 0; i < game.connectPlayers.length; i++) {
								if (game.connectPlayers[i].playerid == that.id) {
									return true;
								}
							}
							return false;
						})()))
			) {
				return;
			}
			var player;
			if (lib.playerOL[id]) {
				player = lib.playerOL[id];
			} else if (game.connectPlayers) {
				for (var i = 0; i < game.connectPlayers.length; i++) {
					if (game.connectPlayers[i].playerid == id) {
						player = game.connectPlayers[i];
						break;
					}
				}
			}
			if (player) {
				player.chat(str);
			}
		},
	};
}
