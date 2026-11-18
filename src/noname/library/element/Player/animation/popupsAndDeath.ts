import { _status, game, get, lib, ui } from "noname";
import type { Card, Player, VCard } from "../../index.js";
import type { SkillAnimationAvatar } from "../contracts/uiAndAnimationContract.js";

export const popupsAndDeathMethods = {
	$fullscreenpop(this: Player, str: string, nature?: string, avatar?: SkillAnimationAvatar, broadcast?: boolean): void {
		if (broadcast !== false) {
			game.broadcast(
				function (player, str, nature, avatar) {
					player.$fullscreenpop(str, nature, avatar);
				},
				this,
				str,
				nature,
				avatar
			);
		}
		game.addVideo("fullscreenpop", this, [str, nature, avatar]);
		let node = ui.create.div(".damage");
		let resolvedAvatar: SkillAnimationAvatar | undefined = avatar;
		if (resolvedAvatar && this.node) {
			if (resolvedAvatar == "vice") {
				if (this.name2 && lib.character[this.name2]) {
					resolvedAvatar = this.node.avatar2;
				}
			} else {
				if (lib.character[String(this.name)]) {
					resolvedAvatar = this.node.avatar;
				}
			}
			if (!(resolvedAvatar instanceof HTMLDivElement) || !get.is.div(resolvedAvatar)) {
				resolvedAvatar = false;
			}
		} else {
			resolvedAvatar = false;
		}
		if (resolvedAvatar) {
			node.classList.add("fullscreenavatar");
			ui.create.div("", ui.create.div(node));
			ui.create.div("", "<div>" + str.split("").join("</div><br><div>") + "</div>", ui.create.div(".text", node));
			const avatarNode = node.firstElementChild?.firstElementChild;
			const textNode = node.lastElementChild?.firstElementChild;
			if (!(avatarNode instanceof HTMLElement && textNode instanceof HTMLElement)) {
				throw new Error("fullscreenpop avatar nodes failed to initialize");
			}
			avatarNode.style.backgroundImage = resolvedAvatar.style.backgroundImage;
			node.dataset.nature = nature || "unknown";
			let num = 0;
			let nodes = textNode.querySelectorAll("div");
			const interval = setInterval(function () {
				if (num < nodes.length) {
					nodes[num].classList.add("flashtext");
					num++;
				} else {
					clearInterval(interval);
				}
			}, 100);
		} else {
			resolvedAvatar = false;
			node.innerHTML = str;
			node.dataset.nature = nature || "soil";
		}
		if (resolvedAvatar) {
			let rect1 = ui.window.getBoundingClientRect();
			let rect2 = this.getBoundingClientRect();
			let dx = Math.round(2 * rect2.left + rect2.width - rect1.width);
			let dy = Math.round(2 * rect2.top + rect2.height - rect1.height);
			node.style.transform = "scale(0.5) translate(" + dx + "px," + dy + "px)";
		}
		ui.window.appendChild(node);
		ui.refresh(node);
		if (resolvedAvatar) {
			node.style.transform = "scale(1)";
			node.style.opacity = "1";
		} else {
			node.classList.add("damageadded");
		}
		setTimeout(
			function () {
				node.delete();
				node.style.transform = "scale(1.5)";
			},
			resolvedAvatar ? 1600 : 1000
		);
	},
	$damagepop(this: Player, num?: number | string, nature: string = "soil", font?: boolean, nobroadcast?: boolean): void {
		if (typeof num == "number" || typeof num == "string") {
			game.addVideo("damagepop", this, [num, nature, font]);
			if (nobroadcast !== false) {
				game.broadcast(
					function (player, num, nature, font) {
						player.$damagepop(num, nature, font);
					},
					this,
					num,
					nature,
					font
				);
			}
			let node = ui.create.div(".damage");
			if (font) {
				node.classList.add("normal-font");
			}
			if (typeof num == "number" && num > 0) {
				if (num == Infinity) {
					num = "+∞";
				} else {
					num = "+" + num;
				}
			} else if (num == -Infinity) {
				num = "-∞";
			}
			node.innerHTML = String(num);
			this.damagepopups.push(node);
			node.dataset.nature = nature || "soil";
			if (this.damagepopups.length == 1) {
				this.$damagepop();
			}
		} else if (this.damagepopups.length) {
			let node = this.damagepopups[0];
			this.appendChild(node);
			ui.refresh(node);
			node.classList.add("damageadded");
			node.listenTransition(function () {
				setTimeout(function () {
					node.delete();
				}, 200);
			});
			let that = this;
			setTimeout(function () {
				that.damagepopups.shift();
				that.$damagepop();
			}, 500);
		}
	},
	$damage(this: Player, source?: Player | string | boolean): void {
		if (get.itemtype(source) == "player" && typeof source == "object") {
			game.addVideo("damage", this, source.dataset.position);
		} else {
			game.addVideo("damage", this);
		}
		game.broadcast(
			function (player, source) {
				player.$damage(source);
			},
			this,
			source
		);
		if (source && typeof source == "object" && source != this && lib.config.damage_shake) {
			let left: number, top: number;
			if (source.getTop() == this.getTop()) {
				left = 20;
				top = 0;
			} else {
				let ratio = (source.getLeft() - this.getLeft()) / (source.getTop() - this.getTop());
				left = Math.abs((20 * ratio) / Math.sqrt(1 + ratio * ratio));
				top = Math.abs(20 / Math.sqrt(1 + ratio * ratio));
			}
			if (source.getLeft() - this.getLeft() > 0) {
				left = -left;
			}
			if (source.getTop() - this.getTop() > 0) {
				top = -top;
			}
			if (get.is.mobileMe(this)) {
				if (this.classList.contains("linked")) {
					this.node.avatar.style.transform = "translate(" + left + "px," + top + "px) rotate(-90deg)";
					this.node.avatar2.style.transform = "translate(" + left + "px," + top + "px) rotate(-90deg)";
				} else {
					this.node.avatar.style.transform = "translate(" + left + "px," + top + "px)";
					this.node.avatar2.style.transform = "translate(" + left + "px," + top + "px)";
				}
			} else if (this.classList.contains("linked") && get.is.newLayout()) {
				this.style.transform = "translate(" + left + "px," + top + "px) rotate(-90deg)";
			} else if (this._chesstransform) {
				this.style.transform = "translate(" + (left + this._chesstransform[0]) + "px," + (top + this._chesstransform[1]) + "px)";
			} else {
				this.style.transform = "translate(" + left + "px," + top + "px)";
			}
		} else {
			let zoom1 = 0.9,
				zoom2 = 0.95;
			// eslint-disable-next-line prefer-rest-params
			if (arguments[1] == "phase") {
				zoom1 = 1.05;
				zoom2 = 1.05;
			}
			if (get.is.mobileMe(this)) {
				if (this.classList.contains("linked")) {
					this.node.avatar.style.transform = "scale(" + zoom1 + ") rotate(-90deg)";
					this.node.avatar2.style.transform = "scale(" + zoom1 + ") rotate(-90deg)";
				} else {
					this.node.avatar.style.transform = "scale(" + zoom1 + ")";
					this.node.avatar2.style.transform = "scale(" + zoom1 + ")";
				}
			} else if (this.classList.contains("linked") && get.is.newLayout()) {
				this.style.transform = "scale(" + zoom2 + ") rotate(-90deg)";
			} else if (game.chess && this._chesstransform) {
				this.style.transform = "translate(" + this._chesstransform[0] + "px," + this._chesstransform[1] + "px) scale(" + zoom2 + ")";
			} else {
				this.style.transform = "scale(" + zoom2 + ")";
			}
		}
		this.queue();
	},
	$die(this: Player): void {
		game.addVideo("die", this);
		game.broadcast(function (player) {
			player.$die();
		}, this);
		if (lib.config.die_move != "off") {
			this.$dieflip(lib.config.die_move);
		}
		if (this.$dieAfter) {
			this.$dieAfter();
		}
	},
	$dieflip(this: Player, type?: string): void {
		let top0 = ui.window.offsetHeight / 2;
		let left0 = ui.window.offsetWidth / 2;
		let ratio = (left0 - this.getLeft()) / (top0 - this.getTop());
		let left = Math.abs((50 * ratio) / Math.sqrt(1 + ratio * ratio));
		let top = Math.abs(50 / Math.sqrt(1 + ratio * ratio));
		if (left0 - this.getLeft() > 0) {
			left = -left;
		}
		if (top0 - this.getTop() > 0) {
			top = -top;
		}
		if (get.is.mobileMe(this)) {
			left = -Math.random() * 5 - 10;
			top = Math.random() * 5 + 10;
		}
		if (this._chesstransform) {
			left += this._chesstransform[0];
			top += this._chesstransform[1];
		}
		let transform = "translate(" + left + "px," + top + "px) " + "rotate(" + (Math.random() * 20 - 10) + "deg) ";
		if (type == "flip") {
			if (game.layout == "long" || game.layout == "long2") {
				transform += "rotateY(180deg)";
			} else {
				transform += Math.random() - 0.5 < 0 ? "rotateX(180deg)" : "rotateY(180deg)";
			}
		}
		if (get.is.mobileMe(this)) {
			this.node.avatar.style.transform = transform;
			this.node.avatar2.style.transform = transform;
			this.style.transform = "";
		} else {
			this.node.avatar.style.transform = "";
			this.node.avatar2.style.transform = "";
			this.style.transform = transform;
		}
		this.queue(false);
	},
	$phaseJudge(this: Player, card: Card | VCard): void {
		game.addVideo("phaseJudge", this, get.cardInfo(card as Card));
		const player = this;
		const cardSymbol = (card as any).cardSymbol;
		if (cardSymbol && (card as any)[cardSymbol]?.cards?.length) {
			const cards = (card as any)[cardSymbol].cards;
			player.$throw(cards);
			if (lib.config.low_performance && cards[0] && cards[0].clone) {
				const waitingForTransition = get.time();
				_status.waitingForTransition = waitingForTransition;
				cards[0].clone.listenTransition(function () {
					if (_status.waitingForTransition == waitingForTransition && _status.paused) {
						game.resume();
					}
				});
				game.pause();
			} else {
				game.delay();
			}
		} else {
			const VCard = game.createCard(card.name, "虚拟", "");
			player.$throw(VCard);
			if (lib.config.low_performance && VCard && VCard.clone) {
				const waitingForTransition = get.time();
				_status.waitingForTransition = waitingForTransition;
				VCard.clone.listenTransition(function () {
					if (_status.waitingForTransition == waitingForTransition && _status.paused) {
						game.resume();
					}
				});
				game.pause();
			} else {
				game.delay();
			}
		}
	},
};
