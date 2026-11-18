import type { IdentityPlayerAI } from "../runtimeTypes.js";
import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function normalAttitude(from: Player, to: Player): number | undefined {
	//正常身份模式态度
	if (!game.zhu) {
		if (from.identity === "nei" || to.identity === "nei" || from.identity === "commoner" || to.identity === "commoner") {
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
	if (from.identity !== "nei" && from.identity !== "commoner" && from !== to && get.population("fan") === 0 && identity2 === "zhong") {
		for (const current of game.players) {
			if (current.identity === "nei" && (current.ai as IdentityPlayerAI).identity_mark === "zhong" && (current.ai as IdentityPlayerAI).shown < 1) {
				identity2 = "nei";
				break;
			} else if (current.identity === "commoner" && (current.ai as IdentityPlayerAI).identity_mark === "zhong" && (current.ai as IdentityPlayerAI).shown < 1) {
				identity2 = "commoner";
				break;
			}
		}
	}
	const zhongmode = !game.zhu.isZhu;
	switch (identity) {
		case "zhu": {
			switch (identity2) {
				case "zhu":
					return 10;
				case "zhong":
				case "mingzhong":
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
						return -0.5;
					}
					if (zhongmode && (to.ai as IdentityPlayerAI).sizhong && (to.ai as IdentityPlayerAI).shown < 1) {
						return 6;
					}
					if (get.population("fan") === 1 && get.population("nei") === 1 && game.players.length === 3) {
						const fan = game.players.find(current => current.identity === "fan");
						if (fan && to.hp! > 1 && to.hp! > fan.hp! && to.countCards("he") > fan.countCards("he")) {
							return -3;
						}
						return 0;
					}
					if (situation > 1) {
						return 0;
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
				case "commoner": {
					if (to.identity === "zhong") {
						return 0;
					}
					if (get.population("fan") === 0) {
						if ((to.ai as IdentityPlayerAI).identity_mark === "zhong" && (to.ai as IdentityPlayerAI).shown < 1) {
							return 0;
						}
						return -0.5;
					}
					if (zhongmode && (to.ai as IdentityPlayerAI).sizhong && (to.ai as IdentityPlayerAI).shown < 1) {
						return 6;
					}
					if (game.players.length === 3) {
						const fan = game.players.find(current => current.identity === "fan");
						if (fan && to.hp! > 1 && to.hp! > fan.hp! && to.countCards("he") > fan.countCards("he")) {
							return -3;
						}
						return 3;
					}
					if (situation < 0 && game.zhu && game.zhu.hp! <= 2) {
						return -3.8;
					}
					return Math.max(-4, 2 - get.population("fan"));
				}
			}
			break;
		}
		case "zhong":
		case "mingzhong":
			switch (identity2) {
				case "zhu":
					return 10;
				case "zhong":
				case "mingzhong":
					return 4;
				case "nei":
					if (get.population("fan") === 0) {
						return -2;
					}
					if (zhongmode && (to.ai as IdentityPlayerAI).sizhong && (to.ai as IdentityPlayerAI).shown < 1) {
						return 6;
					}
					return Math.min(3, -situation);
				case "fan":
					return -8;
				case "commoner":
					return Math.min(3, Math.max(-3, situation - 0.2));
			}
			break;
		case "nei": {
			if (identity2 === "zhu" && game.players.length === 2) {
				return -10;
			}
			if (from !== to && identity2 !== "zhu" && identity2 !== "commoner" && game.players.length === 3) {
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
							return -1.7;
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
					if (zhongmode && situation < 2) {
						num = 4;
					}
					if (strategy === 2) {
						num--;
					}
					if (strategy === 3) {
						num++;
					}
					return num;
				case "mingzhong":
					if (zhongmode) {
						if ((from.ai as IdentityPlayerAI).sizhong === undefined) {
							(from.ai as IdentityPlayerAI).sizhong = Math.random() < 0.5;
						}
						if ((from.ai as IdentityPlayerAI).sizhong) {
							return 6;
						}
					}
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
					} else {
						num = -3;
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
					} else if (situation < 0 || get.population("zhong") + get.population("mingzhong") === 0) {
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
				case "commoner":
					if (game.players.length <= 4) {
						return 5;
					}
					return Math.min(Math.max(-situation, -2), 2);
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
					if (!zhongmode && game.zhu.hp! >= 3 && to.hp === 1) {
						return -10;
					}
					return -7;
				case "mingzhong":
					return -5;
				case "nei":
					if (zhongmode && (to.ai as IdentityPlayerAI).sizhong) {
						return -7;
					}
					if (get.population("fan") === 1) {
						return 0;
					}
					if (get.population("zhong") + get.population("mingzhong") === 0) {
						return -7;
					}
					if (game.zhu && game.zhu.hp! <= 2) {
						return -1;
					}
					return Math.min(3, situation);
				case "fan":
					return 5;
				case "commoner":
					return 2 * get.population("fan") - 3;
			}
			break;
		case "commoner":
			switch (identity2) {
				case "zhu":
					if (situation > 0) {
						return 2 * Math.min(4, to.hp! + to.countCards("h") / 4 - 2);
					}
					if (situation >= -3 && game.zhu) {
						return to.hp! - 2 + to.countCards("h") / 4;
					} //return Math.min(-0.1,5-game.zhu.hp);
					return to.hp! + to.countCards("h") / 3 - 4;
				case "zhong":
					if (situation > 0) {
						if (to.hp! >= 2) {
							return Math.min(3, Math.max(1, to.hp! + to.countCards("h") / 4 - 4));
						}
						return 0;
					}
					return -2;
				case "nei":
					if (game.players.length === 3 && get.population("nei") === 1) {
						return Math.min(3.5, to.hp! - 1.5 + to.countCards("h") / 3) - (to.hp! < (game.zhu ? game.zhu.hp! : 0) ? 4 : 0);
					}
					if (game.players.length <= 4 && get.population("nei") === 1) {
						return Math.min(5, to.hp! - 1.5 + to.countCards("h") / 3);
					}
					if (situation > 0) {
						return -3;
					}
					return 0;
				case "fan":
					if (situation < 0) {
						return to.hp! + to.countCards("h") / 4 - 1.7 * get.population("fan") + 2;
					}
					if (situation === 0) {
						return 0;
					}
					return 0.55 * get.population("fan") - 2.1;
				case "commoner":
					return from === to ? 10 : to.hp! <= 2 ? -2 : 0;
			}
			break;
	}
}
