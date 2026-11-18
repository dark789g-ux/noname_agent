import "../../../../../noname.js";
import "../../../../util/sandbox.js";
import "../../gameEvent.js";
import { AsyncFunction } from "../../../../util/index.js";
import dedent from "../../../../../node_modules/.pnpm/dedent@1.7.1/node_modules/dedent/dist/dedent.js";
import { _status } from "../../../../status/index.js";
import { lib } from "../../../index.js";
import { get } from "../../../../get/binding.js";
import { ai } from "../../../../ai/index.js";
import { ui } from "../../../../ui/index.js";
import { game } from "../../../../game/index.js";
import { security } from "../../../../util/sandbox/security.js";
import compiler from "../../GameEvent/compilers/ContentCompiler.js";
const skillWhenMethods = {
  /**
   * 链式创建一次性的API。
   *
   * 使用者只需关注技能的效果，而不是技能本身
   *
   * @example
   * when('xxx') when([xxx1,xxx2])//均会被解析为：player:xxx或player:[xxx1,xxx2]
   * when({player:xxx})或when({global:[xxx]})//对象类型将直接应用
   */
  when(triggerName, instantlyAdd = true) {
    const player = this;
    if (!_status.postReconnect.player_when) {
      _status.postReconnect.player_when = [
        function(map) {
          "use strict";
          for (let i in map) {
            lib.skill[i] = {
              charlotte: true,
              forced: true,
              popup: false
            };
            if (typeof map[i] == "string") {
              lib.translate[i] = map[i];
            }
          }
        },
        {}
      ];
    }
    let trigger;
    if (Array.isArray(triggerName) || typeof triggerName == "string") {
      trigger = { player: triggerName };
    } else if (get.is.object(triggerName)) {
      trigger = triggerName;
    }
    if (!trigger) {
      throw new Error("player.when传参数类型错误:" + triggerName);
    }
    let skillName;
    do {
      skillName = "player_when_" + Math.random().toString(36).slice(-8);
    } while (lib.skill[skillName] != null);
    const vars = {};
    let eventName = get.event().name ?? "";
    if (eventName.startsWith("pre_")) {
      eventName = eventName.slice(4);
    }
    if (eventName.endsWith("_backup")) {
      eventName = eventName.slice(0, eventName.lastIndexOf("_backup"));
    }
    if (eventName.endsWith("ContentBefore")) {
      eventName = eventName.slice(0, eventName.lastIndexOf("ContentBefore"));
    }
    if (eventName.endsWith("ContentAfter")) {
      eventName = eventName.slice(0, eventName.lastIndexOf("ContentAfter"));
    }
    if (eventName.endsWith("_cost")) {
      eventName = eventName.slice(0, eventName.lastIndexOf("_cost"));
    }
    const sourceSkill = get.sourceSkillFor(eventName);
    let skill = {
      trigger,
      forced: true,
      charlotte: true,
      popup: false,
      // 保证仅发动一次
      triggered: false,
      sourceSkill,
      filterFuns: [
        function() {
          return !lib.requireSkill(skillName).triggered;
        }
      ],
      contentFuns: [],
      // 外部变量
      get vars() {
        return vars;
      },
      get filter() {
        return (event, player2, name) => skill.filterFuns.every((fun) => Boolean(fun(event, player2, name)));
      }
    };
    const warnVars = ["event", "step", "source", "player", "target", "targets", "card", "cards", "skill", "forced", "num", "trigger", "result"];
    const errVars = ["_status", "lib", "game", "ui", "get", "ai"];
    const createContent = () => {
      let varstr = "";
      for (const key in vars) {
        if (warnVars.includes(key)) {
          console.warn(`Variable '${key}' should not be referenced by vars objects`);
        }
        if (errVars.includes(key)) {
          throw new Error(`Variable '${key}' should not be referenced by vars objects`);
        }
        varstr += `var ${key}=lib.skill['${skillName}'].vars['${key}'];
`;
      }
      const originals = [];
      const contents = [];
      const compileStep = (code, scope) => {
        const deconstructs = ["step", "source", "target", "targets", "card", "cards", "skill", "forced", "num", "_result: result"];
        const topVars = ["_status", "lib", "game", "ui", "get", "ai"];
        const params = ["topVars", "event", "trigger", "player"];
        const body = dedent`
					var { ${deconstructs.join(", ")} } = event;
					var { ${topVars.join(", ")} } = topVars;
					${varstr}
					{
						${code}
					}
				`;
        if (!get.isFunctionBody(body)) {
          throw new Error(`无效的函数体: ${body}`);
        }
        let compiled;
        if (!scope) {
          compiled = new Function(...params, body);
        } else {
          compiled = scope(`(function (${params.join(", ")}) {
${body}
})`);
        }
        originals.push(compiled);
        contents.push(function(event, trigger2, player2) {
          return compiled.apply(this, [{ lib, game, ui, get, ai, _status }, event, trigger2, player2]);
        });
      };
      for (let i = 0; i < skill.contentFuns.length; i++) {
        const fun2 = skill.contentFuns[i];
        if (typeof fun2 === "function") {
          originals.push(fun2);
          contents.push(fun2);
        } else {
          const a = fun2;
          const begin = a.indexOf("{") == a.indexOf("}") && a.indexOf("{") == -1 && a.indexOf("=>") > -1 ? a.indexOf("=>") + 2 : a.indexOf("{") + 1;
          const str2 = a.slice(begin, a.lastIndexOf("}") != -1 ? a.lastIndexOf("}") : void 0).trim();
          if (!get.isFunctionBody(str2)) {
            throw new Error("无效的content函数代码");
          }
          let recompiledScope;
          if (security.isSandboxRequired()) {
            recompiledScope = (code) => security.eval(`return (${code.toString()})`);
          } else {
            recompiledScope = eval;
          }
          compileStep(str2, recompiledScope);
        }
      }
      const content = compiler.compile(contents);
      content.original = originals;
      skill.content = content;
    };
    Object.defineProperty(lib.skill, skillName, {
      configurable: true,
      //这类技能不需要被遍历到
      enumerable: false,
      writable: true,
      value: skill
    });
    game.broadcast(function(skillName2) {
      Object.defineProperty(lib.skill, skillName2, {
        configurable: true,
        enumerable: false,
        writable: true,
        value: {
          forced: true,
          charlotte: true,
          popup: false,
          vars: {}
        }
      });
    }, skillName);
    if (instantlyAdd !== false) {
      this.addSkill(skillName);
    }
    _status.postReconnect.player_when[1][skillName] = true;
    const handle = {
      skill: skillName,
      filter(fun) {
        if (lib.skill[skillName] != skill) {
          throw new Error(`This skill has been destroyed`);
        }
        skill.filterFuns.push(fun);
        return this;
      },
      then(fun) {
        if (lib.skill[skillName] != skill) {
          throw new Error(`This skill has been destroyed`);
        }
        if (fun instanceof AsyncFunction) {
          skill.contentFuns.push(fun);
        } else {
          skill.contentFuns.push(String(fun));
        }
        createContent();
        return this;
      },
      /**
       * ```plain
       * 闭包用法的then，不再提供parsex变量，改为使用闭包访问
       * 传参为 event, trigger, player
       * ```
       */
      step(fun) {
        if (lib.skill[skillName] != skill) {
          throw new Error(`This skill has been destroyed`);
        }
        skill.contentFuns.push(fun);
        createContent();
        return this;
      },
      popup(str) {
        if (lib.skill[skillName] != skill) {
          throw new Error(`This skill has been destroyed`);
        }
        if (typeof str == "string") {
          skill.popup = str;
        }
        return this;
      },
      translation(translation) {
        if (lib.skill[skillName] != skill) {
          throw new Error(`This skill has been destroyed`);
        }
        if (typeof translation == "string") {
          _status.postReconnect.player_when[1][skillName] = translation;
          game.broadcastAll((skillName2, translation2) => lib.translate[skillName2] = translation2, skillName, translation);
        }
        return this;
      },
      assign(obj) {
        if (lib.skill[skillName] != skill) {
          throw new Error(`This skill has been destroyed`);
        }
        if (typeof obj == "object" && obj !== null) {
          Object.assign(skill, obj);
          game.broadcast(
            (skillName2, obj2) => {
              Object.assign(lib.skill[skillName2], obj2);
            },
            skillName,
            obj
          );
        }
        return this;
      },
      /**
       * @deprecated
       */
      vars(arg) {
        if (lib.skill[skillName] != skill) {
          throw new Error(`This skill has been destroyed`);
        }
        if (!get.is.object(arg)) {
          throw new Error("vars的第一个参数必须为对象");
        }
        Object.assign(vars, arg);
        createContent();
        return this;
      },
      /**
       * 获得技能
       * 如果instantlyAdd为false，则需要以此法获得技能
       */
      finish() {
        if (lib.skill[skillName] != skill) {
          throw new Error(`This skill has been destroyed`);
        }
        player.addSkill(skillName);
        return this;
      }
    };
    return handle;
  }
};
export {
  skillWhenMethods
};
