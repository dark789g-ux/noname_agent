import { get } from "noname";
import { game } from "noname";
import { _status } from "noname";
import { ui } from "noname";

export function createModeBoss() {
	return {
		name: "挑战",
		config: {
			free_choose: {
				name: "自由选将",
				init: true,
				frequent: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					game.saveConfig("free_choose", bool, this._link.config.mode);
					if (get.mode() != this._link.config.mode || (!_status.event.getParent().showConfig && !_status.event.showConfig)) {
						return;
					}
					if (!ui.cheat2 && get.config("free_choose")) {
						ui.create.cheat2?.();
					} else if (ui.cheat2 && !get.config("free_choose")) {
						ui.cheat2.close();
						delete ui.cheat2;
					}
				},
			},
			change_choice: {
				name: "开启换将卡",
				init: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					game.saveConfig("change_choice", bool, this._link.config.mode);
					if (!_status.event.getParent().showConfig && !_status.event.showConfig) {
						return;
					}
					if (!ui.cheat && get.config("change_choice")) {
						ui.create.cheat?.();
					} else if (ui.cheat && !get.config("change_choice")) {
						ui.cheat.close();
						delete ui.cheat;
					}
				},
				frequent: true,
			},
			single_control: {
				name: "单人控制",
				init: true,
				frequent: true,
				onclick(this: import("@/library/contracts/menu.js").MenuCallbackNode, bool) {
					game.saveConfig("single_control", bool, this._link.config.mode);
					if (ui.single_swap && game.me != game.boss) {
						if (bool) {
							ui.single_swap.style.display = "none";
						} else {
							ui.single_swap.style.display = "";
						}
					}
				},
				intro: "只控制一名角色，其他角色由AI控制",
			},
		},
	};
}
