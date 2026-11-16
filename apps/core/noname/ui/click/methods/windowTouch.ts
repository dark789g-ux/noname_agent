import { lib, game, get, _status, ui } from "noname";
import type { DraggableDialog } from "../contracts/domTargetsContract.js";

function performSwipeAction(action: string): void {
	game.closeConnectMenu();
	switch (action) {
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
		case "chat":
			game.closeMenu();
			if (ui.chatButton) {
				ui.click.hoverpopped.call(ui.chatButton as any);
			}
			break;
	}
}

export const windowTouchMethods = {
	dragtouchdialog(this: DraggableDialog, e: TouchEvent) {
		if (e.touches.length > 1 && !this.classList.contains("popped") && !this.classList.contains("fixed")) {
			_status.draggingtouchdialog = this;
			this._dragorigin = {
				clientX: e.touches[0].clientX,
				clientY: e.touches[0].clientY,
			};
			if (!this._dragtransform) {
				this._dragtransform = [0, 0];
			}
			this._dragorigintransform = this._dragtransform.slice(0);
			e.preventDefault();
			e.stopPropagation();
		}
	},
	windowtouchstart(e: TouchEvent) {
		if (window.inSplash) {
			return;
		}
		if (e.touches[0] && lib.config.swipe && e.touches.length < 2) {
			_status._swipeorigin = {
				clientX: e.touches[0].clientX,
				clientY: e.touches[0].clientY,
				time: get.utc(),
			};
		}
	},
	windowtouchmove(e: TouchEvent) {
		e.preventDefault();
		if (window.inSplash) {
			return;
		}
		if (_status.draggingroundmenu) {
			delete _status._swipeorigin;
			if (ui.roundmenu._dragorigin && ui.roundmenu._dragtransform && e.touches.length) {
				const translate = ui.roundmenu._dragtransform.slice(0);
				const dx = e.touches[0].clientX / game.documentZoom - ui.roundmenu._dragorigin.clientX / game.documentZoom;
				const dy = e.touches[0].clientY / game.documentZoom - ui.roundmenu._dragorigin.clientY / game.documentZoom;
				translate[0] += dx;
				translate[1] += dy;
				if (dx * dx + dy * dy > 100 && ui.roundmenu._resetTimeout) {
					clearTimeout(ui.roundmenu._resetTimeout);
					delete ui.roundmenu._resetTimeout;
				}
				ui.roundmenu._dragtouches = e.touches[0];
				ui.click.checkroundtranslate(translate);
			}
			_status.clicked = true;
		} else if (_status.draggingtouchdialog) {
			delete _status._swipeorigin;
			if (_status.draggingtouchdialog._dragorigin && _status.draggingtouchdialog._dragtransform && e.touches.length) {
				const translate = _status.draggingtouchdialog._dragtransform.slice(0);
				const dx = e.touches[0].clientX / game.documentZoom - _status.draggingtouchdialog._dragorigin.clientX / game.documentZoom;
				const dy = e.touches[0].clientY / game.documentZoom - _status.draggingtouchdialog._dragorigin.clientY / game.documentZoom;
				translate[0] += dx;
				translate[1] += dy;
				_status.draggingtouchdialog._dragtouches = e.touches[0];
				ui.click.checkdialogtranslate(translate, _status.draggingtouchdialog);
			}
			_status.clicked = true;
		} else if (_status._swipeorigin && e.touches[0]) {
			_status._swipeorigin.touches = e.touches[0];
		}

		if (_status.mousedragging && e.touches.length) {
			e.preventDefault();
			let item: Element | null = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
			if (game.chess && ui.selected.cards.length) {
				const itemtype = get.itemtype(item);
				if (itemtype != "card" && itemtype != "button") {
					const ex = e.touches[0].clientX / game.documentZoom - ui.arena.offsetLeft;
					const ey = e.touches[0].clientY / game.documentZoom - ui.arena.offsetTop;
					for (let i = 0; i < game.players.length; i++) {
						const left = -ui.chessContainer.chessLeft + ui.chess.offsetLeft + game.players[i].getLeft();
						const top = -ui.chessContainer.chessTop + ui.chess.offsetTop + game.players[i].getTop();
						const width = game.players[i].offsetWidth;
						const height = game.players[i].offsetHeight;
						if (ex > left && ex < left + width && ey > top && ey < top + height) {
							item = game.players[i];
							break;
						}
					}
				}
			}
			while (item) {
				if (!(item instanceof HTMLElement)) {
					item = item.parentElement;
					continue;
				}
				if (lib.config.enable_touchdragline && _status.mouseleft && !game.chess) {
					ui.canvas.width = ui.arena.offsetWidth;
					ui.canvas.height = ui.arena.offsetHeight;
					const ctx = ui.canvas.getContext("2d");
					if (ctx) {
						ctx.shadowBlur = 5;
						ctx.shadowColor = "rgba(0,0,0,0.3)";
						ctx.strokeStyle = "white";
						ctx.lineWidth = 3;
						ctx.setLineDash([8, 2]);

						ctx.beginPath();
						ctx.moveTo(_status.mousedragging.clientX / game.documentZoom - ui.arena.offsetLeft, _status.mousedragging.clientY / game.documentZoom - ui.arena.offsetTop);

						if (_status.multitarget) {
							for (let i = 0; i < _status.lastdragchange.length; i++) {
								const exy = _status.lastdragchange[i]._lastdragchange!;
								ctx.lineTo(exy[0], exy[1]);
							}
						}
						if (!_status.selectionfull) {
							ctx.lineTo(e.touches[0].clientX / game.documentZoom - ui.arena.offsetLeft, e.touches[0].clientY / game.documentZoom - ui.arena.offsetTop);
						}
						ctx.stroke();
						if (!_status.multitarget) {
							for (let i = 0; i < _status.lastdragchange.length; i++) {
								ctx.moveTo(_status.mousedragging.clientX / game.documentZoom - ui.arena.offsetLeft, _status.mousedragging.clientY / game.documentZoom - ui.arena.offsetTop);
								const exy = _status.lastdragchange[i]._lastdragchange!;
								ctx.lineTo(exy[0], exy[1]);
								ctx.stroke();
							}
						}
					}
				}

				if (item == _status.mousedragorigin) {
					if (_status.mouseleft) {
						_status.mousedragging = null;
						_status.mousedragorigin = null;
						_status.clicked = false;
						game.uncheck();
						game.check();
						_status.clicked = true;
					}
					return;
				}
				const itemtype = get.itemtype(item);
				if (itemtype == "card" || itemtype == "button" || itemtype == "player") {
					_status.mouseleft = true;
					if (ui.selected.cards.length) {
						ui.selected.cards[0].updateTransform(true, 100);
					}
					let ex = e.touches[0].clientX / game.documentZoom - ui.arena.offsetLeft;
					let ey = e.touches[0].clientY / game.documentZoom - ui.arena.offsetTop;
					const exx = ex;
					const eyy = ey;
					if (game.chess) {
						ex -= -ui.chessContainer.chessLeft + ui.chess.offsetLeft;
						ey -= -ui.chessContainer.chessTop + ui.chess.offsetTop;
					}
					if (itemtype != "player" || game.chess || (ex > item.offsetLeft && ex < item.offsetLeft + item.offsetWidth && ey > item.offsetTop && ey < item.offsetTop + item.offsetHeight)) {
						let targetfixed = false;
						if (itemtype == "player" && get.select(_status.event.selectTarget)[1] <= -1) {
							targetfixed = true;
						}
						if (!targetfixed && item.classList.contains("selectable") && _status.dragstatuschanged != item) {
							_status.mouseleft = true;
							_status.dragstatuschanged = item;
							_status.clicked = false;
							_status.dragged = false;
							const notbefore = itemtype == "player" && !item.classList.contains("selected");
							if (itemtype == "card" && item instanceof lib.element.Card) {
								ui.click.card.call(item);
							} else if (itemtype == "button" && item instanceof HTMLDivElement) {
								ui.click.button.call(item);
							} else if (itemtype == "player" && item instanceof lib.element.Player) {
								ui.click.target.call(item);
							}
							if (item.classList.contains("selected")) {
								if (notbefore) {
									_status.lastdragchange.push(item);
									const dragItem = item as HTMLElement & { _lastdragchange?: [number, number] };
									dragItem._lastdragchange = [exx, eyy];
									if ("falseitem" in lib && lib.falseitem) {
										const from = [_status.mousedragging.clientX / game.documentZoom - ui.arena.offsetLeft, _status.mousedragging.clientY / game.documentZoom - ui.arena.offsetTop];
										const to = [exx, eyy];
										const node = ui.create.div(".linexy.hidden");
										node.style.left = from[0] + "px";
										node.style.top = from[1] + "px";
										node.style.transitionDuration = "0.3s";
										node.style.backgroundColor = "white";
										const dy = to[1] - from[1];
										const dx = to[0] - from[0];
										let deg = (Math.atan(Math.abs(dy) / Math.abs(dx)) / Math.PI) * 180;
										if (dx >= 0) {
											deg = dy <= 0 ? deg + 90 : 90 - deg;
										} else {
											deg = dy <= 0 ? 270 - deg : deg + 270;
										}
										node.style.transform = "rotate(" + -deg + "deg) scaleY(0)";
										node.style.height = get.xyDistance(from, to) + "px";
										if (game.chess) {
											ui.chess.appendChild(node);
										} else {
											ui.arena.appendChild(node);
										}
										ui.refresh(node);
										node.show();
										node.style.transform = "rotate(" + -deg + "deg) scaleY(1)";
										ui.touchlines.push(node);
										const touchLine = node as HTMLDivElement & { _origin?: HTMLElement };
										touchLine._origin = item;
									}
								}
							} else {
								_status.lastdragchange.remove(item);
								for (let i = 0; i < ui.touchlines.length; i++) {
									const lineNode = ui.touchlines[i] as HTMLDivElement & { _origin?: HTMLElement };
									if (lineNode._origin == item) {
										lineNode.delete();
										ui.touchlines.splice(i--, 1);
									}
								}
							}
							_status.selectionfull = true;
							if (_status.event.filterButton && ui.selected.buttons.length < get.select(_status.event.selectButton)[1]) {
								_status.selectionfull = false;
							} else if (_status.event.filterCard && ui.selected.cards.length < get.select(_status.event.selectCard)[1]) {
								_status.selectionfull = false;
							} else if (_status.event.filterTarget && ui.selected.targets.length < get.select(_status.event.selectTarget)[1]) {
								_status.selectionfull = false;
							}
						}
					}
					return;
				}
				item = item.parentElement;
			}
			_status.mouseleft = true;
			_status.dragstatuschanged = null;
		}
	},
	windowtouchend(e: TouchEvent) {
		delete _status.force;
		if (window.inSplash) {
			return;
		}
		if (e.touches.length == 1 && !_status.dragged && !_status.draggingtouchdialog) {
			ui.click.pause();
		}
		if (_status.draggingroundmenu) {
			delete _status._swipeorigin;
			if (ui.roundmenu._resetTimeout) {
				clearTimeout(ui.roundmenu._resetTimeout);
				delete ui.roundmenu._resetTimeout;
			}
			let translate: number[] | undefined;
			if (ui.roundmenu._dragorigin && ui.roundmenu._dragtransform && ui.roundmenu._dragtouches) {
				const dx = ui.roundmenu._dragtouches.clientX / game.documentZoom - ui.roundmenu._dragorigin.clientX / game.documentZoom;
				const dy = ui.roundmenu._dragtouches.clientY / game.documentZoom - ui.roundmenu._dragorigin.clientY / game.documentZoom;
				if (dx * dx + dy * dy < 1000) {
					ui.click.roundmenu();
					ui.roundmenu._dragtransform = ui.roundmenu._dragorigintransform;
					translate = ui.roundmenu._dragtransform;
					if (translate) {
						ui.roundmenu.style.transform = "translate(" + translate[0] + "px," + translate[1] + "px)";
					}
				} else {
					translate = ui.roundmenu._dragtransform;
					translate[0] += dx;
					translate[1] += dy;
					ui.click.checkroundtranslate();
				}
				delete ui.roundmenu._dragorigin;
			} else {
				ui.click.roundmenu();
			}
			_status.clicked = false;
			game.saveConfig("roundmenu_transform", translate);
			delete _status.draggingroundmenu;
		} else if (_status.draggingtouchdialog) {
			delete _status._swipeorigin;
			let translate: number[] | undefined;
			if (_status.draggingtouchdialog._dragorigin && _status.draggingtouchdialog._dragtransform && _status.draggingtouchdialog._dragtouches) {
				const dx = _status.draggingtouchdialog._dragtouches.clientX / game.documentZoom - _status.draggingtouchdialog._dragorigin.clientX / game.documentZoom;
				const dy = _status.draggingtouchdialog._dragtouches.clientY / game.documentZoom - _status.draggingtouchdialog._dragorigin.clientY / game.documentZoom;
				translate = _status.draggingtouchdialog._dragtransform;
				translate[0] += dx;
				translate[1] += dy;
				ui.click.checkdialogtranslate(null, _status.draggingtouchdialog);
				delete _status.draggingtouchdialog._dragorigin;
			}
			_status.clicked = false;
			game.saveConfig("dialog_transform", translate);
			delete _status.draggingtouchdialog;
			_status.justdragged = true;
			setTimeout(function () {
				_status.justdragged = false;
			}, 500);
		} else if (_status._swipeorigin && !_status.paused2 && !_status.mousedragging && _status._swipeorigin.touches && !_status.filterCharacter) {
			if (get.utc() - _status._swipeorigin.time < 500) {
				const dx = _status._swipeorigin.touches.clientX / game.documentZoom - _status._swipeorigin.clientX / game.documentZoom;
				const dy = _status._swipeorigin.touches.clientY / game.documentZoom - _status._swipeorigin.clientY / game.documentZoom;
				if (Math.abs(dx) < 100) {
					if (dy < -200) {
						performSwipeAction(lib.config.swipe_up);
					} else if (dy > 200) {
						performSwipeAction(lib.config.swipe_down);
					}
				} else if (Math.abs(dy) < 100) {
					if (dx < -200) {
						performSwipeAction(lib.config.swipe_left);
					} else if (dx > 200) {
						performSwipeAction(lib.config.swipe_right);
					}
				}
			}
		}
		let tmpflag: boolean | HTMLDivElement = false;
		_status.mousedown = false;
		_status.clicked = false;
		if (_status.mousedragging && _status.mouseleft) {
			if (game.check()) {
				if (ui.confirm) {
					ui.confirm.close();
				}
				const event = _status.event;
				if (!event.filterOk || event.filterOk()) {
					ui.click.ok();
				}
				ui.canvas.width = ui.arena.offsetWidth;
				ui.canvas.height = ui.arena.offsetHeight;
			} else {
				game.uncheck();
				game.check();
			}
		} else if (_status.mousedragging && _status.mousedragorigin) {
			tmpflag = _status.mousedragorigin;
		}
		_status.lastdragchange.length = 0;
		_status.mousedragging = null;
		_status.mouseleft = false;
		_status.mousedragorigin = null;
		_status.dragstatuschanged = false;
		while (ui.touchlines.length) {
			ui.touchlines.shift()?.delete();
		}
		if (tmpflag) {
			game.check();
		}
		_status.dragged = false;
		_status.clicked = false;
	},
	checkroundtranslate(translate?: number[] | null) {
		const currentTranslate = translate ?? ui.roundmenu._dragtransform;
		if (!currentTranslate) {
			return;
		}
		if (currentTranslate[1] + ui.roundmenu._position[1] + 50 + ui.arena.offsetTop > ui.window.offsetHeight) {
			currentTranslate[1] = ui.window.offsetHeight - (ui.roundmenu._position[1] + 50) - ui.arena.offsetTop;
		} else if (currentTranslate[1] + ui.roundmenu._position[1] + ui.arena.offsetTop < 0) {
			currentTranslate[1] = -ui.roundmenu._position[1] - ui.arena.offsetTop;
		}
		if (currentTranslate[0] + ui.roundmenu._position[0] + 50 + ui.arena.offsetLeft > ui.window.offsetWidth) {
			currentTranslate[0] = ui.window.offsetWidth - (ui.roundmenu._position[0] + 50) - ui.arena.offsetLeft;
		} else if (currentTranslate[0] + ui.roundmenu._position[0] + ui.arena.offsetLeft < 0) {
			currentTranslate[0] = -ui.roundmenu._position[0] - ui.arena.offsetLeft;
		}
		ui.roundmenu.style.transform = "translate(" + currentTranslate[0] + "px," + currentTranslate[1] + "px)";
	},
	checkdialogtranslate(translate: number[] | null | undefined, dialog: DraggableDialog | (HTMLDivElement & { _dragtransform?: number[] })) {
		const resolved = translate || dialog._dragtransform;
		if (!resolved) {
			return;
		}
		if (Math.sqrt(resolved[0] * resolved[0] + resolved[1] * resolved[1]) < 10) {
			resolved[0] = 0;
			resolved[1] = 0;
		}
		dialog.style.transform = "translate(" + resolved[0] + "px," + resolved[1] + "px)";
	},
};
