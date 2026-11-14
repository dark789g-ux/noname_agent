import { _status, game, get, lib, ui } from "noname";
import type { GameEvent } from "../../gameEvent.js";
import type { Player } from "../../player.js";

type WaitRuntimeEvent = GameEvent & {
	_global_timer?: boolean;
	_global_waiting?: boolean;
	resultOL?: Record<string, any>;
};

export const waitAndTimerMethods = {
	wait(this: Player, callback) {
		if (lib.node) {
			const playerid = this.playerid;
			if (typeof playerid !== "string") return;
			const node = lib.requireNodeServer();
			if (typeof callback == "function") {
				callback._noname_waiting = true;
				node.torespond[playerid] = callback;
			} else {
				node.torespond[playerid] = "_noname_waiting";
			}
			clearTimeout(node.torespondtimeout[playerid]);
			const socket = this.ws;
			if (socket && !socket.closed) {
				const player = this;
				const time = parseInt(lib.configOL.choose_timeout) * 1000;
				if ((_status.event as WaitRuntimeEvent)._global_timer || (_status.event.getParent() as { skillHidden?: boolean }).skillHidden) {
					for (let i = 0; i < game.players.length; i++) {
						game.players[i].showTimer(time);
					}
					player._hide_all_timer = true;
				} else if (!(_status.event as WaitRuntimeEvent)._global_waiting && _status.noclearcountdown !== "direct") {
					player.showTimer(time);
				}
				node.torespondtimeout[playerid] = setTimeout(function () {
					player.unwait("ai");
					const currentSocket = player.ws;
					if (!currentSocket) {
						throw new TypeError("联机等待生命周期错误：玩家连接未初始化");
					}
					currentSocket.ws.close();
				}, time + 5000);
			}
		}
	},
	unwait(this: Player, result) {
		if (this._hide_all_timer) {
			delete this._hide_all_timer;
			for (let i = 0; i < game.players.length; i++) {
				game.players[i].hideTimer();
			}
		} else if (!(get.event() as WaitRuntimeEvent)._global_waiting && (_status.noclearcountdown !== "direct" || (result && result.bool)) && !(result && result._noHidingTimer)) {
			this.hideTimer();
		}
		const playerid = this.playerid;
		if (typeof playerid !== "string") return;
		const node = lib.requireNodeServer();
		clearTimeout(node.torespondtimeout[playerid]);
		delete node.torespondtimeout[playerid];
		if (!(playerid in node.torespond)) {
			return;
		}
		let noresume = false;
		let proceed: boolean | void | (() => void) = undefined;
		const entry = node.torespond[playerid];
		if (typeof entry == "function" && entry._noname_waiting) {
			proceed = entry(result, this);
			if (proceed === false) {
				noresume = true;
			}
		}
		node.torespond[playerid] = result;
		for (const i in node.torespond) {
			const responder = node.torespond[i];
			if (responder == "_noname_waiting") {
				return;
			} else if (responder && typeof responder == "function" && responder._noname_waiting) {
				return;
			}
		}
		_status.event.result = result;
		(_status.event as WaitRuntimeEvent).resultOL = node.torespond;
		node.torespond = {};
		if (typeof proceed == "function") {
			proceed();
		} else if (_status.paused && !noresume) {
			game.resume();
		}

		if (node.waitForResult[playerid]?.length > 0) {
			const current = node.waitForResult[playerid].pop();
			current?.(result);
		}
	},
	tempUnwait(this: Player, result) {
		const playerid = this.playerid;
		if (typeof playerid !== "string") return;
		const node = lib.requireNodeServer();
		if (!(playerid in node.torespond)) {
			return;
		}
		let proceed: boolean | void | (() => void) = undefined;
		const entry = node.torespond[playerid];
		if (typeof entry == "function" && entry._noname_waiting) {
			proceed = entry(result, this);
		}
		if (typeof proceed == "function") {
			proceed();
		}
	},
	showTimer(this: Player, time) {
		if (!time && lib.configOL) {
			time = parseInt(lib.configOL.choose_timeout) * 1000;
		}
		if (_status.connectMode && !game.online) {
			game.broadcast(
				function (player, time) {
					player.showTimer(time);
				},
				this,
				time
			);
		}
		if (this == game.me) {
			return;
		}
		if (this.node.timer) {
			this.node.timer.remove();
		}
		const timer = ui.create.div(".timerbar", this);
		this.node.timer = timer;
		ui.create.div(this.node.timer);
		const bar = ui.create.div(this.node.timer);
		ui.refresh(bar);
		bar.style.transitionDuration = time / 1000 + "s";
		bar.style.transform = "scale(0,1)";
	},
	hideTimer(this: Player) {
		if (_status.connectMode && !game.online && this.playerid) {
			game.broadcast(function (player) {
				player.hideTimer();
			}, this);
		}
		if (this.node.timer) {
			this.node.timer.delete();
			delete this.node.timer;
		}
	},
};
