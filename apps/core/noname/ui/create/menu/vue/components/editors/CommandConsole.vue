<template>
	<div class="menu-sym command-console">
		<!-- 输出区域（对应旧版 text + pre） -->
		<div
			ref="outputContainerRef"
			class="command-output"
		>
			<pre ref="preRef" class="fullsize"></pre>
		</div>

		<!-- 输入框（对应旧版 text2） -->
		<input
			ref="inputRef"
			type="text"
			class="command-input"
			@keydown="onKeydown"
		/>

		<!-- 浮动按钮："执"（run）+ "清"（clear） -->
		<div class="menubutton round highlight command-float-btn run-btn" @click="runCommand">执</div>
		<div class="menubutton round highlight command-float-btn clear-btn" @click="clearOutput">清</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ui, game, get, lib, _status, ai } from "noname";
import { security } from "@/util/sandbox.js";
import dedent from "dedent";

// ---------------------------------------------------------------------------
// DOM 引用
// ---------------------------------------------------------------------------
const outputContainerRef = ref<HTMLDivElement>();
const preRef = ref<HTMLPreElement>();
const inputRef = ref<HTMLInputElement>();

// ---------------------------------------------------------------------------
// 命令历史
// 对应旧版 465-466
// ---------------------------------------------------------------------------
const logs: string[] = [];
let logindex = -1;

// ---------------------------------------------------------------------------
// proxyWindow / 安全沙箱
// 对应旧版 467-519
// ---------------------------------------------------------------------------
let proxyWindow: any;

function initProxyWindow() {
	proxyWindow = Object.assign({}, window, {
		_status: _status,
		lib: lib,
		game: game,
		ui: ui,
		get: get,
		ai: ai,
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
			.then((access: any, nameds: any, control: any) => {
				if (access.action == AccessAction.DEFINE) {
					control.preventDefault();
					control.stopPropagation();
					control.setReturnValue(false);
					return;
				}
				control.overrideParameter("target", window);
			})
			.start();
	} else {
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
				if (typeof propertyKey == "string" && keys.includes(propertyKey)) {
					return Reflect.set(target, propertyKey, value, receiver);
				}
				return Reflect.set(window, propertyKey, value);
			},
		});
	}
}

// ---------------------------------------------------------------------------
// eval 函数（new Function / security.exec）
// 对应旧版 520-566
// ---------------------------------------------------------------------------
let fun: (value: string) => any;

function initEvalFunction() {
	if (security.isSandboxRequired()) {
		const reg = /^\{([^{}]+:\s*([^\s,]*|'[^']*'|"[^"]*"|\{[^}]*\}|\[[^\]]*\]|null|undefined|([a-zA-Z$_][a-zA-Z0-9$_]*\s*:\s*)?[a-zA-Z$_][a-zA-Z0-9$_]*\(\)))(?:,\s*([^{}]+:\s*(?:[^\s,]*|'[^']*'|"[^"]*"|\{[^}]*\}|\[[^\]]*\]|null|undefined|([a-zA-Z$_][a-zA-Z0-9$_]*\s*:\s*)?[a-zA-Z$_][a-zA-Z0-9$_]*\(\))))*\}$/;
		fun = function (value: string) {
			const exp = reg.test(value) ? `(${value})` : value;
			const expName = "_" + Math.random().toString().slice(2);
			return security.exec(`return eval(${expName})`, { window: proxyWindow, [expName]: exp });
		};
	} else {
		fun = new Function(
			"window",
			dedent`
			const _status=window._status;
			const lib=window.lib;
			const game=window.game;
			const ui=window.ui;
			const get=window.get;
			const ai=window.nonameAI;
			const cheat=window.lib.cheat;
			const reg=${/^\{([^{}]+:\s*([^\s,]*|'[^']*'|"[^"]*"|\{[^}]*\}|\[[^\]]*\]|null|undefined|([a-zA-Z$_][a-zA-Z0-9$_]*\s*:\s*)?[a-zA-Z$_][a-zA-Z0-9$_]*\(\)))(?:,\s*([^{}]+:\s*(?:[^\s,]*|'[^']*'|"[^"]*"|\{[^}]*\}|\[[^\]]*\]|null|undefined|([a-zA-Z$_][a-zA-Z0-9$_]*\s*:\s*)?[a-zA-Z$_][a-zA-Z0-9$_]*\(\))))*\}$/};
			return function(value){ 
				"use strict";
				return eval(reg.test(value)?('('+value+')'):value);
			}
		`
		)(proxyWindow);
	}
}

// ---------------------------------------------------------------------------
// game.print —— 格式化输出
// 对应旧版 630-685
// ---------------------------------------------------------------------------
function formatObject(obj: any): string {
	if (Array.isArray(obj)) {
		return `[${obj.map((v: any) => formatObject(v)).join(", ")}]`;
	} else if (typeof obj == "function") {
		if (typeof obj.name == "string") {
			return `[Function ${obj.name}]`;
		} else {
			return `[Function]`;
		}
	} else if (typeof obj != "string") {
		if (obj instanceof Error) {
			return `<span style="color:red;">${String(obj)}</span>`;
		}
		return String(obj);
	} else {
		return `'${String(obj)}'`;
	}
}

function initGamePrint() {
	const originalPrint = game.print;
	game.print = function () {
		if (!preRef.value || !outputContainerRef.value) {
			// 还未挂载时，保存到 _status.toprint（旧版 686-689）
			originalPrint(...arguments);
			return;
		}
		const args = [...arguments];
		const printResult = args
			.map((arg: any) => {
				if (typeof arg != "string") {
					// 函数
					if (typeof arg == "function") {
						let argi: string;
						try {
							argi = get.stringify(arg);
							if (argi === "") {
								argi = arg.toString();
							}
						} catch (_) {
							argi = arg.toString();
						}
						return argi
							.replace(/&/g, "&amp;")
							.replace(/</g, "&lt;")
							.replace(/>/g, "&gt;")
							.replace(/"/g, "&quot;")
							.replace(/'/g, "&#39;");
					} else if (typeof arg == "object") {
						// 对象
						let msg = "";
						for (const name of Object.getOwnPropertyNames(arg)) {
							msg += `${name}: ${formatObject(arg[name])}<br>`;
						}
						return `<details><summary>${formatObject(arg)}</summary>${msg}</details>`;
					} else {
						return formatObject(arg);
					}
				} else {
					// 字符串
					const str = String(arg);
					if (!/<[a-zA-Z]+[^>]*?\/?>.*?(?=<\/[a-zA-Z]+[^>]*?>|$)/.exec(str)) {
						return str
							.replace(/&/g, "&amp;")
							.replace(/</g, "&lt;")
							.replace(/>/g, "&gt;")
							.replace(/"/g, "&quot;")
							.replace(/'/g, "&#39;");
					} else {
						return str;
					}
				}
			})
			.join(" ");
		preRef.value.innerHTML += printResult + "<br>";
		outputContainerRef.value.scrollTop = outputContainerRef.value.scrollHeight;
	};
}

// ---------------------------------------------------------------------------
// runCommand —— 执行命令
// 对应旧版 567-610
// ---------------------------------------------------------------------------
function runCommand() {
	const input = inputRef.value;
	if (!input) return;

	if (input.value && !["up", "down"].includes(input.value)) {
		logindex = -1;
		logs.unshift(input.value);
	}

	if (input.value == "cls") {
		if (preRef.value) preRef.value.innerHTML = "";
		input.value = "";
	} else if (input.value == "up") {
		if (logindex + 1 < logs.length) {
			input.value = logs[++logindex];
		} else {
			input.value = "";
		}
	} else if (input.value == "down") {
		if (logindex >= 0) {
			logindex--;
			if (logindex < 0) {
				input.value = "";
			} else {
				input.value = logs[logindex];
			}
		} else {
			input.value = "";
		}
	} else if (
		input.value.includes("无天使") &&
		(input.value.includes("无神佛") ||
			(input.value.includes("无神") && input.value.includes("无佛")))
	) {
		game.print("密码正确！欢迎来到死后世界战线！");
		_status.keyVerified = true;
		input.value = "";
	} else {
		if (!game.observe && !game.online) {
			try {
				let value = input.value.trim();
				if (value.endsWith(";")) {
					value = value.slice(0, -1).trim();
				}
				game.print(fun(value));
			} catch (e) {
				game.print(e);
			}
		}
		input.value = "";
	}
}

function clearOutput() {
	if (preRef.value) preRef.value.innerHTML = "";
}

// ---------------------------------------------------------------------------
// 键盘事件
// 对应旧版 611-628
// ---------------------------------------------------------------------------
function onKeydown(e: KeyboardEvent) {
	if (e.key == "Enter") {
		runCommand();
	} else if (e.key == "ArrowUp") {
		if (logindex + 1 < logs.length) {
			inputRef.value!.value = logs[++logindex];
		}
	} else if (e.key == "ArrowDown") {
		if (logindex >= 0) {
			logindex--;
			if (logindex < 0) {
				inputRef.value!.value = "";
			} else {
				inputRef.value!.value = logs[logindex];
			}
		}
	}
}

// ---------------------------------------------------------------------------
// 生命周期
// ---------------------------------------------------------------------------
onMounted(() => {
	initProxyWindow();
	initEvalFunction();
	initGamePrint();

	// 输出之前缓存的内容（旧版 686-689）
	if (_status.toprint) {
		for (const args of _status.toprint) {
			game.print(...args);
		}
		delete _status.toprint;
	}

	// DevTools 提示（旧版 694-697）
	if (typeof (window as any).noname_shijianInterfaces?.showDevTools == "function") {
		game.print("点击以下按钮\n将开启诗笺版内置的控制台");
		game.print(
			"<button onclick='window.noname_shijianInterfaces.showDevTools();'>开启DevTools</button>",
		);
	}
});
</script>

<style>
/* 浮动按钮定位 —— 对应旧版 22-28 行的绝对定位 */
.command-console {
	position: relative;
}
.command-float-btn {
	position: absolute;
	top: 15px;
	right: 15px;
}
.command-float-btn.run-btn {
	right: 15px;
}
.command-float-btn.clear-btn {
	right: 55px;
}
/* 输出区域 —— 对应旧版 text 的绝对定位和尺寸 */
.command-output {
	width: 194px;
	height: 124px;
	padding: 3px;
	border-radius: 2px;
	box-shadow: rgba(0, 0, 0, 0.2) 0 0 0 1px;
	text-align: left;
	-webkit-user-select: initial;
	user-select: initial;
	overflow: scroll;
	position: absolute;
	left: 30px;
	top: 50px;
	word-break: break-all;
}
.command-output pre.fullsize {
	margin: 0;
	padding: 0;
	position: relative;
	-webkit-user-select: text;
	user-select: text;
}
/* 输入框 —— 对应旧版 text2 的绝对定位和尺寸 */
.command-input {
	width: 200px;
	height: 20px;
	padding: 0;
	position: absolute;
	top: 15px;
	left: 30px;
	resize: none;
	border: none;
	border-radius: 2px;
	box-shadow: rgba(0, 0, 0, 0.2) 0 0 0 1px;
}
</style>
