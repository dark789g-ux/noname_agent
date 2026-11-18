import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createIdentityResultMethods() {
	return {
		/**
		 * 根据当前身份模式和场上存活情况结算本机视角的胜负。
		 *
		 * 普通身份局会按主公、忠臣、反贼、内奸、平民的胜利条件判断；
		 * 3v3v2（purple）会先拆分冷暖阵营和野心家，写入联机结算用的胜负名单。
		 */
		checkResult() {
			const me = game.me!._trueMe || game.me;
			if (_status.brawl && _status.brawl.checkResult) {
				_status.brawl.checkResult();
				return;
			} else if (_status.mode == "purple") {
				const winner: any[] = [];
				const loser: any[] = [];
				const ye = game.filterPlayer(current => ["rYe", "bYe"].includes(current.identity), null as unknown as Player[], true);
				const red = game.filterPlayer(current => ["rZhu", "rZhong", "bNei"].includes(current.identity), null as unknown as Player[], true);
				const blue = game.filterPlayer(current => ["bZhu", "bZhong", "rNei"].includes(current.identity), null as unknown as Player[], true);
				game.countPlayer2(
					(current => {
						switch (current.identity) {
							case "rZhu":
								if (ye.length == 0 && game.bZhu!.isDead()) {
									winner.push(current);
								}
								if (current.isDead()) {
									loser.push(current);
								}
								break;
							case "rZhong":
							case "bNei":
								if (ye.length == 0 && game.bZhu!.isDead()) {
									winner.push(current);
								}
								if (game.rZhu!.isDead()) {
									loser.push(current);
								}
								break;
							case "bZhu":
								if (ye.length == 0 && game.rZhu!.isDead()) {
									winner.push(current);
								}
								if (current.isDead()) {
									loser.push(current);
								}
								break;
							case "bZhong":
							case "rNei":
								if (ye.length == 0 && game.rZhu!.isDead()) {
									winner.push(current);
								}
								if (game.bZhu!.isDead()) {
									loser.push(current);
								}
								break;
							default:
								if (red.length + blue.length == 0) {
									winner.push(current);
								} else if (game.rZhu!.isDead() && game.bZhu!.isDead()) {
									loser.push(current);
								}
								break;
						}
					}) as unknown as Parameters<typeof game.countPlayer2>[0],
					true
				);
				const winner2 = winner.slice(0);
				const loser2 = loser.slice(0);
				for (const current of winner.slice()) {
					if (current.isDead()) {
						winner.remove(current);
					}
				}
				for (const current of loser.slice()) {
					if (current.isDead()) {
						loser.remove(current);
					}
				}
				if (winner.length > 0 || loser.length == game.players.length) {
					game.broadcastAll(
						(winner, loser) => {
							_status.winner = winner;
							_status.loser = loser;
						},
						winner,
						loser
					);
					if (loser.length == game.players.length) {
						game.showIdentity!();
						game.over("游戏平局");
					} else if (winner2.includes(me)) {
						game.showIdentity!();
						if (loser2.includes(me)) {
							game.over(false);
						} else {
							game.over(true);
						}
					} else {
						game.showIdentity!();
						game.over(false);
					}
				}
				return;
			}
			if (!game.zhu) {
				if (get.population("fan") == 0) {
					switch (me!.identity) {
						case "fan":
							game.over(false);
							break;
						case "zhong":
							game.over(true);
							break;
						case "commoner":
							game.over(true);
							break;
						default:
							game.over();
							break;
					}
				} else if (get.population("zhong") == 0) {
					switch (me!.identity) {
						case "fan":
							game.over(true);
							break;
						case "zhong":
							game.over(false);
							break;
						case "commoner":
							game.over(true);
							break;
						default:
							game.over();
							break;
					}
				}
				return;
			}
			if (game.zhu.isAlive() && get.population("fan") + get.population("nei") > 0) {
				return;
			}
			if (game.zhong) {
				game.zhong.identity = "zhong";
			}
			game.showIdentity!();
			if (me!.identity == "zhu" || me!.identity == "zhong" || me!.identity == "mingzhong") {
				if (game.zhu.classList.contains("dead")) {
					game.over(false);
				} else {
					game.over(true);
				}
			} else if (me!.identity == "nei") {
				if (game.players.length == 1 + game.players.filter(i => i.identity == "commoner").length && me!.isAlive()) {
					game.over(true);
				} else {
					game.over(false);
				}
			} else if (me!.identity == "fan") {
				if ((get.population("fan") + get.population("zhong") > 0 || get.population("nei") > 1) && game.zhu.classList.contains("dead")) {
					game.over(true);
				} else {
					game.over(false);
				}
			} else if (me!.identity == "commoner") {
				game.over(true);
			}
		},

		/**
		 * 联机结算时检查指定玩家是否胜利。
		 *
		 * @param { Player } player - 要检查结算结果的玩家。
		 * @returns { boolean | null } 返回`true`表示胜利，`false`表示失败；所有玩家均失败时返回`null`。
		 */
		checkOnlineResult(player) {
			if (_status.winner && _status.loser) {
				if (_status.loser.length === game.players.length) {
					return null;
				}
				if (_status.loser.includes(player)) {
					return false;
				}
				if (_status.winner.includes(player)) {
					return true;
				}
			}
			if (game.zhu.isAlive()) {
				return player.identity === "zhu" || player.identity === "zhong" || player.identity === "mingzhong" || (player.identity === "commoner" && player.isAlive());
			} else if ((game.players.length == 1 + game.players.filter(i => i.identity === "commoner").length && game.players[0].identity === "nei") || game.players[0].identity === "commoner") {
				return player.isAlive();
			} else {
				return player.identity === "fan" || (player.identity === "commoner" && player.isAlive());
			}
		},
	};
}
