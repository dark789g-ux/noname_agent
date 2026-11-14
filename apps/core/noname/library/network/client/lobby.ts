/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { ai } from "noname";
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";
import { lib } from "noname";
import type { Player } from "@/library/contracts/runtime.js";
import type { Card } from "@/library/contracts/runtime.js";

export function createMessageClientLobby() {
	return {
		updaterooms: function (list, clients) {
			/**
			 * @param {string | HTMLDivElement | Player[] | Card[]} node
			 * @returns {node is HTMLDivElement & {
			 * 	roomindex: number,
			 * 	initRoom: Player["initRoom"],
			 * 	key?: string,
			 * 	serving?: boolean,
			 * 	version?: number | null,
			 * }}
			 */
			function isConnectRoomNode(node: string | HTMLDivElement | Player[] | Card[]): node is HTMLDivElement & {
				roomindex: number;
				initRoom: Player["initRoom"];
				key?: string;
				serving?: boolean;
				version?: number | null;
			} {
				return node instanceof HTMLDivElement;
			}
			/**
			 * @param {HTMLDivElement} node
			 * @returns {node is HTMLDivElement & {
			 * 	key: string,
			 * 	roomfull: boolean,
			 * 	roomgaming: boolean,
			 * 	roomempty: boolean,
			 * 	version: number | string | null,
			 * 	serving: boolean,
			 * 	config?: {observe?: boolean},
			 * }}
			 */
			function isConnectRoomTarget(node: HTMLDivElement): node is HTMLDivElement & {
				key: string;
				roomfull: boolean;
				roomgaming: boolean;
				roomempty: boolean;
				version: number | string | null;
				serving: boolean;
				config?: {
					observe?: boolean;
				};
			} {
				return "key" in node && "roomfull" in node && "roomgaming" in node && "roomempty" in node && "version" in node && "serving" in node && typeof node.key == "string" && typeof node.roomfull == "boolean" && typeof node.roomgaming == "boolean" && typeof node.roomempty == "boolean" && (typeof node.version == "number" || typeof node.version == "string" || node.version === null) && typeof node.serving == "boolean";
			}
			if (Array.isArray(ui.rooms)) {
				const rooms = ui.rooms;
				const roombase = ui.roombase;
				if (!roombase) {
					return;
				}
				var map = {},
					map2 = {};
				for (var i of rooms) {
					map2[i.key!] = true;
				}
				for (let i of list) {
					if (!i) {
						continue;
					}
					map[i[4]] = i;
				}
				ui.window.classList.add("more_room");
				for (let i = 0; i < rooms.length; i++) {
					if (!map[rooms[i].key!]) {
						rooms[i].remove();
						rooms.splice(i--, 1);
					} else {
						rooms[i].initRoom(list[i]);
					}
				}
				for (let i of list) {
					if (!i) {
						continue;
					}
					map[i[4]] = i;
					if (!map2[i[4]]) {
						var player = roombase.add('<div class="popup text pointerdiv" style="width:calc(100% - 10px);display:inline-block;white-space:nowrap">空房间</div>');
						if (!isConnectRoomNode(player)) {
							continue;
						}
						player.roomindex = i;
						player.initRoom = lib.element.Player.prototype.initRoom;
						player.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.connectroom);
						player.initRoom(i);
						rooms.push(player);
					}
				}
				if (!_status.requestReadClipboard && get.config("read_clipboard", "connect")) {
					const read = text => {
						try {
							var roomId = text.split("\n")[1].match(/\d+/);
							var caption = rooms.find(caption => caption.key == roomId);
							if (caption && isConnectRoomTarget(caption) && (_status.read_clipboard_text || confirm(`是否通过复制的内容加入${roomId}房间？`))) {
								ui.click.connectroom.call(caption);
								delete _status.read_clipboard_text;
							}
						} catch (e) {
							console.log(e);
						}
					};
					//每次启动只请求一次
					_status.requestReadClipboard = true;
					if (_status.read_clipboard_text) {
						read(_status.read_clipboard_text);
					} else {
						window.focus();
						if (navigator.clipboard && lib.node) {
							navigator.clipboard
								.readText()
								.then(read)
								.catch(_ => {});
						} else {
							var input = ui.create.node("textarea", ui.window, { opacity: "0" });
							input.select();
							var result = document.execCommand("paste");
							input.blur();
							ui.window.removeChild(input);
							if (result || input.value.length > 0) {
								read(input.value);
							} else if (confirm("是否输入邀请链接以加入房间？")) {
								game.prompt("请输入邀请链接", text => {
									if (typeof text === "string" && text.length > 0) {
										read(text);
									}
								});
							}
						}
					}
				}
			}
			lib.message.client.updateclients(clients, true);
		},
		updateclients: function (clients, bool) {
			if (clients && ui.connectClients) {
				if ("info" in ui.connectClients) {
					ui.connectClients.info = clients;
				}
				if (ui.connectClientsCount) {
					ui.connectClientsCount.innerHTML = clients.length;
				}
			}
			if (_status.connectClientsCallback) {
				_status.connectClientsCallback();
			}
		},
		updateevents: function (events) {
			if (events && ui.connectEvents) {
				ui.connectEvents.info = events;
				var num = events.filter(function (evt) {
					return typeof evt.creator == "string" && (evt.creator == game.onlineKey || !get.is.banWords(evt.content));
				}).length;
				const connectEventsCount = ui.connectEventsCount;
				if (connectEventsCount) {
					if (num) {
						connectEventsCount.innerHTML = num;
						connectEventsCount.show();
					} else {
						connectEventsCount.hide();
					}
				}
				if (_status.connectEventsCallback) {
					_status.connectEventsCallback();
				}
			}
		},
		eventsdenied: function (reason) {
			var str = "创建约战失败";
			if (reason == "total") {
				str += "，约战总数不能超过20";
			} else if (reason == "time") {
				str += "，时间已过";
			} else if (reason == "ban") {
				str += "，请注意文明发言";
			}
			alert(str);
		},
		init: function (id, config, ip, servermode, roomId) {
			game.online = true;
			game.onlineID = id;
			game.ip = ip;
			game.servermode = servermode;
			game.roomId = roomId;
			if (game.servermode) {
				game.saveConfig("reconnect_info", [_status.ip, id, game.roomId]);
			} else {
				game.saveConfig("reconnect_info", [_status.ip, id]);
				game.saveConfig("tmp_user_roomId", roomId);
			}
			lib.config.recentIP.remove(_status.ip);
			lib.config.recentIP.unshift(_status.ip);
			lib.config.recentIP.splice(5);
			game.saveConfig("recentIP", lib.config.recentIP);
			_status.connectMode = true;
			lib.configOL = config;
			lib.playerOL = {};
			lib.cardOL = {};
			lib.vcardOL = {};

			game.clearArena();
			game.finishCards();
			ui.create.roomInfo();
			ui.create.chat();
			if (game.servermode) {
				ui.create.connectPlayers(get.modetrans(config, true));
			} else {
				ui.create.connectPlayers(ip);
			}
			ui.pause.hide();
			ui.auto.hide();
			game.clearConnect();
			clearTimeout(_status.createNodeTimeout);

			var proceed = function () {
				game.loadModeAsync(config.mode, function (mode) {
					for (var i in mode.ai) {
						if (typeof mode.ai[i] == "object") {
							if (ai[i] == undefined) {
								ai[i] = {};
							}
							for (var j in mode.ai[i]) {
								ai[i][j] = mode.ai[i][j];
							}
						} else {
							ai[i] = mode.ai[i];
						}
					}
					for (var i in mode.get) {
						if (typeof mode.get[i] == "object") {
							if (get[i] == undefined) {
								get[i] = {};
							}
							for (var j in mode.get[i]) {
								get[i][j] = mode.get[i][j];
							}
						} else {
							get[i] = mode.get[i];
						}
					}
					for (var i in mode.translate) {
						lib.translate[i] = mode.translate[i];
					}
					if (mode.game) {
						game.getIdentityList = mode.game.getIdentityList;
						game.updateState = mode.game.updateState;
						game.getRoomInfo = mode.game.getRoomInfo;
					}
					if (mode.element && mode.element.player) {
						Object.defineProperties(lib.element.Player.prototype, Object.getOwnPropertyDescriptors(mode.element.player));
					}
					if (mode.skill) {
						for (var i in mode.skill) {
							lib.skill[i] = mode.skill[i];
						}
					}
					if (mode.card) {
						for (var i in mode.card) {
							lib.card[i] = mode.card[i];
						}
					}
					game.finishCards();
					if (mode.characterPack) {
						for (var i in mode.characterPack) {
							lib.characterPack[i] = mode.characterPack[i];
						}
					}
					_status.event = lib.element.GameEvent.initialGameEvent();
					_status.paused = false;
					game.createEvent("game", false).setContent(lib.init.startOnline);
					game.loop();
					game.send("inited");
					ui.create.connecting(true);
				});
			};
			if (_status.event.parent) {
				game.forceOver("noover", proceed);
			} else {
				proceed();
			}
			for (var i in lib.characterPack) {
				for (var j in lib.characterPack[i]) {
					lib.character[j] = lib.character[j] || lib.characterPack[i][j];
				}
			}
		},
	};
}
