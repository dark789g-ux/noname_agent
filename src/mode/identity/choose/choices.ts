import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";
import type { SelectionContext, IdentitySelectionEvent } from "../contracts.js";

export async function presentChoices(context: SelectionContext) {
	const { event, chosen, stratagemMode, list2, list3, list4 } = context;

	const getZhuList = context.getZhuList;
	const addSetting = event.addSetting;
	let list: string[] | false | "nozhu";
	const round = event.selectionRound;
	event.llmOpening = createIdentityOpening(event);
	delete event.llmChoice;
	context.num = get.config(`choice_${game.me!.identity}`, undefined);
	if (event.zhongmode) {
		context.num = 6;
		if (game.me!.identity === "zhu" || game.me!.identity === "nei" || game.me!.identity === "mingzhong") {
			context.num = 8;
		}
	}
	if (stratagemMode) {
		list = event.list.slice(0, context.num);
	} else if (game.zhu !== game.me) {
		if (event.llmOpening?.eligible(game.zhu)) {
			await selectOpeningMonarch(event, getZhuList(), list3);
		} else {
			event.ai(game.zhu, event.list, getZhuList());
		}
		event.list.remove(get.sourceCharacter(game.zhu.name1!));
		event.list.remove(get.sourceCharacter(game.zhu.name2!));
		if (_status.brawl && _status.brawl.chooseCharacter) {
			list = _status.brawl.chooseCharacter(event.list, context.num) as string[] | false | "nozhu";
			if (list === false || list === "nozhu") {
				list = event.list.slice(0, context.num);
			}
		} else {
			list = event.list.slice(0, context.num);
		}
	} else {
		if (_status.brawl && _status.brawl.chooseCharacter) {
			list = _status.brawl.chooseCharacter(getZhuList(), list3, context.num) as string[] | false | "nozhu";
			if (list === false) {
				if (event.zhongmode) {
					list = list3.slice(0, 6);
				} else {
					list = getZhuList().concat(list3.slice(0, context.num));
				}
			} else if (list === "nozhu") {
				list = event.list.slice(0, context.num);
			}
		} else {
			if (event.zhongmode) {
				list = list3.slice(0, 8);
			} else {
				list = getZhuList().concat(list3.slice(0, context.num));
			}
		}
	}
	if (await selectOpeningSelf(event, list)) {
		if (event.swapnodialog) {
			ui.dialog?.close();
			delete event.swapnodialog;
		}
		lib.init.onfree();
		return;
	}
	delete event.swapnochoose;
	let dialog;
	if (event.swapnodialog) {
		dialog = ui.dialog;
		event.swapnodialog(dialog, list);
		delete event.swapnodialog;
	} else {
		let str = "选择角色";
		if (_status.brawl && _status.brawl.chooseCharacterStr) {
			str = _status.brawl.chooseCharacterStr;
		}
		dialog = ui.create.dialog(str, "hidden", [list, "characterx"]);
		if ((!_status.brawl || !_status.brawl.noAddSetting) && get.config("change_identity", undefined)) {
			addSetting(dialog);
		}
	}
	if (game.me!.special_identity) {
		dialog.setCaption(`选择角色（${get.translation(game.me!.special_identity)}）`);
		(game.me!.node.identity.firstChild! as HTMLElement).innerHTML = get.translation(`${game.me!.special_identity}_bg`);
	} else {
		dialog.setCaption("选择角色");
		game.me!.setIdentity();
	}
	if (!event.chosen.length) {
		context.choice = game.me!.chooseButton(dialog, true).set("onfree", true);
		context.choice.selectButton = () => ((_status.brawl && _status.brawl.doubleCharacter) || get.config("double_character", undefined) ? 2 : 1);
	} else {
		lib.init.onfree();
	}
	ui.create.cheat = () => {
		if (round && !round.current()) return;
		_status.createControl = ui.cheat2;
		ui.cheat = ui.create.control("更换", () => {
			if (round && !round.current()) return;
			if (ui.cheat2 && ui.cheat2.dialog === _status.event.dialog) {
				return;
			}
			if (game.changeCoin) {
				game.changeCoin(-3);
			}
			if (game.zhu !== game.me) {
				event.list.randomSort();
				if (_status.brawl && _status.brawl.chooseCharacter) {
					list = _status.brawl.chooseCharacter(event.list, context.num) as string[] | false | "nozhu";
					if (list === false || list === "nozhu") {
						list = event.list.slice(0, context.num);
					}
				} else {
					list = event.list.slice(0, context.num);
				}
			} else {
				getZhuList().sort(lib.sort.character);
				list3.randomSort();
				if (_status.brawl && _status.brawl.chooseCharacter) {
					list = _status.brawl.chooseCharacter(getZhuList(), list3, context.num) as string[] | false | "nozhu";
					if (list === false) {
						if (event.zhongmode) {
							list = list3.slice(0, 6);
						} else {
							list = getZhuList().concat(list3.slice(0, context.num));
						}
					} else if (list === "nozhu") {
						event.list.randomSort();
						list = event.list.slice(0, context.num);
					}
				} else {
					if (event.zhongmode) {
						list = list3.slice(0, 6);
					} else {
						list = getZhuList().concat(list3.slice(0, context.num));
					}
				}
			}
			const buttons = ui.create.div(".buttons");
			const node = _status.event.dialog!.buttons[0].parentNode;
			_status.event.dialog!.buttons = ui.create.buttons(list, "characterx", buttons);
			_status.event.dialog!.content.insertBefore(buttons, node);
			buttons.addTempClass("start");
			(node as HTMLElement).remove();
			game.uncheck();
			game.check();
		});
		delete _status.createControl;
	};
	if (lib.onfree) {
		lib.onfree.push(() => {
			if (round && !round.current()) return;
			event.dialogxx = ui.create.characterDialog("heightset");
			if (ui.cheat2) {
				ui.cheat2.addTempClass("controlpressdownx", 500);
				ui.cheat2.classList.remove("disabled");
			}
		});
	} else {
		event.dialogxx = ui.create.characterDialog("heightset");
	}

	ui.create.cheat2 = () => {
		if (round && !round.current()) return;
		ui.cheat2 = ui.create.control("自由选将", () => {
			if (round && !round.current()) return;
			const control = ui.cheat2;
			if (control!.dialog === _status.event.dialog) {
				if (game.changeCoin) {
					game.changeCoin(10);
				}
				control!.dialog!.close();
				_status.event.dialog = control!.backup;
				control!.backup!.open();
				delete control!.backup;
				game.uncheck();
				game.check();
				if (ui.cheat) {
					ui.cheat.addTempClass("controlpressdownx", 500);
					ui.cheat.classList.remove("disabled");
				}
			} else {
				if (game.changeCoin) {
					game.changeCoin(-10);
				}
				control!.backup = _status.event.dialog;
				_status.event.dialog!.close();
				_status.event.dialog = (_status.event.parent! as IdentitySelectionEvent).dialogxx;
				control!.dialog = _status.event.dialog;
				control!.dialog!.open();
				game.uncheck();
				game.check();
				if (ui.cheat) {
					ui.cheat.classList.add("disabled");
				}
			}
		});
		if (lib.onfree) {
			ui.cheat2.classList.add("disabled");
		}
	};
	if (!_status.brawl || !_status.brawl.chooseCharacterFixed) {
		if (!ui.cheat && get.config("change_choice", undefined)) {
			ui.create.cheat();
		}
		if (!ui.cheat2 && get.config("free_choose", undefined)) {
			ui.create.cheat2();
		}
	}
}
