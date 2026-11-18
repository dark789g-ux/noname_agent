import { game, lib, _status, ui } from "noname";
import { getRegisteredSkill, get } from "../../dependencies.js";

export const uiSkillintroMethods = {
	skillintro(name, learn, learn2) {
		let str = "";
		let skills = get.character(name, 3);
		let opacity;
		for (let i = 0; i < skills.length; i++) {
			const info = getRegisteredSkill(lib.skill, skills[i]);
			if (lib.translate[skills[i]] && lib.translate[skills[i] + "_info"] && info) {
				if (learn && info.unique && (learn2 || !info.gainable)) {
					opacity = "opacity:0.5";
				} else {
					opacity = "";
				}
				let skilltrans = get.translation(skills[i]).slice(0, 2);
				str += '<div class="skill" style="' + opacity + '">【' + skilltrans + '】</div><div style="' + opacity + '">' + get.skillInfoTranslation(skills[i], null, false) + '</div><div style="display:block;height:10px"></div>';
			}
		}
		return str;
	},

	intro(name) {
		let info = lib.character[name];
		let str = "性别：" + get.translation(info[0]) + "<br/>";
		str += "势力：" + get.translation(info[1]) + "<br/>";
		str += "体力：" + get.translation(info[2]) + "<br/>";
		str += "技能：";
		if (info[3].length) {
			str += get.translation(info[3][0]);
			for (let i = 1; i < info[3].length; i++) {
				str += "、" + get.translation(info[3][i]);
			}
		}
		return str;
	},

	storageintro(type, content, player, dialog, skill) {
		switch (type) {
			case "mark": {
				if (content > 0) {
					return "共有" + content + "个标记";
				}
				return false;
			}
			case "turn": {
				if (content > 0) {
					return "剩余" + content + "个回合";
				}
				return false;
			}
			case "time": {
				if (content > 0) {
					return "剩余" + content + "次";
				}
				return false;
			}
			case "limited": {
				if (content) {
					return "已发动";
				}
				return "未发动";
			}
			case "qidingSkill": {
				if (content) {
					return "此事已成";
				}
				return "契约未定";
			}
			case "info": {
				return lib.translate[skill + "_info"];
			}
			case "cardCount": {
				if (Array.isArray(content)) {
					return "共有" + get.cnNumber(content.length) + "张牌";
				}
				return false;
			}
			case "expansion": {
				content = player.getCards("x", function (card) {
					return card.hasGaintag(skill);
				});
				if (dialog && content.length) {
					dialog.addAuto(content);
				} else {
					return "没有卡牌";
				}
				return false;
			}
			case "card":
			case "cards": {
				if (get.itemtype(content) == "card") {
					content = [content];
				}
				if (dialog && get.itemtype(content) == "cards") {
					dialog.addAuto(content);
				} else {
					if (content && content.length) {
						return get.translation(content);
					}
				}
				if (Array.isArray(content) && !content.length) {
					return "没有卡牌";
				}
				return false;
			}
			case "player":
			case "players": {
				if (get.itemtype(content) == "player") {
					content = [content];
				}
				if (dialog && get.itemtype(content) == "players") {
					dialog.addAuto(content);
					return false;
				} else {
					if (content && content.length) {
						return get.translation(content);
					}
					return false;
				}
			}
			case "character":
			case "characters": {
				if (typeof content == "string") {
					content = [content];
				}
				if (dialog && Array.isArray(content)) {
					dialog.addAuto([content, "character"]);
					return false;
				} else {
					if (content && content.length) {
						return get.translation(content);
					}
					return false;
				}
			}
			default: {
				if (typeof type == "string") {
					type = type.replace(/#/g, content);
					type = type.replace(/&/g, String(get.cnNumber(content)));
					type = type.replace(/\$/g, get.translation(content));
					return type;
				} else if (typeof type == "function") {
					return type(content, player, skill);
				}
				return false;
			}
		}
	},

	linkintro(dialog, content, player) {
		dialog.content.firstChild.remove();
		dialog.add('<div class="text center">已横置</div>');
		let list: any[] = [];
		for (let i = 0; i < game.players.length; i++) {
			const player = game.players[i];
			if (player.isLinked()) {
				const name = player.name;
				if (typeof name != "string") {
					throw new TypeError("Linked player must have a name");
				}
				if (!name.startsWith("unknown")) {
					list.push(player);
				}
			}
		}
		if (list.length) {
			dialog.add(list, true, true);
		}
	},

	/**
	 * 返回可以选择的目标
	 * @param {((a: Player, b: Player) => number)} [sort] 排序函数
	 * @returns { Player[] }
	 */
	selectableTargets(sort: ((a: Player, b: Player) => number) | undefined) {
		let selectable: any[] = [];
		let players = game.players.slice(0);
		if (_status.event.deadTarget || (_status.event.skill && get.info(_status.event.skill)?.deadTarget) || (get.card(undefined) && get.info(get.card(undefined))?.deadTarget)) {
			players.addArray(game.dead);
		}
		for (let i = 0; i < players.length; i++) {
			if (players[i].classList.contains("selectable") && players[i].classList.contains("selected") == false) {
				selectable.push(players[i]);
			}
		}
		selectable.randomSort();
		if (sort) {
			selectable.sort(sort);
		}
		return selectable;
	},

	noSelected() {
		return ui.selected.buttons.length + ui.selected.cards.length + ui.selected.targets.length == 0;
	},

	// /**
	//  *
	//  * 根据id获取一个特殊名词的翻译
	//  * @param {string} id 特殊名词在lib.poptipMap的id
	//  * @returns {string}
	//  */
	// poptipName(id) {
	// 	return lib.poptip.getName(id);
	// }
	// /**
	//  *
	//  * 根据id获取一个特殊名词的解释
	//  * @param {string} id 特殊名词在lib.poptipMap的id
	//  * @returns {string}
	//  */
	// poptipInfo(id) {
	// 	return lib.poptip.getInfo(id);
	// }
	/**
	 * @overload
	 * @param {string} poptip 特殊名词的id/技能id/卡牌id
	 * @returns {string}
	 */
	/**
	 * @overload
	 * @param {object} poptip
	 * @param {string} [poptip.id] 对应特殊名词id
	 * @param {string} [poptip.type] 特殊名词的类型
	 * @param {string} poptip.name 特殊名词
	 * @param {string} [poptip.info] 对应解释
	 * @param {string | ((dialog: Dialog, poptip: string) => Dialog)} [poptip.dialog] 自定义框
	 * @returns {string}
	 */
	/**
	 * 生成一个超链接格式用于查看特殊名词的解释
	 * @param {string | object} poptip
	 * @returns {string}
	 */
	poptip(poptip) {
		return lib.poptip.getElement(poptip);
	},

	/**
	 *
	 * 弹出特殊名词的解释窗口
	 * @param {string | Function} info 对应解释在lib.poptip的值
	 * @param {string} poptip 此名词的对应id
	 * @param {PointerEvent|TouchEvent} event 点击事件
	 */
	poptipIntro(info: string | Function, poptip: string, event: PointerEvent | TouchEvent) {
		const uiintro = ui.create.dialog("hidden", "notouchscroll");
		uiintro.style.zIndex = "21";
		uiintro.setAttribute("id", "poptip");
		if (typeof info == "string") {
			uiintro._place_text = uiintro.add(`<div class = "text">${info}</div>`);
		} else {
			info(uiintro, poptip);
		}
		uiintro.classList.add("popped");
		uiintro.classList.add("static");
		ui.window.appendChild(uiintro);

		if (lib.config.touchscreen) {
			lib.setScroll(uiintro.contentContainer);
		}

		lib.placePoppedDialog(uiintro, event);
		const layer = ui.create.div(".poplayer", ui.window);
		_status.poptip = [uiintro, layer];
		/** @this {HTMLDivElement} */
		const clicklayer = function (this: HTMLDivElement, e) {
			uiintro.delete();
			this.remove();
			delete _status.poptip;
			if (e?.stopPropagation) {
				e.stopPropagation();
			}
			if (uiintro._onclose) {
				uiintro._onclose();
			}
		};
		layer.addEventListener(lib.config.touchscreen ? "touchend" : "click", clicklayer);

		/** @this {Dialog} */
		const clickintro = function (this: Dialog, e) {
			layer.remove();
			this.delete();
			/*if (e?.stopPropagation) {
				e.stopPropagation();
			}*/
			if (uiintro._onclose) {
				uiintro._onclose();
			}
		};
		if (uiintro.clickintro) {
			uiintro.listen(function () {
				_status.clicked = true;
			});
			uiintro._clickintro = clicklayer;
		} else if (!lib.config.touchscreen) {
			uiintro.addEventListener("mouseleave", clickintro);
			uiintro.addEventListener("click", clickintro);
		} else if (uiintro.touchclose) {
			uiintro.listen(clickintro);
		}
		uiintro._close = clicklayer;

		const adjust = function () {
			const margin = 8; //上下最小间距
			uiintro.style.maxHeight = "none";
			uiintro.style.overflowY = "";
			if (uiintro._poptipOriginalTransform === undefined) {
				uiintro._poptipOriginalTransform = uiintro.style.transform || "";
			}
			const rect = uiintro.getBoundingClientRect();
			const top = rect.top;
			const naturalHeight = uiintro.scrollHeight;
			const winH = window.innerHeight;
			const availableBelow = winH - top - margin;
			const allowedFull = winH - margin * 2;
			if (naturalHeight <= availableBelow) {
				uiintro.style.transform = uiintro._poptipOriginalTransform || "";
				uiintro.style.maxHeight = "none";
				uiintro.style.overflowY = "";
				uiintro._poptipTranslate = 0;
				return;
			}
			const desiredTop = Math.max(margin, Math.min(top, winH - margin - naturalHeight));
			const lift = top - desiredTop;
			const baseTransform = uiintro._poptipOriginalTransform || "";
			uiintro._poptipTranslate = lift;
			uiintro.style.transform = baseTransform + ` translateY(${-lift}px)`;
			if (naturalHeight > allowedFull) {
				uiintro.style.maxHeight = allowedFull + "px";
				uiintro.style.overflowY = "auto";
			} else {
				uiintro.style.maxHeight = "none";
				uiintro.style.overflowY = "";
			}
		};
		if (uiintro._poptipAdjust) {
			window.removeEventListener("resize", uiintro._poptipAdjust);
			if (uiintro._poptipObserver) {
				uiintro._poptipObserver.disconnect();
			}
			if (uiintro._poptipRemoveObserver) {
				uiintro._poptipRemoveObserver.disconnect();
			}
		}
		uiintro._poptipAdjust = adjust;
		window.addEventListener("resize", adjust);
		const mo = new MutationObserver(adjust);
		mo.observe(uiintro, { childList: true, subtree: true, characterData: true });
		uiintro._poptipObserver = mo;
		const removeObserver = new MutationObserver((mutations: MutationRecord[]) => {
			for (const m of mutations) {
				for (const node of m.removedNodes) {
					if (node === uiintro) {
						window.removeEventListener("resize", adjust);
						mo.disconnect();
						removeObserver.disconnect();
						return;
					}
				}
			}
		});
		removeObserver.observe(document.body, { childList: true, subtree: true });
		uiintro._poptipRemoveObserver = removeObserver;
		requestAnimationFrame(adjust);
		return uiintro;
	},

	links(buttons) {
		let links: any[] = [];
		for (let i = 0; i < buttons.length; i++) {
			if (buttons[i].link != undefined) {
				links.push(buttons[i].link);
			}
		}
		return links;
	},

	menuZoom() {
		if (game.menuZoom === undefined || game.menuZoom === null) {
			return game.documentZoom;
		}
		return game.menuZoom;
	},

	/**
	 * 遍历子元素
	 * @param {...HTMLElement} elements
	 * @returns {Iterable<Element>} 迭代器
	 */
	*iterableChildNodes(...elements: HTMLElement[]) {
		for (const element of elements) {
			for (const child of element.children) {
				yield child;
			}
		}
	},
};
