import { _status, game, get, lib, ui } from "noname";
import type { Card, Player } from "../../index.js";
import type { DrawAnimationConfig } from "../contracts/uiAndAnimationContract.js";
import { createGainAnimationNode, replaceThrownCardsetion } from "../dom/nodeGuards.js";

export const drawAndGainMethods = {
	$drawAuto(this: Player, cards: Card[], target?: Player): void {
		if (this.isUnderControl(true, target)) {
			this.$draw(cards);
		} else {
			this.$draw(cards.length);
		}
	},
	$draw(this: Player, num, init?: boolean | "nobroadcast", config?: DrawAnimationConfig | null, cardsetion?: string | false | null): void {
		if (!cardsetion && cardsetion !== false && lib.config.card_animation_info) {
			cardsetion = get.cardsetion(this);
		}
		if (init !== false && init !== "nobroadcast") {
			game.broadcast(
				function (player, num, init, config, cardsetion) {
					player.$draw(num, init, config, cardsetion);
				},
				this,
				num,
				init,
				config,
				cardsetion
			);
		}
		let cards, node;
		if (get.itemtype(num) == "cards") {
			cards = num;
			num = cards.length;
		} else if (get.itemtype(num) == "card") {
			cards = [num];
			num = 1;
		}
		if (init !== false) {
			if (cards) {
				game.addVideo("drawCard", this, get.cardsInfo(cards));
			} else {
				game.addVideo("draw", this, num);
			}
		}
		if (cards) {
			cards = cards.slice(0);
			node = cards.shift().copy("thrown", "drawingcard");
			if (cardsetion) {
				const next = ui.create.div(".cardsetion", cardsetion, node);
				next.style.setProperty("display", "block", "important");
				if (node.node) {
					if (node.node.cardsetion) {
						node.node.cardsetion.remove();
						delete node.node.cardsetion;
					}
					node.node.cardsetion = next;
				}
			}
		} else {
			node = ui.create.div(".card.thrown.drawingcard");
			node.classList.add("infoflip");
			node.classList.add("infohidden");
			if (cardsetion) {
				const next = ui.create.div(".cardsetion", cardsetion, node);
				next.style.setProperty("display", "block", "important");
				replaceThrownCardsetion(node, next);
			}
		}
		node.fixed = true;
		node.hide();

		let dx: number, dy: number;
		const parentNode = this.parentNode;
		if (!parentNode) return;
		if (game.chess) {
			let rect = this.getBoundingClientRect();

			if (rect.left <= 80) {
				dx = -10;
				if (rect.top <= 80) {
					dy = -10;
				} else if (rect.top + rect.height + 80 >= ui.chessContainer.offsetHeight) {
					dy = 10;
				} else {
					dy = 0;
				}
			} else if (rect.left + rect.width + 80 >= ui.chessContainer.offsetWidth) {
				dx = 10;
				if (rect.top <= 80) {
					dy = -10;
				} else if (rect.top + rect.height + 80 >= ui.chessContainer.offsetHeight) {
					dy = 10;
				} else {
					dy = 0;
				}
			} else if (rect.top <= 80) {
				dx = 0;
				dy = -10;
			} else if (rect.top + rect.height + 80 >= ui.chessContainer.offsetHeight) {
				dx = 0;
				dy = 10;
			} else {
				dx = rect.left + this.offsetWidth / 2 - ui.arena.offsetWidth / 2;
				dy = rect.top + this.offsetHeight / 2 - ui.arena.offsetHeight / 2;
			}

			let coeff = 240 / Math.sqrt(dx * dx + dy * dy);
			dx *= coeff;
			dy *= coeff;

			node.style.left = this.getLeft() + this.offsetWidth / 2 - 52 - dx + "px";
			node.style.top = this.getTop() + this.offsetHeight / 2 - 52 - dy + "px";
			parentNode.appendChild(node);
		} else {
			parentNode.appendChild(node);
			node.style.left = "calc(50% - 52px)";
			node.style.top = "calc(50% - 52px)";

			dx = this.getLeft() + this.offsetWidth / 2 - 52 - node.offsetLeft;
			dy = this.getTop() + this.offsetHeight / 2 - 52 - node.offsetTop;

			if (get.is.mobileMe(this)) {
				dx += get.cardOffset();
				if (ui.arena.classList.contains("oblongcard")) {
					dy -= 16;
				}
			}
		}
		node.style.transitionDuration = "0.8s";
		ui.refresh(node);
		if (typeof num == "number" && init !== false) {
			config = {
				total: num,
				current: 1,
			};
		}
		if (config && config.total > 1) {
			let total = config.total,
				current = config.current;
			let dxtotal: number;
			if (total <= 5) {
				dxtotal = Math.min(80, (total - 1) * 20);
				dx += -dxtotal + (2 * dxtotal * (current - 1)) / (total - 1);
			} else {
				let total2 = Math.floor(total / 2);
				if (current <= total2) {
					total = total2;
					dy -= 20;
				} else {
					current -= total2;
					total -= total2;
					dy += 20;
				}
				dxtotal = Math.min(80, (total - 1) * 20);
				dx += -dxtotal + (2 * dxtotal * (current - 1)) / (total - 1);
			}
			config.current++;
		}
		if (node.style.transform && node.style.transform != "none" && node.style.transform.indexOf("translate") == -1) {
			node.style.transform += " translate(" + dx + "px," + dy + "px)";
		} else {
			node.style.transform = "translate(" + dx + "px," + dy + "px)";
		}
		node.show();

		node.listenTransition(function () {
			node.style.transitionDuration = "0.5s";
			ui.refresh(node);
			node.delete();
		});
		let that = this;
		if (num && num > 1) {
			if (config && config.total > 1) {
				setTimeout(function () {
					if (cards) {
						that.$draw(cards, false, config, cardsetion);
					} else {
						that.$draw(num - 1, false, config, cardsetion);
					}
				}, 50);
			} else {
				setTimeout(function () {
					if (cards) {
						that.$draw(cards, false, config, cardsetion);
					} else {
						that.$draw(num - 1, false, config, cardsetion);
					}
				}, 200);
			}
		}
	},
	$gain(this: Player, card, log?: boolean | null, init?: boolean, cardsetion?: string | false | null): void {
		if (!cardsetion && cardsetion !== false && lib.config.card_animation_info) {
			cardsetion = get.cardsetion(this);
		}
		if (init !== false) {
			game.broadcast(
				function (player, card, init, cardsetion) {
					player.$gain(card, false, init, cardsetion);
				},
				this,
				card,
				init,
				cardsetion
			);
			if (typeof card == "number" && card >= 0) {
				game.addVideo("gain", this, card);
			} else {
				if (get.itemtype(card) == "card") {
					card = [card];
				}
				if (get.itemtype(card) == "cards") {
					game.addVideo("gainCard", this, get.cardsInfo(card));
				} else {
					game.addVideo("gain", this, 1);
				}
			}
		}
		if (get.itemtype(card) == "cards") {
			if (log != false && !_status.video) {
				game.log(this, "获得了", card);
			}
			if (this.$gainmod) {
				this.$gainmod(card);
			} else {
				for (let i = 0; i < card.length; i++) {
					this.$gain(card[i], false, false);
				}
			}
		} else if (typeof card == "number" && card > 1) {
			if (log != false && !_status.video) {
				game.log(this, "获得了" + get.cnNumber(card) + "张牌");
			}
			if (this.$gainmod) {
				this.$gainmod(card);
			} else {
				for (let i = 0; i < card; i++) {
					this.$gain(1, false, false);
				}
			}
		} else {
			if (get.itemtype(card) == "card" && log != false && !_status.video) {
				game.log(this, "获得了", card);
			}
			if (this.$gainmod) {
				this.$gainmod(card);
			} else {
				let node;
				if (get.itemtype(card) == "card") {
					node = card.copy("thrown", false);
				} else {
					node = createGainAnimationNode();
				}
				if (cardsetion) {
					let next = ui.create.div(".cardsetion", cardsetion, node);
					next.style.setProperty("display", "block", "important");
					if (node.node) {
						if (node.node.cardsetion) {
							node.node.cardsetion.remove();
							delete node.node.cardsetion;
						}
						node.node.cardsetion = next;
					}
				}
				node.fixed = true;
				node.style.left = "calc(50% - 52px " + (Math.random() - 0.5 < 0 ? "+" : "-") + " " + Math.random() * 100 + "px)";
				node.style.top = "calc(50% - 52px " + (Math.random() - 0.5 < 0 ? "+" : "-") + " " + Math.random() * 100 + "px)";
				node.style.transform = "scale(0)";
				node.hide();
				ui.arena.appendChild(node);
				ui.refresh(node);
				node.show();
				node.style.transform = "";

				lib.listenEnd(node);
				let player = this;
				setTimeout(function () {
					node.moveDelete(player);
				}, 700);
			}
		}
	},
	$gain2(this: Player, cards, log?: boolean | null, cardsetion?: string | false | null): true | undefined {
		if (!cardsetion && cardsetion !== false && lib.config.card_animation_info) {
			cardsetion = get.cardsetion(this);
		}
		if (log === true) {
			game.log(this, "获得了", cards);
		}
		game.broadcast(
			function (player, cards, cardsetion) {
				player.$gain2(cards, null, cardsetion);
			},
			this,
			cards,
			cardsetion
		);
		if (get.itemtype(cards) == "card") {
			cards = [cards];
		} else if (get.itemtype(cards) != "cards") {
			return;
		}
		let list: Card[] = [],
			list2: Card[] = [];
		for (let i = 0; i < cards.length; i++) {
			if (cards[i].clone && (cards[i].clone.parentNode == this.parentNode || cards[i].clone.parentNode == ui.arena) && parseFloat(getComputedStyle(cards[i].clone).opacity) > 0.3) {
				let next = ui.create.div(".cardsetion", cardsetion || undefined, cards[i].clone);
				next.style.setProperty("display", "block", "important");
				if (cards[i].clone.node) {
					if (cards[i].clone.node.cardsetion) {
						cards[i].clone.node.cardsetion.remove();
						delete cards[i].clone.node.cardsetion;
					}
					cards[i].clone.node.cardsetion = next;
				}
				cards[i].clone.moveDelete(this);
				list2.push(cards[i].clone);
			} else {
				list.push(cards[i]);
			}
		}
		if (list2.length) {
			game.addVideo("gain2", this, get.cardsInfo(list2));
		}
		if (list.length) {
			this.$draw(list, "nobroadcast", null, cardsetion);
			return true;
		}
	},
};
