import { defineComponent, ref, nextTick, onMounted, onUnmounted, openBlock, createElementBlock, createElementVNode, Fragment, renderList, withDirectives, vModelText } from "vue";
import "../../../../../../../../noname.js";
import { createConsoleProxyWindow, createConsoleEvaluator, registerConsolePrintSink } from "./consoleRuntime.js";
import { game } from "../../../../../../../game/index.js";
import { _status } from "../../../../../../../status/index.js";
const _hoisted_1 = { class: "menu-sym command-console" };
const _hoisted_2 = { class: "fullsize" };
const _hoisted_3 = ["innerHTML"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CommandConsole",
  setup(__props) {
    const outputContainerRef = ref();
    const inputRef = ref();
    const commandInput = ref("");
    const outputLines = ref([]);
    const logs = [];
    let logindex = -1;
    let evalCommand = null;
    let unregisterPrint = null;
    function appendOutputLine(htmlLine) {
      outputLines.value.push(htmlLine);
      nextTick(() => {
        if (outputContainerRef.value) {
          outputContainerRef.value.scrollTop = outputContainerRef.value.scrollHeight;
        }
      });
    }
    function stepHistory(direction) {
      if (direction === "up") {
        commandInput.value = logindex + 1 < logs.length ? logs[++logindex] : "";
        return;
      }
      if (logindex >= 0) {
        logindex--;
        commandInput.value = logindex < 0 ? "" : logs[logindex];
      } else {
        commandInput.value = "";
      }
    }
    function runCommand() {
      const raw = commandInput.value;
      if (raw && !["up", "down"].includes(raw)) {
        logindex = -1;
        logs.unshift(raw);
      }
      if (raw === "cls") {
        outputLines.value = [];
        commandInput.value = "";
        return;
      }
      if (raw === "up" || raw === "down") {
        stepHistory(raw);
        return;
      }
      if (raw.includes("无天使") && (raw.includes("无神佛") || raw.includes("无神") && raw.includes("无佛"))) {
        game.print("密码正确！欢迎来到死后世界战线！");
        _status.keyVerified = true;
        commandInput.value = "";
        return;
      }
      if (!game.observe && !game.online && evalCommand) {
        try {
          let value = raw.trim();
          if (value.endsWith(";")) {
            value = value.slice(0, -1).trim();
          }
          game.print(evalCommand(value));
        } catch (e) {
          game.print(e);
        }
      }
      commandInput.value = "";
    }
    function clearOutput() {
      outputLines.value = [];
    }
    function onKeydown(e) {
      if (e.key === "Enter") {
        runCommand();
      } else if (e.key === "ArrowUp") {
        stepHistory("up");
      } else if (e.key === "ArrowDown") {
        stepHistory("down");
      }
    }
    onMounted(() => {
      const proxyWindow = createConsoleProxyWindow();
      evalCommand = createConsoleEvaluator(proxyWindow);
      unregisterPrint = registerConsolePrintSink(appendOutputLine);
      if (_status.toprint) {
        for (const args of _status.toprint) {
          game.print(...args);
        }
        delete _status.toprint;
      }
      if (typeof window.noname_shijianInterfaces?.showDevTools === "function") {
        game.print("点击以下按钮\n将开启诗笺版内置的控制台");
        game.print(
          "<button onclick='window.noname_shijianInterfaces.showDevTools();'>开启DevTools</button>"
        );
      }
    });
    onUnmounted(() => {
      unregisterPrint?.();
      unregisterPrint = null;
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode("div", {
          ref_key: "outputContainerRef",
          ref: outputContainerRef,
          class: "command-output"
        }, [
          createElementVNode("pre", _hoisted_2, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(outputLines.value, (line, idx) => {
              return openBlock(), createElementBlock(Fragment, { key: idx }, [
                createElementVNode("span", { innerHTML: line }, null, 8, _hoisted_3),
                _cache[1] || (_cache[1] = createElementVNode("br", null, null, -1))
              ], 64);
            }), 128))
          ])
        ], 512),
        withDirectives(createElementVNode("input", {
          ref_key: "inputRef",
          ref: inputRef,
          "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => commandInput.value = $event),
          type: "text",
          class: "command-input",
          onKeydown
        }, null, 544), [
          [vModelText, commandInput.value]
        ]),
        createElementVNode("div", {
          class: "menubutton round highlight command-float-btn run-btn",
          onClick: runCommand
        }, "执"),
        createElementVNode("div", {
          class: "menubutton round highlight command-float-btn clear-btn",
          onClick: clearOutput
        }, "清")
      ]);
    };
  }
});
export {
  _sfc_main as default
};
