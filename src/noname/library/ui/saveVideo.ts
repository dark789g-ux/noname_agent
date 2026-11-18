import { game } from "noname";
import { _status } from "noname";
import { lib } from "noname";

export function saveVideo() {
	if (_status.videoToSave) {
		game.export(lib.init.encode(JSON.stringify(_status.videoToSave)), "无名杀 - 录像 - " + _status.videoToSave.name[0] + " - " + _status.videoToSave.name[1]);
	}
}
