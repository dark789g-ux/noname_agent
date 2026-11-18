import type { IdentityPlayerAI } from "../runtimeTypes.js";
import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createIdentityRevealMethods() {
	return {
		/**
		 * 公开当前角色身份，并清理身份猜测交互节点。
		 *
		 * @this { Player }
		 * @returns { void }
		 */
		showIdentity(this: Player) {
			this.node.identity.classList.remove("guessing");
			this.identityShown = true;
			(this.ai as IdentityPlayerAI).shown = 1;
			this.setIdentity();
			if (this.special_identity) {
				(this.node.identity.firstChild as HTMLElement).innerHTML = get.translation(`${this.special_identity}_bg`);
			}
			if (this.identity === "zhu") {
				this.isZhu = true;
			} else {
				delete (this as Partial<Player>).isZhu;
			}
			if (_status.clickingidentity) {
				for (const node of _status.clickingidentity[1]) {
					node.delete();
					node.style.transform = "";
				}
				delete _status.clickingidentity;
			}
		},
	};
}
