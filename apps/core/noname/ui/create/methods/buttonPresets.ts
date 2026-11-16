import { lib, get, _status, ui } from "noname";
import type { Button, Card } from "../../../library/element/index.js";
import { getRegisteredSkill } from "../../../library/skillRegistry.js";

function renderCharacterButtonNode(node: RuntimeCharacterButton, item: string, noclick?: boolean): void {
	node.setBackground(item, "character");
	if (node.node) {
		node.node.name.remove();
		node.node.hp.remove();
		node.node.group.remove();
		node.node.intro.remove();
		if (node.node.replaceButton) {
			node.node.replaceButton.remove();
		}
	}
	node.node = {
		name: ui.create.div(".name", node),
		hp: ui.create.div(".hp", node),
		group: ui.create.div(".identity", node),
		intro: ui.create.div(".intro", node),
	};
	const infoitem = get.character(item);
	node.node.name.innerHTML = get.slimName(item);
	if (lib.config.buttoncharacter_style == "default" || lib.config.buttoncharacter_style == "simple") {
		if (lib.config.buttoncharacter_style == "simple") {
			node.node.group.style.display = "none";
		}
		node.classList.add("newstyle");
		node.node.name.dataset.nature = get.groupnature(get.bordergroup(infoitem));
		node.node.group.dataset.nature = get.groupnature(get.bordergroup(infoitem), "raw");
		ui.create.div(node.node.hp);
		const hp = infoitem.hp;
		const maxHp = infoitem.maxHp;
		const hujia = infoitem.hujia;
		let str = get.numStr(hp);
		if (hp !== maxHp) {
			str += "/";
			str += get.numStr(maxHp);
		}
		ui.create.div(".text", str, node.node.hp);
		if (infoitem[2] == 0) {
			node.node.hp.hide();
		} else if (get.infoHp(infoitem[2]) <= 3) {
			node.node.hp.dataset.condition = "mid";
		} else {
			node.node.hp.dataset.condition = "high";
		}
		if (hujia > 0) {
			ui.create.div(node.node.hp, ".shield");
			ui.create.div(".text", get.numStr(hujia), node.node.hp);
		}
	} else {
		const hp = infoitem.hp;
		const maxHp = infoitem.maxHp;
		const shield = infoitem.hujia;
		if (maxHp > 14) {
			node.node.hp.innerHTML = hp !== maxHp || shield > 0 ? infoitem[2] : get.numStr(infoitem[2]);
			node.node.hp.classList.add("text");
		} else {
			for (let i = 0; i < maxHp; i++) {
				const next = ui.create.div("", node.node.hp);
				if (i >= hp) {
					next.classList.add("exclude");
				}
			}
			for (let i = 0; i < shield; i++) {
				ui.create.div(node.node.hp, ".shield");
			}
		}
	}
	if (node.node.hp.childNodes.length == 0) {
		node.node.name.style.top = "8px";
	}
	if (node.node.name.querySelectorAll("br").length >= 4) {
		node.node.name.classList.add("long");
		if (lib.config.buttoncharacter_style == "old") {
			node.addEventListener("mouseenter", ui.click.buttonnameenter);
			node.addEventListener("mouseleave", ui.click.buttonnameleave);
		}
	}
	node.node.intro.innerHTML = lib.config.intro;
	if (!noclick) {
		lib.setIntro(node);
	}
	if (infoitem[1]) {
		const double = get.is.double(item, []);
		if (Array.isArray(double)) {
			node.node.group.innerHTML = double.reduce((previousValue, currentValue) => `${previousValue}<div data-nature="${get.groupnature(currentValue)}">${get.translation(currentValue)}</div>`, "");
			if (double.length > 4) {
				node.node.group.style.height = new Set([5, 6, 9]).has(double.length) ? "48px" : "64px";
			}
		} else {
			node.node.group.innerHTML = `<div>${get.translation(infoitem[1])}</div>`;
		}
		node.node.group.style.backgroundColor = get.translation(`${get.bordergroup(infoitem)}Color`);
	} else {
		node.node.group.style.display = "none";
	}
	if (node._replaceButton) {
		const intro = Object.assign(ui.create.div(".button.replaceButton", node), { _node: node });
		intro[lib.experimental.symbol.itemType] = "button";
		node.node.replaceButton = intro;
		intro.innerHTML = "切换";
		intro.addEventListener(lib.config.touchscreen ? "touchend" : "click", function () {
			_status.tempNoButton = true;
			const targetNode = intro._node;
			const list = lib.characterReplace[targetNode._link];
			let link = targetNode.link;
			let index = list.indexOf(link);
			if (index == list.length - 1) {
				index = 0;
			} else {
				index++;
			}
			link = list[index];
			targetNode.link = link;
			targetNode.refresh(targetNode, link);
			setTimeout(function () {
				delete _status.tempNoButton;
			}, 200);
		});
	}
}

export function createButtonPresets() {
	return {
		tdnodes(item: any, _type?: string, position?: any, _noclick?: boolean, node?: any): Button {
			node = ui.create.div(".shadowed.reduce_radius.pointerdiv.tdnode.tdnodes", position);
			if (Array.isArray(item)) {
				node.innerHTML = "<span>" + item[1] + "</span>";
				node.link = item[0];
			} else {
				node.innerHTML = "<span>" + item + "</span>";
				node.link = item;
			}
			return node;
		},
		blank(item: any, _type?: string, position?: any, _noclick?: boolean, node?: any): Button {
			node = ui.create.div(".button.card.blank", position);
			node.link = item;
			if (get.position(item) == "j" && item.viewAs && lib.config.cardtempname != "off") {
				node.classList.add("infoflip");
				node.classList.add("infohidden");
				ui.create.cardTempName(item, node).style.setProperty("display", "block", "important");
			}
			return node;
		},
		card(item: Card, _type?: string, position?: any, noclick?: boolean, node?: any): RuntimeCardButton {
			if (typeof item.copy == "function") {
				node = item.copy(false);
			} else {
				node = item.cloneNode(true);
			}
			node.classList.add("button");
			if (position) {
				position.appendChild(node);
			}
			node.link = item;
			// 复制标记信息
			node.node.gaintag.innerHTML = item.node.gaintag.innerHTML;
			if (item.style.backgroundImage) {
				node.style.backgroundImage = item.style.backgroundImage;
				node.style.backgroundSize = "cover";
			}
			if (item.style.color) {
				node.style.color = item.style.color;
			}
			if (item.nature) {
				const natures = get.natureList(item.nature as string | string[]);
				natures.forEach(n => node.classList.add(n));
			}
			if (!noclick) {
				lib.setIntro(node);
			}
			const itemPosition = get.position(item);
			if ((itemPosition === "e" || itemPosition === "j") && item.viewAs && item.viewAs != item.name && lib.config.cardtempname != "off") {
				ui.create.cardTempName(item, node);
			}
			return node;
		},
		vcard(item: any, _type?: string, position?: any, noclick?: boolean, node?: any): RuntimeCardButton {
			if (typeof item == "string") {
				item = [get.type(item), "", item];
			}
			node = ui.create.card(position, "noclick", noclick);
			node.classList.add("button");
			node.init(item);
			node.link = item;
			return node;
		},
		character(item: string, type?: string, position?: any, noclick?: boolean, node?: any): RuntimeCharacterButton {
			if (node) {
				node.classList.add("button");
				node.classList.add("character");
				node.style.display = "";
			} else {
				node = ui.create.div(".button.character", position);
			}
			node._link = item;
			if (_status.noReplaceCharacter && type == "characterx") {
				type = "character";
			}
			if (type == "characterx") {
				if (lib.characterReplace[item] && lib.characterReplace[item].length) {
					item = lib.characterReplace[item].randomGet();
				}
			}
			node.link = item;
			if (get.is.double(node._link)) {
				node._changeGroup = true;
			}
			if (type == "characterx" && lib.characterReplace[node._link] && lib.characterReplace[node._link].length > 1) {
				node._replaceButton = true;
			}
			node.refresh = renderCharacterButtonNode;
			node.refresh(node, item, noclick);
			return node;
		},
		characterx(item: string, type?: string, position?: any, noclick?: boolean, node?: any): RuntimeCharacterButton {
			return ui.create.buttonPresets.character(item, type, position, noclick, node);
		},
		player(item: any, _type?: string, position?: any, _noclick?: boolean, node?: any): RuntimePlayerButton {
			if (node) {
				node.classList.add("button");
				node.classList.add("character");
				node.style.display = "";
			} else {
				node = ui.create.div(".button.character", position);
			}
			node._link = item;
			node.link = item;
			node.node = {
				name: ui.create.div(".name", node),
				intro: ui.create.div(".intro", node),
			};
			if (item.name && item.name.startsWith("unknown")) {
				if (item.node && item.node.name_seat) {
					node.classList.add("cardbg");
					ui.create.div(".avatar_name", node, get.translation(item.name));
				} else {
					node.setBackground(item.name1, "character");
				}
			} else {
				node.setBackground(item.name, "character");
			}
			return node;
		},
		skill(item: string | [string, string | null], _type?: string, position?: any, noclick?: boolean, node?: any): RuntimeSkillButton {
			if (!Array.isArray(item)) {
				item = [item, null];
			}
			let defaultName = _status.skillOwner[item[0]] || "shibing";
			const currentPlayer = get.player();
			if ("clanSkill" in get.info(item[0]) && currentPlayer) {
				const matchedName = get.nameList(currentPlayer).find(name => get.character(name, 3).includes(item[0]));
				defaultName = matchedName || defaultName;
			}
			const characterName = item[1] || defaultName;
			const skillId = item[0];
			const info = get.character(characterName);
			node = ui.create.buttonPresets.vcard(skillId, "vcard", position, noclick);
			node.owner = characterName;
			node.link = skillId;
			node.node.name.innerHTML = `<div class="name" data-nature=${get.groupnature(info[1], "raw")}m style="position: relative;color:#ffffff;fontweight:bold">${get.translation(skillId)}</div>`;
			node.node.background.innerHTML = "";
			node.setBackground(characterName, "character");
			node._customintro = function (uiintro: any) {
				const skill = node.link;
				uiintro.add(get.translation(skill));
				if (lib.translate[skill + "_info"]) {
					uiintro.add(`<div class="text">${get.skillInfoTranslation(skill, null, false)}</div>`);
					if (lib.translate[skill + "_append"]) {
						uiintro._place_text = uiintro.add('<div class="text">' + lib.translate[skill + "_append"] + "</div>");
					}
				}
				const registered = getRegisteredSkill(lib.skill, skill);
				if (registered?.derivation) {
					let skills = registered.derivation;
					if (!Array.isArray(skills)) {
						skills = [skills];
					}
					skills = skills.filter((s: string) => lib.translate[`${s}_info`] && getRegisteredSkill(lib.skill, s));
					if (skills.length) {
						uiintro.add(`—— 衍生技能 ——`);
					}
					uiintro.add([skills.map((i: string) => [i, node.owner]), ui.create.buttonPresets.skill]);
				}
			};
			return node;
		},
	};
}
