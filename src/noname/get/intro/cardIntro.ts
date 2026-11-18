import { game, lib, ui } from "noname";
import { get } from "../dependencies.js";

import { finishIntro } from "./finish.js";
export function cardIntro(node, simple, evt, uiintro, createButtons) {
	// Function-scoped bindings intentionally remain shared across legacy branches.
	let i, translation, intro, str, placetext;

	//卡牌长按介绍
	if (ui.arena.classList.contains("observe") && node.parentNode.classList.contains("handcards")) {
		return;
	}
	let name = node.name,
		Vcard = node[node.cardSymbol] || false,
		trueCard = node;
	if (node.parentNode.cardMod) {
		let moded = false;
		for (let i in node.parentNode.cardMod) {
			let item = node.parentNode.cardMod[i](node);
			if (Array.isArray(item)) {
				moded = true;
				uiintro.add(item[0]);
				uiintro._place_text = uiintro.add('<div class="text" style="display:inline">' + item[1] + "</div>");
			}
		}
		if (moded) {
			return uiintro;
		}
	}
	if (node.link?.name && lib.card[node.link.name]) {
		name = node.link.name;
		Vcard = node.link[node.link.cardSymbol] || false;
		trueCard = node.link;
	}
	let cardPosition = get.position(trueCard, undefined);
	/** @type {boolean | undefined} */
	let showCardIntro;
	if (((cardPosition === "e" || cardPosition === "j") && trueCard.viewAs && trueCard.viewAs != name) || (Vcard && (Vcard.cards.length != 1 || Vcard.cards[0].name != name))) {
		uiintro.add(get.translation(trueCard.viewAs));
		let cardInfo = lib.card[trueCard.viewAs];
		showCardIntro = true;
		let cardOwner = get.owner(trueCard);
		if (cardInfo.blankCard) {
			if (cardOwner && !cardOwner.isUnderControl(true)) {
				showCardIntro = false;
			}
		}
		if (cardOwner && showCardIntro) {
			uiintro.isNotCard = true;
		}
		// uiintro.add(get.translation(node.viewAs)+'<br><div class="text center" style="padding-top:5px;">（'+get.translation(node)+'）</div>');
		//uiintro.nosub = true;
		name = trueCard.viewAs;
	} else {
		if (node.extraEquip) {
			name = node.extraEquip[1];
			uiintro.add(`${get.translation(node.extraEquip[0])} ${get.translation(node.extraEquip[1])}`);
		} else {
			uiintro.add(get.translation(node));
		}
	}
	if (node._banning) {
		let clickBanned = /** @this {HTMLDivElement} */ function (this: HTMLDivElement) {
			const bannedname = this.dataset.bannedname;
			if (typeof bannedname != "string" || !bannedname) {
				return;
			}
			const configured = lib.config[bannedname];
			let banned = Array.isArray(configured) ? configured : [];
			if (banned.includes(name)) {
				banned.splice(banned.indexOf(name), 1);
			} else {
				banned.push(name);
			}
			game.saveConfig(bannedname, banned);
			this.classList.toggle("on");
			if (node.updateBanned) {
				node.updateBanned();
			}
		};
		let modeorder = lib.config.modeorder || [];
		for (let i in lib.mode) {
			modeorder.add(i);
		}
		let list: any[] = [];
		uiintro.contentContainer.listen(function (e) {
			ui.click.touchpop();
			e.stopPropagation();
		});
		for (let i = 0; i < modeorder.length; i++) {
			if (node._banning == "online") {
				if (!lib.mode[modeorder[i]].connect) {
					continue;
				}
			} else if (modeorder[i] == "connect" || modeorder[i] == "brawl") {
				continue;
			}
			if (lib.config.all.mode.includes(modeorder[i])) {
				list.push(modeorder[i]);
			}
		}
		if (lib.card[name] && lib.card[name].type == "trick") {
			list.push("zhinang_tricks");
		}
		let page = ui.create.div(".menu-buttons.configpopped", uiintro.content);
		let banall = false;
		for (let i = 0; i < list.length; i++) {
			let cfg = ui.create.div(".config", list[i] == "zhinang_tricks" ? "设为智囊" : lib.translate[list[i]] + "模式", page);
			cfg.classList.add("toggle");
			if (list[i] == "zhinang_tricks") {
				cfg.dataset.bannedname = (node._banning == "offline" ? "" : "connect_") + "zhinang_tricks";
			} else if (node._banning == "offline") {
				cfg.dataset.bannedname = list[i] + "_bannedcards";
			} else {
				cfg.dataset.bannedname = "connect_" + list[i] + "_bannedcards";
			}
			cfg.listen(clickBanned);
			ui.create.div(ui.create.div(cfg));
			const bannedname = cfg.dataset.bannedname;
			const configured = typeof bannedname == "string" && bannedname ? lib.config[bannedname] : undefined;
			let banned = Array.isArray(configured) ? configured : [];
			if (banned.includes(name) == (list[i] == "zhinang_tricks")) {
				cfg.classList.add("on");
				banall = true;
			}
		}
		ui.create.div(".menubutton.pointerdiv", banall ? "全部禁用" : "全部启用", uiintro.content, function (this: HTMLDivElement) {
			if (this.innerHTML == "全部禁用") {
				for (const child of page.children) {
					if (child instanceof HTMLDivElement) {
						const bannedname = child.dataset.bannedname;
						if (typeof bannedname == "string" && bannedname && bannedname.indexOf("zhinang_tricks") == -1 && child.classList.contains("on")) {
							clickBanned.call(child);
						}
					}
				}
				this.innerHTML = "全部启用";
			} else {
				for (const child of page.children) {
					if (child instanceof HTMLDivElement) {
						const bannedname = child.dataset.bannedname;
						if (typeof bannedname == "string" && bannedname && bannedname.indexOf("zhinang_tricks") == -1 && !child.classList.contains("on")) {
							clickBanned.call(child);
						}
					}
				}
				this.innerHTML = "全部禁用";
			}
		}).style.marginTop = "-10px";
		ui.create.div(".placeholder.slim", uiintro.content);
	} else {
		if (lib.translate[name + "_info"]) {
			if (!uiintro.nosub) {
				if (lib.card[name] && lib.card[name].derivation) {
					if (typeof lib.card[name].derivation == "string") {
						uiintro.add('<div class="text center">来源：' + get.translation(lib.card[name].derivation) + "</div>");
					} else if (lib.card[name].derivationpack) {
						uiintro.add('<div class="text center">来源：' + get.translation(lib.card[name].derivationpack + "_card_config") + "包</div>");
					}
				}
				let typeinfo = "";
				if (lib.card[name] && lib.card[name].unique) {
					typeinfo += "特殊" + get.translation(lib.card[name].type) + "牌";
				} else if (lib.card[name] && lib.card[name].type && lib.translate[lib.card[name].type]) {
					typeinfo += get.translation(lib.card[name].type) + "牌";
				}
				let vcard = get
					.owner(node)
					?.getVCards(get.position(node, undefined))
					?.find((card: VCard) => card.cards?.includes(node));
				if (get.subtypes(vcard || node, get.owner(node))?.length) {
					typeinfo +=
						"-" +
						get
							.subtypes(vcard || node, get.owner(node))
							.map((type: string) => get.translation(type))
							.join("/");
				}
				if (typeinfo) {
					uiintro.add('<div class="text center">' + typeinfo + "</div>");
				}
				if (lib.card[name].unique && lib.card[name].type == "equip") {
					if (lib.cardPile && typeof lib.cardPile == "object" && "guozhan" in lib.cardPile && lib.cardPack && typeof lib.cardPack == "object" && "guozhan" in lib.cardPack && Array.isArray(lib.cardPile.guozhan) && Array.isArray(lib.cardPack.guozhan) && lib.cardPack.guozhan.includes(name)) {
						uiintro.add('<div class="text center">专属装备</div>').style.marginTop = "-5px";
					} else {
						uiintro.add('<div class="text center">特殊装备</div>').style.marginTop = "-5px";
					}
				}
				if (lib.card[name] && lib.card[name].addinfomenu) {
					uiintro.add('<div class="text center">' + lib.card[name].addinfomenu + "</div>");
				}
				if (get.subtype(name, false) == "equip1") {
					let added = false;
					if (lib.card[name] && lib.card[name].distance) {
						let dist = lib.card[name].distance;
						if (dist.attackFrom) {
							added = true;
							uiintro.add('<div class="text center">攻击范围：' + (-dist.attackFrom + 1) + "</div>");
						}
					}
					if (!added) {
						uiintro.add('<div class="text center">攻击范围：1</div>');
					}
				}
			}
			if (lib.card[name].cardPrompt) {
				str = lib.card[name].cardPrompt(node.link || node, get.owner(node));
				placetext = uiintro.add('<div class="text" style="display:inline">' + str + "</div>");
				if (!str.startsWith('<div class="skill"')) {
					uiintro._place_text = placetext;
				}
			} else if (lib.translate[name + "_info"]) {
				placetext = uiintro.add('<div class="text" style="display:inline">' + lib.translate[name + "_info"] + "</div>");
				const translatedInfo = lib.translate[name + "_info"];
				if (typeof translatedInfo !== "string") {
					throw new TypeError("card info translation is missing after dialog update");
				}
				if (!translatedInfo.startsWith('<div class="skill"')) {
					uiintro._place_text = placetext;
				}
			}
			if (get.is.yingbianConditional(node.link || node)) {
				const yingbianEffects = get.yingbianEffects(node.link || node);
				if (!yingbianEffects.length) {
					const defaultYingbianEffect = get.defaultYingbianEffect(node.link || node);
					if (lib.yingbian.prompt.has(defaultYingbianEffect)) {
						yingbianEffects.push(defaultYingbianEffect);
					}
				}
				if (yingbianEffects.length && showCardIntro) {
					uiintro.add(`<div class="text" style="font-family: yuanli">应变：${yingbianEffects.map((value: string) => lib.yingbian.prompt.get(value)).join("；")}</div>`);
				}
			}
			if (lib.translate[name + "_append"]) {
				uiintro.add('<div class="text" style="display:inline">' + lib.translate[name + "_append"] + "</div>");
			}
			if (uiintro.isNotCard) {
				if (Vcard?.cards?.length) {
					uiintro.add('<div class="text center">—— 对应实体牌 ——</div>');
					uiintro.addSmall(Vcard.cards);
				} else {
					uiintro.add('<div class="text center">（这是一张虚拟牌）</div>');
				}
			}
			if (node.gaintag?.length) {
				let gaintag = node.gaintag
					.map(tag => {
						let translate = get.translation(tag);
						if (translate === tag && tag.startsWith("eternal_")) {
							translate = get.translation(tag.slice(8));
						}
						if (translate === "invisible") {
							return "";
						}
						return translate;
					})
					.filter(tag => tag.length);
				if (gaintag?.length) {
					uiintro.add(" ");
					uiintro.add(`<div class="text" style="display:inline">此牌标签：${gaintag}</div>`);
				}
			}
		}
		uiintro.add(ui.create.div(".placeholder.slim"));
	}
	return finishIntro(uiintro);
}
