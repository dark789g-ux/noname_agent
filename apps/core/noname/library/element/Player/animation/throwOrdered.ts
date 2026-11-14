import { game, get, lib, ui } from "noname";
import type { Card, Player } from "../../index.js";

export const throwOrderedMethods = {
	$throwordered<T extends HTMLDivElement>(this: Player, node: T, nosource?: boolean | null, cardsetion?: string | false | null): T {
		const $throwordered2 = this.$throwordered2(node, nosource);
		if (lib.config.card_animation_info) {
			let eventInfo = cardsetion,
				player = this;
			if (eventInfo !== false) {
				eventInfo = get.cardsetion(player);
			}
			if (typeof eventInfo == "string" && eventInfo.length) {
				const anyNode = node as any;
				game.broadcastAll(
					function (node, eventInfo, id) {
						const isThrownCard = value => value instanceof HTMLDivElement;
						const getThrownCardId = value => {
							return value._cardid;
						};
						const isThrownCardSelected = value => {
							return Boolean(value.selectedt);
						};
						const selectThrownCard = value => {
							if (getThrownCardId(value) != id || isThrownCardSelected(value)) return false;
							value.selectedt = true;
							return true;
						};
						if (!node?.node) {
							node = [...ui.arena.childNodes].find(c => {
								if (!isThrownCard(c)) return false;
								const cardNode = c;
								if (cardNode.classList.contains("thrown") && cardNode.classList.contains("card")) {
									if (selectThrownCard(cardNode)) {
										return true;
									}
								}
							});
						}
						if (!node?.node) {
							return;
						}
						node.classList.add("infoflip");
						let next = ui.create.div(".cardsetion", eventInfo, node);
						next.style.setProperty("display", "block", "important");
						if (node.node) {
							if (node.node.cardsetion) {
								node.node.cardsetion.remove();
								delete node.node.cardsetion;
							}
							node.node.cardsetion = next;
						}
					},
					anyNode,
					eventInfo,
					anyNode._cardid
				);
				anyNode.classList.add("infoflip");
				let next = ui.create.div(".cardsetion", eventInfo, anyNode);
				next.style.setProperty("display", "block", "important");
				if (anyNode.node) {
					if (anyNode.node.cardsetion) {
						anyNode.node.cardsetion.remove();
						delete anyNode.node.cardsetion;
					}
					anyNode.node.cardsetion = next;
				}
			}
		}
		return $throwordered2;
	},
	$throwordered1<T extends HTMLDivElement>(this: Player, node: T, nosource?: boolean | null): T {
		node.classList.add("thrown");
		node.hide();
		node.style.transitionProperty = "left,top,opacity,transform";
		for (let i = 0; i < ui.thrown.length; i++) {
			if (ui.thrown[i].parentNode != ui.arena || ui.thrown[i].classList.contains("removing")) {
				ui.thrown.splice(i--, 1);
			}
		}
		ui.thrown.push(node as any);
		let uithrowns = ui.thrown.slice(0);
		let tops: string[];
		if (game.chess) {
			switch (Math.floor((ui.thrown.length - 1) / 4)) {
				case 0:
					tops = ["calc(50% - 82px)"];
					break;
				case 1:
					tops = ["calc(50% - 139px)", "calc(50% - 25px)"];
					break;
				case 2:
					tops = ["calc(50% - 196px)", "calc(50% - 82px)", "calc(50% + 32px)"];
					break;
				default:
					tops = ["calc(50% - 253px)", "calc(50% - 139px)", "calc(50% - 25px)", "calc(50% + 89px)"];
			}
		} else {
			switch (Math.floor((ui.thrown.length - 1) / 4)) {
				case 0:
					tops = ["calc(50% - 52px)"];
					break;
				case 1:
					tops = ["calc(50% - 109px)", "calc(50% + 5px)"];
					break;
				case 2:
					tops = ["calc(50% - 166px)", "calc(50% - 52px)", "calc(50% + 62px)"];
					break;
				default:
					tops = ["calc(50% - 223px)", "calc(50% - 109px)", "calc(50% + 5px)", "calc(50% + 119px)"];
			}
		}
		while (uithrowns.length) {
			let throwns = uithrowns.splice(0, Math.min(uithrowns.length, 4));
			switch (throwns.length) {
				case 1:
					throwns[0].style.left = "calc(50% - 52px)";
					break;
				case 2:
					throwns[0].style.left = "calc(50% - 109px)";
					throwns[1].style.left = "calc(50% + 5px)";
					break;
				case 3:
					throwns[0].style.left = "calc(50% - 166px)";
					throwns[1].style.left = "calc(50% - 52px)";
					throwns[2].style.left = "calc(50% + 62px)";
					break;
				case 4:
					throwns[0].style.left = "calc(50% - 223px)";
					throwns[1].style.left = "calc(50% - 109px)";
					throwns[2].style.left = "calc(50% + 5px)";
					throwns[3].style.left = "calc(50% + 119px)";
					break;
			}
			let top: string;
			const shiftedTop = tops.shift();
			if (shiftedTop !== undefined) {
				top = shiftedTop;
			} else if (game.chess) {
				top = "calc(50% - 82px)";
			} else {
				top = "calc(50% - 52px)";
			}
			for (let i = 0; i < throwns.length; i++) {
				throwns[i].style.top = top;
			}
		}
		if (nosource) {
			node.style.transform = "scale(0)";
			node.classList.add("center");
		} else {
			let parseCalc = function (str: string): [number, number] {
				let per = str.slice(str.indexOf("calc(") + 5, str.indexOf("%"));
				let add = str.slice(str.indexOf("%") + 1, str.indexOf("px")).replace(/\s/g, "");
				return [parseInt(per), parseInt(add)];
			};
			let [nxPer, nxAdd] = parseCalc(node.style.left);
			let [nyPer, nyAdd] = parseCalc(node.style.top);
			let nx = (nxPer * ui.arena.offsetWidth) / 100 + nxAdd;
			let ny = (nyPer * ui.arena.offsetHeight) / 100 + nyAdd;
			let dx: number, dy: number;
			if (game.chess) {
				let rect = this.getBoundingClientRect();
				dx = rect.left + this.offsetWidth / 2 - 52 - nx;
				dy = rect.top + this.offsetHeight / 2 - 52 - ny;
			} else {
				dx = this.getLeft() + this.offsetWidth / 2 - 52 - nx;
				dy = this.getTop() + this.offsetHeight / 2 - 52 - ny;
				if (get.is.mobileMe(this)) {
					dx += get.cardOffset();
					if (ui.arena.classList.contains("oblongcard")) {
						dy -= 16;
					}
				}
			}
			if (node.style.transform && node.style.transform != "none" && node.style.transform.indexOf("translate") == -1) {
				node.style.transform += " translate(" + dx + "px," + dy + "px)";
			} else {
				node.style.transform = "translate(" + dx + "px," + dy + "px)";
			}
		}
		ui.arena.appendChild(node);
		ui.refresh(node);
		node.style.transform = "";
		node.show();
		lib.listenEnd(node);
		return node;
	},
	$throwordered2<T extends HTMLDivElement>(this: Player, node: T, nosource?: boolean | null): T {
		const anyNode = node as any;
		node.classList.add("thrown");
		node.classList.add("center");
		node.hide();
		node.style.transitionProperty = "left,top,opacity,transform";
		if (!nosource) {
			let nx = (50 * ui.arena.offsetWidth) / 100 - 52;
			let ny = (50 * ui.arena.offsetHeight) / 100 - 52;
			let dx: number, dy: number;
			if (game.chess) {
				let rect = this.getBoundingClientRect();
				dx = rect.left + this.offsetWidth / 2 - 52 - nx;
				dy = rect.top + this.offsetHeight / 2 - 52 - ny;
			} else {
				dx = this.getLeft() + this.offsetWidth / 2 - 52 - nx;
				dy = this.getTop() + this.offsetHeight / 2 - 52 - ny;
				if (get.is.mobileMe(this)) {
					dx += get.cardOffset();
					if (ui.arena.classList.contains("oblongcard")) {
						dy -= 16;
					}
				}
			}
			if (node.style.transform && node.style.transform != "none" && node.style.transform.indexOf("translate") == -1) {
				node.style.transform += " translate(" + dx + "px," + dy + "px)";
			} else {
				node.style.transform = "translate(" + dx + "px," + dy + "px)";
			}
		}
		ui.arena.appendChild(node);
		ui.refresh(node);
		for (let i = 0; i < ui.thrown.length; i++) {
			if (ui.thrown[i].parentNode != ui.arena || ui.thrown[i].classList.contains("removing")) {
				ui.thrown.splice(i--, 1);
			}
		}
		ui.thrown.push(anyNode);
		if (!anyNode.subThrow && anyNode.node?.throw_id && ui.thrown.some((n: any) => n != anyNode && n.node?.throw_id == anyNode.node?.throw_id)) {
			anyNode.subThrow = true;
		}
		let cards: any[] = ui.thrown;
		let pw = ui.arena.offsetWidth;
		let cardWidth = 105;
		let cardGap = 2;
		let totalWidth = cards.filter(i => !i.subThrow).length * cardWidth + (cards.filter(i => !i.subThrow).length - 1) * cardGap;
		let maxWidth = pw * 0.7;
		let limitWidth = Math.min(maxWidth, pw);
		let margin = totalWidth > limitWidth ? (limitWidth - cardWidth) / (cards.filter(i => !i.subThrow).length - 1) : cardWidth + cardGap;
		let actualWidth = Math.min(totalWidth, limitWidth);
		let offsetX = -actualWidth / 2 + cardWidth / 2;
		let infoOffset = cardWidth + cardGap - margin;
		if (infoOffset < 0) infoOffset = 0;
		let dlcX = 0;
		const maxMargin = cardWidth + cardGap;
		for (let j = 0; j < cards.length; j++) {
			let x = Math.round(offsetX + j * margin);
			x -= dlcX;
			let id = cards[j]?.node?.throw_id;
			const node_Stacking = cards.filter(n => n.subThrow && n.node.throw_id == id).slice(0);
			const index = node_Stacking.indexOf(cards[j]);
			if (index != -1) {
				let xx = 80;
				if (node_Stacking.length > 2) {
					xx += 10;
				}
				if (node_Stacking.length > 4) {
					xx += 5;
				}
				Math.min(0, (xx -= maxMargin - margin));
				dlcX += xx;
				x -= xx;
			}
			cards[j].style.transform = "translate(" + x + "px, -30px)";
			if (cards[j].node && j < cards.length - 1 && infoOffset > 0) {
				let actualInfoOffset = infoOffset;
				if (infoOffset > 40) {
					actualInfoOffset = 90 - (cards[j].node.info ? cards[j].node.info.offsetWidth : 20);
					if (cards[j].node.info) {
						const infoSpan = cards[j].node.info.querySelector("span");
						if (infoSpan) infoSpan.style.display = "none";
						cards[j].node.info.style.transform = "translateX(-" + actualInfoOffset + "px) translateY(-3px)";
					}
					if (cards[j].node.name) {
						if (cards[j].node.name.classList.contains("long")) {
							cards[j].node.name.style.transform = "translateY(16px) scale(0.85)";
							cards[j].node.name.style.transformOrigin = "top left";
						} else {
							cards[j].node.name.style.transform = "translateY(16px)";
						}
					}
				} else {
					if (cards[j].node.info) {
						const infoSpan = cards[j].node.info.querySelector("span");
						if (infoSpan) infoSpan.style.display = "";
						cards[j].node.info.style.transform = "translateX(-" + actualInfoOffset + "px)";
					}
					if (cards[j].node.name) {
						cards[j].node.name.style.transform = "";
						cards[j].node.name.style.transformOrigin = "";
					}
				}
			} else if (cards[j].node) {
				if (cards[j].node.info) {
					const infoSpan = cards[j].node.info.querySelector("span");
					if (infoSpan) infoSpan.style.display = "";
					cards[j].node.info.style.transform = "";
				}
				if (cards[j].node.name) {
					cards[j].node.name.style.transform = "";
					cards[j].node.name.style.transformOrigin = "";
				}
			}
		}
		node.show();
		lib.listenEnd(node);
		return node;
	},
	$throwxy(this: Player, card: Card, left: string, top: string): Card {
		let node = card.copy("thrown", "thrownhighlight");
		node.dataset.position = this.dataset.position;
		node.hide();
		node.style.transitionProperty = "left,top,opacity";

		ui.arena.appendChild(node);
		ui.refresh(node);
		node.show();
		node.style.left = left;
		node.style.top = top;
		lib.listenEnd(node);
		return node;
	},
	$throwxy2(this: Player, card: Card, left: string, top: string, trans?: string, flipx?: boolean, flipy?: boolean): Card {
		if (game.chess) {
			return this.$throwxy(card, left, top);
		}
		let node = card.copy("thrown", "thrownhighlight");
		node.style.left = left;
		node.style.top = top;
		node.hide();

		let parseCalc = function (str: string): [number, number] {
			let per = str.slice(str.indexOf("calc(") + 5, str.indexOf("%"));
			let add = str.slice(str.indexOf("%") + 1, str.indexOf("px")).replace(/\s/g, "");
			return [parseInt(per), parseInt(add)];
		};
		let [nxPer, nxAdd] = parseCalc(node.style.left);
		let [nyPer, nyAdd] = parseCalc(node.style.top);
		let nx = (nxPer * ui.arena.offsetWidth) / 100 + nxAdd;
		let ny = (nyPer * ui.arena.offsetHeight) / 100 + nyAdd;
		let dx = this.getLeft() + this.offsetWidth / 2 - 52 - nx;
		let dy = this.getTop() + this.offsetHeight / 2 - 52 - ny;
		if (flipx) {
			dx = -dx;
		}
		if (flipy) {
			dy = -dy;
		}
		if (trans) {
			node.style.transform = trans + " translate(" + dx + "px," + dy + "px)";
		} else {
			node.style.transform = "translate(" + dx + "px," + dy + "px)";
		}

		ui.arena.appendChild(node);
		ui.refresh(node);
		node.show();
		lib.listenEnd(node);
		return node;
	},
};
