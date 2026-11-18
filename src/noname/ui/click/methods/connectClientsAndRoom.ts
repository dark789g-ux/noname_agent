import { lib, game, get, _status, ui } from "noname";
import type { ConnectClientsButton, ConnectRoomTarget } from "../contracts/domTargetsContract.js";

export const connectClientsAndRoomMethods = {
	connectClients(this: ConnectClientsButton) {
		if (!this.info) {
			return;
		}
		const button = this;
		const layer = ui.create.div(".poplayer", ui.window);
		const uiintro = ui.create.dialog("hidden", "notouchscroll");
		this.classList.add("active");
		if (lib.config.touchscreen) {
			lib.setScroll(uiintro.contentContainer);
		}
		layer.listen(function (this: HTMLDivElement) {
			if (_status.clicked) {
				_status.clicked = false;
				return;
			}
			button.classList.remove("active");
			uiintro.delete();
			this.delete();
		});
		uiintro.listen(function () {
			_status.clicked = true;
		});
		uiintro.style.zIndex = "21";
		uiintro.classList.add("popped");
		uiintro.classList.add("static");
		uiintro.classList.add("onlineclient");
		uiintro.style.width = "180px";
		uiintro.style.height = "300px";
		uiintro.style.left = "auto";
		uiintro.style.right = "20px";
		uiintro.style.top = "auto";
		uiintro.style.bottom = "75px";

		uiintro.refresh = function () {
			if (button.focused) {
				return;
			}
			uiintro.content.innerHTML = "";
			uiintro.addText("发状态");
			const textContainer = uiintro.content.lastElementChild;
			if (textContainer instanceof HTMLElement && textContainer.lastElementChild instanceof HTMLElement) {
				button.textnode = textContainer.lastElementChild;
			}
			uiintro.add('<input type="text" style="width:calc(100% - 10px);resize: none;border: none;border-radius: 2px;box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 0px 1px;margin-top: -2px;margin-bottom: 2px;">');
			const inputContainer = uiintro.content.lastElementChild;
			if (inputContainer instanceof HTMLElement) {
				inputContainer.style.paddingTop = "0";
				const input = inputContainer.lastElementChild;
				if (input instanceof HTMLInputElement) {
					button.input = input;
				}
			}
			button.input.onfocus = function () {
				button.focused = true;
			};
			button.input.onblur = function () {
				delete button.focused;
			};
			if (button.interval) {
				button.input.disabled = true;
				button.input.style.opacity = "0.6";
				if (button.intervaltext) {
					button.textnode.innerHTML = button.intervaltext;
				}
			}
			button.input.onkeydown = function (e) {
				if (e.key == "Enter" && !this.disabled) {
					game.send("server", "status", this.value);
					this.blur();
					this.disabled = true;
					this.style.opacity = "0.6";
					button.textnode.innerHTML = "发状态(10)";
					button.intervaltext = button.textnode.innerHTML;
					let num = 10;
					button.input.disabled = true;
					button.input.style.opacity = "0.6";
					this.value = "";
					button.interval = setInterval(function () {
						num--;
						if (num > 0) {
							button.textnode.innerHTML = "发状态(" + num + ")";
							button.intervaltext = button.textnode.innerHTML;
						} else {
							button.textnode.innerHTML = "发状态";
							button.input.disabled = false;
							button.input.style.opacity = "";
							clearInterval(button.interval);
							delete button.interval;
							delete button.intervaltext;
						}
					}, 1000);
				}
			};

			for (let i = 0; i < button.info.length; i++) {
				const node = ui.create.div(".menubutton.videonode.pointerdiv", uiintro.content);
				ui.create.div(".menubutton.videoavatar", node).setBackground(button.info[i][1] || "caocao", "character");
				if (button.info[i][4] == game.wsid) {
					ui.create.div(".name", '<span class="thundertext thunderauto">' + (button.info[i][0] || "无名玩家"), node);
				} else if (button.info[i][2]) {
					ui.create.div(".name", button.info[i][0] || "无名玩家", node);
				} else {
					ui.create.div(".name", '<span style="opacity:0.6">' + (button.info[i][0] || "无名玩家"), node);
				}
				const status = button.info[i][3];
				if (typeof status == "string" && status) {
					ui.create.div(".videostatus", node, get.plainText(status.slice(0, 80)));
					node.classList.add("videonodestatus");
				}
			}
		};

		uiintro.refresh?.();
		ui.window.appendChild(uiintro);
		_status.connectClientsCallback = function () {
			if (uiintro.parentNode == ui.window) {
				uiintro.refresh?.();
			}
		};
	},
	connectroom(this: ConnectRoomTarget, _e?: Event) {
		if (_status.dragged || _status.clicked || ui.intro) {
			return;
		}
		if (this.roomfull) {
			alert("房间已满");
		} else if (this.roomgaming && !game.onlineID) {
			if (this.config && this.config.observe) {
				alert("房间暂时不可旁观");
			} else {
				alert("房间不允许旁观");
			}
		} else if (!this.roomempty && this.version != lib.versionOL) {
			if (Number(this.version) > Number(lib.versionOL)) {
				alert("加入失败：你的游戏版本过低");
			} else {
				alert("加入失败：房主的游戏版本过低");
			}
		} else if (!_status.enteringroom) {
			_status.enteringroom = true;
			_status.enteringroomserver = this.serving;
			game.send("server", "enter", this.key, get.connectNickname(), lib.config.connect_avatar);
		}
	},
};
