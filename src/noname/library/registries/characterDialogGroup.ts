/* eslint-disable no-var -- 保留原实现的函数作用域及 arguments 协议。 */
import { get } from "noname";
import { lib } from "noname";

export function createCharacterDialogGroup() {
	return {
		收藏: function (name, capt) {
			return lib.config.favouriteCharacter.includes(name) ? capt : null;
		},
		最近: function (name, capt) {
			var list = get.config("recentCharacter") || [];
			return list.includes(name) ? capt : null;
		},
	};
}
