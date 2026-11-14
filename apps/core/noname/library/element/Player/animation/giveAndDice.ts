import { _status, game, get, lib, ui } from "noname";
import type { Card, Player } from "../../index.js";
import type { DiceNode, DiceRoll } from "../contracts/instanceFieldsContract.js";
import { replaceThrownCardsetion } from "../dom/nodeGuards.js";

export const giveAndDiceMethods = {
	throwDice(this: Player, num?: number): void {
		if (typeof num != "number") {
			num = get.rand(6) + 1;
			_status.event.num = num;
		}
		if (lib.config.test_game != null) {
			return;
		}
		if (!game.online) {
			game.pause();
		}
		game.broadcastAll(function (num) {
			let diceContainer = ui.create.div(".fullsize.dice-container", ui.window);
			ui.window.classList.add("dicepaused");
			const roll: DiceRoll = function (deg) {
				if (typeof deg == "number") {
					this.current[0] += deg;
					deg = this.current;
				}
				const current = deg.slice(0);
				this.current = current;
				this.style.transform = "rotateX(" + current[0] + "deg) rotateY(" + current[1] + "deg) rotateZ(" + current[2] + "deg)";
			};
			let dice: DiceNode = Object.assign(ui.create.div(".dice"), {
				current: [] as number[],
				roll,
			});
			let side: HTMLDivElement;

			side = ui.create.div(".side.front", dice);
			ui.create.div(".dot.center", side);
			ui.create.div(".side.front.inner", dice);

			side = ui.create.div(".side.top", dice);
			ui.create.div(".dot.dtop.dleft", side);
			ui.create.div(".dot.dbottom.dright", side);
			ui.create.div(".side.top.inner", dice);

			side = ui.create.div(".side.right", dice);
			ui.create.div(".dot.dtop.dleft", side);
			ui.create.div(".dot.center", side);
			ui.create.div(".dot.dbottom.dright", side);
			ui.create.div(".side.right.inner", dice);

			side = ui.create.div(".side.left", dice);
			ui.create.div(".dot.dtop.dleft", side);
			ui.create.div(".dot.dtop.dright", side);
			ui.create.div(".dot.dbottom.dleft", side);
			ui.create.div(".dot.dbottom.dright", side);
			ui.create.div(".side.left.inner", dice);

			side = ui.create.div(".side.bottom", dice);
			ui.create.div(".dot.center", side);
			ui.create.div(".dot.dtop.dleft", side);
			ui.create.div(".dot.dtop.dright", side);
			ui.create.div(".dot.dbottom.dleft", side);
			ui.create.div(".dot.dbottom.dright", side);
			ui.create.div(".side.bottom.inner", dice);

			side = ui.create.div(".side.back", dice);
			ui.create.div(".dot.dtop.dleft", side);
			ui.create.div(".dot.dtop.dright", side);
			ui.create.div(".dot.dbottom.dleft", side);
			ui.create.div(".dot.dbottom.dright", side);
			ui.create.div(".dot.center dleft", side);
			ui.create.div(".dot.center dright", side);
			ui.create.div(".side.back.inner", dice);

			ui.create.div(".side.cover.x", dice);
			ui.create.div(".side.cover.y", dice);
			ui.create.div(".side.cover.z", dice);

			let map: Record<number, number[]> = {
				1: [75, 0, 45],
				2: [-15, 45, 0],
				3: [165, -45, 90],
				4: [345, -45, 90],
				5: [345, -45, 180],
				6: [255, 0, 135],
			};
			dice.roll(map[num]);
			diceContainer.appendChild(dice);
			ui.refresh(dice);
			dice.roll(1025);

			dice.addEventListener("webkitTransitionEnd", function () {
				if (!dice.over) {
					dice.style.transition = "transform 0.8s ease";
					dice.roll(-20);
					dice.over = true;
				} else if (!dice.resumed) {
					setTimeout(function () {
						diceContainer.delete();
						ui.window.classList.remove("dicepaused");
					}, 300);
					if (!game.online) {
						setTimeout(game.resume, 800);
					}
					dice.resumed = true;
				}
			});
		}, num);
	},
	$giveAuto(this: Player, card: Card | Card[] | number, player: Player, log?: boolean): void {
		if (Array.isArray(card) && card.length == 0) {
			return;
		}
		if (_status.connectMode || (!this.isUnderControl(true) && !player.isUnderControl(true))) {
			if (Array.isArray(card)) {
				card = card.length;
			} else {
				card = 1;
			}
		}
		return this.$give(card, player, log);
	},
	$give(this: Player, card, player: Player, log?: boolean, init?: boolean, cardsetion?: string | false | null): void {
		if (!cardsetion && cardsetion !== false && lib.config.card_animation_info) {
			let evt = get.cardsetion(null, true);
			if (evt && evt.player == player) {
				cardsetion = get.cardsetion(player);
			} else {
				cardsetion = get.cardsetion(this);
			}
		}
		if (init !== false) {
			game.broadcast(
				function (source, card, player, init, cardsetion) {
					source.$give(card, player, false, init, cardsetion);
				},
				this,
				card,
				player,
				init,
				cardsetion
			);
			if (typeof card == "number" && card >= 0) {
				game.addVideo("give", this, [card, player.dataset.position]);
			} else {
				if (get.itemtype(card) == "card") {
					card = [card];
				}
				if (get.itemtype(card) == "cards") {
					game.addVideo("giveCard", this, [get.cardsInfo(card), player.dataset.position]);
				}
			}
		}
		if (get.itemtype(card) == "cards") {
			if (log != false && !_status.video) {
				game.log(player, "从", this, "获得了", card);
			}
			if (this.$givemod) {
				this.$givemod(card, player);
			} else {
				for (let i = 0; i < card.length; i++) {
					this.$give(card[i], player, false, false, cardsetion);
				}
			}
		} else if (typeof card == "number" && card >= 0) {
			if (log != false && !_status.video) {
				game.log(player, "从", this, "获得了" + get.cnNumber(card) + "张牌");
			}
			if (this.$givemod) {
				this.$givemod(card, player);
			} else {
				while (card--) {
					this.$give("", player, false, false, cardsetion);
				}
			}
		} else {
			if (log != false && !_status.video) {
				if (get.itemtype(card) == "card") {
					game.log(player, "从", this, "获得了", card);
				} else {
					game.log(player, "从", this, "获得了一张牌");
				}
			}
			if (this.$givemod) {
				this.$givemod(card, player);
			} else {
				let node;
				if (get.itemtype(card) == "card") {
					node = card.copy("card", "thrown", false);
					if (cardsetion) {
						let next = ui.create.div(".cardsetion", cardsetion, node);
						if (node.node) {
							if (node.node.cardsetion) {
								node.node.cardsetion.remove();
								delete node.node.cardsetion;
							}
							node.node.cardsetion = next;
						}
					}
				} else {
					node = ui.create.div(".card.thrown");
					if (cardsetion) {
						node.classList.add("infoflip");
						node.classList.add("infohidden");
						let next = ui.create.div(".cardsetion", cardsetion, node);
						next.style.setProperty("display", "block", "important");
						replaceThrownCardsetion(node, next);
					}
				}
				node.fixed = true;
				this.$throwordered(node, null, cardsetion);

				node.listenTransition(function () {
					let dx = player.getLeft() + player.offsetWidth / 2 - 52 - node.offsetLeft;
					let dy = player.getTop() + player.offsetHeight / 2 - 52 - node.offsetTop;
					if (node.style.transform && node.style.transform != "none" && node.style.transform.indexOf("translate") == -1) {
						node.style.transform += " translate(" + dx + "px," + dy + "px)";
					} else {
						node.style.transform = "translate(" + dx + "px," + dy + "px)";
					}

					node.delete();
				});
			}
		}
	},
};
