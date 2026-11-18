import { lib, game, get, _status, ui } from "noname";
import type { Control } from "../../../library/element/index.js";
import { requireRegisteredSkill } from "../../../library/skillRegistry.js";
import {
	isSkillToggleTarget,
	type ControlButton,
	type ControlContainer,
	type SkillButtonTarget,
} from "../contracts/domTargetsContract.js";

function isSkillButtonTarget(node: HTMLDivElement): node is SkillButtonTarget {
	return "link" in node && "func" in node && typeof (node as Partial<SkillButtonTarget>).func === "function" && get.itemtype((node as Partial<SkillButtonTarget>).link) === "player";
}

function closeActiveSkillControls(): void {
	ui.skills?.close();
	ui.skills2?.close();
	ui.skills3?.close();
}

export const gameplayControlsMethods = {
	control2(this: ControlContainer) {
		if (this.childNodes.length == 1 && !this._doubleclick) {
			const firstChild = this.firstElementChild;
			if (firstChild instanceof HTMLDivElement && "link" in firstChild && typeof firstChild.link == "string") {
				const controlButton = Object.assign(firstChild, { link: firstChild.link });
				ui.click.control.call(controlButton);
			}
		}
	},
	control(this: ControlButton) {
		if (_status.dragged || ui.control.classList.contains("hidden")) {
			return;
		}
		const node = this.parentElement;
		if (node) {
			const controlContainer = node;
			if ("_doubleclick" in node && node._doubleclick === true) {
				return;
			}
			Object.assign(node, { _doubleclick: true });
			setTimeout(function () {
				Object.assign(controlContainer, { _doubleclick: false });
			}, 500);
			if (node.classList.contains("hidden") || node.classList.contains("removing") || node.classList.contains("disabled")) {
				return;
			}
		}
		if (ui.intro) {
			ui.intro.close();
			delete ui.intro;
		}
		_status.clicked = true;
		const parent = this.parentElement as (HTMLElement & { custom?: (link: string, btn: ControlButton) => void; close?: () => void }) | null;
		if (parent && typeof parent.custom == "function") {
			parent.custom(this.link, this);
			return;
		}
		if (this.link == "ok") {
			ui.click.ok(this);
		} else if (this.link == "cancel") {
			ui.click.cancel(this);
		} else {
			_status.event.result = {
				buttons: ui.selected.buttons.slice(0),
				cards: ui.selected.cards.slice(0),
				targets: ui.selected.targets.slice(0),
				control: this.link,
				links: get.links(ui.selected.buttons),
			};
			if (parent && typeof parent.close == "function") {
				game.uncheck();
				parent.close();
			}
			game.resume();
		}
	},
	dialogcontrol(this: ControlButton) {
		_status.event.result = {
			buttons: ui.selected.buttons.slice(0),
			cards: ui.selected.cards.slice(0),
			targets: ui.selected.targets.slice(0),
			control: this.link,
			links: get.links(ui.selected.buttons),
		};
		game.resume();
	},
	skill(skill: string) {
		const info = get.info(skill);
		const event = _status.event as GameEvent & { skillDialog?: any };
		event.backup(skill);
		const player = event.getPlayer();
		if (info.filterCard && info.discard != false && info.lose != false && !info.viewAs) {
			const cards = player.getCards(event.position);
			for (let i = 0; i < cards.length; i++) {
				if (!lib.filter.cardDiscardable(cards[i], player)) {
					cards[i].uncheck("useSkill");
				}
			}
		}
		if (typeof event.skillDialog == "object") {
			event.skillDialog.close();
		}
		if (event.isMine()) {
			event.skillDialog = true;
		}
		game.uncheck();
		game.check();
		if (event.skillDialog === true) {
			const str = get.translation(skill);
			if (info.prompt) {
				const str2 = typeof info.prompt == "function" ? info.prompt(event, player) : info.prompt;
				event.skillDialog = ui.create.dialog(str, '<div><div style="width:100%;text-align:center">' + str2 + "</div></div>");
				if (info.longprompt) {
					event.skillDialog.forcebutton = true;
					ui.update();
				}
			} else if (info.promptfunc) {
				event.skillDialog = ui.create.dialog(str, '<div><div style="width:100%">' + info.promptfunc(event, player) + "</div></div>");
			} else if (lib.dynamicTranslate[skill]) {
				event.skillDialog = ui.create.dialog(str, '<div><div style="width:100%">' + lib.dynamicTranslate[skill](player, skill) + "</div></div>");
			} else if (lib.translate[skill + "_info"]) {
				event.skillDialog = ui.create.dialog(str, '<div><div style="width:100%">' + lib.translate[skill + "_info"] + "</div></div>");
			}
		}
	},
	ok(node?: ControlButton | ChildNode | null) {
		const gameEvent = get.event() as GameEvent & { skillDialog?: any };
		const custom = gameEvent.custom;
		const replaceConfirm = custom?.replace?.confirm;
		if (typeof replaceConfirm == "function") {
			replaceConfirm(true);
			return;
		}
		const result: Partial<Result> = (gameEvent.result = {
			buttons: ui.selected.buttons.slice(),
			cards: ui.selected.cards.slice(),
			targets: ui.selected.targets.slice(),
			confirm: "ok",
			bool: true,
			links: get.links(ui.selected.buttons),
		});
		if (node?.parentNode && "close" in node.parentNode && typeof node.parentNode.close == "function") {
			node.parentNode.close();
		}
		const skill = gameEvent.skill;
		if (skill) {
			const player = gameEvent.getPlayer();
			result.skill = skill;
			const info = get.info(skill);
			if (info && info.direct && !info.clearTime) {
				result._noHidingTimer = true;
			}
			const viewAs = info.viewAs;
			if (typeof viewAs == "function") {
				let viewedAs = viewAs(result.cards!, player);
				if (viewedAs) {
					if (typeof viewedAs == "string") {
						viewedAs = { name: viewedAs };
					}
					result.card = get.autoViewAs(viewedAs);
				}
			} else if (viewAs) {
				const viewedAs = typeof viewAs == "string" ? { name: viewAs } : viewAs;
				result.card = get.autoViewAs(viewedAs);
			}
			const resultCard = result.card as { suit?: string | null; number?: number | "unsure" | null } | undefined;
			if (resultCard) {
				const cards = result.cards!;
				if (cards.length == 1) {
					const firstCard = cards[0];
					if (!resultCard.suit) {
						resultCard.suit = get.suit(firstCard);
					}
					if (!resultCard.number) {
						resultCard.number = get.number(firstCard);
					}
				}
			}
			const skillDialog = gameEvent.skillDialog;
			if (skillDialog && (typeof skillDialog == "object" || typeof skillDialog == "function") && "close" in skillDialog && typeof skillDialog.close == "function") {
				skillDialog.close();
			}
			player.getCards("hej").forEach(card => card.recheck("useSkill"));
			gameEvent.restore();
		} else if (["chooseToUse", "chooseToRespond"].includes(gameEvent.name)) {
			result.card = get.autoViewAs(result.cards![0]);
		}
		closeActiveSkillControls();
		game.uncheck();
		const addConfirm = custom?.add?.confirm;
		if (typeof addConfirm == "function") {
			addConfirm(true);
		}
		game.resume();
	},
	cancel(node?: ControlButton | ChildNode | null) {
		const event = _status.event as GameEvent & { skillDialog?: any; dialog?: any };
		if (typeof event.custom?.replace?.confirm == "function") {
			event.custom.replace.confirm(false);
			return;
		}
		if (event.skill && !event.norestore) {
			const player = event.getPlayer();
			if (event.skillDialog && (typeof event.skillDialog == "object" || typeof event.skillDialog == "function") && "close" in event.skillDialog && typeof event.skillDialog.close == "function") {
				event.skillDialog.close();
			}
			if (typeof event.dialog == "string" && event.isMine()) {
				event.dialog = ui.create.dialog(event.dialog);
			}
			if (_status.event.type == "phase" && ui.confirm) {
				ui.confirm.classList.add("removing");
			}
			event.restore();
			const cards = player.getCards("hej");
			for (let i = 0; i < cards.length; i++) {
				cards[i].recheck("useSkill");
			}
			game.uncheck();
			game.check();
			return;
		}
		event.result = {
			confirm: "cancel",
			bool: false,
		};
		if (node?.parentNode && "close" in node.parentNode && typeof node.parentNode.close == "function") {
			node.parentNode.close();
		}
		closeActiveSkillControls();
		game.uncheck();
		if (typeof event.custom?.add?.confirm == "function") {
			event.custom.add.confirm(false);
		}
		game.resume();
	},
	auto(mode?: string | Event) {
		if (!ui || !ui.auto || (ui.auto.classList.contains("hidden") && mode !== "forced") || _status.paused2) {
			return;
		}
		ui.click.shortcut(false);
		const evt = _status.event as GameEvent & { switchToAuto?: () => void };
		if (!_status.auto) {
			_status.auto = true;
			ui.auto.classList.add("glow");
			ui.arena.classList.add("auto");
			if (_status.imchoosing && _status.paused) {
				if (ui.confirm) {
					ui.confirm.close();
				}
				ui.control.hide();
				if (evt.switchToAuto) {
					evt.switchToAuto();
				} else if (_status.paused && _status.imchoosing) {
					game.uncheck();
					evt.redo();
					if (evt.skill && !evt.norestore) {
						evt.restore();
					}
				}
				game.resume();
			} else if (evt.switchToAuto) {
				evt.switchToAuto();
			}
			if (game.online) {
				game.send("auto");
			} else if (_status.connectMode) {
				game.broadcastAll(function (player: any) {
					player.setNickname(player.nickname + " - 托管");
				}, game.getMe());
			}
		} else {
			if (game.notMe || _status.llmSelfControlledAtGameStart) {
				return;
			}
			ui.control.show();
			_status.auto = false;
			ui.auto.classList.remove("glow");
			ui.arena.classList.remove("auto");

			if (game.online) {
				game.send("unauto");
			} else if (_status.connectMode) {
				game.broadcastAll(function (player: any) {
					player.setNickname(player.nickname);
				}, game.getMe());
			}
		}
	},
	wuxie(this: HTMLDivElement, _event?: Event) {
		if (this.classList.contains("hidden")) {
			return;
		}
		this.classList.toggle("glow");
		if (this.classList.contains("glow") && _status.event.type == "wuxie" && _status.event.isMine() && ui.confirm && _status.imchoosing) {
			ui.click.cancel(ui.confirm.lastChild);
		}
	},
	tempnowuxie(this: Control & { _origin?: string | number }) {
		if (this.classList.contains("hidden")) {
			return;
		}
		this.classList.toggle("glow");
		if (this.classList.contains("glow") && _status.event.type == "wuxie" && _status.event.isMine() && ui.confirm && _status.imchoosing) {
			const triggerevent = _status.event.getTrigger();
			if (triggerevent) {
				const triggerParent = triggerevent.parent as (GameEvent & { id?: string | number }) | undefined;
				if (!triggerParent) {
					throw new TypeError("wuxie trigger requires a parent event");
				}
				if (this._origin == triggerParent.id) {
					if (triggerevent.targets && triggerevent.num == triggerevent.targets.length - 1) {
						this.close();
					}
				}
			}
			ui.click.cancel(ui.confirm.lastChild);
		}
	},
	autoskill(bool: boolean, node: { link: string }) {
		const list = lib.config.autoskilllist;
		if (bool) {
			list.remove(node.link);
		} else {
			list.add(node.link);
		}
		game.saveConfig("autoskilllist", list);
	},
	skillbutton(this: HTMLDivElement) {
		if (!isSkillButtonTarget(this)) {
			return;
		}
		this.func(this.link);
	},
	autoskill2(this: HTMLDivElement, e: Event) {
		if (!isSkillToggleTarget(this)) {
			return;
		}
		const link = this.link;
		const info = requireRegisteredSkill(lib.skill, link);
		this.classList.toggle("on");
		const list: string[] = [];
		if (info.frequent) {
			list.push(link);
		}
		const subfrequent = info.subfrequent;
		if (subfrequent) {
			for (let i = 0; i < subfrequent.length; i++) {
				list.push(link + "_" + subfrequent[i]);
			}
		}
		for (let i = 0; i < list.length; i++) {
			if (this.classList.contains("on")) {
				lib.config.autoskilllist.remove(list[i]);
			} else {
				lib.config.autoskilllist.add(list[i]);
			}
		}
		game.saveConfig("autoskilllist", lib.config.autoskilllist);
		ui.click.touchpop();
		e.stopPropagation();
	},
	hiddenskill(this: HTMLDivElement, e: Event) {
		if (!isSkillToggleTarget(this)) {
			return;
		}
		this.classList.toggle("on");
		const hidden = requireRegisteredSkill(lib.skill, this.link).preHidden;
		if (Array.isArray(hidden)) {
			if (this.classList.contains("on")) {
				_status.prehidden_skills.removeArray(hidden);
			} else {
				_status.prehidden_skills.addArray(hidden);
			}
		}
		if (this.classList.contains("on")) {
			_status.prehidden_skills.remove(this.link);
		} else {
			_status.prehidden_skills.add(this.link);
		}
		ui.click.touchpop();
		e.stopPropagation();
	},
};
