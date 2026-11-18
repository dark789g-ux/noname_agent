import type { IdentityPlayerAI } from "../runtimeTypes.js";
import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function stratagemAttitude(from: Player, to: Player): number | undefined {
	if (!game.zhu) {
		if (from.identity === "nei" || to.identity === "nei") {
			return -1;
		}
		if (from.identity === to.identity) {
			return 6;
		}
		return -6;
	}
	const situation = get.situation!();
	const identity = from.identity;
	let identity2 = to.identity;
	if (identity2 === "zhu" && !to.isZhu) {
		identity2 = "zhong";
		if (from === to) {
			return 10;
		}
	}
	if (from !== to && to.identity === "nei" && (to.ai as IdentityPlayerAI).shown < 1 && ((to.ai as IdentityPlayerAI).identity_mark === "fan" || (to.ai as IdentityPlayerAI).identity_mark === "zhong")) {
		identity2 = (to.ai as IdentityPlayerAI).identity_mark!;
	}
	if (from.identity !== "nei" && from !== to && get.population("fan") === 0 && identity2 === "zhong") {
		for (const current of game.players) {
			if (current.identity === "nei" && (current.ai as IdentityPlayerAI).identity_mark === "zhong" && (current.ai as IdentityPlayerAI).shown < 1) {
				identity2 = "nei";
				break;
			}
		}
	}
	switch (identity) {
		case "zhu": {
			switch (identity2) {
				case "zhu":
					return 10;
				case "zhong":
					return 6;
				case "nei": {
					if (game.players.length === 2) {
						return -10;
					}
					if (to.identity === "zhong") {
						return 0;
					}
					if (get.population("fan") === 0) {
						if ((to.ai as IdentityPlayerAI).identity_mark === "zhong" && (to.ai as IdentityPlayerAI).shown < 1) {
							return 0;
						}
						return -1;
					}
					if (get.population("fan") === 1 && get.population("nei") === 1 && game.players.length === 3) {
						const fan = game.players.find(current => current.identity === "fan");
						if (fan && to.hp! > 1 && to.hp! > fan.hp! && to.countCards("he") > fan.countCards("he")) {
							return -3;
						}
						return 0;
					}
					if (situation > 1) {
						return Math.max((situation - 8) / 3, -2);
					}
					return Math.min(3, get.population("fan"));
				}
				case "fan": {
					if (get.population("fan") === 1 && get.population("nei") === 1 && game.players.length === 3) {
						const nei = game.players.find(current => current.identity === "nei");
						if (nei && nei.hp! > 1 && nei.hp! > to.hp! && nei.countCards("he") > to.countCards("he")) {
							return 0;
						}
						return -3;
					}
					return -4;
				}
			}
			break;
		}
		case "zhong":
			switch (identity2) {
				case "zhu":
					return 10;
				case "zhong":
					if (from === to) {
						return 5;
					}
					if (get.population("zhong") > 1) {
						return 3;
					}
					return 4;
				case "nei":
					if (get.population("fan") === 0 && get.population("zhong") === 1) {
						return -2;
					}
					if (get.population("zhong") >= 1) {
						return Math.min(3, -situation);
					}
					return 3;
				case "fan":
					return -8;
			}
			break;
		case "nei": {
			if (identity2 === "zhu" && game.players.length === 2) {
				return -10;
			}
			if (from !== to && identity2 !== "zhu" && game.players.length === 3) {
				return -8;
			}
			const strategy = get.aiStrategy();
			if (strategy === 4) {
				if (from === to) {
					return 10;
				}
				return 0;
			}
			let num;
			switch (identity2) {
				case "zhu":
					if (strategy === 6) {
						return -1;
					}
					if (strategy === 5) {
						return 10;
					}
					if (to.hp! <= 0) {
						return 10;
					}
					if (get.population("fan") === 1) {
						const fan = game.players.find(current => current.identity === "fan");
						if (fan && to.hp! > 1 && to.hp! > fan.hp! && to.countCards("he") > fan.countCards("he")) {
							return -3;
						}
						return 0;
					}
					if (situation > 1 || get.population("fan") === 0) {
						num = 0;
					} else {
						num = get.population("fan") + Math.max(0, 3 - game.zhu.hp!);
					}
					if (strategy === 2) {
						num--;
					}
					if (strategy === 3) {
						num++;
					}
					return num;
				case "zhong":
					if (strategy === 5) {
						return Math.min(0, -situation);
					}
					if (strategy === 6) {
						return Math.max(-1, -situation);
					}
					if (get.population("fan") === 0) {
						num = -5;
					} else if (situation <= 0) {
						num = 0;
					} else if (game.zhu && game.zhu.hp! < 2) {
						num = 0;
					} else if (game.zhu && game.zhu.hp === 2) {
						num = -1;
					} else if (game.zhu && game.zhu.hp! <= 2 && situation > 1) {
						num = -1;
					} else {
						num = -2;
					}
					if (strategy === 2) {
						num--;
					}
					if (strategy === 3) {
						num++;
					}
					return num;
				case "nei":
					if (from === to) {
						return 10;
					}
					if ((from.ai as IdentityPlayerAI).friend.includes(to)) {
						return 5;
					}
					if (get.population("fan") + get.population("zhong") > 0) {
						return 0;
					}
					return -5;
				case "fan":
					if (strategy === 5) {
						return Math.max(-1, situation);
					}
					if (strategy === 6) {
						return Math.min(0, situation);
					}
					if ((game.zhu && game.zhu.hp! <= 2 && situation < 0) || situation < -1) {
						num = -3;
					} else if (situation < 0 || get.population("zhong") === 0) {
						num = -2;
					} else if ((game.zhu && game.zhu.hp! >= 4 && situation > 0) || situation > 1) {
						num = 1;
					} else {
						num = 0;
					}
					if (strategy === 2) {
						num++;
					}
					if (strategy === 3) {
						num--;
					}
					return num;
			}
			break;
		}
		case "fan":
			switch (identity2) {
				case "zhu":
					if (get.population("nei") > 0) {
						if (situation === 1) {
							return -6;
						}
						if (situation > 1) {
							return -5;
						}
					}
					return -8;
				case "zhong":
					if (game.zhu.hp! >= 3 && to.hp === 1) {
						return -10;
					}
					return -7;
				case "nei":
					if (get.population("fan") === 1) {
						return 0;
					}
					if (get.population("zhong") === 0) {
						return -2;
					}
					if (game.zhu && game.zhu.hp! <= 2 && game.zhu.identityShown) {
						return -1;
					}
					return 3;
				case "fan":
					return 5;
			}
			break;
	}
}
