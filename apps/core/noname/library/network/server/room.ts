/* eslint-disable no-var, prefer-rest-params -- 保留原实现的函数作用域及 arguments 协议。 */
import { game } from "noname";
import { _status } from "noname";
import { lib } from "noname";
import type { Player } from "@/library/contracts/runtime.js";

export function createMessageServerRoom() {
	return {
		/**
		 * ```plain
		 * 当客机向主机发送投降请求时的回调
		 * ```
		 *
		 * @this {import("@/library/element/client.js").Client}
		 * @param {Player} player
		 */
		giveup(this: import("@/library/element/client.js").Client, player: Player) {
			if (lib.requireNodeServer().observing.includes(this) || !player || !player._giveUp) {
				return;
			}
			var self = lib.playerOL[this.id];
			if (self !== player) {
				return;
			} // 禁止让别人投降
			_status.event.next.length = 0;
			game
				.createEvent("giveup", false)
				.set("includeOut", true)
				.setContent(function () {
					game.log(player, "投降");
					player.popup("投降");
					player.die("nosource").includeOut = true;
				}).player = player;
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		auto(this: import("@/library/element/client.js").Client) {
			if (lib.requireNodeServer().observing.includes(this)) {
				return;
			}
			var player = lib.playerOL[this.id];
			if (player) {
				player.isAuto = true;
				player.setNickname(player.nickname + " - 托管");
				game.broadcast(function (player) {
					player.setNickname(player.nickname + " - 托管");
				}, player);
			}
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		unauto(this: import("@/library/element/client.js").Client) {
			if (lib.requireNodeServer().observing.includes(this)) {
				return;
			}
			var player = lib.playerOL[this.id];
			if (player) {
				player.isAuto = false;
				player.setNickname(player.nickname);
				game.broadcast(function (player) {
					player.setNickname(player.nickname);
				}, player);
			}
		},
		exec(func) {
			// if(typeof func=='function'){
			//     var args=Array.from(arguments);
			//     args.shift();
			//     func.apply(this,args);
			// }
		},
		/**
		 * 用于代替exec进行主机许可的请求喵
		 *
		 * @this {import("@/library/element/client.js").Client}
		 * @param {{ type: string }} subject 请求附带的载荷，必须是对象并且包含类型为字符串的`type`属性喵
		 * @param {string|null} id 本次请求id，如果给出了请求id代表服务器应该进行响应喵
		 */
		dataSync(
			this: import("@/library/element/client.js").Client,
			subject: {
				type: string;
			},
			id: string | null
		) {
			if (lib.requireNodeServer().observing.includes(this)) {
				return;
			}

			void (async () => {
				let ok = false;
				let result: unknown = null;

				try {
					if (!subject || typeof subject !== "object" || typeof subject.type !== "string") {
						return;
					}

					const type = subject.type;
					const requester = lib.playerOL?.[this.id] ?? null;
					let directResult: [boolean, unknown] | undefined | null = null;

					if (!requester) {
						return;
					}

					switch (type) {
						// 如果要增加类型请走这里喵
						case "skill":
							directResult = await game.respondSkillData(id, requester, subject);
							break;
					}

					if (directResult != null) {
						[ok, result] = directResult;
					}
				} finally {
					if (id) {
						this.send("dataReply", { ok, id, result });
					}
				}
			})();
		},
		/**
		 * @this {import("@/library/element/client.js").Client}
		 */
		log(this: import("@/library/element/client.js").Client) {
			var items: unknown[] = [];
			try {
				const sandbox = this.sandbox;
				if (!sandbox) {
					this.send("log", ["err"]);
					return;
				}
				for (var i = 0; i < arguments.length; i++) {
					items.push(sandbox.exec(`return ${arguments[i]}`));
				}
			} catch (e) {
				this.send("log", ["err"]);
				return;
			}
			this.send("log", items);
		},
		/**
		 * 同步主客机的手牌状态
		 *
		 * @this {import("@/library/element/client.js").Client}
		 * @param {string[]} cardid_list 要同步的手牌id序列
		 */
		syncHandcard(this: import("@/library/element/client.js").Client, cardid_list: string[]) {
			if (lib.requireNodeServer().observing.includes(this)) {
				return;
			}

			const player = lib.playerOL[this.id];
			if (!player) {
				return;
			}
			game.syncHandcard(player, cardid_list);
		},
	};
}
