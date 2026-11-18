import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";
import type { IdentitySelectionEvent, SelectionContext } from "../contracts.js";

export function createSettings(context: SelectionContext) {
	const { event, stratagemMode } = context;
	const round = event.selectionRound;
	const addSetting = dialog => {
		dialog.add("选择身份").classList.add("add-setting");
		const table = document.createElement("div");
		table.classList.add("add-setting");
		table.style.margin = "0";
		table.style.width = "100%";
		table.style.position = "relative";
		let identityChoices;
		let seats;
		if (event.zhongmode) {
			identityChoices = ["random", "zhu", "mingzhong", "zhong", "fan", "nei"];
		} else {
			identityChoices = ["random", "zhu", "zhong", "fan", "nei"];
			if (get.config("enable_commoner", undefined) && !event.stratagemMode) {
				identityChoices.push("commoner");
			}
		}

		for (const identity of identityChoices) {
			const td = Object.assign(ui.create.div(".shadowed.reduce_radius.pointerdiv.tdnode"), { link: identity });
			if (td.link === game.me!.identity) {
				td.classList.add("bluebg");
			}
			table.appendChild(td);
			td.innerHTML = `<span>${get.translation(`${identity}2`)}</span>`;
			td.addEventListener(lib.config.touchscreen ? "touchend" : "click", e => {
				if (round && !round.current()) return;
				const selection = round ? event : (_status.event.parent as IdentitySelectionEvent);
				const target = e.currentTarget as HTMLDivElement & { link: string; parentNode: HTMLElement };
				if (_status.dragged) {
					return;
				}
				if (_status.justdragged) {
					return;
				}
				_status.tempNoButton = true;
				setTimeout(() => {
					_status.tempNoButton = false;
				}, 500);
				let link = target!.link;
				if (game.zhu) {
					if (link !== "random") {
						selection!.fixedseat = get.distance(game.me, game.zhu, "absolute");
					}
					if (game.zhu.name) {
						game.zhu.uninit();
					}
					delete (game.zhu as Partial<Player>).isZhu;
					delete (game.zhu as Partial<Player>).identityShown;
				}
				let current = target!.parentNode.querySelector(".bluebg");
				if (current) {
					current.classList.remove("bluebg");
				}
				current = _status.cheat_seat || seats.querySelector(".bluebg");
				if (current) {
					current.classList.remove("bluebg");
				}
				if (link === "random") {
					if (event.zhongmode) {
						link = ["zhu", "zhong", "nei", "fan", "mingzhong"].randomGet();
					} else {
						const randomIdentities = ["zhu", "zhong", "nei", "fan"];
						if (get.config("enable_commoner", undefined) && !event.stratagemMode) {
							randomIdentities.push("commoner");
						}
						link = randomIdentities.randomGet();
					}
					for (const identityNode of target!.parentNode.childNodes as NodeListOf<HTMLDivElement & { link: string }>) {
						if (identityNode.link === link) {
							identityNode.classList.add("bluebg");
						}
					}
				} else {
					target!.classList.add("bluebg");
				}
				context.num = get.config(`choice_${link}`, undefined);
				if (event.zhongmode) {
					context.num = 6;
					if (link === "zhu" || link === "nei" || link === "mingzhong") {
						context.num = 8;
					}
				}
				selection!.swapnodialog = (dialog, list) => {
					const buttons = ui.create.div(".buttons");
					const node = dialog.buttons[0].parentNode;
					dialog.buttons = ui.create.buttons(list, "characterx", buttons);
					dialog.content.insertBefore(buttons, node);
					buttons.addTempClass("start");
					(node as HTMLElement).remove();
					game.uncheck();
					game.check();
					if (event.stratagemMode) {
						return;
					}
					for (const seatNode of seats.childNodes) {
						if (get.distance(game.zhu, game.me, "absolute") === seatNode.link) {
							seatNode.classList.add("bluebg");
						}
					}
				};
				if (round) {
					event.identity = link;
					round.restart();
				} else {
					_status.event = _status.event.parent! as IdentitySelectionEvent;
					_status.event.step = 0;
					(_status.event as IdentitySelectionEvent).identity = link;
				}
				if (ui.selected.buttons.length > 0) {
					ui.selected.buttons.forEach(button => {
						if (button && button.parentNode) {
							button.classList.remove("selected");
						}
					});
					ui.selected.buttons.length = 0;
				}
				if (!event.stratagemMode) {
					const zhuIdentity = event.zhongmode ? "mingzhong" : "zhu";
					if (link === zhuIdentity) {
						seats.previousSibling.style.display = "none";
						seats.style.display = "none";
					} else {
						seats.previousSibling.style.display = "";
						seats.style.display = "";
					}
				}
				game.resume();
			});
		}
		dialog.content.appendChild(table);

		dialog.add("选择座位").classList.add("add-setting");
		seats = document.createElement("div");
		seats.classList.add("add-setting");
		seats.style.margin = "0";
		seats.style.width = "100%";
		seats.style.position = "relative";
		const firstSeat = stratagemMode ? 1 : 2;
		for (let seatNumber = firstSeat; seatNumber <= game.players.length; seatNumber++) {
			const td = Object.assign(ui.create.div(".shadowed.reduce_radius.pointerdiv.tdnode"), { link: seatNumber - 1 });
			td.innerHTML = get.cnNumber(seatNumber, true) as string;
			seats.appendChild(td);
			if (!stratagemMode && get.distance(game.zhu, game.me, "absolute") === seatNumber - 1) {
				td.classList.add("bluebg");
			}
			td.addEventListener(lib.config.touchscreen ? "touchend" : "click", e => {
				if (round && !round.current()) return;
				const target = e.currentTarget as HTMLDivElement & { link: number; parentNode: HTMLElement };
				if (_status.dragged) {
					return;
				}
				if (_status.justdragged) {
					return;
				}
				if (_status.cheat_seat) {
					_status.cheat_seat.classList.remove("bluebg");
					if (_status.cheat_seat === target) {
						delete _status.cheat_seat;
						return;
					}
				}
				if (stratagemMode) {
					target!.classList.add("bluebg");
					_status.cheat_seat = target;
					return;
				}
				if (get.distance(game.zhu, game.me, "absolute") === target!.link) {
					return;
				}
				const current = target!.parentNode.querySelector(".bluebg");
				if (current) {
					current.classList.remove("bluebg");
				}
				target!.classList.add("bluebg");
				for (const currentPlayer of game.players) {
					if (get.distance(currentPlayer, game.me, "absolute") === target!.link) {
						game.swapSeat(game.zhu, currentPlayer, false);
						return;
					}
				}
			});
		}
		dialog.content.appendChild(seats);
		if (!stratagemMode && game.me === game.zhu) {
			seats.previousSibling.style.display = "none";
			seats.style.display = "none";
		}

		dialog.add(ui.create.div(".placeholder.add-setting"));
		dialog.add(ui.create.div(".placeholder.add-setting"));
		if (get.is.phoneLayout()) {
			dialog.add(ui.create.div(".placeholder.add-setting"));
		}
	};
	const removeSetting = () => {
		const dialog = _status.event.dialog;
		if (!dialog) {
			return;
		}
		dialog.style.height = "";
		delete dialog._scrollset;
		const settingNodes = Array.from(dialog.querySelectorAll(".add-setting"));
		while (settingNodes.length) {
			settingNodes.shift()!.remove();
		}
		ui.update();
	};
	return { addSetting, removeSetting };
}
