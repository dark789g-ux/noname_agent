import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

import { legacySelectionContent } from "./content.js";
import { normalSelectionContent } from "./normal.js";
import type { IdentitySelectionEvent } from "../contracts.js";
export function chooseCharacter() {
	if (_status.mode == "purple") {
		game.chooseCharacterPurple();
		return;
	}

	const next = game.createEvent("chooseCharacter") as IdentitySelectionEvent;
	next.showConfig = true;
	next.addPlayer = player => {
		const list = get.identityList(game.players.length - 1);
		const list2 = get.identityList(game.players.length);
		for (const item of list) {
			list2.remove(item);
		}
		player.identity = list2[0];
		player.setIdentity("cai");
	};
	next.removePlayer = () => {
		return game.players.randomGet(game.me!, game.zhu);
	};
	next.ai = (player, list, list2, back) => {
		if (_status.brawl && _status.brawl.chooseCharacterAi && _status.brawl.chooseCharacterAi(player, list, list2, back) !== false) {
			return;
		}
		const stratagemMode = _status.event.stratagemMode;
		if (_status.event.zhongmode) {
			const listc = list.slice(0, 2);
			for (const index of listc.keys()) {
				const listx = lib.characterReplace[listc[index]];
				if (listx && listx.length) {
					listc[index] = listx.randomGet();
				}
			}
			if (get.config("double_character", undefined)) {
				player.init(listc[0], listc[1]);
			} else {
				player.init(listc[0]);
			}
			if (player.identity === "mingzhong" && !player.isInitFilter("noZhuHp")) {
				player.hp!++;
				player.maxHp!++;
				player.update();
			}
		} else if (player.identity === "zhu" && !stratagemMode) {
			list2!.randomSort();
			let choice = list[0];
			let choice2 = list[1];
			if (!_status.event.zhongmode && Math.random() - 0.8 < 0 && list2!.length) {
				choice = list2![0];
				choice2 = list[0];
				if (choice2 == choice) {
					choice2 = list[1];
				}
			}
			const choiceList = lib.characterReplace[choice];
			if (choiceList && choiceList.length) {
				choice = choiceList.randomGet();
			}
			const choice2List = lib.characterReplace[choice2];
			if (choice2List && choice2List.length) {
				choice2 = choice2List.randomGet();
			}
			if (get.config("double_character", undefined)) {
				player.init(choice, choice2);
			} else {
				player.init(choice);
			}
			if (game.players.length > 4 && !player.isInitFilter("noZhuHp")) {
				player.hp!++;
				player.maxHp!++;
				player.update();
			}
		} else if (player.identity === "zhong" && (Math.random() < 0.5 || ["sunliang", "key_akane"].includes(game.zhu.name!)) && !stratagemMode) {
			const listc = list.slice(0);
			for (const index of listc.keys()) {
				const listx = lib.characterReplace[listc[index]];
				if (listx && listx.length) {
					listc[index] = listx.randomGet();
				}
			}
			let choice = 0;
			for (const index of listc.keys()) {
				if (lib.character[listc[index]][1] == game.zhu.group) {
					choice = index;
					break;
				}
			}
			if (get.config("double_character", undefined)) {
				player.init(listc[choice], listc[choice == 0 ? choice + 1 : choice - 1]);
			} else {
				player.init(listc[choice]);
			}
		} else {
			const listc = list.slice(0, 2);
			for (const index of listc.keys()) {
				const listx = lib.characterReplace[listc[index]];
				if (listx && listx.length) {
					listc[index] = listx.randomGet();
				}
			}
			if (get.config("double_character", undefined)) {
				player.init(listc[0], listc[1]);
			} else {
				player.init(listc[0]);
			}
		}
		if (back) {
			list.remove(get.sourceCharacter(player.name1!));
			list.remove(get.sourceCharacter(player.name2!));
			for (const name of list) {
				back.push(name);
			}
		}
		if (typeof lib.config.test_game === "string" && player === game.me!.next && lib.config.test_game !== "_") {
			player.init(lib.config.test_game);
		}
		if (get.is.double(player.name1)) {
			player._groupChosen = "double";
			player.group = (get.is.double(player.name1, true) as string[]).randomGet();
			player.node.name.dataset.nature = get.groupnature(player.group, undefined);
		} else if (get.config("choose_group", undefined) && lib.selectGroup.includes(player.group!) && !player.isUnseen(0)) {
			player._groupChosen = "kami";
			const groups = lib.group.slice(0);
			groups.remove("shen");
			if (groups.length) {
				player.group = (() => {
					if (_status.mode === "zhong" || !game.zhu || !game.zhu.group) {
						return groups.randomGet();
					}
					if (["re_zhangjiao", "liubei", "re_liubei", "caocao", "re_caocao", "sunquan", "re_sunquan", "zhangjiao", "sp_zhangjiao", "caopi", "re_caopi", "liuchen", "caorui", "sunliang", "sunxiu", "sunce", "re_sunben", "ol_liushan", "re_liushan", "key_akane", "dongzhuo", "re_dongzhuo", "ol_dongzhuo", "jin_simashi", "caomao"].includes(game.zhu.name!)) {
						return game.zhu.group;
					}
					if (game.zhu.name === "yl_yuanshu") {
						if (player.identity !== "zhong") {
							return "qun";
						}
						groups.remove("qun");
					}
					if (["sunhao", "xin_yuanshao", "re_yuanshao", "re_sunce", "ol_yuanshao", "yuanshu", "jin_simazhao", "liubian"].includes(game.zhu.name!)) {
						if (player.identity == "zhong") {
							return game.zhu.group;
						}
						groups.remove(game.zhu.group);
					}
					return groups.randomGet();
				})();
			}
		}
		player.node.name.dataset.nature = get.groupnature(player.group, undefined);
	};
	if (_status.mode === "normal" && !_status.connectMode && !_status.brawl) {
		next.setContent(async event => {
			await normalSelectionContent(event as IdentitySelectionEvent);
		});
	} else next.setContent(legacySelectionContent());
}

/** Keep the mode factory's fresh, non-constructible method identity. */
export function createChooseCharacter() {
	return {
		chooseCharacter() {
			chooseCharacter();
		},
	}.chooseCharacter;
}
