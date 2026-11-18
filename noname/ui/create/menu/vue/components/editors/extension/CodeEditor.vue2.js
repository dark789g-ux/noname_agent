import { defineComponent, reactive, openBlock, createElementBlock, createElementVNode, createTextVNode, Fragment, renderList, toDisplayString } from "vue";
import "../../../../../../../../noname.js";
import "../../../../../../../util/sandbox.js";
import { openValidatedCodeEditor, validateNamedObjectCode } from "./makerShared.js";
import { security } from "../../../../../../../util/sandbox/security.js";
import { lib } from "../../../../../../../library/index.js";
import { get } from "../../../../../../../get/binding.js";
const _hoisted_1 = { class: "menu-buttons code-editor" };
const _hoisted_2 = ["onClick"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CodeEditor",
  props: {
    extName: {},
    isNew: { type: Boolean }
  },
  emits: ["back"],
  setup(__props, { expose: __expose }) {
    const content = reactive({});
    const codeItems = reactive([
      {
        short: "辅",
        full: "辅助代码",
        link: "arenaReady",
        defaultCode: "function(){\n    \n}\n\n/*\n函数执行时机为游戏界面创建之后\n导出时本段代码中的换行、缩进以及注释将被清除\n*/"
      },
      {
        short: "主",
        full: "主代码",
        link: "content",
        defaultCode: "function(config,pack){\n    \n}\n\n/*\n函数执行时机为游戏数据加载之后、界面加载之前\n参数1扩展选项（见选项代码）；参数2为扩展定义的武将、卡牌和技能等（可在此函数中修改）\n导出时本段代码中的换行、缩进以及注释将被清除\n*/"
      },
      {
        short: "预",
        full: "预备代码",
        link: "prepare",
        defaultCode: "function(){\n    \n}\n\n/*\n函数执行时机为游戏扩展全部加载之后\n导出时本段代码中的换行、缩进以及注释将被清除\n*/"
      },
      {
        short: "启",
        full: "启动代码",
        link: "precontent",
        defaultCode: "function(config){\n    \n}\n\n/*\n函数执行时机为游戏数据加载之前，联机模式亦可加载\n除添加模式外请慎用\n导出时本段代码中的换行、缩进以及注释将被清除\n*/"
      },
      {
        short: "选",
        full: "选项代码",
        link: "config",
        defaultCode: 'config={\n    \n}\n\n/*\n示例：\nconfig={\n    switcher_example:{\n        name:"示例列表选项",\n        init:"3",\n      	  item:{"1":"一","2":"二","3":"三"}\n    },\n    toggle_example:{\n        name:"示例开关选项",\n        init:true\n    }\n}\n此例中传入的主代码函数的默认参数为{switcher_example:"3",toggle_example:true}\n导出时本段代码中的换行、缩进以及注释将被清除\n*/'
      },
      {
        short: "帮",
        full: "帮助代码",
        link: "help",
        defaultCode: 'help={\n    \n}\n\n/*\n示例：\nhelp={\n    "帮助条目":"<ul><li>列表1-条目1<li>列表1-条目2</ul><ol><li>列表2-条目1<li>列表2-条目2</ul>"\n}\n帮助内容将显示在菜单－选项－帮助中\n导出时本段代码中的换行、缩进以及注释将被清除\n*/'
      }
    ]);
    for (const item of codeItems) {
      content[item.link] = item.defaultCode;
    }
    const FUNCTION_SECTIONS = /* @__PURE__ */ new Set(["arenaReady", "content", "prepare", "precontent"]);
    function onEditCode(item) {
      openValidatedCodeEditor(
        content[item.link] || item.defaultCode,
        (result) => {
          if (FUNCTION_SECTIONS.has(item.link)) {
            const { func } = security.exec2(`func = ${result}`);
            if (typeof func !== "function") {
              throw new Error("代码格式有错误，请对比示例代码仔细检查");
            }
          } else {
            validateNamedObjectCode(item.link, result);
          }
        },
        (result) => {
          content[item.link] = result;
        }
      );
    }
    function reset(name) {
      for (const key in content) delete content[key];
      for (const item of codeItems) {
        content[item.link] = item.defaultCode;
      }
      if (name && lib.extensionPack[name]?.code) {
        const extCode = lib.extensionPack[name].code;
        for (const i in extCode) {
          if (typeof extCode[i] === "function") {
            content[i] = extCode[i].toString();
          } else if (typeof extCode[i] === "object") {
            content[i] = `${i}=${get.stringify(extCode[i])}`;
          }
        }
      }
    }
    __expose({ content, reset });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", {
          class: "config more margin-bottom",
          onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("back"))
        }, [..._cache[1] || (_cache[1] = [
          createElementVNode("div", { style: { "transform": "none", "margin-right": "3px" } }, "←", -1),
          createTextVNode("返回 ", -1)
        ])]),
        (openBlock(true), createElementBlock(Fragment, null, renderList(codeItems, (item) => {
          return openBlock(), createElementBlock("div", {
            key: item.link,
            class: "menubutton large dashboard",
            onClick: ($event) => onEditCode(item)
          }, [
            createElementVNode("div", null, toDisplayString(item.short), 1),
            createElementVNode("div", null, toDisplayString(item.full), 1)
          ], 8, _hoisted_2);
        }), 128))
      ]);
    };
  }
});
export {
  _sfc_main as default
};
