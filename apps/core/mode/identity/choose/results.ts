import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

import type { IdentitySelectionEvent, IdentitySelectionResult } from "../contracts.js";
export async function applySelection(event: IdentitySelectionEvent, result: IdentitySelectionResult) {
	if (ui.cheat) {
		ui.cheat.close();
		delete ui.cheat;
	}
	if (ui.cheat2) {
		ui.cheat2.close();
		delete ui.cheat2;
	}
	if (event.llmChoice) {
		event.llmOpening!.revalidate(event.llmChoice);
		event.choosed = event.llmChoice.result.characters.slice();
		event.group = event.llmChoice.result.group;
		game.addRecentCharacter(...event.choosed);
	} else if (event.chosen.length) {
		event.choosed = event.chosen;
	} else if (event.modchosen) {
		if (event.modchosen[0] === "random") {
			event.modchosen[0] = result.buttons[0].link;
		} else {
			event.modchosen[1] = result.buttons[0].link;
		}
		event.choosed = event.modchosen;
	} else if (result.buttons.length === 2) {
		event.choosed = [result.buttons[0].link, result.buttons[1].link];
		game.addRecentCharacter(result.buttons[0].link, result.buttons[1].link);
	} else {
		event.choosed = [result.buttons[0].link];
		game.addRecentCharacter(result.buttons[0].link);
	}
	const name = event.choosed[0];
	const groups = get.selectGroup(name, undefined);
	const type = get.selectGroup(name, true);
	if (type !== "default") {
		game.me!._groupChosen = type;
	}
	if (groups.length && !event.llmChoice) {
		const groupResult = (await game
			.me!.chooseButton(["请选择你的势力", [groups.map(group => ["", "", `group_${group}`]), "vcard"]], true)
			.set("direct", true)
			.forResult()) as Result;

		if (groupResult.links?.length) {
			event.group = groupResult.links[0][2].slice(6);
		}
	}
	if (event.choosed.length === 2) {
		game.me!.init(event.choosed[0], event.choosed[1]);
	} else {
		game.me!.init(event.choosed[0]);
	}
	event.list.remove(get.sourceCharacter(game.me!.name1!));
	event.list.remove(get.sourceCharacter(game.me!.name2!));
	if (!event.stratagemMode && game.me === game.zhu && game.players.length > 4 && !game.me.isInitFilter("noZhuHp")) {
		game.me.hp!++;
		game.me.maxHp!++;
		game.me.update();
	}
	if (event.llmChoice) {
		event.llmOpening!.applyGroup(game.me, event.llmChoice.result);
		event.llmOpening!.finish(event.llmChoice);
	} else if (event.llmOpening && event.group && game.me === game.zhu) {
		// 后续 LLM 座位应看到真人主公已公开选定的势力。
		game.me.group = event.group;
		game.me.node.name.dataset.nature = get.groupnature(event.group, undefined);
		game.me.update();
	}
	if (!(await selectRemainingOpening(event))) {
		for (const currentPlayer of game.players) {
			if ((event.stratagemMode || currentPlayer !== game.zhu) && currentPlayer !== game.me) {
				event.list.randomSort();
				event.ai(currentPlayer, event.list.splice(0, get.config(`choice_${currentPlayer.identity}`, undefined)), null, event.list);
			}
		}
	}
}
export async function finishSelection(event: IdentitySelectionEvent) {
	if (event.group) {
		game.me!.group = event.group;
		game.me!.node.name.dataset.nature = get.groupnature(game.me!.group, undefined);
		game.me!.update();
	}
	for (const currentPlayer of game.players) {
		_status.characterlist!.remove(currentPlayer.name);
		_status.characterlist!.remove(currentPlayer.name1);
		_status.characterlist!.remove(currentPlayer.name2);
	}
	if (event.stratagemMode) {
		["stratagem_gain", "stratagem_insight", "stratagem_expose"].forEach(globalSkill => game.addGlobalSkill(globalSkill));
		game.players.forEach(i => {
			i.storage.zhibi = [];
			i.storage.stratagem_expose = [];
			i.markSkill("stratagem_fury");
		});
	}
	setTimeout(() => {
		ui.arena.classList.remove("choose-character");
	}, 500);

	if (event.special_identity) {
		for (const specialIdentity of event.special_identity) {
			game.zhu.addSkill(specialIdentity);
		}
	}
}
