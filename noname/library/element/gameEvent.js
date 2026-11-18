import "../../../noname.js";
import compiler from "./GameEvent/compilers/ContentCompiler.js";
import { default as default2 } from "./GameEvent/GameEventManager.js";
import { installEventMethods } from "./GameEvent/installEventMethods.js";
import "./GameEvent/eventMethodsContract.js";
import { triggerMethods } from "./GameEvent/triggerMethods.js";
import { selectionMethods } from "./GameEvent/selectionMethods.js";
import { promiseMethods } from "./GameEvent/promiseMethods.js";
import { handlersMethods } from "./GameEvent/handlersMethods.js";
import { stateMethods } from "./GameEvent/stateMethods.js";
import { initializeEvent } from "./GameEvent/initializeEvent.js";
import { _status } from "../../status/index.js";
import { game } from "../../game/index.js";
import { lib } from "../index.js";
class GameEvent {
  constructor(name = "", trigger = true, manager = _status.eventManager) {
    if (name instanceof GameEvent) {
      const other = name;
      name = other.name;
      manager = other.manager;
      trigger = other._triggered !== null;
    }
    this.name = name;
    this.manager = manager;
    if (trigger && !game.online) {
      this._triggered = 0;
    }
    game.globalEventHandlers.addHandlerToEvent(this);
  }
  static initialGameEvent() {
    const event = new GameEvent();
    event.finish();
    return event;
  }
  get [Symbol.toStringTag]() {
    return "GameEvent";
  }
  name;
  /** A DOM transition listener used by the guhuo animation paths. */
  onEnd01;
  /** Parent override supplied by the online send/receive path. */
  _modparent;
  _cancelled;
  _neutralize_event;
  isSkipped;
  numFixed;
  _rand_map;
  _rand;
  _args = [];
  _set = [];
  set(key, value) {
    if (Array.isArray(key)) {
      for (let i = 0; i < key.length; i++) {
        if (Array.isArray(key[i])) {
          this.setRaw(key[i][0], key[i][1]);
        }
      }
    } else {
      if (typeof key != "string") {
        console.log("warning: using non-string object as event key");
        console.log(key, value);
        console.log(_status.event);
      }
      this.setRaw(key, value);
    }
    return this;
  }
  setRaw(key, value) {
    Object.assign(this, { [key]: value });
    this._set.push([key, value]);
  }
  content;
  setContent(content) {
    if (this.#inContent) {
      throw new Error("Cannot set content when content is running");
    }
    if (typeof content === "string") {
      this.content = compiler.compile(content);
    } else if ("compiled" in content && content.compiled) {
      this.content = compiler.compile(content);
    } else {
      this.content = compiler.compile(content, this);
    }
    return this;
  }
  /**
   * 事件的返回值
   */
  result;
  cost_data;
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then(onfulfilled, onrejected) {
    return (this.parent ? this.parent.waitNext().then(() => void 0) : this.start()).then(onfulfilled, onrejected);
  }
  manager;
  parent;
  childEvents = [];
  next = (() => {
    const event = this;
    return new Proxy([], {
      set(target, p, childEvent, receiver) {
        if (childEvent instanceof GameEvent && !target.includes(childEvent)) {
          childEvent.parent = event;
          const type = childEvent.getDefaultNextHandlerType();
          if (type) {
            childEvent.pushHandlersFrom(type, event.getHandler(type));
          }
          if (event.#inContent && event.finished) {
            childEvent.resolve();
          }
        }
        return Reflect.set(target, p, childEvent);
      }
    });
  })();
  after = [];
  insert(content, map) {
    const next = new GameEvent(`${this.name}Inserted`, false, this.manager);
    this.next.push(next);
    if (typeof content === "string") {
      next.setContent(content);
    } else if ("compiled" in content && content.compiled) {
      next.setContent(content);
    } else {
      next.setContent(content);
    }
    for (const [key, value] of Object.entries(map)) {
      next.setRaw(key, value);
    }
    return next;
  }
  insertAfter(content, map) {
    const next = new GameEvent(`${this.name}Inserted`, false, this.manager);
    this.after.push(next);
    if (typeof content === "string") {
      next.setContent(content);
    } else if ("compiled" in content && content.compiled) {
      next.setContent(content);
    } else {
      next.setContent(content);
    }
    for (const [key, value] of Object.entries(map)) {
      next.setRaw(key, value);
    }
    return next;
  }
  _trigger;
  triggername;
  _triggered = null;
  #start;
  resolve() {
    if (!this.#start) {
      this.#start = Promise.resolve();
    }
  }
  start() {
    if (this.#start) {
      return this.#start;
    }
    this.#start = (async () => {
      if (this.parent) {
        this.parent.childEvents.push(this);
      }
      game.getGlobalHistory("everything").push(this);
      this.manager.setStatusEvent(this, true);
      await this.loop().then(() => {
        this.manager.popStatusEvent();
      });
    })();
    return this.#start;
  }
  async loop() {
    const trigger = async (trigger2, to) => {
      this._triggered = to;
      if (this.type == "card") {
        await this.trigger("useCardTo" + trigger2);
      }
      await this.trigger(this.name + trigger2);
    };
    if (await this.checkSkipped()) {
      return;
    }
    while (true) {
      await this.waitNext();
      if (!this.finished) {
        if (this._triggered === 0) {
          await trigger("Before", 1);
        } else if (this._triggered === 1) {
          await trigger("Begin", 2);
        } else {
          this.#inContent = true;
          let next = this.content(this).catch((error) => {
            if (lib.config.ignore_error || _status.connectMode && !lib.config.debug) {
              game.print("游戏出错：" + this.name);
              game.print(error.toString());
              console.error(error);
            } else {
              throw error;
            }
          });
          await next.finally(() => this.#inContent = false);
        }
      } else {
        if (this._triggered === 1) {
          await trigger("Omitted", 4);
        } else if (this._triggered === 2) {
          await trigger("End", 3);
        } else if (this._triggered === 3) {
          await trigger("After", 4);
        } else if (this.after.length) {
          this.next.push(this.after.shift());
        } else {
          return;
        }
      }
    }
  }
  #waitNext;
  waitNext() {
    if (this.#waitNext) {
      return this.#waitNext;
    }
    this.#waitNext = (async () => {
      let result;
      while (true) {
        await _status.pauseManager.waitPause();
        if (this.manager.tempEvent) {
          if (this.manager.tempEvent === this) {
            this.manager.tempEvent = void 0;
          } else {
            this.cancel(true, null, "notrigger");
            return result;
          }
        }
        if (!this.next.length) {
          return result;
        }
        const next = this.next[0];
        await next.start();
        if (next.result) {
          result = next.result;
        }
        this.next.shift();
      }
    })().finally(() => this.#waitNext = void 0);
    return this.#waitNext;
  }
  doingList;
  playerMap;
  /**
   * 当前执行的arrangeTrigger事件
   */
  _triggering;
  // This callback is invoked through an event instance.  Its receiver can be
  // any executable event; tying it to this class's numeric value-domain would
  // make otherwise identical GameEvent<N> instances invariant in N.
  filterStop;
  notrigger;
  _notrigger = [];
  /**
   * content执行中的标志，如果inContent && finished则不执行子事件
   */
  #inContent = false;
  finished = false;
  // @todo
  _neutralized = false;
  #step = 0;
  #nextStep = null;
  /**
   * 最后一个子事件的result
   */
  _result = {};
  get step() {
    return this.#step;
  }
  set step(num) {
    this.#nextStep = num;
  }
  updateStep() {
    if (this.#nextStep === null) {
      return;
    }
    this.#step = this.#nextStep;
    this.#nextStep = null;
  }
  custom = {
    add: {},
    replace: {}
  };
  type;
  source;
  player;
  players;
  target;
  targets;
  card;
  cards;
  skill;
  forced;
  /** Every event accepts numeric counts; N adds documented non-numeric count forms. */
  num;
  original_num;
  directHit;
  baseDamage;
  extraDamage;
  customSource;
  nature;
  unreal;
  responded;
  judgestr;
  judging;
  judge2;
  orderingCards;
  ai;
  _aiexclude = [];
  forceDie;
  includeOut;
  targetprompt2 = [];
  pushHandler(...args) {
    const first = args[0];
    const handlers = this.getHandler(typeof first == "string" ? first : this.getDefaultHandlerType());
    if (!Array.isArray(handlers)) {
      throw new TypeError("Event handler did not normalize to an array");
    }
    return handlers.push(...typeof first == "string" ? args.slice(1) : args);
  }
  pushHandlersFrom(type, handlers) {
    const target = this.getHandler(type);
    if (!Array.isArray(target) || !Array.isArray(handlers)) {
      throw new TypeError("Event handler did not normalize to an array");
    }
    return target.push(...handlers);
  }
  _oncancel;
  excludeButton;
}
installEventMethods(GameEvent.prototype, [triggerMethods, selectionMethods, promiseMethods, handlersMethods, stateMethods]);
export {
  compiler as ContentCompiler,
  GameEvent,
  default2 as GameEventManager,
  initializeEvent
};
