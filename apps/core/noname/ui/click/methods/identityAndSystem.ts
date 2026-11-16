import { lib, game, get, _status, ui } from "noname";
import { menuBridge } from "@/ui/create/menu/vue/utils/menuBridge";
import type { Player } from "../../../library/element/index.js";
import type { IdentityCircleContainer, IdentityCircleNode, IdentityTarget } from "../contracts/domTargetsContract.js";
import { renderCommonCardPileDialog } from "./commonCardPile.js";

function isIdentityCircleContainer(value: ParentNode | null): value is IdentityCircleContainer {
	if (!(value instanceof HTMLElement)) {
		return false;
	}
	return Array.from(value.childNodes).every(child => child instanceof HTMLElement && "link" in child && Array.isArray(child.link));
}

export const identityAndSystemMethods = {
	identitycircle(this: IdentityCircleNode) {
		const list: string[] = [];
		if (!isIdentityCircleContainer(this.parentNode)) {
			return;
		}
		const parentNode = this.parentNode;
		this.classList.toggle("transparent");
		for (let i = 0; i < parentNode.childNodes.length; i++) {
			if (!parentNode.childNodes[i].classList.contains("transparent")) {
				list.add(parentNode.childNodes[i].link[2]);
			}
		}
		const info = this.link;
		if (list.length == 1) {
			for (let i = 0; i < parentNode.childNodes.length; i++) {
				if (!parentNode.childNodes[i].classList.contains("transparent")) {
					const info2 = parentNode.childNodes[i].link;
					info[0].firstChild.innerHTML = info2[1];
					info[0].dataset.color = info2[2];
				}
			}
		} else {
			info[0].firstChild.innerHTML = "";
			info[0].dataset.color = "";
			ui.create.identitycircle(list, info[0].firstChild);
		}
		this._source._guozhanguess = list;
	},
	exit() {
		if (game.servermode && lib.config.reconnect_info && _status.over) {
			if (!_status.roomtimeout) {
				lib.config.reconnect_info[2] = game.roomId;
				game.saveConfig("reconnect_info", lib.config.reconnect_info);
			}
			game.reload();
			return;
		}
		if (typeof game.roomId != "string") {
			game.saveConfig("reconnect_info");
		}
		if (!ui.exit || !(ui.exit as { stay?: boolean }).stay) {
			if (lib.config.reconnect_info) {
				lib.config.reconnect_info.length = 1;
				game.saveConfig("reconnect_info", lib.config.reconnect_info);
			}
			game.saveConfig("tmp_user_roomId", undefined, false, function () {
				game.reload();
			});
		} else {
			game.reload();
		}
	},
	shortcut(show?: boolean | Event) {
		if (show === false) {
			ui.shortcut.classList.add("hidden");
		} else {
			ui.shortcut.classList.toggle("hidden");
		}
		if (ui.shortcut.classList.contains("hidden")) {
			ui.favmode.style.display = "none";
			if (window.StatusBar && lib.config.show_statusbar_ios == "auto") {
				document.body.classList.remove("statusbar");
				window.StatusBar.hide();
			}
			ui.window.classList.remove("shortcutpaused");
		} else {
			if (lib.config.show_favmode) {
				ui.favmode.style.display = "";
			}
			if (window.StatusBar && lib.config.show_statusbar_ios == "auto") {
				document.body.classList.add("statusbar");
				window.StatusBar.overlaysWebView(true);
				window.StatusBar.backgroundColorByName("black");
				window.StatusBar.show();
			}
			ui.shortcut.autobutton.classList.toggle("active", Boolean(_status.auto));
			ui.window.classList.add("shortcutpaused");
		}
	},
	favouriteCharacter(this: HTMLElement & { link?: string }, e: Event) {
		if (typeof this.link == "string") {
			if (this.innerHTML == "添加收藏") {
				this.innerHTML = "移除收藏";
				lib.config.favouriteCharacter.add(this.link);
			} else {
				this.innerHTML = "添加收藏";
				lib.config.favouriteCharacter.remove(this.link);
			}
			menuBridge.refreshCharacterPackMenu?.();
			game.saveConfig("favouriteCharacter", lib.config.favouriteCharacter);
		}
		e.stopPropagation();
	},
	identity(this: IdentityTarget, _e?: Event) {
		if (_status.dragged) {
			return;
		}
		_status.clicked = true;
		if (!game.getIdentityList || _status.video || this.parentNode.forceShown) {
			return;
		}
		const playerAi = this.parentNode.ai;
		if (!_status.connectMode && "stratagem_camouflage" in playerAi && playerAi.stratagem_camouflage && get.config("nei_auto_mark_camouflage") && game.getMe().identity == "nei") {
			return;
		}
		if (_status.clickingidentity) {
			for (let i = 0; i < _status.clickingidentity[1].length; i++) {
				_status.clickingidentity[1][i].delete();
				_status.clickingidentity[1][i].style.transform = "";
			}
			if (_status.clickingidentity[0] == this.parentNode) {
				delete _status.clickingidentity;
				return;
			}
		}
		let list = game.getIdentityList(this.parentNode);
		if (!list) {
			return;
		}
		if (lib.config.mark_identity_style == "click") {
			const list2: string[] = [];
			for (const i in list) {
				list2.push(i);
			}
			list2.push(list2[0]);
			for (let i = 0; i < list2.length; i++) {
				if (this.firstChild.innerHTML == list[list2[i]]) {
					this.firstChild.innerHTML = list[list2[i + 1]];
					this.dataset.color = list2[i + 1];
					break;
				}
			}
		} else {
			if (get.mode() == "guozhan") {
				list = { wei: "魏", shu: "蜀", wu: "吴", qun: "群", jin: "晋", ye: "野" };
				if ("forceKey" in _status && _status.forceKey) {
					list.key = "键";
				}
				for (const i in list) {
					if (_status.bannedGroup?.slice(6) == i) {
						delete list[i];
					}
				}
			}
			const identityList = list;
			const list2 = get.copy(list);
			if (game.getIdentityList2) {
				game.getIdentityList2(list2);
			}
			const rect = this.parentNode.getBoundingClientRect();
			this._customintro = function (uiintro) {
				if (get.mode() == "guozhan") {
					uiintro.clickintro = true;
				} else {
					uiintro.touchclose = true;
				}
				uiintro.classList.add("woodbg");
				uiintro.style.width = get.is.phoneLayout() ? "100px" : "85px";
				const source = this.parentNode;
				for (const i in identityList) {
					const target = this;
					const node: IdentityCircleNode = Object.assign(ui.create.div(), {
						_source: source,
						link: [target, identityList[i], i] as [IdentityTarget, string, string],
					});
					node.classList.add("guessidentity");
					node.classList.add("pointerdiv");
					ui.create.div(".menubutton.large", list2[i], node);
					if (!get.is.phoneLayout()) {
						const firstChild = node.firstElementChild;
						if (firstChild instanceof HTMLElement) {
							firstChild.style.fontSize = "24px";
							firstChild.style.lineHeight = "24px";
						}
					}
					if (get.mode() == "guozhan") {
						if (source._guozhanguess && !source._guozhanguess.includes(i)) {
							node.classList.add("transparent");
						}
						node.listen(ui.click.identitycircle.bind(node));
					} else {
						node.listen(function (this: IdentityCircleNode) {
							const info = this.link;
							info[0].firstChild.innerHTML = info[1];
							info[0].dataset.color = info[2];
							_status.clicked = false;
						}.bind(node));
					}
					uiintro.add(node);
				}
			};
			ui.click.touchpop();
			ui.click.intro.call(this, {
				clientX: rect.left + rect.width,
				clientY: rect.top,
			});
		}
	},
	identity2(this: HTMLElement) {
		if (_status.clickingidentity) {
			_status.clicked = true;
			const player = _status.clickingidentity[0];
			const nodes = _status.clickingidentity[1];
			player.node.identity.dataset.color = this.dataset.color;
			const firstChild = player.node.identity.firstElementChild;
			const selectedChild = this.firstElementChild;
			if (!(firstChild instanceof HTMLElement) || !(selectedChild instanceof HTMLElement)) {
				return;
			}
			firstChild.innerHTML = selectedChild.innerHTML;
			for (let i = 0; i < nodes.length; i++) {
				nodes[i].delete();
				nodes[i].style.transform = "";
			}
			delete _status.clickingidentity;
		}
	},
	roundmenu() {
		game.closeConnectMenu();
		switch (lib.config.round_menu_func) {
			case "system":
				game.closePopped();
				ui.system1.classList.add("shown");
				ui.system2.classList.add("shown");
				game.closeMenu();
				ui.click.shortcut();
				break;
			case "menu":
				if (ui.click.configMenu) {
					game.closePopped();
					game.pause2();
					ui.click.configMenu();
					ui.system1.classList.remove("shown");
					ui.system2.classList.remove("shown");
				}
				break;
			case "pause":
				ui.click.pause();
				break;
			case "auto":
				ui.click.auto();
				break;
		}
		_status.clicked = true;
	},
	pausehistory() {
		if (!lib.config.auto_popped_history || !ui.sidebar.childNodes.length) {
			return;
		}
		const uiintro = ui.create.dialog("hidden");
		uiintro.style.maxHeight = "400px";
		uiintro.add(ui.sidebar);
		return uiintro;
	},
	pauseconfig() {
		if (!lib.config.auto_popped_config || get.is.phoneLayout()) {
			return;
		}
		const uiintro = ui.create.dialog("hidden");
		uiintro.listen(function (e) {
			e.stopPropagation();
		});
		const rows = Math.floor(lib.config.all.mode.length / 3);
		uiintro.type = "config";
		const modes = lib.config.modeorder || lib.config.all.mode.slice(0);
		for (let i = 0; i < modes.length; i++) {
			if (!lib.config.all.mode.includes(modes[i])) {
				modes.splice(i--, 1);
			}
		}
		for (let k = 0; k < rows; k++) {
			const node = ui.create.div(".newgame.pointernode");
			for (let i = 0; i < 3 && i + k * 3 < modes.length; i++) {
				const thismode = modes[i + k * 3];
				const div = Object.assign(ui.create.div(thismode == (_status.sourcemode || lib.config.mode) ? ".underlinenode.on" : ".underlinenode", node), { link: thismode });
				div.innerHTML = String(lib.translate[thismode]);
				div.addEventListener(lib.config.touchscreen ? "touchend" : "click", function (this: HTMLDivElement & { link: string }) {
					game.saveConfig("mode", this.link);
					localStorage.setItem(lib.configprefix + "directstart", "true");
					game.reload();
				});
			}
			uiintro.add(node);
		}
		return uiintro;
	},
	cardPileButton() {
		const uiintro = ui.create.dialog("hidden");
		uiintro.listen(function (e) {
			e.stopPropagation();
		});
		const num = game.online ? _status.cardPileNum || 0 : ui.cardPile.childNodes.length;
		uiintro.add('剩余 <span style="font-family:xinwei">' + num);
		if (_status.connectMode) {
			return uiintro;
		}
		uiintro.add('<div class="text center">轮数 <span style="font-family:xinwei">' + game.roundNumber + '</span>&nbsp;&nbsp;&nbsp;&nbsp;洗牌 <span style="font-family:xinwei">' + game.shuffleNumber + "</div>");
		uiintro.add('<div class="text center">弃牌堆</div>');
		if (ui.discardPile.childNodes.length) {
			const list: ChildNode[] = [];
			for (let i = 0; i < ui.discardPile.childNodes.length; i++) {
				list.unshift(ui.discardPile.childNodes[i]);
			}
			uiintro.addSmall([list, "card"]);
		} else {
			uiintro.add('<div class="text center" style="padding-bottom:3px">无</div>');
		}
		return uiintro;
	},
	commonCardPileButton() {
		return renderCommonCardPileDialog(lib, _status, ui, get);
	},
	dierevive() {
		if (game.getMe().isDead()) {
			game.getMe().revive(Math.max(1, Number(game.getMe().maxHp)));
			game.getMe().draw(2);
		} else if (ui.revive) {
			ui.revive.close();
			delete ui.revive;
		}
	},
	dieswap() {
		if (game.getMe().isDead()) {
			_status.clicked = true;
			if (ui.intro) {
				const intro = ui.intro;
				intro.close();
				if (intro.source == "dieswap") {
					delete ui.intro;
					ui.control.show();
					game.resume2();
					return;
				}
			}
			game.pause2();
			ui.control.hide();
			ui.intro = ui.create.dialog();
			ui.intro.source = "dieswap";
			const players: Player[] = [];
			for (let i = 0; i < game.players.length; i++) {
				if (game.players[i].isAlive()) {
					players.push(game.players[i]);
				}
			}
			ui.intro.add(players, true);
			const buttons = ui.intro.querySelectorAll(".button");
			for (let i = 0; i < buttons.length; i++) {
				buttons[i].addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.dieswap2);
			}
		} else if (ui.swap) {
			ui.swap.close();
			delete ui.swap;
		}
	},
	dieswap2(this: HTMLDivElement & { link: Player }) {
		if (_status.dragged) {
			return;
		}
		game.swapPlayer(this.link);
	},
	pause() {
		if (_status.paused2 || _status.pausing || _status.nopause || !ui.pause) {
			return;
		}
		if (!_status.video) {
			if (ui.pause.classList.contains("hidden") || !_status.gameStarted || lib.config.test_game) {
				return;
			}
		}
		ui.system.hide();
		game.pause2();
		const node = ui.create.pause();
		if (!node) {
			return;
		}
		node.addTempClass("start");
		ui.sidebar3.innerHTML = "";
		if (lib.config.show_discardpile) {
			for (let i = 0; i < ui.discardPile.childNodes.length; i++) {
				const div = ui.create.div(ui.sidebar3);
				div.innerHTML = get.translation(ui.discardPile.childNodes[i]);
				ui.sidebar3.insertBefore(div, ui.sidebar3.firstChild);
			}
		}
		node.appendChild(ui.sidebar);
		node.appendChild(ui.sidebar3);
		ui.historybar.classList.add("paused");
		ui.arena.classList.add("paused");
		ui.window.classList.add("touchinfohidden");
		ui.time.hide();
		if (game.onpause) {
			game.onpause();
		}
	},
	resume(this: HTMLDivElement, e: Event) {
		if (_status.pausing || _status.dragged || _status.clicked || lib.config.test_game) {
			return;
		}
		this.delete();
		ui.system.show();
		ui.time.show();
		ui.historybar.classList.remove("paused");
		ui.arena.classList.remove("paused");
		ui.window.classList.remove("touchinfohidden");
		game.resume2();
		e.stopPropagation();
		if (game.onresume) {
			game.onresume();
		}
		return false;
	},
	config() {
		if (!ui.click.configMenu) {
			return;
		}
		_status.config2 = !_status.paused2;
		_status.clicked = true;
		game.pause2();
		ui.click.configMenu();
		ui.system1.classList.remove("shown");
		ui.system2.classList.remove("shown");
	},
	swap(this: Player) {
		if (_status.dragged || this.classList.contains("dead") || _status.over) {
			return;
		}
		if (ui.auto && !_status.llmSelfControlledAtGameStart) {
			ui.auto.show();
		}
		if (ui.wuxie && !_status.llmSelfControlledAtGameStart) {
			ui.wuxie.show();
		}
		game.swapPlayer(this);
	},
};
