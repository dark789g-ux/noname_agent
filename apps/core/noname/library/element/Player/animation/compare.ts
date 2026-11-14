import { game, get, lib, ui } from "noname";
import type { Card, Player } from "../../index.js";

export const compareAnimationMethods = {
	$compareMultiple(this: Player, card1: Card, targets: Player[], cards: Card[], cardsetions?: Record<string, string | undefined>): void {
		if (!cardsetions && lib.config.card_animation_info) {
			let cardsetions: Record<string, string | undefined> = {},
				cardsetion_targets: Player[] = [this];
			cardsetion_targets.addArray(targets);
			for (let target of cardsetion_targets) {
				let id = target.playerid === undefined ? "undefined" : target.playerid,
					cardsetion = get.cardsetion(target);
				cardsetions[id] = cardsetion;
			}
		}
		game.broadcast(
			function (player, card1, targets, cards, cardsetions) {
				player.$compareMultiple(card1, targets, cards, cardsetions);
			},
			this,
			card1,
			targets,
			cards,
			cardsetions
		);
		game.addVideo("compareMultiple", this, [get.cardInfo(card1), get.targetsInfo(targets), get.cardsInfo(cards)]);
		let player = this;
		let node1: any = player.$throwxy2(card1, "calc(50% - 52px)", "calc(50% + 10px)", "perspective(600px) rotateY(180deg)", true);
		if (lib.config.cardback_style != "default") {
			node1.style.transitionProperty = "none";
			ui.refresh(node1);
			node1.classList.add("infohidden");
			ui.refresh(node1);
			node1.style.transitionProperty = "";
		} else {
			node1.classList.add("infohidden");
		}

		node1.style.transform = "perspective(600px) rotateY(180deg) translateX(0)";
		if (cardsetions) {
			const playerId = player.playerid === undefined ? "undefined" : player.playerid;
			const playerCardsetion = cardsetions[playerId];
			let next = ui.create.div(".cardsetion", playerCardsetion || "", node1);
			next.style.setProperty("display", "block", "important");
			if (node1.node) {
				if (node1.node.cardsetion) {
					node1.node.cardsetion.remove();
					delete node1.node.cardsetion;
				}
				node1.node.cardsetion = next;
			}
		}
		let onEnd01 = function () {
			setTimeout(function () {
				node1.style.transition = "all ease-in 0.3s";
				node1.style.transform = "perspective(600px) rotateY(270deg) translateX(52px)";
				let onEnd = function () {
					node1.classList.remove("infohidden");
					node1.style.transition = "all 0s";
					ui.refresh(node1);
					node1.style.transform = "perspective(600px) rotateY(-90deg) translateX(52px)";
					ui.refresh(node1);
					node1.style.transition = "";
					ui.refresh(node1);
					node1.style.transform = "";
				};
				node1.listenTransition(onEnd);
			}, 300);
		};
		node1.listenTransition(onEnd01);

		setTimeout(function () {
			let left0 = -targets.length * 52 - (targets.length - 1) * 8;
			for (let i = 0; i < targets.length; i++) {
				(function (target, card2, i) {
					let left = left0 + i * 120;
					let node2: any;
					if (left < 0) {
						node2 = target.$throwxy2(card2, "calc(50% - " + -left + "px)", "calc(50% - 114px)", "perspective(600px) rotateY(180deg)", true);
					} else {
						node2 = target.$throwxy2(card2, "calc(50% + " + left + "px)", "calc(50% - 114px)", "perspective(600px) rotateY(180deg)", true);
					}
					if (cardsetions) {
						const targetId = target.playerid === undefined ? "undefined" : target.playerid;
						let next = ui.create.div(".cardsetion", cardsetions[targetId] || "", node2);
						next.style.setProperty("display", "block", "important");
						if (node2.node) {
							if (node2.node.cardsetion) {
								node2.node.cardsetion.remove();
								delete node2.node.cardsetion;
							}
							node2.node.cardsetion = next;
						}
					}
					if (lib.config.cardback_style != "default") {
						node2.style.transitionProperty = "none";
						ui.refresh(node2);
						node2.classList.add("infohidden");
						ui.refresh(node2);
						node2.style.transitionProperty = "";
					} else {
						node2.classList.add("infohidden");
					}
					node2.style.transform = "perspective(600px) rotateY(180deg) translateX(0)";
					let onEnd02 = function () {
						setTimeout(function () {
							node2.style.transition = "all ease-in 0.3s";
							node2.style.transform = "perspective(600px) rotateY(270deg) translateX(52px)";
							let onEnd = function () {
								node2.classList.remove("infohidden");
								node2.style.transition = "all 0s";
								ui.refresh(node2);
								node2.style.transform = "perspective(600px) rotateY(-90deg) translateX(52px)";
								ui.refresh(node2);
								node2.style.transition = "";
								ui.refresh(node2);
								node2.style.transform = "";
							};
							node2.listenTransition(onEnd);
						}, 200);
					};
					node2.listenTransition(onEnd02);
				})(targets[i], cards[i], i);
			}
		}, 200);
	},
	$compare(this: Player, card1: Card, target: Player, card2: Card, cardsetions?: Record<string, string | undefined>): void {
		if (!cardsetions && lib.config.card_animation_info) {
			let cardsetions: Record<string, string | undefined> = {},
				cardsetion_targets: Player[] = [this, target];
			for (let targetx of cardsetion_targets) {
				let id = targetx.playerid === undefined ? "undefined" : targetx.playerid,
					cardsetion = get.cardsetion(targetx);
				cardsetions[id] = cardsetion;
			}
		}
		game.broadcast(
			function (player, target, card1, card2, cardsetions) {
				player.$compare(card1, target, card2, cardsetions);
			},
			this,
			target,
			card1,
			card2,
			cardsetions
		);
		game.addVideo("compare", this, [get.cardInfo(card1), target.dataset.position, get.cardInfo(card2)]);
		let player = this;
		let node1: any = player.$throwxy2(card1, "calc(50% - 114px)", "calc(50% - 52px)", "perspective(600px) rotateY(180deg)", true);
		if (lib.config.cardback_style != "default") {
			node1.style.transitionProperty = "none";
			ui.refresh(node1);
			node1.classList.add("infohidden");
			ui.refresh(node1);
			node1.style.transitionProperty = "";
		} else {
			node1.classList.add("infohidden");
		}
		if (cardsetions) {
			const playerId = player.playerid === undefined ? "undefined" : player.playerid;
			const playerCardsetion = cardsetions[playerId];
			let next = ui.create.div(".cardsetion", playerCardsetion || "", node1);
			next.style.setProperty("display", "block", "important");
			if (node1.node) {
				if (node1.node.cardsetion) {
					node1.node.cardsetion.remove();
					delete node1.node.cardsetion;
				}
				node1.node.cardsetion = next;
			}
		}
		node1.style.transform = "perspective(600px) rotateY(180deg) translateX(0)";
		let onEnd01 = function () {
			setTimeout(function () {
				node1.style.transition = "all ease-in 0.3s";
				node1.style.transform = "perspective(600px) rotateY(270deg) translateX(52px)";
				let onEnd = function () {
					node1.classList.remove("infohidden");
					node1.style.transition = "all 0s";
					ui.refresh(node1);
					node1.style.transform = "perspective(600px) rotateY(-90deg) translateX(52px)";
					ui.refresh(node1);
					node1.style.transition = "";
					ui.refresh(node1);
					node1.style.transform = "";
				};
				node1.listenTransition(onEnd);
			}, 300);
		};
		node1.listenTransition(onEnd01);
		setTimeout(function () {
			let node2: any = target.$throwxy2(card2, "calc(50% + 10px)", "calc(50% - 52px)", "perspective(600px) rotateY(180deg)", true);
			if (lib.config.cardback_style != "default") {
				node2.style.transitionProperty = "none";
				ui.refresh(node2);
				node2.classList.add("infohidden");
				ui.refresh(node2);
				node2.style.transitionProperty = "";
			} else {
				node2.classList.add("infohidden");
			}
			if (cardsetions) {
				const targetId = target.playerid === undefined ? "undefined" : target.playerid;
				let next = ui.create.div(".cardsetion", cardsetions[targetId] || "", node2);
				next.style.setProperty("display", "block", "important");
				if (node2.node) {
					if (node2.node.cardsetion) {
						node2.node.cardsetion.remove();
						delete node2.node.cardsetion;
					}
					node2.node.cardsetion = next;
				}
			}
			node2.style.transform = "perspective(600px) rotateY(180deg) translateX(0)";
			let onEnd02 = function () {
				setTimeout(function () {
					node2.style.transition = "all ease-in 0.3s";
					node2.style.transform = "perspective(600px) rotateY(270deg) translateX(52px)";
					let onEnd = function () {
						node2.classList.remove("infohidden");
						node2.style.transition = "all 0s";
						ui.refresh(node2);
						node2.style.transform = "perspective(600px) rotateY(-90deg) translateX(52px)";
						ui.refresh(node2);
						node2.style.transition = "";
						ui.refresh(node2);
						node2.style.transform = "";
					};
					node2.listenTransition(onEnd);
				}, 200);
			};
			node2.listenTransition(onEnd02);
		}, 200);
	},
};
