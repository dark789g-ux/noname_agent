import { _status, lib, get, ui } from "noname";
import { game } from "../index.js";
import type { Game } from "../index.js";
import type { Videos } from "../contracts/gameContract.js";

export const videoControlMethods = {
	playVideo(this: Game, time: string | number, mode: string) {
		if (!_status.replayvideo) {
			localStorage.setItem(lib.configprefix + "playbackmode", lib.config.mode);
		}
		game.saveConfig("mode", mode);
		localStorage.setItem(lib.configprefix + "playback", String(time));
		game.reload();
	},
	playVideoContent(this: Game, video: Videos) {
		const next = game.createEvent("video", false);
		next.video = video;
		ui.system.style.display = "none";
		ui.system.hide();
		ui.arena.style.display = "none";
		ui.arena.hide();
		ui.window.classList.remove("leftbar");
		ui.window.classList.remove("rightbar");
		ui.historybar.style.display = "none";
		_status.event = next;
		_status.paused = false;
		_status.paused2 = false;
		_status.over = false;
		_status.video = true;
		clearTimeout(_status.timeout);
		for (let i in lib.characterPack) {
			for (let j in lib.characterPack[i]) {
				lib.character[j] = lib.character[j] || lib.characterPack[i][j];
			}
		}
		next.setContent("playVideoContent");
		game.loop();
	},
	reload(this: Game) {
		if (_status) {
			if (_status.reloading) {
				return;
			}
			_status.reloading = true;
		}
		if (_status.video && !_status.replayvideo) {
			localStorage.removeItem(lib.configprefix + "playbackmode");
		}
		localStorage.setItem("show_splash_off", "true");
		if (lib.status.reload) {
			_status.waitingToReload = true;
		} else {
			window.location.reload();
		}
	},
	reload2(this: Game) {
		lib.status.reload--;
		if (lib.status.reload == 0 && lib.ondb2.length) {
			const command = lib.ondb2.shift();
			game[command[0]](...command[1]);
		}
		if (lib.status.reload == 0 && lib.ondb.length) {
			const command = lib.ondb.shift();
			game[command[0]](...command[1]);
		}
		if (lib.status.reload || !_status.waitingToReload) {
			return;
		}
		window.location.reload();
		delete _status.waitingToReload;
	},
	reloadCurrent(this: Game) {
		const me = (Reflect.get(_status, "_startPlayerNames") as Player | undefined) ?? game.me;
		let names = [me.name1 || me.name, me.name2];
		if (me.name1 != me.name) {
			names = [me.name];
		}
		game.saveConfig("continue_name", names);
		game.saveConfig("mode", lib.config.mode);
		localStorage.setItem(lib.configprefix + "directstart", "true");
		game.reload();
	},
	update(this: Game, func: Function) {
		lib.updates.push(func);
		if (lib.updates.length === 1) {
			game.run();
		}
		return func;
	},
	unupdate(this: Game, func: Function) {
		lib.updates.remove(func);
	},
	stop(this: Game) {
		cancelAnimationFrame(lib.status.frameId);
	},
	run(this: Game) {
		if (lib.updates.length) {
			cancelAnimationFrame(lib.status.frameId);
			lib.status.frameId = requestAnimationFrame(function (time) {
				if (lib.status.time !== 0) {
					lib.status.delayed += time - lib.status.time;
				}
				lib.status.frameId = requestAnimationFrame(lib.run);
			});
		}
	},
	addVideo(this: Game, type: string, player?: Player | null, content?: object | string | number | boolean | null | undefined) {
		if (_status.video || game.online) {
			return;
		}
		if (!_status.videoInited) {
			if (type == "arrangeLib") {
				const initialVideoPlayer = player && get.itemtype(player) == "player" ? player.dataset.position : undefined;
				lib.video.push({
					type: type,
					player: initialVideoPlayer,
					content: content,
					delay: 0,
				});
			}
			return;
		}
		if (type == "storage" && player && player.updateMarks) {
			player.updateMarks();
		}
		if (game.getVideoName) {
			let time = get.time();
			if (!_status.lastVideoLog) {
				_status.lastVideoLog = time;
			}
			let videoPlayer: string | null | undefined;
			if (player && get.itemtype(player) == "player") {
				videoPlayer = player.dataset.position;
			} else {
				videoPlayer = player == null ? player : undefined;
			}
			lib.video.push({
				type: type,
				player: videoPlayer === null ? undefined : videoPlayer,
				content: content,
				delay: time - _status.lastVideoLog,
			});
			_status.lastVideoLog = time;
		}
		if (type === "init") {
			game.addVideo("cardtag", null, _status.cardtag);
		}
	},
};
