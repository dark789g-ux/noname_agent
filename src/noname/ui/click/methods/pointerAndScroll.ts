import { lib, game, get, _status, ui } from "noname";
import {
	isTouchScrollTarget,
	type DraggablePlayer,
	type HoverTarget,
	type InteractiveCard,
	type LongPressTarget,
	type ScrollableDiv,
} from "../contracts/domTargetsContract.js";

export const pointerAndScrollMethods = {
	touchconfirm() {
		_status.touchconfirmed = true;
		document.removeEventListener("touchstart", ui.click.touchconfirm);
	},
	cardtouchstart(this: InteractiveCard, e: TouchEvent) {
		if (e.touches.length != 1 || !lib.config.enable_drag) {
			return;
		}
		if (!this.parentNode?.parentNode || this.parentNode.parentNode.parentNode != ui.me) {
			return;
		}
		if (this.parentNode.parentNode.classList.contains("scrollh")) {
			return;
		}
		if (this.classList.contains("selectable") && !this.classList.contains("selected") && !this.classList.contains("noclick")) {
			this._waitingfordrag = {
				clientX: e.touches[0].clientX,
				clientY: e.touches[0].clientY,
			};
		}
	},
	cardtouchmove(this: InteractiveCard, _e: TouchEvent) {
		ui.click.longpresscancel.call(this);
		if (this._waitingfordrag) {
			const drag = this._waitingfordrag;
			_status.clicked = false;
			_status.touchnocheck = true;
			ui.click.card.call(this);
			_status.touchnocheck = false;
			if (this.classList.contains("selected")) {
				_status.mousedragging = drag;
				_status.mousedragorigin = this;
				_status.mouseleft = false;
				_status.selectionfull = false;
				_status.multitarget = false;
			}
			delete this._waitingfordrag;
		}
	},
	cardmouseenter(this: InteractiveCard) {
		if (!lib.config.spread_card) return;
		if (this.parentNode?.parentNode?.parentNode !== ui.me) return;
		if (ui.selected.cards.length) return;
		ui._handcardHover = this;
		ui.updatehl();
	},
	cardmouseleave(this: InteractiveCard) {
		if (ui._handcardHover === this) {
			ui._handcardHover = null;
			if (!ui.selected.cards.length) {
				ui.updatehl();
			}
		}
	},
	playertouchstart(this: DraggablePlayer, e: TouchEvent) {
		if (e.touches.length != 1 || !lib.config.enable_drag) {
			return;
		}
		if (this.classList.contains("selectable") && !this.classList.contains("selected") && !this.classList.contains("noclick")) {
			this._waitingfordrag = {
				clientX: e.touches[0].clientX,
				clientY: e.touches[0].clientY,
			};
		}
	},
	playertouchmove(this: DraggablePlayer, _e: TouchEvent) {
		ui.click.longpresscancel.call(this);
		if (this._waitingfordrag) {
			const drag = this._waitingfordrag;
			_status.clicked = false;
			_status.touchnocheck = true;
			ui.click.target.call(this);
			_status.touchnocheck = false;
			if (this.classList.contains("selected")) {
				_status.mousedragging = drag;
				_status.mousedragorigin = this;
				_status.mouseleft = false;
				_status.selectionfull = false;
				_status.multitarget = false;
			}
			delete this._waitingfordrag;
		}
	},
	mousemove(this: HoverTarget) {
		if (!lib.config.hover_handcard && this.parentNode && this.parentNode.parentNode == ui.me) {
			return;
		}
		if (!_status.currentmouseenter) {
			_status.currentmouseenter = this;
		}
	},
	mouseenter(this: HoverTarget) {
		if (!lib.config.hover_handcard && this.parentNode && this.parentNode.parentNode == ui.me) {
			return;
		}
		_status.currentmouseenter = this;
	},
	mouseleave(this: HoverTarget) {
		ui.click.mouseentercancel();
		if (_status.currentmouseenter == this) {
			_status.currentmouseenter = null;
		}
		this._mouseentercreated = false;
	},
	mousedown(this: HoverTarget) {
		ui.click.mouseentercancel();
		if (_status.currentmouseenter == this) {
			_status.currentmouseenter = null;
		}
		this._mouseentercreated = true;
	},
	mouseentercancel() {
		if (_status._mouseentertimeout) {
			clearTimeout(_status._mouseentertimeout);
			delete _status._mouseentertimeout;
		}
	},
	hoverplayer(this: HTMLDivElement, _e: MouseEvent) {
		const node = get.nodeintro(this, true);
		if (node) {
			node.style.zIndex = "21";
		}
		return node;
	},
	longpressdown(this: LongPressTarget, e: TouchEvent) {
		if (_status.longpressed) {
			return;
		}
		if (this._longpresstimeout) {
			clearTimeout(this._longpresstimeout);
		}
		if (lib.config.longpress_info) {
			this._longpresstimeout = setTimeout(ui.click.longpresscallback, 500);
		}
		this._longpressevent = e;
		if (_status.longpressing && _status.longpressing != this) {
			ui.click.longpresscancel.call(_status.longpressing);
		}
		_status.longpressing = this;
	},
	longpresscallback() {
		if (!_status.longpressing) {
			return;
		}
		const node = _status.longpressing as LongPressTarget;
		const func = node._longpresscallback;
		const e = node._longpressevent;
		if (!func || !e) {
			return;
		}
		clearTimeout(node._longpresstimeout);
		_status.force = true;
		delete _status.longpressing;
		delete node._longpresstimeout;
		delete node._longpressevent;
		if (_status.mousedragging && _status.mouseleft) {
			return;
		}
		if (!_status.longpressed) {
			_status.longpressed = true;
			setTimeout(function () {
				_status.longpressed = false;
			}, 500);
			func.call(node, e);
			if (lib.config.touchscreen && lib.config.enable_drag && !node._waitingfordrag) {
				_status.mousedragging = null;
				_status.mousedragorigin = null;
				_status.clicked = false;
				game.uncheck();
				game.check();
				_status.clicked = true;
			}
			delete node._waitingfordrag;
			ui.click.touchpop();
		}
	},
	longpresscancel(this: LongPressTarget) {
		if (this._longpresstimeout) {
			clearTimeout(this._longpresstimeout);
			delete this._longpresstimeout;
		}
		delete this._longpressevent;
		if (_status.longpressing == this) {
			delete _status.longpressing;
		}
	},
	mousewheel(this: ScrollableDiv, evt: WheelEvent & { readonly wheelDelta: number }) {
		if (this.firstElementChild && this.firstElementChild.classList.contains("handcards") && !this.classList.contains("scrollh")) {
			return;
		}
		const node = this;
		let num = this._scrollnum || 6;
		const speed = this._scrollspeed || 16;
		clearInterval(node.interval);
		if (evt.detail > 0 || evt.wheelDelta < 0) {
			node.interval = setInterval(function () {
				if (num-- && Math.abs(node.scrollLeft + node.clientWidth - node.scrollWidth) > 0) {
					node.scrollLeft += speed;
				} else {
					clearInterval(node.interval);
				}
			}, 16);
		} else {
			node.interval = setInterval(function () {
				if (num-- && node.scrollLeft > 0) {
					node.scrollLeft -= speed;
				} else {
					clearInterval(node.interval);
				}
			}, 16);
		}
	},
	touchStart(this: HTMLDivElement, e: TouchEvent) {
		Object.assign(this, {
			startX: e.touches[0].clientX / game.documentZoom,
			startY: e.touches[0].clientY / game.documentZoom,
		});
		_status.dragged = false;
	},
	dialogtouchStart(this: HTMLDivElement, e: TouchEvent) {
		ui.click.touchStart.call(this, e);
		_status.dialogtouched = true;
	},
	touchScroll(this: HTMLDivElement, e: TouchEvent) {
		if (!isTouchScrollTarget(this) || _status.mousedragging || _status.draggingtouchdialog) {
			return;
		}
		if (!_status.dragged) {
			if (Math.abs(e.touches[0].clientX / game.documentZoom - this.startX) > 10 || Math.abs(e.touches[0].clientY / game.documentZoom - this.startY) > 10) {
				_status.dragged = true;
			}
		}
		if ((this == ui.handcards1Container || this == ui.handcards2Container) && !this.classList.contains("scrollh")) {
			e.preventDefault();
		} else if (lib.device == "ios" && this.scrollHeight <= this.offsetHeight + 5 && this.scrollWidth <= this.offsetWidth + 5) {
			e.preventDefault();
		} else {
			delete _status._swipeorigin;
			e.stopPropagation();
		}
	},
};
