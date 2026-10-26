import { _status, game, get, lib, ui } from "noname";

/**
 * @typedef {[suit: string | null | undefined, number: number | string | null | undefined, name: string, nature?: string | boolean | null, tags?: string[] | null]} CardInitTuple
 */

/**
 * @typedef {CardInitTuple & { _replaced?: boolean }} CardPileEntry
 * @export
 */

/**
 * @typedef {[suit: string | null | undefined, number: number | null | undefined, name: string, nature: string | boolean | null | undefined, cardid: string | undefined]} CardInfoTuple
 * @export
 */

/**
 * @typedef {{
 * 	name: string;
 * 	suit?: string | null;
 * 	number?: number | string | null;
 * 	nature?: string | boolean | null;
 * 	tags?: string[];
 * }} CardInitData
 */

/**
 * @typedef {{
 * 	image: HTMLDivElement;
 * 	info: HTMLDivElement;
 * 	name: HTMLDivElement;
 * 	name2: HTMLDivElement;
 * 	background: HTMLDivElement;
 * 	intro: HTMLDivElement;
 * 	range: HTMLDivElement;
 * 	gaintag: HTMLDivElement;
 * 	avatar?: HTMLDivElement;
 * 	framebg?: HTMLDivElement;
 * 	addinfo?: HTMLDivElement;
 * }} CardNodeMap
 */

export class Card extends HTMLDivElement {
	/**
	 * @param {HTMLDivElement|DocumentFragment} [position]
	 */
	// @ts-expect-error ignore
	constructor(position) {
		if (position instanceof Card) {
			const other = position;
			// @ts-expect-error ignore
			[position] = other._args;
		}
		/**
		 * @type {this}
		 */
		// @ts-expect-error ignore
		const card = ui.create.div(".card", position);
		Object.setPrototypeOf(card, (lib.element.Card || Card).prototype);
		// @ts-expect-error ignore
		card._args = [position];
		return card;
	}
	/**
	 * @param {'noclick'} [info]
	 * @param {true} [noclick]
	 */
	build(info, noclick) {
		let card = this;
		card.buildNode();
		card.buildIntro(noclick);
		card.buildProperty();
		card.buildEventListener(info);
		return this;
	}
	buildEventListener(info) {
		let card = this;
		if (info != "noclick") {
			card.addEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.card);
			if (lib.config.touchscreen) {
				card.addEventListener("touchstart", ui.click.cardtouchstart);
				card.addEventListener("touchmove", ui.click.cardtouchmove);
			} else {
				card.addEventListener("mouseenter", ui.click.cardmouseenter);
				card.addEventListener("mouseleave", ui.click.cardmouseleave);
			}
			if ("cardSelectObserver" in lib && lib.cardSelectObserver) {
				const observer = lib.cardSelectObserver;
				if ((typeof observer !== "object" || observer === null) && typeof observer !== "function") {
					throw new TypeError("The card selection observer must provide observe()");
				}
				if (!("observe" in observer) || typeof observer.observe !== "function") {
					throw new TypeError("The card selection observer must provide observe()");
				}
				observer.observe(card, {
					attributes: true,
				});
			}
		}
	}
	buildProperty() {
		let card = this;
		card.storage = {};
		card.vanishtag = [];
		card.gaintag = [];
		card._uncheck = [];
	}
	buildNode() {
		this.node = {
			image: ui.create.div(".image", this),
			info: ui.create.div(".info", this),
			name: ui.create.div(".name", this),
			name2: ui.create.div(".name2", this),
			background: ui.create.div(".background", this),
			intro: ui.create.div(".intro", this),
			range: ui.create.div(".range", this),
			gaintag: ui.create.div(".gaintag", this),
		};
		this.node.intro.innerHTML = lib.config.intro;
	}
	buildIntro(noclick) {
		if (!noclick) {
			lib.setIntro(this);
		}
	}
	/** @type {CardNodeMap} */
	// eslint-disable-next-line no-unreachable
	node;
	/**
	 * @type { string }
	 */
	name;
	/**
	 * @type { Record<string, any> }
	 */
	storage;
	/**
	 * @type { any[] }
	 */
	vanishtag;
	/**
	 * @type { string[] }
	 */
	gaintag;
	/**
	 * @type { any[] }
	 */
	_uncheck;
	/**
	 * @type { boolean }
	 */
	isCard;
	/**
	 * @type { string | null | undefined }
	 */
	original;
	/**
	 * @type { string[] }
	 * 卡牌“占用的装备栏”
	 * TODO: 补充对应的typings
	 */
	subtypes;
	//执行销毁一张牌的钩子函数
	selfDestroy(event) {
		if (this._selfDestroyed) {
			return;
		}
		this._selfDestroyed = true;
		this.fix();
		this.delete();
		const info = get.info(this, false);
		if (!info) {
			return;
		}
		if ((!("destroyLog" in this) || this.destroyLog !== false) && info.destroyLog !== false) {
			game.log(this, "被销毁了");
		}
		if (info.onDestroy) {
			info.onDestroy(this, event);
		}
	}
	//判断一张牌进入某个区域后是否会被销毁
	willBeDestroyed(targetPosition, player, event) {
		const destroyed = this.destroyed;
		if (typeof destroyed == "function") {
			return destroyed(this, targetPosition, player, event);
		} else if (lib.skill[destroyed]) {
			if (player) {
				if (player.hasSkill(destroyed)) {
					delete this.destroyed;
					return false;
				}
			}
			return true;
		} else if (typeof destroyed == "string") {
			return destroyed == targetPosition;
		}
		return destroyed;
	}
	hasNature(nature, player) {
		return game.hasNature(this, nature, player);
	}
	//只针对【杀】起效果
	/**
	 * @param {string} nature
	 */
	addNature(nature) {
		let natures = [];
		if (typeof this.nature != "string" || !this.nature) {
			this.nature = "";
		} else {
			natures.addArray(get.natureList(this.nature));
		}
		natures.addArray(get.natureList(nature));
		this.nature = get.nature(natures);
		this.classList.add(nature);
		let str = get.translation(this.nature) + "杀";
		this.node.name.innerText = str;
		let name = get.name(this, false);
		do {
			if (name == "sha") {
				let _bg;
				for (const n of natures) {
					if (lib.natureBg.has(n)) {
						_bg = n;
					}
				}
				if (_bg) {
					const natureBackground = lib.natureBg.get(_bg);
					if (typeof natureBackground == "string") {
						this.node.image.setBackgroundImage(natureBackground);
					}
					break;
				}
			}
			this.node.image.setBackgroundImage("image/card/" + name + ".png");
		} while (0);
		return this.nature;
	}
	/**
	 * @param {string} nature
	 */
	removeNature(nature) {
		if (typeof this.nature != "string" || !this.nature) {
			return;
		}
		let natures = get.natureList(this.nature);
		natures.remove(nature);
		if (!natures.length) {
			delete this.nature;
		} else {
			this.nature = get.nature(natures);
		}
		this.classList.remove(nature);
		let str = get.translation(this.nature) + "杀";
		this.node.name.innerText = str;
		let name = get.name(this, false);
		do {
			if (name == "sha") {
				let _bg;
				for (const n of natures) {
					if (lib.natureBg.has(n)) {
						_bg = n;
					}
				}
				if (_bg) {
					const natureBackground = lib.natureBg.get(_bg);
					if (typeof natureBackground == "string") {
						this.node.image.setBackgroundImage(natureBackground);
					}
					break;
				}
			}
			this.node.image.setBackgroundImage("image/card/" + name + ".png");
		} while (0);
		return this.nature;
	}
	/**
	 * @param {string | string[]} gaintag
	 */
	addGaintag(gaintag) {
		//目前无名杀支持永久标记，只要加上前缀“eternal_”（即eternal，永恒的）均视为永久标记
		//然后就是永久标记的翻译问题，前缀是eternal_可以选择只看后面的子字符串的对应翻译
		if (Array.isArray(gaintag)) {
			this.gaintag = gaintag.slice(0);
		} else {
			this.gaintag.add(gaintag);
		}
		var str = "";
		for (var gi = 0; gi < this.gaintag.length; gi++) {
			const tag = this.gaintag[gi];
			var translate = get.translation(tag);
			if (translate == tag && tag.startsWith("eternal_")) {
				translate = get.translation(tag.slice(8));
			}
			if (translate != "invisible") {
				str += translate;
				if (gi < this.gaintag.length - 1) {
					str += " ";
				}
			}
		}
		this.node.gaintag.innerHTML = str;
	}
	/**
	 * @param {string | true} tag
	 */
	removeGaintag(tag) {
		if (tag === true) {
			if ((this.gaintag && this.gaintag.length) || this.node.gaintag.innerHTML.length) {
				this.addGaintag([]);
			}
		} else if (this.hasGaintag(tag)) {
			this.gaintag.remove(tag);
			this.addGaintag(this.gaintag);
		}
	}
	/**
	 * @param {string} tag
	 * @returns {boolean}
	 */
	hasGaintag(tag) {
		return this.gaintag && this.gaintag.includes(tag);
	}
	/**
	 * @param {CardInitTuple | CardInfoTuple | CardInitData} card
	 */
	init(card) {
		/** @type {CardInitTuple | CardInfoTuple} */
		let initData;
		if (Array.isArray(card)) {
			initData = card;
			if (initData[2] == "huosha") {
				initData[2] = "sha";
				initData[3] = "fire";
			} else if (initData[2] == "leisha") {
				initData[2] = "sha";
				initData[3] = "thunder";
			} else if (initData[2] == "cisha") {
				initData[2] = "sha";
				initData[3] = "stab";
			} else if (initData[2].length > 3) {
				let prefix = initData[2].slice(0, initData[2].lastIndexOf("sha"));
				if (lib.nature.has(prefix)) {
					if (prefix.length + 3 == initData[2].length) {
						initData[2] = "sha";
						initData[3] = prefix;
					}
				}
				if (initData[2].startsWith("sha_")) {
					let suffix = initData[2].slice(4);
					let natureList = suffix.split("_");
					initData[2] = "sha";
					initData[3] = get.nature(natureList);
				}
			}
		} else {
			initData = [card.suit, card.number, card.name, card.nature];
		}
		let cardnum = initData[1] || "";
		if (typeof cardnum == "string") {
			const parsedCardNumber = parseInt(cardnum);
			if (parsedCardNumber == Number(cardnum)) {
				cardnum = parsedCardNumber;
			}
		}
		let vanish = false;
		if (!lib.card[initData[2]]) {
			vanish = true;
			lib.card[initData[2]] = {};
		}
		var info = lib.card[initData[2]];
		if (info.global && !this.classList.contains("button")) {
			if (Array.isArray(info.global)) {
				while (info.global.length) {
					game.addGlobalSkill(info.global.shift());
				}
			} else if (typeof info.global == "string") {
				game.addGlobalSkill(info.global);
			}
			delete info.global;
		}
		this.suit = initData[0];
		let number = 0;
		const rawNumber = initData[1];
		if (typeof rawNumber == "number") {
			number = parseInt(String(rawNumber)) || 0;
		} else if (typeof rawNumber == "string") {
			number = parseInt(rawNumber) || 0;
		}
		this.number = number;
		this.name = initData[2];

		if (info.destroy && typeof info.destroy != "boolean" && !lib.skill[info.destroy]) {
			this.destroyed = info.destroy;
		}

		if (_status.connectMode && !game.online && lib.cardOL && !this.cardid) {
			this.cardid = get.id();
			lib.cardOL[this.cardid] = this;
		}
		if (!_status.connectMode && !_status.video) {
			this.cardid = get.id();
		}

		this.$init(initData);

		if (this.inits) {
			for (var i = 0; i < this.inits.length; i++) {
				this.inits[i](this);
			}
		}
		if (typeof info.init == "function") {
			info.init();
		}
		if (vanish) {
			delete lib.card[initData[2]];
		}
		return this;
	}
	/**
	 * @param {CardInitTuple | CardInfoTuple} card
	 */
	$init(card) {
		var info = lib.card[card[2]];
		let cardnum = card[1] || "";
		if (typeof cardnum == "string") {
			const parsedCardNumber = parseInt(cardnum);
			if (parsedCardNumber == Number(cardnum)) {
				cardnum = parsedCardNumber;
			}
		}
		if (typeof cardnum == "number") {
			cardnum = get.strNumber(cardnum, true) || cardnum;
		}
		if (typeof cardnum != "string") {
			cardnum = "";
		}
		if (this.name) {
			this.classList.remove("epic");
			this.classList.remove("legend");
			this.classList.remove("gold");
			this.classList.remove("unique");
			this.style.background = "";
			var subtype = get.subtype(this, false);
			if (subtype) {
				this.classList.remove(subtype);
			}
		}
		if (info.epic) {
			this.classList.add("epic");
		} else if (info.legend) {
			this.classList.add("legend");
		} else if (info.gold) {
			this.classList.add("gold");
		} else if (info.unique) {
			this.classList.add("unique");
		}
		var bg = card[2];
		if (info.cardimage) {
			bg = info.cardimage;
		}
		let img = get.dynamicVariable(lib.card[bg].image, this);
		if (img) {
			if (typeof img != "string") {
				img = null;
			} else {
				if (img.startsWith("ext:")) {
					img = img.replace(/^ext:/, "extension/");
				} else if (["character:"].some(prefix => img.startsWith(prefix)) || ["background", "card"].includes(img)) {
					img = null;
				}
			}
		}
		this.classList.remove("fullskin");
		this.classList.remove("fullimage");
		this.classList.remove("fullborder");
		this.dataset.cardName = card[2];
		this.dataset.cardType = info.type || "";
		this.dataset.cardSubtype = info.subtype || "";
		this.dataset.cardMultitarget = info.multitarget ? "1" : "0";
		this.node.name.dataset.nature = "";
		this.node.info.classList.remove("red");
		if (!lib.config.hide_card_image && lib.card[bg].fullskin) {
			this.classList.add("fullskin");
			if (img) {
				if (img.startsWith("db:")) {
					this.node.image.setBackgroundDB(img.slice(3));
				} else if (typeof img == "string") {
					this.node.image.setBackgroundImage(img);
				}
				/*if (img.startsWith("ext:")) {
					this.node.image.setBackgroundImage(img.replace(/^ext:/, "extension/"));
				} else {
					this.node.image.setBackgroundDB(img);
				}*/
			} else {
				if (lib.card[bg].modeimage) {
					this.node.image.setBackgroundImage("image/mode/" + lib.card[bg].modeimage + "/card/" + bg + ".png");
				} else {
					do {
						let nature = card[3];
						if (bg == "sha" && typeof nature == "string") {
							let natures = get.natureList(nature),
								_bg;
							for (const n of natures) {
								if (lib.natureBg.has(n)) {
									_bg = n;
								}
							}
							if (_bg) {
								const natureBackground = lib.natureBg.get(_bg);
								if (typeof natureBackground == "string") {
									this.node.image.setBackgroundImage(natureBackground);
								}
								break;
							}
						}
						this.node.image.setBackgroundImage("image/card/" + bg + ".png");
					} while (0);
				}
			}
		} else if (get.dynamicVariable(lib.card[bg].image, this) == "background") {
			if (typeof card[3] == "string" && card[3]) {
				this.node.background.setBackground(bg + "_" + get.natureList(card[3])[0], "card");
			} else {
				this.node.background.setBackground(bg, "card");
			}
		} else if (lib.card[bg].fullimage) {
			this.classList.add("fullimage");
			if (img) {
				if (img.startsWith("db:")) {
					this.setBackgroundDB(img.slice(3));
				} else if (typeof img == "string") {
					this.setBackgroundImage(img);
					this.style.backgroundSize = "cover";
				}
				/*if (img.startsWith("ext:")) {
					this.setBackgroundImage(img.replace(/^ext:/, "extension/"));
					this.style.backgroundSize = "cover";
				} else {
					this.setBackgroundDB(img);
				}*/
			} else if (get.dynamicVariable(lib.card[bg].image, this)) {
				if (get.dynamicVariable(lib.card[bg].image, this).startsWith("character:")) {
					this.setBackground(get.dynamicVariable(lib.card[bg].image, this).slice(10), "character");
				} else {
					this.setBackground(get.dynamicVariable(lib.card[bg].image, this));
				}
			} else {
				var cardPack = lib.cardPack["mode_" + get.mode()];
				if (Array.isArray(cardPack) && cardPack.includes(bg)) {
					this.setBackground("mode/" + get.mode() + "/card/" + bg);
				} else {
					this.setBackground("card/" + bg);
				}
			}
		} else if (lib.card[bg].fullborder) {
			this.classList.add("fullborder");
			if (lib.card[bg].fullborder == "gold") {
				this.node.name.dataset.nature = "metalmm";
			} else if (lib.card[bg].fullborder == "silver") {
				this.node.name.dataset.nature = "watermm";
			}
			if (!this.node.avatar) {
				this.node.avatar = ui.create.div(".cardavatar");
				this.insertBefore(this.node.avatar, this.firstChild);
			}
			if (!this.node.framebg) {
				this.node.framebg = ui.create.div(".cardframebg");
				this.node.framebg.dataset.auto = lib.card[bg].fullborder;
				this.insertBefore(this.node.framebg, this.firstChild);
			}
			if (img) {
				if (img.startsWith("db:")) {
					this.node.avatar.setBackgroundDB(img.slice(3));
				} else if (typeof img == "string") {
					this.node.avatar.setBackgroundImage(img);
					this.node.avatar.style.backgroundSize = "cover";
				}
				/*if (img.startsWith("ext:")) {
					this.node.avatar.setBackgroundImage(img.replace(/^ext:/, "extension/"));
					this.node.avatar.style.backgroundSize = "cover";
				} else {
					this.node.avatar.setBackgroundDB(img);
				}*/
			} else if (get.dynamicVariable(lib.card[bg].image, this)) {
				if (get.dynamicVariable(lib.card[bg].image, this).startsWith("character:")) {
					this.node.avatar.setBackground(get.dynamicVariable(lib.card[bg].image, this).slice(10), "character");
				} else {
					this.node.avatar.setBackground(get.dynamicVariable(lib.card[bg].image, this));
				}
			} else {
				var cardPack = lib.cardPack["mode_" + get.mode()];
				if (Array.isArray(cardPack) && cardPack.includes(bg)) {
					this.node.avatar.setBackground("mode/" + get.mode() + "/card/" + bg);
				} else {
					this.node.avatar.setBackground("card/" + bg);
				}
			}
		} else if (get.dynamicVariable(lib.card[bg].image, this) == "card") {
			if (typeof card[3] == "string" && card[3]) {
				this.setBackground(bg + "_" + get.natureList(card[3])[0], "card");
			} else {
				this.setBackground(bg, "card");
			}
		} else if (typeof get.dynamicVariable(lib.card[bg].image, this) == "string" && !lib.card[bg].fullskin) {
			if (img) {
				if (img.startsWith("db:")) {
					this.setBackgroundDB(img.slice(3));
				} else if (typeof img == "string") {
					this.setBackgroundImage(img);
					this.style.backgroundSize = "cover";
				}
				/*if (img.startsWith("ext:")) {
					this.setBackgroundImage(img.replace(/^ext:/, "extension/"));
					this.style.backgroundSize = "cover";
				} else {
					this.setBackgroundDB(img);
				}*/
			} else {
				this.setBackground(get.dynamicVariable(lib.card[bg].image, this));
			}
		} else {
			this.node.background.innerHTML = lib.translate[bg + "_cbg"] || lib.translate[bg + "_bg"] || get.translation(bg)[0];
			// this.node.background.style.fontFamily=lib.config.card_font;
			if (this.node.background.innerHTML.length > 1) {
				this.node.background.classList.add("tight");
			} else {
				this.node.background.classList.remove("tight");
			}
		}
		if (!lib.card[bg].fullborder && this.node.avatar && this.node.framebg) {
			this.node.avatar.remove();
			this.node.framebg.remove();
			delete this.node.avatar;
			delete this.node.framebg;
		}
		if (info.noname) {
			this.node.name.style.display = "none";
		}
		if (info.color) {
			this.style.color = info.color;
		}
		if (info.textShadow) {
			this.style.textShadow = info.textShadow;
		}
		if (info.opacity) {
			this.node.info.style.opacity = info.opacity;
			this.node.name.style.opacity = info.opacity;
		}
		if (info.modinfo) {
			this.node.info.innerHTML = info.modinfo;
		} else {
			this.node.info.innerHTML = get.translation(card[0]) + '<span style="font-family:xinwei"> </span><span style="font-family:xinwei">' + cardnum + "</span>";
		}
		if (info.addinfo) {
			if (!this.node.addinfo) {
				this.node.addinfo = ui.create.div(".range", this);
			}
			this.node.addinfo.innerHTML = info.addinfo;
		} else if (this.node.addinfo) {
			this.node.addinfo.remove();
			delete this.node.addinfo;
		}
		if (typeof card[0] == "string" && lib.color.red.includes(card[0])) {
			this.node.info.classList.add("red");
		}
		this.node.image.className = "image";
		var name = get.translation(card[2]);
		if (card[2] == "sha") {
			name = "";
			let nature = card[3];
			if (typeof nature == "string" && nature) {
				let natures = get.natureList(nature);
				natures.sort(lib.sort.nature);
				for (let nature of natures) {
					name += lib.translate["nature_" + nature] || lib.translate[nature] || "";
					if (nature != "stab") {
						this.node.image.classList.add(nature);
					}
				}
			}
			name += "杀";
		}
		this.node.name.innerHTML = name;
		if (name.length >= 5) {
			this.node.name.classList.add("long");
			if (name.length >= 7) {
				this.node.name.classList.add("longlong");
			}
		}
		this.node.name2.innerHTML = get.translation(card[0]) + cardnum + " " + name;
		this.classList.add("card");
		if (typeof card[3] == "string" && card[3]) {
			let natures = get.natureList(card[3]);
			natures.forEach(n => {
				if (n) {
					this.classList.add(n);
				}
			});
			this.nature = natures
				.filter(n => lib.nature.has(n))
				.sort(lib.sort.nature)
				.join(lib.natureSeparator);
		} else if (typeof this.nature == "string" && this.nature) {
			this.classList.remove(this.nature);
			delete this.nature;
		}
		if (info.subtype) {
			this.classList.add(info.subtype);
		}
		this.node.range.innerHTML = "";
		switch (get.subtype(this, false)) {
			case "equip1":
				var added = false;
				if (lib.card[this.name] && lib.card[this.name].distance) {
					var dist = lib.card[this.name].distance;
					if (dist.attackFrom) {
						added = true;
						this.node.range.innerHTML = "范围: " + (-dist.attackFrom + 1);
					}
				}
				if (!added) {
					this.node.range.innerHTML = "范围: 1";
				}
				break;
			case "equip3":
				if (info.distance && info.distance.globalTo) {
					this.node.range.innerHTML = "防御: " + info.distance.globalTo;
					this.node.name2.innerHTML += "+";
				}
				break;
			case "equip4":
				if (info.distance && info.distance.globalFrom) {
					this.node.range.innerHTML = "进攻: " + -info.distance.globalFrom;
					this.node.name2.innerHTML += "-";
				}
				break;
		}
		var tags = [];
		if (Array.isArray(card[4])) {
			tags.addArray(card[4]);
		}
		if (this.cardid) {
			if (!_status.cardtag) {
				_status.cardtag = {};
			}
			for (const tagName in _status.cardtag) {
				if (_status.cardtag[tagName].includes(this.cardid)) {
					tags.add(tagName);
				}
			}
			if (tags.length) {
				var tagstr = ' <span class="cardtag">';
				for (let index = 0; index < tags.length; index++) {
					const tagName = tags[index];
					if (!_status.cardtag[tagName]) {
						_status.cardtag[tagName] = [];
					}
					_status.cardtag[tagName].add(this.cardid);
					tagstr += lib.translate[tagName + "_tag"];
					//if(i<tags.length-1) tagstr+=' ';
				}
				tagstr += "</span>";
				this.node.range.innerHTML += tagstr;
			}
		}
		return this;
	}
	/**
	 * 给此牌添加特定的cardtag（如添加应变条件）
	 * @param { string } tag
	 */
	addCardtag(tag) {
		let card = this;
		game.broadcastAll(
			function (card, tag) {
				if (!_status.cardtag) {
					_status.cardtag = {};
				}
				if (!_status.cardtag[tag]) {
					_status.cardtag[tag] = [];
				}
				const cardId = card.cardid;
				if (typeof cardId == "string") {
					_status.cardtag[tag].add(cardId);
				}
				card.$init([card.suit, card.number, card.name, card.nature]);
			},
			card,
			tag
		);
	}
	/**
	 * 给此牌移除特定的cardtag（如移除应变条件）
	 * @param { string } tag
	 */
	removeCardtag(tag) {
		let card = this;
		game.broadcastAll(
			function (card, tag) {
				if (!_status.cardtag) {
					_status.cardtag = {};
				}
				if (!_status.cardtag[tag]) {
					_status.cardtag[tag] = [];
				}
				const cardId = card.cardid;
				if (typeof cardId == "string") {
					_status.cardtag[tag].remove(cardId);
				}
				card.$init([card.suit, card.number, card.name, card.nature]);
			},
			card,
			tag
		);
	}
	updateTransform(bool, delay) {
		if (delay) {
			var that = this;
			setTimeout(function () {
				that.updateTransform(that.classList.contains("selected"));
			}, delay);
		} else {
			if (_status.event.player != game.me) {
				return;
			}
			const handcards = this.parentElement?.parentElement;
			if (handcards instanceof HTMLElement && handcards.parentElement == ui.me) {
				ui.updatehl();
			}
			if (this._transform && handcards instanceof HTMLElement && handcards.parentElement == ui.me && (!_status.mousedown || _status.mouseleft) && (!handcards.classList.contains("scrollh") || game.layout == "long2" || game.layout == "nova")) {
				if (bool) {
					this.style.transform = this._transform + " translateY(-20px)";
				} else {
					this.style.transform = this._transform || "";
				}
			}
		}
	}
	aiexclude() {
		_status.event._aiexclude.add(this);
	}
	//为此牌添加知情者。参数可为数组，若参数为字符串'everyone'，则所有玩家均为知情者。
	addKnower(player) {
		if (!this._knowers) {
			this._knowers = [];
		}
		const knowers = this._knowers;
		if (typeof player == "string") {
			knowers.add(player);
		} else {
			let type = get.itemtype(player);
			if (type == "player") {
				knowers.add(player.playerid);
			} else if (type == "players") {
				player.forEach(p => knowers.add(p.playerid));
			}
		}
	}
	removeKnower(player) {
		const knowers = this._knowers;
		if (!knowers) {
			return;
		}
		if (typeof player == "string") {
			knowers.remove(player);
		} else {
			let type = get.itemtype(player);
			if (type == "player") {
				knowers.remove(player.playerid);
			} else if (type == "players") {
				player.forEach(p => knowers.remove(p.playerid));
			}
		}
	}
	//清除此牌的知情者。
	clearKnowers() {
		if (this._knowers) {
			delete this._knowers;
		}
	}
	//判断玩家对此牌是否知情。
	isKnownBy(player, checkKnowers = true) {
		if (["e", "j"].includes(get.position(this))) {
			return true;
		} //装备区或者判定区的牌，必知情。
		let owner = get.owner(this);
		if (owner) {
			if (owner == player) {
				return true;
			} //是牌主，必知情。
			if (player.hasSkillTag("viewHandcard", null, owner, true)) {
				return true;
			} //有viewHandcard标签，必知情。
			if (owner.isUnderControl(true, player)) {
				return true;
			} //被操控，必知情。
		}
		if (get.is.shownCard(this)) {
			return true;
		} //此牌是明置牌，必知情。
		if (this._knowers && checkKnowers) {
			return this._knowers.includes("everyone") || this._knowers.includes(player.playerid);
		}
		return false;
	}
	getSource(name) {
		if (this.name == name) {
			return true;
		}
		var info = lib.card[this.name];
		if (info && Array.isArray(info.source)) {
			return info.source.includes(name);
		}
		return false;
	}
	moveDelete(player) {
		this.fixed = true;
		if (!this._listeningEnd || this._transitionEnded) {
			this.moveTo(player);
			var that = this;
			setTimeout(function () {
				that.delete();
			}, 200);
		} else {
			this._onEndMoveDelete = player;
		}
	}
	moveTo(player) {
		this.fixed = true;
		var dx, dy;
		if (this.classList.contains("center")) {
			/** @type {[percentage: number, offset: number]} */
			var nx = [50, -52];
			/** @type {[percentage: number, offset: number]} */
			var ny = [50, -52];
			const targetX = (nx[0] * ui.arena.offsetWidth) / 100 + nx[1];
			const targetY = (ny[0] * ui.arena.offsetHeight) / 100 + ny[1];
			dx = player.getLeft() + player.offsetWidth / 2 - 52 - targetX;
			dy = player.getTop() + player.offsetHeight / 2 - 52 - targetY;
		} else {
			this.style.left = this.offsetLeft + "px";
			this.style.top = this.offsetTop + "px";

			dx = player.getLeft() + player.offsetWidth / 2 - 52 - this.offsetLeft;
			dy = player.getTop() + player.offsetHeight / 2 - 52 - this.offsetTop;
		}
		if (get.is.mobileMe(player)) {
			dx += get.cardOffset();
			if (ui.arena.classList.contains("oblongcard")) {
				dy -= 16;
			}
		}

		if (this.style.transform && this.style.transform != "none" && this.style.transform.indexOf("translate") == -1) {
			this.style.transform += " translate(" + dx + "px," + dy + "px)";
		} else {
			this.style.transform = "translate(" + dx + "px," + dy + "px)";
		}
		return this;
	}
	copy() {
		const node = this.cloneNode(true);
		Object.setPrototypeOf(node, lib.element.Card.prototype);
		if (!(node instanceof lib.element.Card)) {
			throw new TypeError("Failed to clone card element");
		}
		/**
		 * @param {string} selector
		 */
		const requireDiv = selector => {
			const element = node.querySelector(selector);
			if (!(element instanceof HTMLDivElement)) {
				throw new TypeError(`Missing card node: ${selector}`);
			}
			return element;
		};
		node.style.transform = "";
		node.name = this.name;
		node.suit = this.suit;
		node.number = this.number;
		node.nature = this.nature;
		node._cardid = this.cardid;
		node.classList.remove("hidden");
		node.classList.remove("start");
		node.classList.remove("thrown");
		node.classList.remove("selectable");
		node.classList.remove("selected");
		node.classList.remove("removing");
		node.classList.remove("drawinghidden");
		node.classList.remove("glows");
		/** @type {CardNodeMap} */
		const cardNodeMap = {
			name: requireDiv(".name"),
			name2: requireDiv(".name2"),
			info: requireDiv(".info"),
			intro: requireDiv(".intro"),
			background: requireDiv(".background"),
			image: requireDiv(".image"),
			range: requireDiv(".range"),
			gaintag: requireDiv(".gaintag"),
		};
		const avatar = node.querySelector(".cardavatar");
		if (avatar instanceof HTMLDivElement) {
			cardNodeMap.avatar = avatar;
		}
		const framebg = node.querySelector(".cardframebg");
		if (framebg instanceof HTMLDivElement) {
			cardNodeMap.framebg = framebg;
		}
		if (this.node.addinfo) {
			const ranges = node.querySelectorAll(".range");
			const addinfo = ranges.item(ranges.length - 1);
			if (addinfo instanceof HTMLDivElement && addinfo != cardNodeMap.range) {
				cardNodeMap.addinfo = addinfo;
			}
		}
		node.node = cardNodeMap;
		node.node.gaintag.innerHTML = "";
		var clone = true;
		var position;
		for (var i = 0; i < arguments.length; i++) {
			if (typeof arguments[i] == "string") {
				node.classList.add(arguments[i]);
			} else if (["div", "fragment"].includes(get.objtype(arguments[i]))) {
				position = arguments[i];
			} else if (typeof arguments[i] == "boolean") {
				clone = arguments[i];
			}
		}
		node.moveTo = lib.element.Card.prototype.moveTo;
		node.moveDelete = lib.element.Card.prototype.moveDelete;
		if (clone) {
			this.clone = node;
		}
		if (position) {
			position.appendChild(node);
		}
		return node;
	}
	uncheck(skill) {
		if (skill) {
			this._uncheck.add(skill);
		}
		this.classList.add("uncheck");
	}
	recheck(skill) {
		if (skill) {
			this._uncheck.remove(skill);
		} else {
			this._uncheck.length = 0;
		}
		if (this._uncheck.length == 0) {
			this.classList.remove("uncheck");
		}
	}
	/**
	 * 判断此牌是否包含class样式，参数有多个时，只需一个满足。
	 *
	 * @param {string} className
	 *
	 * @returns {boolean} 是否包含class
	 */
	classListContains(className) {
		return Array.from(arguments).some(name => this.classList.contains(className));
	}
	/**
	 * 判断此牌是否包含class样式，参数有多个时，需全部满足。
	 *
	 * @param {...string} classNames
	 *
	 * @returns {boolean} 是否包含class
	 */
	classListContainsAll() {
		return Array.from(arguments).every(name => this.classList.contains(this.className));
	}
	/**
	 * 返回一个键值，用于在缓存中作为键名。
	 * @param { boolean } [similar] false统一前缀
	 * @returns {string} cacheKey
	 */
	getCacheKey(similar) {
		let prefix = "[object:";
		if (similar !== false) {
			prefix = "[card:";
		}
		if (this.cardid) {
			return prefix + this.cardid + "]";
		}
		return prefix + `${this.name}+${this.suit ? this.suit : "none"}+${this.number === undefined ? "none" : this.number}${this.nature ? "+" + this.nature : ""}]`;
	}
	discard(bool) {
		if (!this._selfDestroyed) {
			this.fix();
			ui.discardPile.appendChild(this);
		}
		this.classList.remove("glow");
		if (bool === false) {
			ui.cardPile.insertBefore(this, ui.cardPile.childNodes[Math.floor(Math.random() * ui.cardPile.childNodes.length)]);
		} else {
			if (_status.discarded) {
				_status.discarded.add(this);
			}
		}
	}
	hasTag(tag) {
		if (this.cardid && _status.cardtag && _status.cardtag[tag] && _status.cardtag[tag].includes(this.cardid)) {
			return true;
		}
		return false;
	}
	hasPosition() {
		return ["h", "e", "j", "s", "x"].includes(get.position(this));
	}
	isInPile() {
		return ["c", "d"].includes(get.position(this));
	}
}
