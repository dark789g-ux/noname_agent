import { _status, lib, get, ui } from "noname";
import { game } from "../index.js";
import type { Game } from "../index.js";

export class GlobalEventHandlers {
	_handlers: Record<string, Record<string, Function[]>> = {};

	getHandler(name: string, type?: string): Function[] | null {
		if (!type) {
			type = this.getDefaultHandlerType(name);
		}
		if (!this._handlers[name]) {
			return null;
		}
		if (!this._handlers[name][type]) {
			return null;
		}
		return this._handlers[name][type];
	}

	ensureHandlerList(name: string, type?: string): Function[] {
		if (!type) {
			type = this.getDefaultHandlerType(name);
		}
		if (!this._handlers[name]) {
			this._handlers[name] = {};
		}
		if (!this._handlers[name][type]) {
			this._handlers[name][type] = [];
		}
		return this._handlers[name][type];
	}

	removeHandler(name: string, type: string | undefined, func: Function): void {
		const list = this.ensureHandlerList(name, type);
		list.remove(func);
		if (list.length == 0) {
			delete this._handlers[name][type || this.getDefaultHandlerType(name)];
			if (Object.keys(this._handlers[name]).length == 0) {
				delete this._handlers[name];
			}
		}
	}

	pushHandler(name: string, type?: string | Function, ...rest: Function[]): void {
		const functions = typeof type == "string" ? rest : type ? [type, ...rest] : rest;
		const resolvedType = typeof type == "string" ? type : this.getDefaultHandlerType(name);
		this.ensureHandlerList(name, resolvedType).addArray(functions);
	}

	getDefaultHandlerType(name: string): string {
		return `on${name[0].toUpperCase()}${name.slice(1)}`;
	}

	addHandlerToEvent(event: GameEvent): void {
		if (typeof event.name != "string") {
			return;
		}
		const handlerMap = this._handlers[event.name];
		if (!handlerMap) {
			return;
		}
		Object.keys(handlerMap).forEach(key => {
			const list = handlerMap[key];
			if (!list) {
				return;
			}
			list.forEach(handler => {
				event.pushHandler(key, handler);
			});
		});
	}
}

export const globalEventAndInitMethods = {
	/**
	 * 当前游戏流程要求本地玩家已经创建时，显式取得该玩家。
	 */
	getMe(this: Game): Player {
		if (!this.me) {
			throw new Error("The local player has not been initialized.");
		}
		return this.me;
	},
	/**
	 * 在指定节点（button）内部创建一个卡片内容区域（.cardsetion），并根据当前结构设置节点状态，用于五谷此类须多人选择的牌的执行过程中显示每张卡牌对应的选择角色
	 */
	createButtonCardsetion(this: Game, innerHTML: string, button: HTMLElement): void {
		const next = ui.create.div(".cardsetion", innerHTML, button);
		next.style.setProperty("display", "block", "important");
		if (!button.querySelector(".info")) {
			button.classList.add("infoflip");
			button.classList.add("infohidden");
		}
	},
	/**
	 * 初始化角色列表
	 *
	 * 仅无参时修改_status.characterlist
	 */
	initCharacterList(this: Game, filter?: boolean): string[] {
		let list: string[];
		if (_status.connectMode) {
			list = get.charactersOL();
		} else {
			list = Object.keys(lib.character).filter(name => !lib.filter.characterDisabled2(name) && !lib.filter.characterDisabled(name));
		}
		if (filter !== false) {
			if (list.length) {
				for (const current of game.filterPlayer2()) {
					list.removeArray(get.nameList(current));
				}
			}
			if (filter === undefined) {
				_status.characterlist = list;
			}
		}
		return list;
	},
};
