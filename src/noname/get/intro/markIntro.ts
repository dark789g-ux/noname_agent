import { lib, _status, ui } from "noname";
import { get } from "../dependencies.js";

import { finishIntro } from "./finish.js";
export function markIntro(node, simple, evt, uiintro, createButtons) {
	// Function-scoped bindings intentionally remain shared across legacy branches.
	let stint, placetext;

	let i, translation, intro, str;
	let info = node.info;
	let player = node.parentNode.parentNode;
	if (info.name) {
		if (typeof info.name == "function") {
			let named = info.name(player.storage[node.skill], player);
			if (named) {
				uiintro.add(named);
			}
		} else {
			uiintro.add(info.name);
		}
	} else if (info.name !== false) {
		uiintro.add(get.translation(node.skill));
	}
	if (typeof info.id == "string" && info.id.startsWith("subplayer") && player.isUnderControl(true) && player.storage[info.id] && !_status.video) {
		let storage = player.storage[info.id];
		uiintro.addText("当前体力：" + storage.hp + "/" + storage.maxHp);
		if (storage.hs.length) {
			uiintro.addText("手牌区");
			uiintro.addSmall(storage.hs);
		}
		if (storage.es.length) {
			uiintro.addText("装备区");
			uiintro.addSmall(storage.es);
		}
	}
	if (typeof info.mark == "function") {
		stint = info.mark(uiintro, player.storage[node.skill], player, evt, node.skill);
		if (stint instanceof Promise) {
			uiintro.hide();
			stint.then(() => {
				uiintro.show();
				if (evt) {
					lib.placePoppedDialog(uiintro, evt);
				}
			});
		} else if (stint) {
			placetext = uiintro.add('<div class="text" style="display:inline">' + stint + "</div>");
			if (!stint.startsWith('<div class="skill"')) {
				uiintro._place_text = placetext;
			}
			// if(stint.length<=100){
			// 	uiintro.add('<div class="text center">'+stint+'</div>');
			// }
			// else{
			// 	uiintro.add('<div class="text">'+stint+'</div>');
			// }
		}
		/*if (evt) {
					lib.placePoppedDialog(uiintro, evt);
				}*/
	} else {
		stint = get.storageintro(info.content, player.storage[node.skill], player, uiintro, node.skill);
		if (stint) {
			if (stint[0] == "@") {
				uiintro.add('<div class="caption">' + stint.slice(1) + "</div>");
			} else {
				placetext = uiintro.add('<div class="text" style="display:inline">' + stint + "</div>");
				if (!stint.startsWith('<div class="skill"')) {
					uiintro._place_text = placetext;
				}
			}
			// else if(stint.length<=100){
			// 	uiintro.add('<div class="text center">'+stint+'</div>');
			// }
			// else{
			// 	uiintro.add('<div class="text">'+stint+'</div>');
			// }
		}
	}
	uiintro.add(ui.create.div(".placeholder.slim"));
	return finishIntro(uiintro);
}
