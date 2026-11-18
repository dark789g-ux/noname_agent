import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

import { purpleAttitude } from "./purpleAttitude.js";
import { stratagemAttitude } from "./stratagemAttitude.js";
import { normalAttitude } from "./normalAttitude.js";
export function realAttitude(from: Player, to: Player): number | undefined {
	if (_status.mode === "purple") return purpleAttitude(from, to);
	if (_status.mode === "stratagem") {
		const result = stratagemAttitude(from, to);
		if (result !== undefined) return result;
	}
	return normalAttitude(from, to);
}

export function createRealAttitude() {
	return {
		realAttitude(from: Player, to: Player): number | undefined {
			return realAttitude(from, to);
		},
	}.realAttitude;
}
