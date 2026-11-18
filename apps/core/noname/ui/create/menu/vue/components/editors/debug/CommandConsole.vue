<template>
	<div class="menu-sym command-console">
		<div ref="outputContainerRef" class="command-output">
			<pre class="fullsize"><template v-for="(line, idx) in outputLines" :key="idx"><span v-html="line"></span><br /></template></pre>
		</div>

		<input
			ref="inputRef"
			v-model="commandInput"
			type="text"
			class="command-input"
			@keydown="onKeydown"
		/>

		<div class="menubutton round highlight command-float-btn run-btn" @click="runCommand">执</div>
		<div class="menubutton round highlight command-float-btn clear-btn" @click="clearOutput">清</div>
	</div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { _status, game } from "noname";
import {
	createConsoleEvaluator,
	createConsoleProxyWindow,
	registerConsolePrintSink,
} from "./consoleRuntime.js";

const outputContainerRef = ref<HTMLDivElement>();
const inputRef = ref<HTMLInputElement>();
const commandInput = ref("");
const outputLines = ref<string[]>([]);

const logs: string[] = [];
let logindex = -1;
let evalCommand: ((value: string) => any) | null = null;
let unregisterPrint: (() => void) | null = null;

function appendOutputLine(htmlLine: string) {
	outputLines.value.push(htmlLine);
	nextTick(() => {
		if (outputContainerRef.value) {
			outputContainerRef.value.scrollTop = outputContainerRef.value.scrollHeight;
		}
	});
}

function stepHistory(direction: "up" | "down") {
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
	if (
		raw.includes("无天使") &&
		(raw.includes("无神佛") || (raw.includes("无神") && raw.includes("无佛")))
	) {
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

function onKeydown(e: KeyboardEvent) {
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

	if (typeof (window as any).noname_shijianInterfaces?.showDevTools === "function") {
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
</script>

<style>
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
