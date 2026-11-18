import { game, get, lib, ui } from "noname";
import { getRegisteredSkill } from "../../../skillRegistry.js";
import { hasHtmlDivParent, isMarkNode, hasMarkName, hasMarkIdentifier, deleteMarkNode } from "../dom/nodeGuards.js";
import type { MarkNode } from "../contracts/instanceFieldsContract.js";
import type { Card, GameEvent, Player } from "../../index.js";
import "../contracts/storageHistoryContract.js";

type RuntimeMarkElement = Omit<MarkNode, "info"> & {
	_name?: string;
	skill?: string;
	suit?: string | null;
	number?: number | string | null;
	info?: any;
};

function isCardItem(value: unknown): value is Card {
	return get.itemtype(value) == "card";
}

function isCardsItem(value: unknown): value is Card[] {
	return get.itemtype(value) == "cards";
}

export const markRenderMethods = {
	localMarkSkill(this: Player, skill: string, target: Player, event: GameEvent): void {
		const func = (skill: string, player: Player) => {
			let name = skill,
				info: Skill["intro"];
			if (player.marks[name]) {
				player.updateMarks();
			}
			const skillInfo = lib.getSkill(name);
			if (skillInfo) {
				info = skillInfo.intro;
			}
			if (!info) {
				return;
			}
			const existing: RuntimeMarkElement | undefined = player.marks[name];
			if (existing) {
				existing.info = info;
			} else {
				player.marks[name] = player.mark(name, info);
			}
			player.updateMarks();
		};
		if (event.player == game.me) {
			func(skill, target);
		} else if (event.isOnline()) {
			this.send(func, skill, target);
		}
	},

	markSkill(this: Player, name: string, info?: Skill["intro"] | Record<string, any> | string | boolean | null, card?: Card | null, nobroadcast?: boolean): Player {
		if (info === true) {
			this.syncStorage(name);
			info = null;
		}
		if (isCardItem(card)) {
			game.addVideo("markSkill", this, [name, get.cardInfo(card)]);
		} else {
			game.addVideo("markSkill", this, [name]);
		}
		const func = function (storage: any, player: Player, name: string, info?: any, card?: Card | null) {
			player.storage[name] = storage;
			if (!info) {
				if (player.marks[name]) {
					player.updateMarks();
					return;
				}
				const skillInfo = lib.getSkill(name);
				if (skillInfo) {
					info = skillInfo.intro;
				}
				if (!info) {
					return;
				}
			}
			const existing: RuntimeMarkElement | undefined = player.marks[name];
			if (existing) {
				existing.info = info;
			} else {
				if (card) {
					player.marks[name] = player.mark(card, info, name);
				} else {
					player.marks[name] = player.mark(name, info);
				}
			}
			player.updateMarks();
		};
		func(this.storage[name], this, name, info, card);
		if (!nobroadcast) {
			game.broadcast(func, this.storage[name], this, name, info, card);
		}
		return this;
	},

	unmarkSkill(this: Player, name: string, nobroadcast?: boolean): Player {
		game.addVideo("unmarkSkill", this, name);
		if (!nobroadcast) {
			game.broadcast(
				function (player, name) {
					if (player.marks[name]) {
						player.marks[name].delete();
						player.marks[name].style.transform += " scale(0.2)";
						delete player.marks[name];
						ui.updatem(player);
					}
				},
				this,
				name
			);
		}
		if (this.marks[name]) {
			this.marks[name].delete();
			this.marks[name].style.transform += " scale(0.2)";
			delete this.marks[name];
			ui.updatem(this);
			const info = getRegisteredSkill(lib.skill, name);
			if (!game.online && info && info.intro && info.intro.onunmark) {
				if (info.intro.onunmark == "throw") {
					if (isCardsItem(this.storage[name])) {
						this.$throw(this.storage[name], 1000);
						game.cardsDiscard(this.storage[name]);
						game.log(this.storage[name], "进入了弃牌堆");
						this.storage[name].length = 0;
					}
				} else if (typeof info.intro.onunmark == "function") {
					info.intro.onunmark(this.storage[name], this, name);
				} else {
					delete this.storage[name];
				}
			}
		}
		return this;
	},

	markSkillCharacter(this: Player, id: string, target: Player | { name?: string } | string, name: string, content?: string, nobroadcast?: boolean): Player {
		const targetName = typeof target == "object" ? String(target.name ?? "") : target;
		const func = function (player: Player, target: string, name: string, content: string | undefined, id: string) {
			const existing: RuntimeMarkElement | undefined = player.marks[id];
			if (existing) {
				existing.name = name + "_charactermark";
				existing._name = target;
				existing.info = {
					name: name,
					content: content,
					id: id,
				};
				existing.setBackground(target, "character");
				game.addVideo("changeMarkCharacter", player, {
					id: id,
					name: name,
					content: content,
					target: target,
				});
			} else {
				const created: RuntimeMarkElement | undefined = player.markCharacter(target, {
					name: name,
					content: content,
					id: id,
				});
				if (created) {
					player.marks[id] = created;
					created._name = target;
				}
				game.addVideo("markCharacter", player, {
					name: name,
					content: content,
					id: id,
					target: target,
				});
			}
		};
		func(this, targetName, name, content, id);
		if (!nobroadcast) {
			game.broadcast(func, this, targetName, name, content, id);
		}
		return this;
	},

	markCharacter(this: Player, name: Player | { name?: string } | string, info?: Record<string, any>, learn?: boolean, learn2?: boolean): MarkNode | undefined {
		const charName = typeof name == "object" ? String(name.name ?? "") : name;
		let node: MarkNode;
		if (charName.startsWith("unknown")) {
			node = ui.create.div(".card.mark.drawinghidden");
			ui.create.div(".background.skillmark", node).innerHTML = get.translation(charName)[0];
		} else {
			if (!get.character(charName)) {
				return;
			}
			node = ui.create.div(".card.mark.drawinghidden").setBackground(charName, "character");
		}
		this.node.marks.insertBefore(node, this.node.marks.childNodes[1]);
		node.name = charName + "_charactermark";
		if (!info) {
			info = {};
		}
		if (!info.name) {
			info.name = get.translation(charName);
		}
		if (!info.content) {
			info.content = get.skillintro(charName, learn, learn2);
		}
		node.info = info;
		node.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.card);
		if (!lib.config.touchscreen) {
			if (lib.config.hover_all) {
				lib.setHover(node, ui.click.hoverplayer);
			}
			if (lib.config.right_info) {
				node.oncontextmenu = e => {
					if (!hasHtmlDivParent(node)) return false;
					return ui.click.rightplayer.call(node, e);
				};
			}
		}
		ui.updatem(this);
		return node;
	},

	mark(this: Player, name: string | Card | Card[], info?: Record<string, any> | string | null, skill?: string): MarkNode | MarkNode[] {
		if (isCardsItem(name)) {
			const marks: MarkNode[] = [];
			for (let i = 0; i < name.length; i++) {
				marks.push(this.mark(name[i], info));
			}
			return marks;
		}
		let node: RuntimeMarkElement;
		let markName: string;
		if (isCardItem(name)) {
			const copied: RuntimeMarkElement = name.copy("mark");
			node = copied;
			node.classList.add("drawinghidden");
			this.node.marks.insertBefore(node, this.node.marks.childNodes[1]);
			node.suit = name.suit;
			node.number = name.number;
			if (name.classList.contains("fullborder")) {
				node.classList.add("fakejudge");
				node.classList.add("fakemark");
				(node.querySelector(".background") || ui.create.div(".background", node)).innerHTML = lib.translate[name.name + "_bg"] || get.translation(name.name)[0];
			}
			markName = name.name;
		} else {
			node = ui.create.div(".card.mark.drawinghidden");
			this.node.marks.insertBefore(node, this.node.marks.childNodes[1]);
			const skillInfo: (Skill & { markimage?: string | string[]; markimage2?: string | string[] }) | undefined = getRegisteredSkill(lib.skill, name);
			if (skillInfo?.markimage) {
				node.setBackgroundImage(skillInfo.markimage);
				node.style["box-shadow"] = "none";
				node.style["background-size"] = "contain";
			} else if (skillInfo?.markimage2) {
				const img = ui.create.div(".background.skillmark", node);
				img.setBackgroundImage(skillInfo.markimage2);
				img.style["background-size"] = "contain";
			} else {
				let str = lib.translate[name + "_bg"];
				if (!str || str[0] == "+" || str[0] == "-") {
					str = get.translation(name)[0];
				}
				ui.create.div(".background.skillmark", node).innerHTML = str;
			}
			markName = name;
		}
		node.name = markName;
		node.skill = skill || markName;
		if (info && typeof info == "object") {
			node.info = info;
		} else if (typeof info == "string") {
			node.markidentifer = info;
		}
		node.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.card);
		if (!lib.config.touchscreen) {
			if (lib.config.hover_all) {
				lib.setHover(node, ui.click.hoverplayer);
			}
			if (lib.config.right_info) {
				const markNode: MarkNode = node;
				node.oncontextmenu = e => {
					if (!hasHtmlDivParent(markNode)) return false;
					return ui.click.rightplayer.call(markNode, e);
				};
			}
		}
		this.updateMarks();
		ui.updatem(this);
		return node;
	},

	unmark(this: Player, name: string | Card | Card[], info?: string): void {
		game.addVideo("unmarkname", this, name);
		if (isCardItem(name)) {
			this.unmark(name.name, info);
		} else if (isCardsItem(name)) {
			for (let i = 0; i < name.length; i++) {
				this.unmark(name[i].name, info);
			}
		} else {
			for (let i = 0; i < this.node.marks.childNodes.length; i++) {
				const mark = this.node.marks.childNodes[i];
				if (!isMarkNode(mark)) {
					continue;
				}
				if (hasMarkName(mark, name) && (!info || hasMarkIdentifier(mark, info))) {
					deleteMarkNode(mark);
					mark.style.transform += " scale(0.2)";
					ui.updatem(this);
					return;
				}
			}
		}
	},
};
