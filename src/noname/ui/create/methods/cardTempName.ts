import { lib, game, get, ui } from "noname";
import type { Dialog } from "../../../library/element/index.js";
import { applyFullImageFallbackBackground } from "./cardTempNameBackground.js";

function mapShaNatureDataset(cardNature: string): string {
	switch (cardNature) {
		case "fire":
			return "fire";
		case "thunder":
			return "thunder";
		case "kami":
			return "kami";
		case "ice":
			return "ice";
		default:
			return "";
	}
}

export const cardTempNameMethods = {
	/**
	 * 创建身份牌实例
	 */
	identityCard(identity: string, position?: any, noclick?: any) {
		const card = ui.create.card(position, "noclick", noclick);
		card.removeEventListener(lib.config.touchscreen ? "touchend" : "click", ui.click.card as EventListener);
		card.classList.add("button");
		card._customintro = (uiintro: Dialog) => uiintro.add(`${get.translation(`${identity}${2}`)}的身份牌`);
		const fileName = `image/card/identity_${identity}.jpg`;
		new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = resolve;
			image.onerror = reject;
			image.src = `${lib.assetURL}${fileName}`;
		}).then(
			() => {
				card.classList.add("fullskin");
				card.node.image.setBackgroundImage(fileName);
			},
			() => (card.node.background.innerHTML = get.translation(identity)[0])
		);
		return card;
	},
	/**
	 * 让卡牌旋转
	 */
	cardSpinning(card: HTMLDivElement & { listenTransition(callback: () => void): void }) {
		if (lib.config.cardback_style != "default") {
			card.style.transitionProperty = "none";
			ui.refresh(card);
			card.classList.add("infohidden");
			ui.refresh(card);
			card.style.transitionProperty = "";
		} else {
			card.classList.add("infohidden");
		}
		card.style.transition = "all 0s";
		card.style.transform = "perspective(600px) rotateY(180deg) translateX(0)";
		const onEnd01 = function () {
			setTimeout(function () {
				card.style.transition = "all ease-in 0.3s";
				card.style.transform = "perspective(600px) rotateY(270deg) translateX(52px)";
				const onEnd = function () {
					card.classList.remove("infohidden");
					card.style.transition = "all 0s";
					ui.refresh(card);
					card.style.transform = "perspective(600px) rotateY(-90deg) translateX(52px)";
					ui.refresh(card);
					card.style.transition = "";
					ui.refresh(card);
					card.style.transform = "";
				};
				card.listenTransition(onEnd);
			}, 300);
		};
		onEnd01();
	},
	/**
	 * 旋转的身份牌！
	 */
	spinningIdentityCard(identity: string, dialog: Dialog) {
		const card = ui.create.identityCard(identity);
		const buttons = ui.create.div(".buttons", dialog.content);
		setTimeout(() => {
			buttons.appendChild(card);
			dialog.open();
			ui.create.cardSpinning(card);
		}, 50);
	},
	cardTempName(card: any, applyNode?: any) {
		const getApplyNode = applyNode || card;
		let cardName = get.name(card);
		const cardNature = get.nature(card);
		let tempname = get.translation(cardName);
		const cardTempNameConfig = lib.config.cardtempname;
		const node = getApplyNode._tempName || ui.create.div(".tempname", getApplyNode);
		let datasetNature = "";
		const cardPosition = get.position(card);
		getApplyNode._tempName = node;
		if (cardTempNameConfig != "image") {
			// 清空，避免和下面的 image 部分有冲突
			node.innerHTML = "";
			datasetNature = "fire";
			if ((cardPosition === "e" || cardPosition === "j") && card.viewAs && card.viewAs != card.name) {
				datasetNature = "wood";
				tempname = get.translation(card.viewAs);
			} else if (cardName == "sha") {
				if (cardNature) {
					tempname = get.translation(cardNature) + tempname;
				}
				const mapped = typeof cardNature == "string" ? mapShaNatureDataset(cardNature) : "";
				if (mapped && mapped != "fire") {
					datasetNature = mapped;
				}
			}
			if (cardTempNameConfig == "default") {
				getApplyNode._tempName.classList.add("vertical");
			}
			if (datasetNature.length > 0) {
				node.dataset.nature = datasetNature;
			} else {
				delete node.dataset.nature;
				node.classList.add(datasetNature);
			}
		} else {
			if ((cardPosition === "e" || cardPosition === "j") && card.viewAs && card.viewAs != card.name) {
				cardName = card.viewAs;
				tempname = get.translation(card.viewAs);
			}
			if (cardName == "sha") {
				if (cardNature) {
					tempname = get.translation(cardNature) + tempname;
				}
				if (typeof cardNature == "string") {
					datasetNature = mapShaNatureDataset(cardNature);
				}
			}
			let bg = node.querySelector("div");
			if (bg) {
				Array.from(node.childNodes)
					.filter(v => v != bg)
					.forEach(v => node.removeChild(v));
			} else {
				bg = ui.create.div(node);
			}
			node.classList.add("tempimage");
			let img = get.dynamicVariable(lib.card[cardName].image, card);
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
			if (lib.card[cardName].fullskin) {
				if (img) {
					if (img.startsWith("db:")) {
						bg.setBackgroundDB(img.slice(3));
					} else if (typeof img == "string") {
						bg.setBackgroundImage(img);
					}
				} else if (lib.card[cardName].modeimage) {
					bg.setBackgroundImage("image/mode/" + lib.card[cardName].modeimage + "/card/" + cardName + ".png");
				} else if (cardName == "sha" && typeof cardNature == "string" && lib.natureBg.has(cardNature)) {
					bg.setBackgroundImage(lib.natureBg.get(cardNature)!);
				} else {
					bg.setBackgroundImage("image/card/" + cardName + ".png");
				}
			} else if (get.dynamicVariable(lib.card[cardName].image, card) == "background") {
				if (cardNature) {
					bg.setBackground(cardName + "_" + cardNature, "card");
				} else {
					bg.setBackground(cardName, "card");
				}
			} else if (lib.card[cardName].fullimage) {
				if (img) {
					if (img.startsWith("db:")) {
						bg.setBackgroundDB(img.slice(3));
					} else if (typeof img == "string") {
						bg.setBackgroundImage(img);
						bg.style.backgroundSize = "cover";
					}
				} else if (get.dynamicVariable(lib.card[cardName].image, card)) {
					const resolvedImg = get.dynamicVariable(lib.card[cardName].image, card);
					if (resolvedImg.startsWith("character:")) {
						bg.setBackground(resolvedImg.slice(10), "character");
					} else {
						bg.setBackground(resolvedImg);
					}
				} else {
					const cardPack = lib.cardPack["mode_" + get.mode()];
					applyFullImageFallbackBackground(cardPack, cardName, bg, get);
				}
			} else if (get.dynamicVariable(lib.card[cardName].image, card) == "card") {
				if (cardNature) {
					bg.setBackground(cardName + "_" + cardNature, "card");
				} else {
					bg.setBackground(cardName, "card");
				}
			} else if (typeof get.dynamicVariable(lib.card[cardName].image, card) == "string" && !lib.card[cardName].fullskin) {
				if (img) {
					if (img.startsWith("db:")) {
						bg.setBackgroundDB(img.slice(3));
					} else if (typeof img == "string") {
						bg.setBackgroundImage(img);
						bg.style.backgroundSize = "cover";
					}
				} else {
					bg.setBackground(get.dynamicVariable(lib.card[cardName].image, card));
				}
			} else {
				console.warn("卡牌图片解析失败");
			}
			if (datasetNature.length > 0) {
				node.classList.add(datasetNature);
			}
			delete node.dataset.nature;
		}
		node.innerHTML += `<span>${cardTempNameConfig == "default" ? get.verticalStr(tempname) : tempname}</span>`;
		node.tempname = tempname;
		return node;
	},
	rarity(button: RuntimeCharacterButton) {
		const rarity = game.getRarity(button.link);
		if (rarity != "common" && lib.config.show_rarity) {
			const intro = button.node.intro;
			intro.classList.add("showintro");
			intro.style.fontFamily = "yuanli";
			intro.style.fontSize = "16px";
			intro.style.bottom = "6px";
			intro.style.left = "6px";
			switch (rarity) {
				case "rare":
					intro.dataset.nature = "thunderm";
					break;
				case "epic":
					intro.dataset.nature = "metalm";
					break;
				case "legend":
					intro.dataset.nature = "orangem";
					break;
				case "junk":
					intro.dataset.nature = "woodm";
					break;
			}
			intro.innerHTML = get.translation(rarity);
		}
	},
};
