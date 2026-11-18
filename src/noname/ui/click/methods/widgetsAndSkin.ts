import { lib, game, get, _status, ui } from "noname";
import type { Card, Player } from "../../../library/element/index.js";
import type {
	ConfigSwitcher,
	EditorTarget,
	LogvTarget,
	PoppedTarget,
	SwitcherChoice,
	ToggleTarget,
} from "../contracts/domTargetsContract.js";

function closeCountDialog(target: Player): boolean {
	if (_status.countDialogs[String(target.playerid)]) {
		const dialog = _status.countDialogs[String(target.playerid)];
		if (ui.window.querySelector(`#${dialog.id}`)) {
			clearInterval(dialog._intervalId);
			const container = dialog.handcardsContainer;
			if (container) {
				container.destroyContainer();
			}
			dialog?.delete();
		}
		delete _status.countDialogs[String(target.playerid)];
		return true;
	}
	return false;
}

function getVisibleCards(target: Player): { cards: Card[]; allShown: boolean } {
	const allShown = target.isUnderControl(true, game.me) || (!game.observe && Boolean(game.me && game.me.hasSkillTag("viewHandcard", null, target, true)));
	if (allShown) {
		return { cards: target.getCards("h"), allShown };
	}
	return { cards: target.getCards("h", card => Boolean(get.is.shownCard(card))), allShown };
}

export const widgetsAndSkinMethods = {
	autoskin() {
		if (!lib.config.change_skin) {
			return;
		}
		const players = game.filterPlayer();
		const change = function (player: Player, num: string, callback: (bool: boolean) => void) {
			if (num == "1") {
				ui.click.skin(player.node.avatar, player.name!, callback);
			} else {
				ui.click.skin(player.node.avatar2, player.name2!, callback);
			}
		};
		const finish = function () {
			if (lib.config.change_skin_auto != "off") {
				_status.skintimeout = setTimeout(ui.click.autoskin, parseInt(lib.config.change_skin_auto));
			}
		};
		const stepAutoskin = function () {
			if (players.length) {
				const player = players.randomRemove();
				if (!player) {
					return;
				}
				const list: string[] = [];
				if (player.name && !player.isUnseen(0)) {
					list.push("1");
				}
				if (player.name2 && !player.isUnseen(1)) {
					list.push("2");
				}
				if (list.length) {
					change(player, list.randomRemove()!, function (bool) {
						if (bool) {
							finish();
						} else if (list.length) {
							change(player, list[0], function (nextBool) {
								if (nextBool) {
									finish();
								} else {
									stepAutoskin();
								}
							});
						} else {
							stepAutoskin();
						}
					});
				} else {
					stepAutoskin();
				}
			} else {
				finish();
			}
		};
		stepAutoskin();
	},
	skin(avatar: HTMLDivElement, name: string, callback?: (bool: boolean) => void) {
		let nowSkin = "defaultSkin";
		if (name.startsWith("gz_")) {
			name = name.slice(3);
		}
		if (lib.config.skin[name]) {
			nowSkin = lib.config.skin[name][1];
		}
		const fakeavatar = avatar.cloneNode(true) as HTMLDivElement;
		const finish = function (bool: boolean) {
			const player = avatar.parentNode as Player;
			if (bool) {
				fakeavatar.style.boxShadow = "none";
				player.insertBefore(fakeavatar, avatar.nextSibling);
				setTimeout(function () {
					fakeavatar.delete();
				}, 100);
			}
			if (bool && lib.config.animation && !lib.config.low_performance) {
				player.$rare();
			}
			if (callback) {
				callback(bool);
			}
		};
		const src = get.skinPath(name);
		if (!src) {
			finish(false);
			return;
		}
		const defaultFolder = src;
		game.getFileList?.(
			defaultFolder,
			(_folders: string[], files: string[]) => {
				if (files.length) {
					const list = [...files, "defaultSkin"].filter(i => i != nowSkin);
					if (list.length) {
						const skin = list.randomGet();
						if (skin === "defaultSkin") {
							delete lib.config.skin[name];
							if (lib.characterSubstitute[name]) {
								for (const nameList of lib.characterSubstitute[name]) {
									delete lib.config.skin[nameList[0]];
								}
							}
						} else {
							lib.config.skin[name] = [skin, `${defaultFolder}${skin}`];
							if (lib.characterSubstitute[name]) {
								for (const nameList of lib.characterSubstitute[name]) {
									const subName = nameList[0];
									const [fold, prefix] = skin.split(".");
									lib.config.skin[subName] = [name, `${defaultFolder}/${fold}/${subName}.${prefix}`];
								}
							}
						}
						game.saveConfig("skin", lib.config.skin);
						avatar.setBackground(name, "character");
						finish(true);
					} else {
						finish(false);
					}
				} else {
					finish(false);
				}
			},
			() => {
				finish(false);
			}
		);
	},
	toggle(this: ToggleTarget) {
		if (_status.dragged || this.parentNode.classList.contains("disabled")) {
			return;
		}
		_status.tempunpop = true;
		if (this.link) {
			this.link = false;
			this.classList.remove("on");
			this.additionalCommand?.(false, this.parentNode);
		} else {
			this.link = true;
			this.classList.add("on");
			this.additionalCommand?.(true, this.parentNode);
		}
	},
	editor(this: EditorTarget) {
		if (_status.dragged || _status.editing) {
			return;
		}
		_status.clicked = true;
		this.innerHTML = "";
		_status.editing = this;
		this.additionalCommand?.(this);
	},
	switcher(this: ConfigSwitcher) {
		if (_status.dragged || this.parentNode.classList.contains("disabled") || _status.choosing) {
			return;
		}
		_status.clicked = true;
		_status.tempunpop = true;
		this.previousSibling.hide();
		const node = ui.create.div(".switcher", this.parentNode).addTempClass("start");
		for (let i = 0; i < this.choice.length; i++) {
			const choice = Object.assign(ui.create.div(".pointerdiv", node), { link: this.choice[i] });
			choice.innerHTML = get.translation(this.choice[i]);
			choice.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.choice);
		}
		_status.choosing = this;
		if (!this.expand) {
			this.expand = true;
			setTimeout(function () {
				const choosing = _status.choosing;
				if (!choosing) {
					throw new TypeError("choosing switcher is missing");
				}
				choosing.expand = false;
			}, 500);
		}
	},
	choice(this: SwitcherChoice) {
		if (_status.dragged || !_status.choosing) {
			return;
		}
		_status.choosing.link = this.link;
		_status.choosing.innerHTML = get.translation(this.link);
		this.parentNode.parentNode.style.height = "";
		this.parentNode.delete();
		_status.choosing.previousSibling.show();
		delete _status.choosing;
		if (this.parentNode.parentNode.querySelector(".toggle").additionalCommand) {
			const secondToggle = this.parentNode.parentNode.querySelector(".toggle");
			const additionalCommand = secondToggle.additionalCommand;
			if (typeof additionalCommand != "function") {
				throw new TypeError("toggle additionalCommand is not a function");
			}
			additionalCommand.call(secondToggle, this.link, this.parentNode.parentNode);
		}
	},
	logv(this: LogvTarget, e: Event) {
		if (_status.currentlogv) {
			if (_status.currentlogv == this) {
				return;
			}
			if (_status.logvtimeout) {
				clearTimeout(_status.logvtimeout);
			}
			const that = this;
			_status.logvtimeout = setTimeout(function () {
				if (!_status.currentlogv) {
					_status.currentlogv = that;
					ui.click.intro.call(that, e);
				}
			}, 200);
			this.logvtimeout = _status.logvtimeout;
		} else {
			_status.currentlogv = this;
			ui.click.intro.call(this, e);
		}
	},
	logvleave(this: LogvTarget) {
		if (_status.currentlogv == this) {
			setTimeout(function () {
				delete _status.currentlogv;
			}, 150);
		}
		if (this.logvtimeout) {
			clearTimeout(this.logvtimeout);
			if (_status.logvtimeout == this.logvtimeout) {
				delete _status.logvtimeout;
			}
			delete this.logvtimeout;
		}
	},
	rightplayer(this: PoppedTarget, e: Event) {
		if (this._nopup || _status.clickedplayer) {
			return false;
		}
		if (this._mouseenterdialog && this._mouseenterdialog.parentNode) {
			this._mouseenterdialog.delete();
		} else {
			ui.click.intro.call(this, e);
		}
		_status.clickedplayer = true;
		_status.clicked = false;
		ui.click.longpresscancel.call(this);
		return false;
	},
	right(e: MouseEvent) {
		if (window.inSplash) {
			return false;
		}
		if (lib.config.touchscreen) {
			return;
		}
		if (_status.noright) {
			_status.noright = false;
			return false;
		}
		if (_status.clickedplayer) {
			_status.clickedplayer = false;
			return;
		}
		game.closePopped();
		switch (lib.config.right_click) {
			case "shortcut":
				ui.click.shortcut();
				break;
			case "pause":
				ui.click.pause();
				break;
			case "auto":
				ui.click.auto();
				break;
			case "config":
				ui.click.config();
				break;
		}
		e.preventDefault();
		return false;
	},
	count(this: HTMLDivElement & { parentNode: Player }, e: MouseEvent) {
		if (_status.dragged) {
			return;
		}
		const target = this.parentNode;
		if (closeCountDialog(target)) {
			return;
		}
		if (game.me == target) {
			return false;
		}
		const { cards, allShown } = getVisibleCards(target);
		if (!cards.length && !allShown) {
			return;
		}

		const dialog = ui.create.dialog("hidden", `${get.translation(target)}的手牌`);
		_status.countDialogs[String(target.playerid)] = dialog;
		dialog.setAttribute("id", "count_handcards_" + target.playerid);
		dialog.classList.add("scroll1");
		dialog.classList.add("scroll2");
		dialog.classList.add("nobutton");
		dialog.classList.add("static");

		const container = ui.create.handcardsContainer();
		container.setAttribute("id", `count_handcards_container_${target.playerid}`);
		dialog.handcardsContainer = container;
		dialog.content.appendChild(container);

		const closeButton = ui.create.div(".close-btn");
		closeButton.textContent = "关闭";
		dialog.appendChild(closeButton);
		closeButton.onclick = function () {
			closeCountDialog(target);
		};

		const intervalId = setInterval(() => {
			const nextState = getVisibleCards(target);
			if (!nextState.cards.length && !nextState.allShown) {
				closeCountDialog(target);
				return;
			}
			container.addCards(nextState.cards);
		}, 200);
		dialog._intervalId = intervalId;

		dialog.style.transform = "scale(0.8)";
		dialog.style.transitionProperty = "opacity,transform";
		dialog.style.opacity = "0";
		ui.window.appendChild(dialog);
		ui.refresh(dialog);
		lib.placePoppedDialog(dialog, e);
		dialog.style.transform = "scale(1)";
		dialog.style.opacity = "1";
		setTimeout(() => {
			dialog.style.transitionProperty = "";
		}, 500);
		container.addCards(cards);
	},
};
