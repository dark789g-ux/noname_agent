import { _status, game, get, lib, ui } from "noname";
import type { GameEvent } from "../../gameEvent.js";
import type { Player } from "../../player.js";

export const characterInitMethods = {
	reinitCharacter(this: Player, from: string, to: string, log = true): GameEvent | undefined {
		const rawPairs = [this.name1];
		if (this.name2) {
			rawPairs.push(this.name2);
		}
		for (let i = 0; i < rawPairs.length; i++) {
			if (rawPairs[i] == from) {
				rawPairs[i] = to;
				break;
			}
		}
		return this.changeCharacter(rawPairs, log);
	},
	changeCharacter(this: Player, newPairs: (string | undefined)[], log = true): GameEvent | undefined {
		if (!Array.isArray(newPairs)) {
			console.warn(`警告：Player[${this.name}].changeCharacter填写了一个错误的参数:`, newPairs);
			return;
		}
		for (const name of newPairs) {
			if (!lib.character[String(name)]) {
				console.warn(`警告：Player[${this.name}]试图将武将牌变更为不存在的武将:`, name);
				return;
			}
		}
		const next = game.createEvent("changeCharacter") as GameEvent & {
			newPairs?: (string | undefined)[];
			log?: boolean;
		};
		next.player = this;
		next.newPairs = newPairs;
		next.log = log;
		next.setContent("changeCharacter");
		return next;
	},
	init(this: Player, character, character2, skill, update) {
		let hidden = false;
		if (typeof character == "string" && !lib.character[character]) {
			lib.character[character] = get.character(character);
		}
		if (typeof character2 == "string" && !lib.character[character2]) {
			lib.character[character2] = get.character(character2);
		}
		if (!lib.character[character]) {
			return;
		}
		if (get.is.jun(character2)) {
			const tmp = character;
			character = character2;
			character2 = tmp;
		}
		if (character2 == false) {
			skill = false;
			character2 = null;
		}
		let info = lib.character[character];
		if (!info) {
			info = get.convertedCharacter(["", "", 1, [], []]);
		}
		let skills = info.skills.slice(0);
		this.clearSkills(true);

		const hp1 = info.hp;
		const maxHp1 = info.maxHp;
		const hujia1 = info.hujia;

		this.name = character;
		this.name1 = character;
		this.tempname = [];
		this.skin = {
			name: character,
			name2: character2,
		};
		this.sex = info.sex;
		this.group = info.group;
		this.hp = hp1;
		this.maxHp = maxHp1;
		this.hujia = hujia1;
		this.node.intro.innerHTML = lib.config.intro;
		lib.setIntro(this);
		if (!ui?.create?.playerCard?.syncName1?.(this, character, this.group, this.classList.contains("minskin"))) {
			this.node.name.dataset.nature = get.groupnature(this.group);
			this.node.name.innerHTML = get.slimName(character);
			if (this.classList.contains("minskin") && this.node.name.querySelectorAll("br").length >= 4) {
				this.node.name.classList.add("long");
			}
		}
		if (info.hasHiddenSkill && !this.noclick) {
			if (!this.hiddenSkills) {
				this.hiddenSkills = [];
			}
			this.hiddenSkills.addArray(skills);
			skills = [];
			this.name = "unknown";
			this.sex = "male";
			hidden = true;
			skills.add("g_hidden_ai");
		}
		if (character2 && lib.character[character2]) {
			let info2 = lib.character[character2];
			if (!info2) {
				info2 = get.convertedCharacter(["", "", 1, [], []]);
			}

			this.name2 = character2;
			const hp2 = info2.hp;
			const maxHp2 = info2.maxHp;
			const hujia2 = info2.hujia;
			this.hujia += hujia2;
			let double_hp;
			if (_status.connectMode || (get.mode() == "single" && _status.mode == "changban")) {
				double_hp = "pingjun";
			} else {
				double_hp = get.config("double_hp");
			}
			switch (double_hp) {
				case "pingjun": {
					this.maxHp = Math.floor((maxHp1 + maxHp2) / 2);
					this.hp = Math.floor((hp1 + hp2) / 2);
					this.singleHp = (maxHp1 + maxHp2) % 2 === 1;
					break;
				}
				case "zuidazhi": {
					this.maxHp = Math.max(maxHp1, maxHp2);
					this.hp = Math.max(hp1, hp2);
					break;
				}
				case "zuixiaozhi": {
					this.maxHp = Math.min(maxHp1, maxHp2);
					this.hp = Math.min(hp1, hp2);
					break;
				}
				case "zonghe": {
					this.maxHp = maxHp1 + maxHp2;
					this.hp = hp1 + hp2;
					break;
				}
				default: {
					this.maxHp = maxHp1 + maxHp2 - 3;
					this.hp = hp1 + hp2 - 3;
				}
			}
			if (info2.hasHiddenSkill && !this.noclick) {
				if (!this.hiddenSkills) {
					this.hiddenSkills = [];
				}
				this.hiddenSkills.addArray(info2.skills);
				hidden = true;
				skills.add("g_hidden_ai");
			} else {
				skills = skills.concat(info2.skills);
			}
		}
		if (this.storage.nohp || hidden) {
			this.storage.rawHp = this.hp;
			this.storage.rawMaxHp = this.maxHp;
			this.hp = 1;
			this.maxHp = 1;
			if (this.storage.nohp) {
				this.node.hp.hide();
			}
		}
		if (skill != false) {
			skills = skills.filter(skill => {
				const info = get.info(skill);
				if (info && info.zhuSkill && !this.isZhu2()) {
					return false;
				}
				return true;
			});
			for (let i = 0; i < skills.length; i++) {
				this.addSkill(skills[i], null, true);
			}
			this.checkConflict();
		}
		lib.group.add(this.group);

		this.$init(character, character2);

		if (this.inits) {
			for (let i = 0; i < this.inits.length; i++) {
				this.inits[i](this);
			}
		}
		if (this._inits) {
			for (let i = 0; i < this._inits.length; i++) {
				this._inits[i](this);
			}
		}
		if (update !== false) {
			this.$update();
		}
		return this;
	},
	$init(this: Player, character, character2) {
		this.classList.add("fullskin");
		let info = lib.character[character];
		if (!info) {
			info = get.convertedCharacter(["", "", 1, [], []]);
		}

		if (!game.minskin && get.is.newLayout() && !info.isMinskin) {
			this.classList.remove("minskin");
			this.node.avatar.setBackground(character, "character");
		} else {
			this.node.avatar.setBackground(character, "character");
			if (info.isMinskin) {
				this.classList.add("minskin");
			} else if (game.minskin) {
				this.classList.add("minskin");
			} else {
				this.classList.remove("minskin");
			}
		}

		this.node.avatar.show();
		this.node.count.show();
		this.node.equips.show();

		this.node.intro.innerHTML = lib.config.intro;
		lib.setIntro(this);
		if (!ui?.create?.playerCard?.syncName1?.(this, character, String(this.group), this.classList.contains("minskin"))) {
			this.node.name.dataset.nature = get.groupnature(String(this.group));
			this.node.name.innerHTML = get.slimName(character);
			if (this.classList.contains("minskin") && this.node.name.querySelectorAll("br").length >= 4) {
				this.node.name.classList.add("long");
			}
		}
		if (info.hasHiddenSkill && !this.noclick) {
			if (!_status.video && get.mode() != "guozhan") {
				this.classList.add("unseen_show");
			}
			this.classList.add(_status.video ? "unseen_v" : "unseen");
			if (!this.node.name_seat && !_status.video) {
				this.node.name_seat = ui.create.div(".name.name_seat", get.verticalStr(get.translation(this.name)), this);
				this.node.name_seat.dataset.nature = get.groupnature(String(this.group));
			}
		}
		if (character2 && lib.character[character2]) {
			let info2 = lib.character[character2];
			if (!info2) {
				info2 = get.convertedCharacter(["", "", 1, [], []]);
			}
			this.classList.add("fullskin2");
			this.node.avatar2.setBackground(character2, "character");
			this.node.avatar2.show();
			this.name2 = character2;

			this.node.count.classList.add("p2");
			if (info2.hasHiddenSkill && !this.noclick) {
				if (!_status.video && get.mode() != "guozhan") {
					this.classList.add("unseen2_show");
				}
				this.classList.add(_status.video ? "unseen2_v" : "unseen2");
			}
			if (!ui?.create?.playerCard?.syncName2?.(this, character2)) {
				this.node.name2.innerHTML = get.slimName(character2);
			}
		}
		if (this.storage.nohp) {
			this.node.hp.hide();
		}

		return this;
	},
};
