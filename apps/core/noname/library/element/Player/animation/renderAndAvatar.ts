import { _status, game, get, lib, ui } from "noname";
import type { Player } from "../../index.js";
import type { AvatarQueueNode } from "../contracts/instanceFieldsContract.js";

export const renderAndAvatarMethods = {
	getLeft(this: Player): number {
		return this.offsetLeft;
	},
	getTop(this: Player): number {
		return this.offsetTop;
	},
	smoothAvatar(this: Player, vice?: boolean, video?: boolean): void {
		let div = ui.create.div(".fullsize");
		if (vice) {
			div.style.background = getComputedStyle(this.node.avatar2).background;
			this.node.avatar2.appendChild(div);
		} else {
			div.style.background = getComputedStyle(this.node.avatar).background;
			this.node.avatar.appendChild(div);
		}
		ui.refresh(div);
		div.style.transition = "all 1s";
		setTimeout(function () {
			div.classList.add("removing");
			setTimeout(function () {
				div.remove();
			}, 2000);
		}, 100);
		if (video != false) {
			game.addVideo("smoothAvatar", this, vice);
		}
	},
	changeSeat(this: Player, position: number | string, video?: boolean): void {
		let player = this;
		if (video !== false) {
			game.addVideo("changeSeat", player, position);
		}
		let rect1 = player.getBoundingClientRect();
		player.style.transition = "all 0s";
		ui.refresh(player);
		player.dataset.position = String(position);
		let rect2 = player.getBoundingClientRect();
		let dx = rect1.left - rect2.left;
		let dy = rect1.top - rect2.top;
		if ((game.chess || (Number(player.dataset.position) != 0 && position != 0)) && player.classList.contains("linked")) {
			player.style.transform = "rotate(-90deg) translate(" + -dy + "px," + dx + "px)";
		} else {
			player.style.transform = "translate(" + dx + "px," + dy + "px)";
		}
		setTimeout(function () {
			player.style.transition = "";
			ui.refresh(player);
			player.style.transform = "";
		}, 100);
	},
	setAvatar(this: Player, name?: string, name2?: string, video?: boolean, fakeme?: boolean): void {
		let node: HTMLDivElement | undefined;
		if (this.name2 == name) {
			node = this.node.avatar2;
			this.smoothAvatar(true, video);
		} else if (this.name == name) {
			node = this.node.avatar;
			this.smoothAvatar(false, video);
		}
		if (node) {
			if (name === name2) {
				let skinName = this.name2 != name ? this.skin?.name : this.skin?.name2;
				if (!skinName || skinName === name2) {
					node.setBackground(name2, "character");
				} else {
					node.setBackground(skinName, "character");
				}
			} else {
				node.setBackground(name2, "character");
			}
			if (this == game.me && ui.fakeme && fakeme !== false) {
				ui.fakeme.style.backgroundImage = node.style.backgroundImage;
			}
			if (video != false) {
				game.addVideo("setAvatar", this, [name, name2]);
			}
		}
		game.broadcast(
			function (player, name, name2) {
				player.setAvatar(name, name2, false);
			},
			this,
			name,
			name2
		);
	},
	setAvatarQueue(this: Player, name: string | undefined, list: string[]): void {
		let player = this;
		const node: AvatarQueueNode = player.name2 == name ? player.node.avatar2 : player.node.avatar;
		if (node._avatarqueue) {
			for (let i = 0; i < list.length; i++) {
				node._avatarqueue.push(list[i]);
			}
		} else {
			const queue = list.slice(0);
			let func = function () {
				if (queue.length) {
					const nextAvatar = queue.shift();
					if (typeof nextAvatar == "string") {
						player.setAvatar(name, nextAvatar, false, false);
					}
				} else {
					if (node._avatarqueueinterval !== undefined) {
						clearInterval(node._avatarqueueinterval);
					}
					delete node._avatarqueue;
					delete node._avatarqueueinterval;
					player.setAvatar(name, name, false, false);
				}
			};
			node._avatarqueue = queue;
			node._avatarqueueinterval = setInterval(func, 1000);
			func();
		}
		game.addVideo("setAvatarQueue", this, [name, list]);
	},
	flashAvatar(this: Player, skill: string, name: string): void {
		if (lib.skill[name] && !lib.character[name]) {
			let stop = false;
			let list = lib.config.all.characters.slice(0);
			for (let i in lib.characterPack) {
				list.add(i);
			}
			for (let i = 0; i < list.length; i++) {
				for (let j in lib.characterPack[list[i]]) {
					const character = get.convertedCharacter(lib.characterPack[list[i]][j]);
					if (character.skills.includes(name)) {
						name = j;
						stop = true;
						break;
					}
				}
				if (stop) {
					break;
				}
			}
		}
		const name2 = this.name2;
		if (name2 && lib.character[name2] && lib.character[name2].skills.includes(skill)) {
			this.setAvatarQueue(name2, [name]);
		} else {
			this.setAvatarQueue(this.name, [name]);
		}
	},
	update(this: Player): void {
		if (_status.video && arguments.length == 0) {
			return;
		}
		if (Number(this.hp) >= Number(this.maxHp)) {
			this.hp = this.maxHp;
		}
		game.broadcast(
			function (player, hp, maxHp, hujia) {
				player.hp = hp;
				player.maxHp = maxHp;
				player.hujia = hujia;
				player.$update();
			},
			this,
			this.hp,
			this.maxHp,
			this.hujia
		);
		game.callHook("checkUpdate", [this]);
		// eslint-disable-next-line prefer-rest-params
		this.$update(...arguments);
	},
	$update(this: Player): Player {
		if (Number(this.hp) >= Number(this.maxHp)) {
			this.hp = this.maxHp;
		}
		let hp = this.node.hp;
		hp.style.transition = "none";
		if (!_status.video) {
			if (this.hujia) {
				this.markSkill("ghujia");
			} else {
				this.unmarkSkill("ghujia");
			}
		}
		if (!this.storage.nohp) {
			if (!ui?.create?.playerCard?.syncHp?.(this)) {
				const hidden = this.classList.contains("unseen_show") || this.classList.contains("unseen2_show");
				const maxHp = hidden ? 1 : this.maxHp;
				if (maxHp == Infinity) {
					hp.innerHTML = this.hp == Infinity ? "∞" : this.hp + "<br>/<br>" + "∞" + "<div></div>";
				} else if (Number(maxHp) > 5) {
					hp.innerHTML = this.hp + "<br>/<br>" + maxHp + "<div></div>";
					if (this.hp == 0) {
						const lastHpSegment = hp.lastElementChild;
						if (lastHpSegment instanceof HTMLElement) {
							lastHpSegment.classList.add("lost");
						}
					}
					hp.classList.add("textstyle");
				} else {
					hp.innerHTML = "";
					hp.classList.remove("text");
					hp.classList.remove("textstyle");
					while (Number(maxHp) > hp.children.length) {
						ui.create.div(hp);
					}
					while (Math.max(0, Number(maxHp)) < hp.children.length) {
						const lastHpSegment = hp.lastElementChild;
						if (!lastHpSegment) {
							break;
						}
						hp.removeChild(lastHpSegment);
					}
					for (let i = 0; i < Number(maxHp); i++) {
						let index = i;
						if (get.is.newLayout()) {
							index = Number(maxHp) - i - 1;
						}
						const hpSegment = hp.children[index];
						if (!(hpSegment instanceof HTMLElement)) {
							continue;
						}
						if (i < Number(this.hp)) {
							hpSegment.classList.remove("lost");
						} else {
							hpSegment.classList.add("lost");
						}
					}
				}
				if (hidden) {
					hp.dataset.condition = "hidden";
				} else if (hp.classList.contains("room")) {
					hp.dataset.condition = "high";
				} else if (this.hp == 0) {
					hp.dataset.condition = "";
				} else if (Number(this.hp) > Math.round(Number(maxHp) / 2) || this.hp === maxHp) {
					hp.dataset.condition = "high";
				} else if (Number(this.hp) > Math.floor(Number(maxHp) / 3)) {
					hp.dataset.condition = "mid";
				} else {
					hp.dataset.condition = "low";
				}

				setTimeout(function () {
					hp.style.transition = "";
				});
			}
		}
		let numh = this.countCards("h");
		if (_status.video) {
			// eslint-disable-next-line prefer-rest-params
			numh = arguments[0];
		}
		if (!ui?.create?.playerCard?.syncCount?.(this, numh)) {
			this.node.count.innerHTML = numh?.toString();
			if (numh < 10) {
				this.node.count.dataset.condition = "low";
			} else if (numh < 100) {
				this.node.count.dataset.condition = "mid";
			} else {
				this.node.count.dataset.condition = "high";
			}
		}
		if (this.updates) {
			for (let i = 0; i < this.updates.length; i++) {
				this.updates[i](this);
			}
		}
		if (!_status.video) {
			game.addVideo("update", this, [this.countCards("h"), this.hp, this.maxHp, this.hujia]);
		}
		this.updateMarks();
		game.callHook("checkTipBottom", [this]);
		return this;
	},
	playerfocus(this: Player, time?: number): Player {
		time = time || 1000;
		this.classList.add("playerfocus");
		ui.arena.classList.add("playerfocus");
		let that = this;
		setTimeout(function () {
			that.classList.remove("playerfocus");
			ui.arena.classList.remove("playerfocus");
		}, time);
		game.addVideo("playerfocus", this, time);
		game.broadcast(
			function (player, time) {
				player.playerfocus(time);
			},
			this,
			time
		);
		return this;
	},
	queue(this: Player, time?: number | false): void {
		if (time == false) {
			clearTimeout(this.queueTimeout);
			this.queueCount = 0;
			return;
		}
		if (time == undefined) {
			time = 500;
		}
		let player = this;
		player.queueCount++;
		this.queueTimeout = setTimeout(function () {
			player.queueCount--;
			if (player.queueCount == 0) {
				player.style.transform = "";
				player.node.avatar.style.transform = "";
				player.node.avatar2.style.transform = "";
				if (game.chess) {
					if (typeof ui.placeChess != "function") {
						throw new TypeError("Chess mode requires ui.placeChess");
					}
					ui.placeChess(player, String(player.dataset.position));
				}
				if (player == game.me) {
					ui.me.removeAttribute("style");
				}
			}
		}, time);
	},
};
