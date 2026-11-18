import { _status, lib, ui } from "noname";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const playerLifecycleMethods = {
	/**
	 * @deprecated 请使用addPlayerOL，addPlayer已被废除！
	 */
	addPlayer(this: Game, position: number, character?: string, character2?: string) {
		const totalPlayers = game.players.length + game.dead.length;
		if (typeof position != "number" || !Number.isFinite(position) || position < 0 || position > totalPlayers) {
			position = Math.ceil(Math.random() * totalPlayers);
		}
		const players = game.players.concat(game.dead);
		ui.arena.setNumber(players.length + 1);
		players.forEach(value => {
			const currentPosition = Number.parseInt(value.dataset.position ?? "", 10);
			if (Number.isFinite(currentPosition) && currentPosition >= position) {
				value.dataset.position = String(currentPosition + 1);
			}
		});
		const player = ui.create.player(ui.arena).addTempClass("start");
		player.getId();
		if (character) {
			player.init(character, character2);
		}
		game.players.push(player);
		player.dataset.position = String(position);
		game.arrangePlayers();
		return player;
	},
	addFellow(this: Game, position: number, character?: string, animation?: string) {
		game.addVideo("addFellow", null, [position, character, animation]);
		const player = ui.create.player(ui.arena).addTempClass(animation || "start");
		const fallbackPosition = game.players.length + game.dead.length;
		const nextPosition = typeof position == "number" && Number.isFinite(position) && position != 0 ? position : fallbackPosition;
		player.dataset.position = String(nextPosition);
		player.getId();
		if (character) {
			player.init(character);
		}
		game.players.push(player);
		game.arrangePlayers();
		return player;
	},
	triggerEnter(this: Game, player: Player) {
		const next = game.createEvent("enterGame", false);
		next.player = player;
		next.setContent(() => {
			_status.event.trigger("enterGame");
		});
		return next;
	},
	restorePlayer(this: Game, player: Player) {
		if (game.players.includes(player) || game.dead.includes(player)) {
			return;
		}
		const totalPlayers = game.players.length + game.dead.length;
		let position = Number.parseInt(player.dataset.position ?? "", 10);
		if (!Number.isFinite(position) || position < 0 || position > totalPlayers) {
			position = Math.ceil(Math.random() * totalPlayers);
		}
		const players = game.players.concat(game.dead);
		ui.arena.setNumber(players.length + 1);
		players.forEach(value => {
			const currentPosition = Number.parseInt(value.dataset.position ?? "", 10);
			if (Number.isFinite(currentPosition) && currentPosition >= position) {
				value.dataset.position = String(currentPosition + 1);
			}
		});
		game.players.push(player);
		delete player.removed;
		player.removeAttribute("style");
		player.addTempClass("start");
		ui.arena.appendChild(player);
		game.arrangePlayers();
		return player;
	},
	/**
	 * @deprecated 请使用removePlayerOL，removePlayer已被废除！
	 */
	removePlayer(this: Game, player: Player) {
		if (_status.roundStart == player) {
			_status.roundStart = player.next || player.getNext() || game.players[0];
		}
		const players = game.players.concat(game.dead);
		player.style.left = `${player.getLeft()}px`;
		player.style.top = `${player.getTop()}px`;
		if (player == undefined) {
			player = game.dead[0] || game.getMe().next;
		}
		const parsedPosition = Number.parseInt(player.dataset.position ?? "", 10);
		const position = Number.isFinite(parsedPosition) ? parsedPosition : Math.max(players.indexOf(player), 0);
		players.forEach(value => {
			const currentPosition = Number.parseInt(value.dataset.position ?? "", 10);
			if (Number.isFinite(currentPosition) && currentPosition > position) {
				value.dataset.position = String(currentPosition - 1);
			}
		});
		if (player.isAlive()) {
			player.next.previous = player.previous;
			player.previous.next = player.next;
		}
		player.nextSeat.previousSeat = player.previousSeat;
		player.previousSeat.nextSeat = player.nextSeat;
		player.delete();
		game.players.remove(player);
		game.dead.remove(player);
		ui.arena.setNumber(players.length - 1);
		player.removed = true;
		if (player == game.me) {
			ui.me.hide();
			ui.auto.hide();
			ui.wuxie.hide();
		}
		setTimeout(() => player.removeAttribute("style"), 500);
		return player;
	},
	replacePlayer(this: Game, player: Player, character?: string, character2?: string) {
		player.removed = true;
		const position = parseInt(String(player.dataset.position));
		game.players.remove(player);
		game.dead.remove(player);
		player.delete();
		const player2 = ui.create.player(ui.arena).addTempClass("start");
		if (character) {
			player2.init(character, character2);
		}
		game.players.push(player2);
		player2.dataset.position = String(position);
		player2.nextSeat = player.nextSeat;
		player2.previousSeat = player.previousSeat;
		player2.nextSeat.previousSeat = player2;
		player2.previousSeat.nextSeat = player2;
		let player3 = player2.nextSeat;
		while (player3.isDead()) {
			player3 = player3.nextSeat;
		}
		player3.previous = player2;
		player2.next = player3;
		let player4 = player2.previousSeat;
		while (player4.isDead()) {
			player4 = player4.previousSeat;
		}
		player4.next = player2;
		player2.previous = player4;
		if (_status.roundStart == player) {
			_status.roundStart = player2;
		}
		return player2;
	},
	arrangePlayers(this: Game) {
		const me = game.me;
		if (game.chess && me) {
			let friendCount = 0,
				enemyCount = 0;
			const rand = Math.random() < 0.5,
				sortCount = new Map();
			game.players.forEach(value => {
				if (value.side == me.side) {
					if (rand) {
						sortCount.set(value, value == game.friendZhu ? -2 : 2 * friendCount);
					} else {
						sortCount.set(value, value == game.friendZhu ? -1 : 2 * friendCount + 1);
					}
					friendCount++;
					return;
				}
				if (rand) {
					sortCount.set(value, value == game.enemyZhu ? -1 : 2 * enemyCount + 1);
				} else {
					sortCount.set(value, value == game.enemyZhu ? -2 : 2 * enemyCount);
				}
				enemyCount++;
			});
			game.players.sort((a, b) => sortCount.get(a) - sortCount.get(b));
		} else {
			game.players.sort(lib.sort.position);
		}
		game.players
			.concat(game.dead)
			.sort(lib.sort.position)
			.forEach((value, index, array) => {
				value.previousSeat = index == 0 ? array[array.length - 1] : array[index - 1];
				value.nextSeat = index == array.length - 1 ? array[0] : array[index + 1];
			});
		game.players.forEach((value, index, array) => {
			value.previous = index == 0 ? array[array.length - 1] : array[index - 1];
			value.next = index == array.length - 1 ? array[0] : array[index + 1];
		});
	},
};
