import "../../../../../../../../noname.js";
import "../../../../../../../util/sandbox.js";
import dedent from "../../../../../../../../node_modules/.pnpm/dedent@1.7.1/node_modules/dedent/dist/dedent.js";
import { lib } from "../../../../../../../library/index.js";
import { ai } from "../../../../../../../ai/index.js";
import { get } from "../../../../../../../get/binding.js";
import { ui } from "../../../../../../index.js";
import { game } from "../../../../../../../game/index.js";
import { _status } from "../../../../../../../status/index.js";
import { security } from "../../../../../../../util/sandbox/security.js";
const OBJECT_LITERAL_RE = /^\{([^{}]+:\s*([^\s,]*|'[^']*'|"[^"]*"|\{[^}]*\}|\[[^\]]*\]|null|undefined|([a-zA-Z$_][a-zA-Z0-9$_]*\s*:\s*)?[a-zA-Z$_][a-zA-Z0-9$_]*\(\)))(?:,\s*([^{}]+:\s*(?:[^\s,]*|'[^']*'|"[^"]*"|\{[^}]*\}|\[[^\]]*\]|null|undefined|([a-zA-Z$_][a-zA-Z0-9$_]*\s*:\s*)?[a-zA-Z$_][a-zA-Z0-9$_]*\(\))))*\}$/;
function createConsoleProxyWindow() {
  let proxyWindow = Object.assign({}, window, {
    _status,
    lib,
    game,
    ui,
    get,
    ai,
    cheat: lib.cheat
  });
  if (security.isSandboxRequired()) {
    const { Monitor, AccessAction } = security.importSandbox();
    new Monitor().action(AccessAction.DEFINE).action(AccessAction.WRITE).action(AccessAction.DELETE).require("target", proxyWindow).require("property", "_status", "lib", "game", "ui", "get", "ai", "cheat").then((access, _nameds, control) => {
      if (access.action === AccessAction.DEFINE) {
        control.preventDefault();
        control.stopPropagation();
        control.setReturnValue(false);
        return;
      }
      control.overrideParameter("target", window);
    }).start();
    return proxyWindow;
  }
  const keys = ["_status", "lib", "game", "ui", "get", "ai", "cheat"];
  for (const key of keys) {
    const descriptor = Reflect.getOwnPropertyDescriptor(proxyWindow, key);
    if (!descriptor) continue;
    descriptor.writable = false;
    descriptor.enumerable = true;
    descriptor.configurable = false;
    Reflect.defineProperty(proxyWindow, key, descriptor);
  }
  proxyWindow = new Proxy(proxyWindow, {
    set(target, propertyKey, value, receiver) {
      if (typeof propertyKey === "string" && keys.includes(propertyKey)) {
        return Reflect.set(target, propertyKey, value, receiver);
      }
      return Reflect.set(window, propertyKey, value);
    }
  });
  return proxyWindow;
}
function createConsoleEvaluator(proxyWindow) {
  if (security.isSandboxRequired()) {
    return function(value) {
      const exp = OBJECT_LITERAL_RE.test(value) ? `(${value})` : value;
      const expName = "_" + Math.random().toString().slice(2);
      return security.exec(`return eval(${expName})`, { window: proxyWindow, [expName]: exp });
    };
  }
  return new Function(
    "window",
    dedent`
		const _status=window._status;
		const lib=window.lib;
		const game=window.game;
		const ui=window.ui;
		const get=window.get;
		const ai=window.nonameAI;
		const cheat=window.lib.cheat;
		const reg=${OBJECT_LITERAL_RE};
		return function(value){
			"use strict";
			return eval(reg.test(value)?('('+value+')'):value);
		}
	`
  )(proxyWindow);
}
function escapeHtml(raw) {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatObject(obj) {
  if (Array.isArray(obj)) {
    return `[${obj.map((v) => formatObject(v)).join(", ")}]`;
  }
  if (typeof obj === "function") {
    return typeof obj.name === "string" ? `[Function ${obj.name}]` : "[Function]";
  }
  if (typeof obj !== "string") {
    if (obj instanceof Error) {
      return `<span style="color:red;">${String(obj)}</span>`;
    }
    return String(obj);
  }
  return `'${String(obj)}'`;
}
function formatPrintArgs(args) {
  return args.map((arg) => {
    if (typeof arg !== "string") {
      if (typeof arg === "function") {
        let argi;
        try {
          argi = get.stringify(arg);
          if (argi === "") argi = arg.toString();
        } catch {
          argi = arg.toString();
        }
        return escapeHtml(argi);
      }
      if (typeof arg === "object" && arg !== null) {
        let msg = "";
        for (const name of Object.getOwnPropertyNames(arg)) {
          msg += `${name}: ${formatObject(arg[name])}<br>`;
        }
        return `<details><summary>${formatObject(arg)}</summary>${msg}</details>`;
      }
      return formatObject(arg);
    }
    const str = String(arg);
    if (!/<[a-zA-Z]+[^>]*?\/?>.*?(?=<\/[a-zA-Z]+[^>]*?>|$)/.exec(str)) {
      return escapeHtml(str);
    }
    return str;
  }).join(" ");
}
let activePrintSink = null;
let printWrapperInstalled = false;
let originalGamePrint = null;
function registerConsolePrintSink(sink) {
  if (!printWrapperInstalled) {
    originalGamePrint = game.print;
    game.print = function(...args) {
      if (!activePrintSink) {
        originalGamePrint?.(...args);
        return;
      }
      activePrintSink(formatPrintArgs(args));
    };
    printWrapperInstalled = true;
  }
  activePrintSink = sink;
  return () => {
    if (activePrintSink === sink) {
      activePrintSink = null;
    }
  };
}
export {
  createConsoleEvaluator,
  createConsoleProxyWindow,
  formatPrintArgs,
  registerConsolePrintSink
};
