import { ai, game, get, lib, ui, _status } from "noname";
import { security } from "@/util/sandbox.js";
import dedent from "dedent";

const OBJECT_LITERAL_RE =
	/^\{([^{}]+:\s*([^\s,]*|'[^']*'|"[^"]*"|\{[^}]*\}|\[[^\]]*\]|null|undefined|([a-zA-Z$_][a-zA-Z0-9$_]*\s*:\s*)?[a-zA-Z$_][a-zA-Z0-9$_]*\(\)))(?:,\s*([^{}]+:\s*(?:[^\s,]*|'[^']*'|"[^"]*"|\{[^}]*\}|\[[^\]]*\]|null|undefined|([a-zA-Z$_][a-zA-Z0-9$_]*\s*:\s*)?[a-zA-Z$_][a-zA-Z0-9$_]*\(\))))*\}$/;

/** 为控制台指令构建带只读全局注入的 proxyWindow。 */
export function createConsoleProxyWindow(): any {
	let proxyWindow: any = Object.assign({}, window, {
		_status,
		lib,
		game,
		ui,
		get,
		ai,
		cheat: lib.cheat,
	});

	if (security.isSandboxRequired()) {
		const { Monitor, AccessAction } = security.importSandbox();
		new Monitor()
			.action(AccessAction.DEFINE)
			.action(AccessAction.WRITE)
			.action(AccessAction.DELETE)
			.require("target", proxyWindow)
			.require("property", "_status", "lib", "game", "ui", "get", "ai", "cheat")
			.then((access: any, _nameds: any, control: any) => {
				if (access.action === AccessAction.DEFINE) {
					control.preventDefault();
					control.stopPropagation();
					control.setReturnValue(false);
					return;
				}
				control.overrideParameter("target", window);
			})
			.start();
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
		set(target: any, propertyKey: string, value: any, receiver: any) {
			if (typeof propertyKey === "string" && keys.includes(propertyKey)) {
				return Reflect.set(target, propertyKey, value, receiver);
			}
			return Reflect.set(window, propertyKey, value);
		},
	});
	return proxyWindow;
}

/** 创建控制台 JS 表达式求值器（隔离 sandbox / loose 模式）。 */
export function createConsoleEvaluator(proxyWindow: any): (value: string) => any {
	if (security.isSandboxRequired()) {
		return function (value: string) {
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

function escapeHtml(raw: string): string {
	return raw
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function formatObject(obj: any): string {
	if (Array.isArray(obj)) {
		return `[${obj.map((v: any) => formatObject(v)).join(", ")}]`;
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

/** 将 `game.print(...)` 参数格式化为与旧控制台一致的 HTML 片段。 */
export function formatPrintArgs(args: unknown[]): string {
	return args
		.map((arg: any) => {
			if (typeof arg !== "string") {
				if (typeof arg === "function") {
					let argi: string;
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
		})
		.join(" ");
}

type PrintSink = (htmlLine: string) => void;

let activePrintSink: PrintSink | null = null;
let printWrapperInstalled = false;
let originalGamePrint: ((...args: any[]) => void) | null = null;

/**
 * 幂等接管 `game.print`：全局仅包装一次，避免反复切换控制台页签时叠加闭包；
 * 控制台卸载后自动退回原始 `game.print`（写入 `_status.toprint`）。
 */
export function registerConsolePrintSink(sink: PrintSink): () => void {
	if (!printWrapperInstalled) {
		originalGamePrint = game.print;
		game.print = function (...args: any[]) {
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
