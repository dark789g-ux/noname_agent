<template>
	<div class="llm-cli-form">
		<div class="llm-cli-notice">
			通过本地 <code>@noname/fs</code>（<code>/_llm/cli</code>）以隔离临时目录运行 {{ provider }} 子进程，不读取仓库项目指令；CLI 路径与登录态需提前在终端可用。
		</div>

		<div class="llm-grid-2">
			<div class="llm-field">
				<label class="llm-field-label">显示名称</label>
				<input
					v-model="current.displayName"
					type="text"
					class="llm-input"
					:placeholder="provider"
					@input="saveCliConfig(true)"
					@blur="saveCliConfig(true)"
					@keydown.stop
					@keyup.stop
				/>
			</div>

			<div class="llm-field">
				<label class="llm-field-label">可执行命令</label>
				<input
					v-model="current.command"
					type="text"
					class="llm-input"
					:placeholder="provider"
					@blur="saveCliConfig(false, true)"
					@change="saveCliConfig(false, true)"
					@keydown.stop
					@keyup.stop
				/>
			</div>
		</div>

		<div :class="provider === 'agy' ? 'llm-grid-2' : 'llm-grid-3'">
			<div class="llm-field">
				<label class="llm-field-label">模型名称（可选）</label>
				<select
					v-model="current.model"
					class="llm-select"
					@change="saveCliConfig(false)"
					@keydown.stop
					@keyup.stop
				>
					<option value="">默认（使用 CLI 默认模型）</option>
					<option v-if="hasCustomModel" :value="current.model">{{ current.model }}</option>
					<option v-for="modelId in modelOptions" :key="modelId" :value="modelId">{{ modelId }}</option>
				</select>
			</div>

			<div v-if="provider === 'codex'" class="llm-field">
				<label class="llm-field-label">思考深度</label>
				<select
					v-model="current.thinkingEffort"
					class="llm-select"
					@change="saveCliConfig(false)"
					@keydown.stop
					@keyup.stop
				>
					<option value="default">默认（CLI 自身设置）</option>
					<option value="none">无（none）</option>
					<option value="low">低（low）</option>
					<option value="medium">中（medium）</option>
					<option value="high">高（high）</option>
				</select>
			</div>

			<div class="llm-field">
				<label class="llm-field-label">单次调用超时（秒）</label>
				<input
					v-model.number="current.timeoutSec"
					type="number"
					min="5"
					max="300"
					class="llm-input"
					@blur="commitTimeout"
					@change="commitTimeout"
					@keydown.stop
					@keyup.stop
				/>
			</div>
		</div>

		<div v-if="provider === 'agy'" class="llm-field-hint">
			提示：<code>agy</code> 的模型 ID 已包含思考强度档位，请直接通过上方模型下拉框选择。
		</div>

		<div class="llm-field">
			<label class="llm-field-label">附加 CLI 参数（可选）</label>
			<input
				v-model="current.extraArgs"
				type="text"
				class="llm-input"
				placeholder="例如 --sandbox read-only 或其他只读参数"
				@blur="saveCliConfig(false)"
				@change="saveCliConfig(false)"
				@keydown.stop
				@keyup.stop
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { game, lib, ui } from "noname";
import {
	defaultCLISettings,
	getCLIModelOptions,
	readBackendsFromRawConfig,
	type CLIBackendSettings,
} from "@/llm/backends.js";

interface Props {
	provider: "agy" | "codex";
}

const props = defineProps<Props>();

const emit = defineEmits<{
	(e: "labels-change"): void;
}>();

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(n)));
}

const initialExtra = readBackendsFromRawConfig(lib.config, document);
const cliStates = reactive<Record<"agy" | "codex", CLIBackendSettings>>({
	agy: { ...initialExtra.agy },
	codex: { ...initialExtra.codex },
});

const current = computed(() => cliStates[props.provider]);
const modelOptions = computed(() => getCLIModelOptions(props.provider));
const hasCustomModel = computed(() => {
	const value = current.value.model.trim();
	return !!value && !modelOptions.value.includes(value);
});

function saveCliConfig(affectsLabel: boolean, ensureCommandFallback = false) {
	const target = props.provider;
	const src = cliStates[target];
	if (ensureCommandFallback && !src.command.trim()) {
		src.command = defaultCLISettings(target).command;
	}
	const plain: CLIBackendSettings = {
		displayName: src.displayName.trim(),
		command: src.command.trim() || defaultCLISettings(target).command,
		model: src.model.trim(),
		thinkingEffort: target === "agy" ? "default" : src.thinkingEffort,
		timeoutSec: clampInt(src.timeoutSec, 60, 5, 300),
		extraArgs: src.extraArgs.trim(),
	};
	game.saveConfig(target === "agy" ? "llm_agy_config" : "llm_codex_config", plain);
	if (affectsLabel) {
		ui?.updateLLMLogButtons?.();
		emit("labels-change");
	}
}

function commitTimeout() {
	cliStates[props.provider].timeoutSec = clampInt(cliStates[props.provider].timeoutSec, 60, 5, 300);
	saveCliConfig(false);
}
</script>

<style scoped>
.llm-cli-form,
.llm-cli-form div {
	position: relative;
	display: block;
	transition: none;
	box-sizing: border-box;
}

.llm-cli-form {
	display: flex !important;
	flex-direction: column;
	gap: 10px;
}

.llm-grid-2 {
	display: grid !important;
	grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
	gap: 10px;
}

.llm-grid-3 {
	display: grid !important;
	grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
	gap: 10px;
}

.llm-field {
	display: flex !important;
	flex-direction: column;
	gap: 4px;
}

.llm-field-label {
	font-size: 12px;
	color: #c9d3e0;
}

.llm-input,
.llm-select {
	width: 100%;
	padding: 6px 8px;
	border-radius: 5px;
	border: 1px solid rgba(255, 255, 255, 0.22);
	background: rgba(0, 0, 0, 0.35);
	color: #f3f6fb;
	font-size: 13px;
	box-sizing: border-box;
	user-select: text;
	-webkit-user-select: text;
}

.llm-select option {
	background: #242932;
	color: #f3f6fb;
}

.llm-input:focus,
.llm-select:focus {
	outline: none;
	border-color: rgba(110, 175, 255, 0.9);
}

.llm-cli-notice,
.llm-field-hint {
	font-size: 12px;
	line-height: 1.45;
	color: #b9c7d8;
	background: rgba(65, 130, 225, 0.12);
	border: 1px solid rgba(110, 170, 255, 0.24);
	border-radius: 6px;
	padding: 7px 10px;
}
</style>
