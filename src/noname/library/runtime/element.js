import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import * as Element from "@/library/element/index.js";
import { security } from "@/util/sandbox.js";
import { lib } from "noname";
export function createElement() {
	return {
		content: Element.Content,
		Player: Element.Player,
		Card: Element.Card,
		VCard: Element.VCard,
		Button: Element.Button,
		GameEvent: Element.GameEvent,
		Dialog: Element.Dialog,
		Control: Element.Control,
		Client: Element.Client,
		NodeWS: Element.NodeWS,
		Character: Element.Character,
		ws: {
			onopen: function () {
				if (_status.connectCallback) {
					_status.connectCallback(true);
					delete _status.connectCallback;
				}
			},
			onmessage: function (messageevent) {
				if (messageevent.data == "heartbeat") {
					this.send("heartbeat");
					return;
				}
				var message;
				try {
					message = JSON.parse(messageevent.data);
					if (!Array.isArray(message) || typeof lib.message.client[message[0]] !== "function") {
						throw new Error("err");
					}
					if (game.sandbox) {
						security.enterSandbox(game.sandbox);
					}
					try {
						for (var i = 1; i < message.length; i++) {
							message[i] = get.parsedResult(message[i]);
						}
					} finally {
						if (game.sandbox) {
							security.exitSandbox();
						}
					}
				} catch (e) {
					console.log(e);
					console.log("invalid message: " + messageevent.data);
					return;
				}
				lib.message.client[message.shift()].apply(null, message);
			},
			onerror: function (e) {
				if (this._nocallback) {
					return;
				}
				if (_status.connectCallback) {
					_status.connectCallback(false);
					delete _status.connectCallback;
				} else {
					alert("连接失败");
				}
			},
			onclose: function () {
				if (this._nocallback) {
					return;
				}
				if (_status.connectCallback) {
					_status.connectCallback(false);
					delete _status.connectCallback;
				}
				if (game.online || game.onlineroom) {
					if ((game.servermode || game.onlinehall) && _status.over) {
						void 0;
					} else {
						localStorage.setItem(lib.configprefix + "directstart", "true");
						game.reload();
					}
				} else {
					// game.saveConfig('reconnect_info');
				}
				game.online = false;
				game.ws = null;
				game.sandbox = null;
			},
		},
		/**
		 * @legacy Use {@link lib.element.Player.prototype} instead.
		 */
		get player() {
			return this.Player.prototype;
		},
		/**
		 * @legacy Use {@link lib.element.Card.prototype} instead.
		 */
		get card() {
			return this.Card.prototype;
		},
		/**
		 * @legacy Use {@link lib.element.Button.prototype} instead.
		 */
		get button() {
			return this.Button.prototype;
		},
		/**
		 * @legacy Use {@link lib.element.GameEvent.prototype} instead.
		 */
		get event() {
			return this.GameEvent.prototype;
		},
		/**
		 * @legacy Use {@link lib.element.Dialog.prototype} instead.
		 */
		get dialog() {
			return this.Dialog.prototype;
		},
		/**
		 * @legacy Use {@link lib.element.Control.prototype} instead.
		 */
		get control() {
			return this.Control.prototype;
		},
		/**
		 * @legacy Use {@link lib.element.Client.prototype} instead.
		 */
		get client() {
			return this.Client.prototype;
		},
		/**
		 * @legacy Use {@link lib.element.NodeWS.prototype} instead.
		 */
		get nodews() {
			return this.NodeWS.prototype;
		},
		/**
		 * @legacy Use {@link lib.element.Character.prototype} instead.
		 */
		get character() {
			return this.Character.prototype;
		},
	};
}
