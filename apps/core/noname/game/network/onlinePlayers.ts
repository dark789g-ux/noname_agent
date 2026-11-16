import { _status, lib, get, ui } from "noname";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const onlinePlayersMethods = {
	/**
	 * 用于主机同步手牌状态
	 */
	syncHandcard(this: Game, player: Player, id_list: string[]) {
		game.broadcastAll(
			(player, id_list) => {
				const sortFunc = (a: Card, b: Card) => id_list.indexOf(a.cardid) - id_list.indexOf(b.cardid);
				player.sortHandcard(sortFunc);
			},
			player,
			id_list.slice().reverse()
		);
	},
	/**
	 * 添加一个新玩家到target的上家或下家（默认为上家）
	 */
	async addPlayerOL(
		this: Game,
		target: Player,
		character?: string | null,
		character2?: string | null,
		isNext?: boolean,
		config: { source?: Player; animate?: ((player: Player) => Promise<any>) | false } = {}
	): Promise<Player | undefined> {
		if (get.itemtype(target) != "player") {
			return;
		}
		const addPlayer = async function (id: string, target: Player, character: string | undefined | null, character2: string | undefined | null, isNext: boolean | undefined, config: any) {
			let { source, animate } = config;
			const players = game.players.concat(game.dead);
			const arenaNumberValue = ui.arena.dataset.number;
			const targetPositionValue = target.dataset.position;
			if (typeof arenaNumberValue !== "string" || arenaNumberValue.trim() === "" || typeof targetPositionValue !== "string" || targetPositionValue.trim() === "") {
				return;
			}
			const arenaNumber = parseInt(arenaNumberValue, 10);
			const targetPosition = parseInt(targetPositionValue, 10);
			if (Number.isNaN(arenaNumber) || Number.isNaN(targetPosition)) {
				return;
			}
			ui.arena.setNumber(arenaNumber + 1);
			let position = !isNext ? targetPosition : targetPosition + 1;
			if (position == 0) {
				position = arenaNumber;
			}
			players.forEach(value => {
				const valuePosition = value.dataset.position;
				if (typeof valuePosition !== "string" || valuePosition.trim() === "") {
					return;
				}
				const parsedValuePosition = parseInt(valuePosition, 10);
				if (!Number.isNaN(parsedValuePosition) && parsedValuePosition >= position) {
					value.dataset.position = String(parsedValuePosition + 1);
				}
			});
			const player = ui.create.player(ui.arena).addTempClass("start");
			player.playerid = id;
			player._source = source || true;
			if (_status.connectMode) {
				lib.playerOL[id] = player;
			} else {
				game.playerMap[id] = player;
			}
			if (character) {
				player.init(character, character2);
			}
			game.players.push(player);
			player.dataset.position = String(position);
			game.arrangePlayers();
			if (animate == false) {
				animate = () => new Promise<void>(resolve => resolve());
			}
			animate ??= function (player: Player) {
				const parent = player.parentElement!;
				const drop = player.animate(
					[
						{
							transform: "translate(200px, -1000px) scale(0.5) rotate(-15deg)",
							filter: "brightness(5) blur(10px)",
							opacity: 0,
						},
						{
							transform: "translate(0, 0) scale(1) rotate(0deg)",
							filter: "brightness(1) blur(0px)",
							opacity: 1,
							offset: 1,
						},
					],
					{
						duration: 600,
						easing: "cubic-bezier(0.85, 0, 0.15, 1)",
					}
				);
				return drop.finished.then(() => {
					const list: Promise<any>[] = [];
					const shock = parent.animate([{ transform: "translate(0, 0)" }, { transform: "translate(-10px, 15px)" }, { transform: "translate(10px, -10px)" }, { transform: "translate(-5px, 5px)" }, { transform: "translate(0, 0)" }], {
						duration: 300,
						easing: "ease-out",
					}).finished;
					list.push(shock);
					const wave = document.createElement("div");
					Object.assign(wave.style, {
						position: "absolute",
						top: `50%`,
						left: `50%`,
						width: "10px",
						height: "10px",
						marginLeft: "-5px",
						marginTop: "-5px",
						borderRadius: "50%",
						border: "4px solid #FFFFFF",
						boxShadow: "0 0 15px #FFD700, 0 0 30px #FF4500",
						zIndex: "5",
						pointerEvents: "none",
						mixBlendMode: "screen",
					});
					player.appendChild(wave);
					const shockWave = wave
						.animate(
							[
								{
									transform: "scale(1)",
									opacity: 1,
									borderWidth: "10px",
									borderColor: "#FFFFFF",
									boxShadow: "0 0 20px #FFF, 0 0 40px #FFD700",
								},
								{
									transform: "scale(10)",
									opacity: 0.8,
									borderWidth: "8px",
									borderColor: "#FF8C00",
									boxShadow: "0 0 50px #FF4500, 0 0 100px #8B0000",
									offset: 0.3,
								},
								{
									transform: "scale(40)",
									opacity: 0,
									borderWidth: "0px",
									borderColor: "#8B0000",
									boxShadow: "0 0 60px #FF4500, 0 0 100px transparent",
								},
							],
							{
								duration: 1000,
								easing: "cubic-bezier(0.1, 0.5, 0.2, 1)",
								fill: "forwards",
							}
						)
						.finished.then(() => wave.remove());
					list.push(shockWave);
					return Promise.allSettled(list);
				});
			};
			await animate(player);
			return player;
		};
		const id = get.id();
		const players = game.players.concat(game.dead);
		game.broadcast(addPlayer, id, target, character, character2, isNext, config);
		const player = await addPlayer(id, target, character, character2, isNext, config);
		if (!player) {
			return;
		}
		await game.delay(2);
		const firstSeat = players.find(value => value.getSeatNum() == 1);
		if (firstSeat) {
			const targetSeat = target.getSeatNum();
			const seatNum = !isNext ? (targetSeat == 1 ? players.length + 1 : targetSeat) : targetSeat + 1;
			player.setSeatNum(seatNum);
			players.forEach(value => {
				if (seatNum && value.getSeatNum() >= seatNum) {
					value.setSeatNum(value.getSeatNum() + 1);
				}
			});
		}
		player.actionHistory = new Array(players[0].actionHistory.length).fill({
			useCard: [],
			respond: [],
			skipped: [],
			lose: [],
			gain: [],
			sourceDamage: [],
			damage: [],
			custom: [],
			useSkill: [],
		});
		for (let i = 0; i < players[0].actionHistory.length; i++) {
			["isRound", "isSkipped"].forEach(key => {
				if (players[0].actionHistory[i][key]) {
					player.actionHistory[i][key] = true;
				}
			});
		}
		player.stat = new Array(players[0].stat.length).fill({
			card: {},
			skill: {},
			triggerSkill: {},
		});
		for (let i = 0; i < players[0].stat.length; i++) {
			["isRound", "isSkipped"].forEach(key => {
				if (players[0].stat[i][key]) {
					player.stat[i][key] = true;
				}
			});
		}
		return player;
	},
	/**
	 * 移除一名玩家，单机联机都可用
	 */
	async removePlayerOL(this: Game, player: Player, config: { animate?: ((player: Player) => Promise<any>) | false } = {}): Promise<Player | undefined> {
		if (get.itemtype(player) != "player") {
			return;
		}
		const cards = player.getCards("hejsx");
		if (cards.length) {
			game.log(player, "将", cards, "置入弃牌堆");
			await player.lose(cards, ui.discardPile).set("_triggered", null);
		}
		const players = game.players.concat(game.dead);
		if (player.getSeatNum() > 0) {
			const seatNum = player.getSeatNum();
			players.forEach(value => {
				if (value.getSeatNum() > seatNum) {
					value.setSeatNum(value.getSeatNum() - 1);
				}
			});
		}
		const ClientElement = lib.element.Client;
		const node = lib.getNodeServer();
		if (player.ws instanceof ClientElement || player == game.me) {
			const ws = player.ws;
			if (ws instanceof ClientElement) {
				node?.observing.push(ws);
			}
			delete player.ws;
			if (!ui.removeObserve && node?.observing.length) {
				ui.removeObserve = ui.create.system(
					"移除旁观",
					function (this: HTMLDivElement) {
						lib.configOL.observe = false;
						if (game.onlineroom) {
							game.send("server", "config", lib.configOL);
						}
						const server = lib.requireNodeServer();
						while (server.observing.length) {
							const observer = server.observing.shift();
							if (observer) {
								observer.ws.close();
							}
						}
						this.remove();
						delete ui.removeObserve;
					},
					true,
					true
				);
			}
		}
		if (_status.connectMode && player.playerid != null) {
			delete lib.playerOL[player.playerid];
		}
		const evt = get.event();
		const loop = evt.getParent("phaseLoop", true);
		if (loop?.player == player) {
			loop.player = player.previousSeat;
		}
		const removePlayer = async (player: Player, config: any, configOL: any) => {
			let { animate } = config;
			if (_status.roundStart == player) {
				_status.roundStart = player.next || player.getNext() || game.players[0];
			}
			player.style.left = `${player.getLeft()}px`;
			player.style.top = `${player.getTop()}px`;
			if (player.isAlive()) {
				player.next.previous = player.previous;
				player.previous.next = player.next;
			}
			player.nextSeat.previousSeat = player.previousSeat;
			player.previousSeat.nextSeat = player.nextSeat;
			game.players.remove(player);
			game.dead.remove(player);
			if (animate == false) {
				animate = () => new Promise<void>(resolve => resolve());
			}
			animate ??= function (player: Player) {
				const shardCount = 30;
				const list: Promise<any>[] = [];
				for (let i = 0; i < shardCount; i++) {
					const shard = document.createElement("div");
					shard.style.cssText = `
						position: absolute;
						pointer-events: none;
						background: #e0f7fa;
						border: 1px solid #222;
						z-index: 100;
					`;
					const size = Math.random() * 15 + 5;
					shard.style.width = `${size}px`;
					shard.style.height = `${size}px`;
					shard.style.left = `50%`;
					shard.style.top = `50%`;
					player.appendChild(shard);

					const destinationX = (Math.random() - 0.5) * 500;
					const destinationY = (Math.random() - 0.5) * 500;
					const rotation = Math.random() * 720 - 360;

					list.push(
						shard
							.animate(
								[
									{ transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
									{ transform: `translate(${destinationX}px, ${destinationY}px) rotate(${rotation}deg) scale(0)`, opacity: 0 },
								],
								{
									duration: 1000 + Math.random() * 500,
									easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
									fill: "forwards",
								}
							)
							.finished.then(() => shard.remove())
					);
				}

				const animation = player.animate(
					[
						{ transform: "scale(1)", filter: "brightness(1) grayscale(0)", opacity: 1 },
						{ transform: "scale(1.1)", filter: "brightness(2) grayscale(1)", opacity: 0.5, offset: 0.2 },
						{ transform: "scale(0.8)", filter: "brightness(0) grayscale(1)", opacity: 0 },
					],
					{ duration: 1000, fill: "forwards" }
				).finished;
				list.push(animation);
				return Promise.allSettled(list);
			};
			await animate(player);
			player.classList.add("dead");
			player.classList.add("out");
			player.style.display = "none";
			player.delete();
			const players = game.players.concat(game.dead);
			const positionValue = player.dataset.position;
			const position = typeof positionValue === "string" && positionValue.trim() !== "" ? parseInt(positionValue, 10) : NaN;
			if (!Number.isNaN(position)) {
				players.forEach(value => {
					const valuePosition = value.dataset.position;
					if (typeof valuePosition !== "string" || valuePosition.trim() === "") {
						return;
					}
					const parsedValuePosition = parseInt(valuePosition, 10);
					if (!Number.isNaN(parsedValuePosition) && parsedValuePosition > position) {
						value.dataset.position = String(parsedValuePosition - 1);
					}
				});
			}
			const arenaNumberValue = ui.arena.dataset.number;
			if (typeof arenaNumberValue === "string" && arenaNumberValue.trim() !== "") {
				const arenaNumber = parseInt(arenaNumberValue, 10);
				if (!Number.isNaN(arenaNumber)) {
					ui.arena.setNumber(arenaNumber - 1);
				}
			}
			player.removed = true;
			if (player == game.me) {
				const func = (player: Player, config: any) => {
					const replacement = game.players.find(i => i != player);
					if (!replacement) {
						throw new TypeError("Spectating requires another player");
					}
					game.swapPlayer(replacement);
					const replacePlayer = function (this: Player, e: any) {
						if (!_status.auto || !game.notMe) {
							return;
						}
						game.swapPlayer(this || e.target.parentElement);
					};
					game.players.forEach(p => p.addEventListener(lib.config.touchscreen ? "touchend" : "click", replacePlayer));
					game.notMe = true;
					_status.auto = true;
					if (game.online) {
						if (!config.observe_handcard) {
							ui.arena.classList.add("observe");
						}
						game.observe = true;
					}
				};
				func(player, configOL);
				ui.auto.hide();
				ui.wuxie.hide();
			}
			setTimeout(() => {
				player.removeAttribute("style");
			}, 500);
		};
		game.broadcast(removePlayer, player, config, get.copy(lib.configOL));
		await removePlayer(player, config, get.copy(lib.configOL));
		await game.delay(2);
		player.dieAfter?.();
		return player;
	},
};
