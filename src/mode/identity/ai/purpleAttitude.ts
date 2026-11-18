import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function purpleAttitude(from: Player, to: Player): number {
	if (["rZhu", "rZhong", "bNei"].includes(from.identity)) {
		if (to.identity === "rZhu") {
			return 8;
		}
		if (["rZhong", "bNei"].includes(to.identity)) {
			return 7;
		}
		return -7;
	}
	if (["bZhu", "bZhong", "rNei"].includes(from.identity)) {
		if (to.identity === "bZhu") {
			return 8;
		}
		if (["bZhong", "rNei"].includes(to.identity)) {
			return 7;
		}
		return -7;
	}
	if (["rYe", "bYe"].includes(to.identity)) {
		return 7;
	}
	if (["rZhu", "bZhu"].includes(to.identity) && game.hasPlayer(current => ["rZhong", "bZhong", "rNei", "bNei"].includes(current.identity))) {
		return 6.5;
	}
	return -7;
}
