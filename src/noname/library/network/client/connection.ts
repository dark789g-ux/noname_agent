/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";
import { lib } from "noname";

export function createMessageClientConnection() {
	return {
		log: function (arr) {
			if (Array.isArray(arr)) {
				for (var i = 0; i < arr.length; i++) {
					console.log(arr[i]);
				}
			}
		},
		opened: function () {
			game.send(
				"init",
				lib.versionOL,
				{
					id: game.onlineID,
					onlineKey: game.onlineKey,
					avatar: lib.config.connect_avatar,
					nickname: get.connectNickname(),
					versionLocal: lib.version,
					extension: lib.config.extensions.some(ext => lib.config[`extension_${ext}_enable`]),
				},
				lib.config.banned_info
			);
			if (ui.connecting && !ui.connecting.splashtimeout) {
				const firstChild = ui.connecting.firstElementChild;
				if (firstChild instanceof HTMLElement) {
					firstChild.innerHTML = "重连成功";
				}
			}
		},
		onconnection: id => lib.init.connection((lib.wsOL[id] = new lib.element.NodeWS(id))),
		onmessage: function (id, message) {
			const socket = lib.wsOL[id];
			if (socket && "onmessage" in socket && typeof socket.onmessage == "function") {
				socket.onmessage(message);
			}
		},
		onclose: function (id) {
			const socket = lib.wsOL[id];
			if (socket && "onclose" in socket && typeof socket.onclose == "function") {
				socket.onclose();
			}
		},
		selfclose: function () {
			if (game.online || game.onlineroom) {
				if ((game.servermode || game.onlinehall) && _status.over) {
					// later
				} else {
					game.saveConfig("tmp_user_roomId");
				}
			}
			const ws = game.ws;
			if (ws) {
				ws.close();
			}
		},
		reloadroom: function (forced) {
			// if (window.isNonameServer && (forced || !_status.protectingroom)) {
			// 	game.reload();
			// }
		},
		createroom: function (index, config, mode) {
			game.online = false;
			game.onlineroom = true;
			game.roomId = index;
			lib.node = {};
			game.switchMode(lib.configOL.mode);
			ui.create.connecting(true);
		},
		enterroomfailed: function () {
			alert("请稍后再试");
			_status.enteringroom = false;
			ui.create.connecting(true);
		},
		roomlist: function (list, events, clients, wsid) {
			game.send("server", "key", [game.onlineKey, lib.version]);
			game.online = true;
			game.onlinehall = true;
			lib.config.recentIP.remove(_status.ip);
			lib.config.recentIP.unshift(_status.ip);
			lib.config.recentIP.splice(5);
			if (!lib.config.reconnect_info || lib.config.reconnect_info[0] != _status.ip) {
				game.saveConfig("reconnect_info", [_status.ip, null]);
			}
			game.saveConfig("recentIP", lib.config.recentIP);
			_status.connectMode = true;

			game.clearArena();
			game.clearConnect();
			ui.pause.hide();
			ui.auto.hide();

			clearTimeout(_status.createNodeTimeout);
			game.send("server", "changeAvatar", get.connectNickname(), lib.config.connect_avatar);

			var proceed = function () {
				game.ip = get.trimip(_status.ip);
				ui.create.connectRooms(list);
				if (events) {
					ui.connectEvents = ui.create.div(".forceopaque.menubutton.large.connectevents.pointerdiv", "约战", ui.window, ui.click.connectEvents);
					ui.connectEventsCount = ui.create.div(".forceopaque.menubutton.icon.connectevents.highlight.hidden", "", ui.window);
					ui.connectClients = ui.create.div(".forceopaque.menubutton.large.connectevents.pointerdiv.left", "在线", ui.window, ui.click.connectClients);
					ui.connectClientsCount = ui.create.div(".forceopaque.menubutton.icon.connectevents.highlight.left", "1", ui.window);
					ui.createRoomButton = ui.create.div(".forceopaque.menubutton.large.connectevents.pointerdiv.left2", "创建房间", ui.window, function () {
						if (!_status.creatingroom) {
							_status.creatingroom = true;
							ui.click.connectMenu?.();
						}
					});
					if (events.length) {
						ui.connectEventsCount.innerHTML = events.filter(function (evt) {
							return evt.creator == game.onlineKey || !get.is.banWords(evt.content);
						}).length;
						ui.connectEventsCount.show();
					}
				}
				game.wsid = wsid;
				lib.message.client.updaterooms(list, clients);
				lib.message.client.updateevents(events);
				ui.exitroom = ui.create.system(
					"退出房间",
					function () {
						game.saveConfig("tmp_owner_roomId");
						game.saveConfig("tmp_user_roomId");
						if (ui.rooms) {
							game.saveConfig("reconnect_info");
						} else {
							if (lib.config.reconnect_info) {
								lib.config.reconnect_info.length = 1;
								game.saveConfig("reconnect_info", lib.config.reconnect_info);
							}
						}
						game.reload();
					},
					true
				);

				if (!Array.isArray(ui.rooms)) {
					return;
				}
				const rooms = ui.rooms;
				var findRoom = function (id) {
					for (var room of rooms) {
						if (room.key == id) {
							return room;
						}
					}
					return false;
				};
				if (typeof lib.config.tmp_owner_roomId == "string") {
					if (typeof game.roomId != "string" && !findRoom(lib.config.tmp_owner_roomId)) {
						lib.configOL.mode = lib.config.connect_mode;
						game.roomId = lib.config.tmp_owner_roomId;
					}
					game.saveConfig("tmp_owner_roomId");
				}
				if (typeof lib.config.tmp_user_roomId == "string") {
					if (typeof game.roomId != "string") {
						if (findRoom(lib.config.tmp_user_roomId)) {
							game.roomId = lib.config.tmp_user_roomId;
						} else {
							ui.create.connecting();
							(function () {
								var n = 10;
								var id = lib.config.tmp_user_roomId;
								var interval = setInterval(function () {
									if (n > 0) {
										n--;
										if (findRoom(id)) {
											clearInterval(interval);
											game.send("server", "enter", id, get.connectNickname(), lib.config.connect_avatar);
										}
									} else {
										ui.create.connecting(true);
										clearInterval(interval);
									}
								}, 500);
							})();
						}
					}
					game.saveConfig("tmp_user_roomId");
				}

				if (typeof game.roomId == "string") {
					var room = findRoom(game.roomId);
					if (game.roomIdServer && room && (room.serving || !room.version)) {
						console.log();
						if (lib.config.reconnect_info) {
							lib.config.reconnect_info[2] = null;
							game.saveConfig("reconnect_info", lib.config.reconnect_info);
						}
					} else {
						ui.create.connecting();
						game.send("server", game.roomId == game.onlineKey ? "create" : "enter", game.roomId, get.connectNickname(), lib.config.connect_avatar);
					}
				}
				lib.init.onfree();
			};
			if (_status.event.parent) {
				game.forceOver("noover", proceed);
			} else {
				proceed();
			}
		},
	};
}
