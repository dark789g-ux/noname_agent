import { defineComponent, toRaw, computed, ref, watch, onMounted, withDirectives, openBlock, createElementBlock, normalizeStyle, normalizeClass, createElementVNode, toDisplayString, vShow, createVNode } from "vue";
import "../../../../../../noname.js";
import { doMenuItem, doToggle } from "../utils/configInteract.js";
import { closePopup, openPopup, setNoclose } from "../utils/popupHost.js";
import "./NonameToggle.vue.js";
import { initLLMTextInput } from "../../../../../llm/config-input.js";
import { ui } from "../../../../index.js";
import { lib } from "../../../../../library/index.js";
import { get } from "../../../../../get/binding.js";
import { game } from "../../../../../game/index.js";
import { _status } from "../../../../../status/index.js";
import _sfc_main$1 from "./NonameToggle.vue2.js";
const _hoisted_1 = {
  key: 1,
  class: "config"
};
const _hoisted_2 = { class: "config-choosing" };
const _hoisted_3 = {
  key: 3,
  class: "config"
};
const _hoisted_4 = ["contenteditable", "data-placeholder"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "NonameConfig",
  props: {
    config: {}
  },
  setup(__props) {
    const props = __props;
    if (props.config.item && typeof props.config.item == "function") {
      toRaw(props.config).item = props.config.item();
    }
    const isClear = computed(() => !!props.config.clear);
    const isArrayInitSwitcher = computed(() => !!props.config.item && Array.isArray(props.config.init));
    const isSwitcher = computed(() => {
      if (!props.config.item) return false;
      if (Array.isArray(props.config.init)) return false;
      return true;
    });
    const isRange = computed(() => {
      return !!props.config.range;
    });
    const isInput = computed(() => !!props.config.input);
    const isVisible = computed(() => !props.config._hidden);
    const isToggleOn = computed(() => props.config.init === true);
    const choosingText = computed(() => {
      var init = props.config.init;
      var item = props.config.item;
      if (item && typeof item === "object" && init !== void 0) {
        return item[init] || init;
      }
      return String(init);
    });
    const clearStyle = computed(() => {
      if (props.config.name && props.config.name.length >= 2) {
        return { height: "auto" };
      }
      return {};
    });
    const configNodeRef = ref();
    const inputRef = ref();
    const popupMenuEl = ref(null);
    watch(
      () => props.config.item,
      () => {
        if (popupMenuEl.value?.isConnected) {
          closePopup();
        }
        popupMenuEl.value = null;
      },
      { deep: true }
    );
    function handleSwitcherClick() {
      var nodeEl = configNodeRef.value;
      if (!nodeEl) return;
      if (nodeEl.classList.contains("disabled")) return;
      nodeEl.classList.add("on");
      if (!popupMenuEl.value) {
        popupMenuEl.value = ui.create.div(".menu");
        var config = props.config;
        if (config.visualMenu) {
          buildVisualMenu(popupMenuEl.value, config, nodeEl);
        } else {
          buildTextMenu(popupMenuEl.value, config, nodeEl);
        }
        popupMenuEl.value._link = nodeEl;
      }
      var pos1 = nodeEl.lastChild.getBoundingClientRect();
      var pos2 = ui.window.getBoundingClientRect();
      var clientX = pos1.left + pos1.width + 5 - pos2.left;
      var clientY = pos1.top - pos2.top;
      if (popupMenuEl.value.classList.contains("visual")) {
        openPopup(popupMenuEl.value, clientX, clientY, () => {
          nodeEl.classList.remove("on");
        });
      } else if (popupMenuEl.value.childElementCount > 10) {
        clientY = Math.min((ui.window.offsetHeight - 400) / 2, pos1.top - pos2.top);
        lib.setScroll(popupMenuEl.value);
        openPopup(popupMenuEl.value, clientX, clientY, () => {
          nodeEl.classList.remove("on");
        });
      } else {
        openPopup(popupMenuEl.value, clientX, clientY, () => {
          nodeEl.classList.remove("on");
        });
      }
    }
    function buildVisualMenu(menu, config, configNodeEl) {
      menu.classList.add("visual");
      var updateVisual = function() {
        config.visualMenu(this, this._link, config.item[this._link] || this._link, config);
      };
      var createNode = function(i2, before) {
        var visualMenu = ui.create.div();
        if (config.visualBar) {
          if (before) {
            menu.insertBefore(visualMenu, before);
          } else {
            menu.insertBefore(visualMenu, menu.lastChild);
          }
        } else {
          menu.appendChild(visualMenu);
        }
        ui.create.div(".name", get.verticalStr(config.item[i2] || i2), visualMenu);
        visualMenu._link = i2;
        if (config.visualMenu(visualMenu, i2, config.item[i2] || i2, config) !== false) {
          visualMenu.listen(function clickMenuItem() {
            doMenuItem(configNodeEl, this, config);
            closePopup();
          });
        }
        visualMenu.update = updateVisual;
      };
      if (config.visualBar) {
        var visualBar = ui.create.div(menu, function() {
          setNoclose();
        });
        menu.classList.add("withbar");
        config.visualBar(visualBar, config.item, createNode, configNodeEl);
        visualBar.update = function() {
          config.visualBar(visualBar, config.item, createNode, configNodeEl);
        };
      }
      for (var i in config.item) {
        createNode(i);
      }
      lib.setScroll(menu);
      menu.updateBr = function() {
        updateBr(menu);
      };
      menu.updateBr();
    }
    function buildTextMenu(menu, config, configNodeEl) {
      for (var i in config.item) {
        var textMenu = ui.create.div("", config.item[i] || i, menu, function clickMenuItem() {
          doMenuItem(configNodeEl, this, config);
          closePopup();
        });
        textMenu._link = i;
        if (config.textMenu) {
          config.textMenu(textMenu, i, config.item[i] || i, config);
        }
        lib.setScroll(menu);
      }
    }
    function updateBr(menu) {
      var brs = Array.from(menu.querySelectorAll(".menu.visual>br"));
      while (brs.length) {
        brs.shift().remove();
      }
      var split = [];
      for (var i = 1; i < menu.childElementCount; i++) {
        if (i % 3 == 0) {
          split.push(menu.childNodes[i]);
        }
      }
      for (var i = 0; i < split.length; i++) {
        menu.insertBefore(ui.create.node("br"), split[i]);
      }
    }
    function handleToggleClick() {
      var nodeEl = configNodeRef.value;
      if (!nodeEl) return;
      doToggle(nodeEl, props.config);
    }
    function handleClearClick() {
      var nodeEl = configNodeRef.value;
      if (!nodeEl) return;
      doToggle(nodeEl, props.config);
    }
    function handleInputKeydown(e) {
      if (e.key == "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.target.blur();
      }
    }
    function initInputOnblur(input, config) {
      if (config.name == "联机昵称") {
        input.innerHTML = config.init || "无名玩家";
        input.onblur = function() {
          input.innerHTML = input.innerHTML.replace(/<br>/g, "");
          if (!input.innerHTML || get.is.banWords(input.innerHTML)) {
            input.innerHTML = "无名玩家";
          }
          input.innerHTML = input.innerHTML.slice(0, 12);
          game.saveConfig("connect_nickname", input.innerHTML);
          game.saveConfig("connect_nickname", input.innerHTML, "connect");
        };
      } else if (config.name == "联机头像") {
        var currentId = lib.config.connect_avatar || config.init || "caocao";
        input.innerHTML = lib.translate[currentId] || "曹操";
        input.onblur = config.onblur;
      } else if (config.name == "联机大厅") {
        input.innerHTML = config.init || lib.hallURL;
        input.onblur = function() {
          if (!input.innerHTML) {
            input.innerHTML = lib.hallURL;
          }
          input.innerHTML = input.innerHTML.replace(/<br>/g, "");
          game.saveConfig("hall_ip", input.innerHTML, "connect");
        };
      } else {
        const plainText = initLLMTextInput(input, config);
        if (!plainText) input.innerHTML = config.init;
        const onblur = config.onblur;
        input.onblur = function(event) {
          onblur?.call(this, event);
          config.init = plainText ? input.textContent ?? "" : input.innerHTML;
        };
      }
    }
    onMounted(() => {
      var config = props.config;
      if (!config.clear) {
        if (config.name != "开启") {
          if (config.name == "屏蔽弱将") {
            config.intro = "强度过低的武将（孙策除外）不会出现在选将框，也不会被AI选择";
          } else if (config.name == "屏蔽强将") {
            config.intro = "强度过高的武将不会出现在选将框，也不会被AI选择";
          } else if (!config.intro) {
            config.intro = "设置" + config.name;
          }
        }
        var introTarget = configNodeRef.value;
        if (introTarget) {
          lib.setIntro(introTarget, function(uiintro) {
            if (lib.config.touchscreen) {
              _status.dragged = true;
            }
            uiintro.style.width = "170px";
            var str = config.intro;
            if (typeof str == "function") {
              str = str();
            }
            uiintro._place_text = uiintro.add('<div class="text" style="display:inline">' + str + "</div>");
          });
        }
      }
      if (config.input && inputRef.value) {
        var input = inputRef.value;
        if (!config.fixed) {
          input.contentEditable = "true";
          input.style.webkitUserSelect = "text";
        }
        initInputOnblur(input, config);
      }
      if (!config.item && !config.input && !config.clear) {
        if (!config.range) {
        }
      }
    });
    return (_ctx, _cache) => {
      return isClear.value ? withDirectives((openBlock(), createElementBlock("div", {
        key: 0,
        ref_key: "configNodeRef",
        ref: configNodeRef,
        class: normalizeClass(["config", { pointerspan: !__props.config.nopointer }]),
        style: normalizeStyle(clearStyle.value),
        onClick: handleClearClick
      }, [
        createElementVNode("span", null, toDisplayString(__props.config.name), 1)
      ], 6)), [
        [vShow, isVisible.value]
      ]) : isArrayInitSwitcher.value ? withDirectives((openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("span", null, toDisplayString(__props.config.name), 1)
      ], 512)), [
        [vShow, isVisible.value]
      ]) : isSwitcher.value ? withDirectives((openBlock(), createElementBlock("div", {
        key: 2,
        ref_key: "configNodeRef",
        ref: configNodeRef,
        class: "config switcher",
        onClick: handleSwitcherClick
      }, [
        createElementVNode("span", null, toDisplayString(__props.config.name), 1),
        createElementVNode("div", _hoisted_2, toDisplayString(choosingText.value), 1)
      ], 512)), [
        [vShow, isVisible.value]
      ]) : isRange.value ? withDirectives((openBlock(), createElementBlock("div", _hoisted_3, [
        createElementVNode("span", null, toDisplayString(__props.config.name), 1)
      ], 512)), [
        [vShow, isVisible.value]
      ]) : isInput.value ? withDirectives((openBlock(), createElementBlock("div", {
        key: 4,
        ref_key: "configNodeRef",
        ref: configNodeRef,
        class: "config switcher"
      }, [
        createElementVNode("span", null, toDisplayString(__props.config.name), 1),
        createElementVNode("div", {
          ref_key: "inputRef",
          ref: inputRef,
          contenteditable: !__props.config.fixed ? "true" : void 0,
          "data-placeholder": __props.config.name,
          class: "config-input",
          onKeydown: handleInputKeydown
        }, null, 40, _hoisted_4)
      ], 512)), [
        [vShow, isVisible.value]
      ]) : withDirectives((openBlock(), createElementBlock("div", {
        key: 5,
        ref_key: "configNodeRef",
        ref: configNodeRef,
        class: normalizeClass(["config toggle", { on: isToggleOn.value }]),
        onClick: handleToggleClick
      }, [
        createElementVNode("span", null, toDisplayString(__props.config.name), 1),
        createVNode(_sfc_main$1)
      ], 2)), [
        [vShow, isVisible.value]
      ]);
    };
  }
});
export {
  _sfc_main as default
};
