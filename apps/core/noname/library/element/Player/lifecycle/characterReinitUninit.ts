import { game, get, lib, ui } from "noname";
import type { Player } from "../../player.js";

export const characterReinitUninitMethods = {
	reinit2(this: Player, newPairs) {
		const player = this;
		game.broadcast(
			(player, newPairs) => {
				player.reinit2(newPairs);
			},
			this,
			newPairs
		);
		const rawPairs = [this.name1];
		if (this.name2 && lib.character[this.name2]) {
			rawPairs.push(this.name2);
		}
		// 单将变单将 & 双将变双将
		if (rawPairs.length == newPairs.length) {
			for (let i = 0; i < Math.min(2, rawPairs.length); i++) {
				const rawName = rawPairs[i],
					newName = newPairs[i];
				if (rawName != newName && lib.character[String(rawName)] && lib.character[String(newName)]) {
					player.reinit(rawName, newName, null, true);
				}
			}
		}
		// 单将变双将
		else if (rawPairs.length == 1 && newPairs.length == 2) {
			player.name1 = newPairs[0];
			player.name2 = newPairs[1];
			player.$reinit12(newPairs);
		}
		// 双将变单将
		else if (rawPairs.length == 2 && newPairs.length == 1) {
			player.name1 = newPairs[0];
			delete player.name2;
			player.$reinit21(newPairs);
		}
		// 修改性别
		if (!player.isUnseen(1)) {
			player.name = player.name1;
			player.sex = get.character(String(player.name1), 0);
		} else if (!player.isUnseen(2)) {
			const name2 = player.name2;
			if (!name2) {
				throw new Error("visible vice character is absent after reinitialization");
			}
			player.name = name2;
			player.sex = get.character(name2, 0);
		}
	},
	$reinit12(this: Player, newPairs) {
		const player = this;
		player.node.avatar.setBackground(newPairs[0], "character");
		if (!ui?.create?.playerCard?.syncName1?.(player, newPairs[0])) {
			player.node.name.innerHTML = get.slimName(newPairs[0]);
		}
		player.name2 = newPairs[1];
		player.classList.add("fullskin2");
		player.node.avatar2.classList.remove("hidden");
		player.node.avatar2.setBackground(newPairs[1], "character");
		if (!ui?.create?.playerCard?.syncName2?.(player, newPairs[1])) {
			player.node.name2.innerHTML = get.slimName(newPairs[1]);
		}
		if (player == game.me && ui.fakeme) {
			ui.fakeme.style.backgroundImage = player.node.avatar.style.backgroundImage;
		}
	},
	$reinit21(this: Player, newPairs) {
		const player = this,
			name = newPairs[0];
		player.smoothAvatar(false);
		player.node.avatar.setBackground(name, "character");
		if (!ui?.create?.playerCard?.syncName1?.(player, name)) {
			player.node.name.innerHTML = get.slimName(name);
		}
		player.classList.remove("fullskin2");
		player.node.avatar2.classList.add("hidden");
		if (!ui?.create?.playerCard?.syncName2?.(player, "")) {
			player.node.name2.innerHTML = "";
		}
		if (player == game.me && ui.fakeme) {
			ui.fakeme.style.backgroundImage = player.node.avatar.style.backgroundImage;
		}
	},
	reinit(this: Player, from, to, maxHp, online) {
		const info1 = lib.character[from];
		const info2 = lib.character[to];
		let smooth = true;
		if (maxHp == "nosmooth") {
			smooth = false;
			maxHp = null;
		}
		const skin = this.skin;
		if (!skin) return this;
		if (this.name2 == from) {
			this.name2 = to;
			skin.name2 = to;
		} else if (this.name == from || this.name1 == from) {
			if (this.name1 == from) {
				this.name1 = to;
				skin.name = to;
			}
			if (!this.isUnseen(1)) {
				this.name = to;
				if (skin.name != to) {
					skin.name = to;
				}
				this.sex = info2[0];
			}
		} else {
			return this;
		}
		if (!online) {
			for (let i = 0; i < info1[3].length; i++) {
				this.removeSkill(info1[3][i]);
			}
			for (let i = 0; i < info2[3].length; i++) {
				const info = get.info(info2[3][i]);
				if (info && info.zhuSkill && !this.isZhu2()) {
					continue;
				}
				this.addSkill(info2[3][i]);
			}
			if (Array.isArray(maxHp)) {
				this.maxHp = maxHp[1];
				this.hp = maxHp[0];
				if (typeof maxHp[2] == "number") {
					this.hujia = maxHp[2];
				}
			} else {
				let num;
				if (maxHp === false) {
					num = 0;
				} else {
					if (typeof maxHp != "number") {
						maxHp = get.infoMaxHp(info2[2]);
					}
					num = maxHp - get.infoMaxHp(info1[2]);
				}
				if (typeof this.singleHp == "boolean") {
					if (num % 2 != 0) {
						if (this.singleHp) {
							this.maxHp = Number(this.maxHp) + (num + 1) / 2;
							this.singleHp = false;
						} else {
							this.maxHp = Number(this.maxHp) + (num - 1) / 2;
							this.singleHp = true;
							if (!game.online) {
								this.doubleDraw();
							}
						}
					} else {
						this.maxHp = Number(this.maxHp) + num / 2;
					}
				} else {
					this.maxHp = Number(this.maxHp) + num;
				}
			}
			game.broadcast(
				function (player, from, to, skills) {
					player.reinit(from, to, null, true);
					player.applySkills(skills);
				},
				this,
				from,
				to,
				get.skillState(this)
			);
		}
		game.addVideo("reinit3", this, {
			from: from,
			to: to,
			hp: this.maxHp,
			avatar2: this.name2 == to,
		});
		this.$reinit(from, to, maxHp, online);
		this.update();
	},
	$reinit(this: Player, from, to, maxHp, online) {
		let smooth = true;
		if (maxHp == "nosmooth") {
			smooth = false;
			maxHp = null;
		}
		if (this.name2 == to) {
			if (smooth) {
				this.smoothAvatar(true);
			}
			this.node.avatar2.setBackground(to, "character");
			if (!ui?.create?.playerCard?.syncName2?.(this, to)) {
				this.node.name2.innerHTML = get.slimName(to);
			}
		} else if (this.name == to || this.name1 == to) {
			if (smooth) {
				this.smoothAvatar(false);
			}
			this.node.avatar.setBackground(to, "character");
			if (!ui?.create?.playerCard?.syncName1?.(this, to)) {
				this.node.name.innerHTML = get.slimName(to);
			}

			if (this == game.me && ui.fakeme) {
				ui.fakeme.style.backgroundImage = this.node.avatar.style.backgroundImage;
			}
		}
	},
	uninit(this: Player) {
		delete this.name;
		delete this.name1;
		delete this.tempname;
		delete this.skin;
		delete this.sex;
		delete this.group;
		delete this.hp;
		delete this.maxHp;
		delete this.hujia;

		if (this.name2) {
			delete this.singleHp;
			delete this.name2;
		}

		this.skipList = [];
		this.clearSkills(true);
		this.initedSkills = [];
		this.additionalSkills = {};
		this.disabledSkills = {};
		this.hiddenSkills = [];
		this.awakenedSkills = [];
		this.forbiddenSkills = {};
		this.phaseNumber = 0;
		this.stat = [{ card: {}, skill: {}, triggerSkill: {} }];
		this.tempSkills = {};
		this.storage = { counttrigger: this.storage.counttrigger };
		this.expandedSlots = {};
		this.disabledSlots = {};
		this.ai = { friend: [], enemy: [], neutral: [] };

		this.$uninit();
		this.marks = {};

		return this;
	},
	$uninit(this: Player) {
		this.$syncExpand();
		this.$syncDisable();
		game.broadcastAll(function (player) {
			delete player.storage._disableJudge;
			for (let i = 0; i < player.node.judges.childNodes.length; i++) {
				const judge = player.node.judges.childNodes[i];
				if (judge instanceof lib.element.Card && judge.name == "disable_judge") {
					player.node.judges.removeChild(judge);
					break;
				}
			}
		}, this);

		this.node.avatar.hide();
		this.node.count.hide();
		if (this.node.wuxing) {
			this.node.wuxing.hide();
		}
		if (this.node.name_seat) {
			this.node.name_seat.remove();
			delete this.node.name_seat;
		}
		this.node.hp.show();
		this.classList.remove("unseen");
		this.classList.remove("unseen2");
		this.classList.remove("unseen_show");
		this.classList.remove("unseen2_show");
		this.classList.remove("turnedover");
		this.classList.remove("linked");
		this.classList.remove("linked2");

		this.node.identity.style.backgroundColor = "";
		this.node.intro.innerHTML = "";
		if (!ui?.create?.playerCard?.reset?.(this)) {
			this.node.name.innerHTML = "";
			this.node.hp.innerHTML = "";
			this.node.count.innerHTML = "0";
			this.node.name2.innerHTML = "";
		}

		this.node.avatar2.hide();
		this.classList.remove("fullskin2");
		this.node.count.classList.remove("p2");

		for (const mark in this.marks) {
			this.marks[mark].remove();
		}
		this.removeTip();
		ui.updatej(this);
		ui.updatem(this);
	},
};
