import "../../../noname.js";
import { game } from "../index.js";
import { _status } from "../../status/index.js";
import { get } from "../../get/binding.js";
import { lib } from "../../library/index.js";
import { ui } from "../../ui/index.js";
class GlobalEventHandlers {
  _handlers = {};
  getHandler(name, type) {
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
  ensureHandlerList(name, type) {
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
  removeHandler(name, type, func) {
    const list = this.ensureHandlerList(name, type);
    list.remove(func);
    if (list.length == 0) {
      delete this._handlers[name][type || this.getDefaultHandlerType(name)];
      if (Object.keys(this._handlers[name]).length == 0) {
        delete this._handlers[name];
      }
    }
  }
  pushHandler(name, type, ...rest) {
    const functions = typeof type == "string" ? rest : type ? [type, ...rest] : rest;
    const resolvedType = typeof type == "string" ? type : this.getDefaultHandlerType(name);
    this.ensureHandlerList(name, resolvedType).addArray(functions);
  }
  getDefaultHandlerType(name) {
    return `on${name[0].toUpperCase()}${name.slice(1)}`;
  }
  addHandlerToEvent(event) {
    if (typeof event.name != "string") {
      return;
    }
    const handlerMap = this._handlers[event.name];
    if (!handlerMap) {
      return;
    }
    Object.keys(handlerMap).forEach((key) => {
      const list = handlerMap[key];
      if (!list) {
        return;
      }
      list.forEach((handler) => {
        event.pushHandler(key, handler);
      });
    });
  }
}
const globalEventAndInitMethods = {
  /**
   * 当前游戏流程要求本地玩家已经创建时，显式取得该玩家。
   */
  getMe() {
    if (!this.me) {
      throw new Error("The local player has not been initialized.");
    }
    return this.me;
  },
  /**
   * 在指定节点（button）内部创建一个卡片内容区域（.cardsetion），并根据当前结构设置节点状态，用于五谷此类须多人选择的牌的执行过程中显示每张卡牌对应的选择角色
   */
  createButtonCardsetion(innerHTML, button) {
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
  initCharacterList(filter) {
    let list;
    if (_status.connectMode) {
      list = get.charactersOL();
    } else {
      list = Object.keys(lib.character).filter((name) => !lib.filter.characterDisabled2(name) && !lib.filter.characterDisabled(name));
    }
    if (filter !== false) {
      if (list.length) {
        for (const current of game.filterPlayer2()) {
          list.removeArray(get.nameList(current));
        }
      }
      if (filter === void 0) {
        _status.characterlist = list;
      }
    }
    return list;
  }
};
export {
  GlobalEventHandlers,
  globalEventAndInitMethods
};
