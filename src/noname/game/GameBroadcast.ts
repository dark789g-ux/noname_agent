import { game, lib } from "noname";
import type { Library } from "../library/index.js";

type ClientMessage = Library["message"]["client"];
type ClientMessageName = keyof ClientMessage;
type ClientMessageArgs<TName extends ClientMessageName> = ClientMessage[TName] extends (...args: infer TArgs) => unknown ? TArgs : never;

export class GameBroadcast {
	/**
	 * 向所有联机客户端广播并执行指定函数，同时在主机上执行相同函数。
	 * 联机场景中，函数体不得引用函数块外的局部变量或闭包；需要的数据须通过 `args` 显式传入。
	 */
	broadcastAll<TName extends ClientMessageName>(func: TName, ...args: ClientMessageArgs<TName>): void;
	broadcastAll<TArgs extends unknown[]>(func: (...args: TArgs) => unknown, ...args: TArgs): void;
	broadcastAll(func: ClientMessageName | ((...args: never[]) => unknown), ...args: unknown[]): void {
		if (game.online) {
			return;
		}
		Reflect.apply(game.broadcast, game, [func, ...args]);
		const handler = typeof func === "string" ? lib.message.client[func] : func;
		if (typeof handler === "function") {
			Reflect.apply(handler, undefined, args);
		}
	}
}
