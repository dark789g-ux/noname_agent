<template>
	<div class="llm-openai-form">
		<div class="llm-field">
			<label class="llm-field-label">
				显示名称（留空自动识别，当前识别：<strong>{{ openaiPreviewName }}</strong>）
			</label>
			<input
				v-model="state.displayName"
				type="text"
				class="llm-input"
				placeholder="留空按模型名提取，例如 deepseek、gpt"
				@input="saveText('llm_openai_display_name', state.displayName, true)"
				@blur="saveText('llm_openai_display_name', state.displayName, true)"
				@keydown.stop
				@keyup.stop
			/>
		</div>

		<div class="llm-field">
			<label class="llm-field-label">API 地址（baseURL，自动拼接 /chat/completions）</label>
			<input
				v-model="state.url"
				type="text"
				class="llm-input"
				placeholder="https://api.deepseek.com 或 http://localhost:11434/v1"
				@input="handleUrlChange(false)"
				@blur="handleUrlChange(true)"
				@keydown.stop
				@keyup.stop
			/>
			<div v-if="urlWarning" class="llm-field-error">{{ urlWarning }}</div>
		</div>

		<div class="llm-field">
			<label class="llm-field-label">API 密钥（仅存本地 IndexedDB）</label>
			<div class="llm-input-row">
				<input
					v-model="state.apikey"
					:type="showApiKey ? 'text' : 'password'"
					class="llm-input"
					placeholder="sk-..."
					autocomplete="off"
					@blur="saveText('llm_apikey', state.apikey, false)"
					@change="saveText('llm_apikey', state.apikey, false)"
					@keydown.stop
					@keyup.stop
				/>
				<button type="button" class="llm-mini-btn" @click="showApiKey = !showApiKey">
					{{ showApiKey ? "隐藏" : "显示" }}
				</button>
			</div>
		</div>

		<div class="llm-field">
			<label class="llm-field-label">模型名称</label>
			<input
				v-model="state.model"
				type="text"
				class="llm-input"
				placeholder="例如 deepseek-chat、gpt-4o-mini"
				@input="saveText('llm_model', state.model, true)"
				@blur="saveText('llm_model', state.model, true)"
				@keydown.stop
				@keyup.stop
			/>
		</div>

		<div class="llm-grid-3">
			<div class="llm-field">
				<label class="llm-field-label">思考深度</label>
				<select
					v-model="state.thinkingEffort"
					class="llm-select"
					@change="game.saveConfig('llm_thinking_effort', state.thinkingEffort)"
					@keydown.stop
					@keyup.stop
				>
					<option v-for="opt in THINKING_EFFORT_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</div>

			<div class="llm-field">
				<label class="llm-field-label">最大重试次数</label>
				<select
					v-model="state.maxRetries"
					class="llm-select"
					@change="game.saveConfig('llm_max_retries', state.maxRetries)"
					@keydown.stop
					@keyup.stop
				>
					<option value="0">0（不重试）</option>
					<option value="1">1 次</option>
					<option value="2">2 次</option>
					<option value="3">3 次</option>
				</select>
			</div>

			<div class="llm-field">
				<label class="llm-field-label">单轮超时（秒）</label>
				<input
					v-model.number="state.timeoutSec"
					type="number"
					min="1"
					max="300"
					class="llm-input"
					@blur="commitTimeout"
					@change="commitTimeout"
					@keydown.stop
					@keyup.stop
				/>
			</div>

			<div class="llm-field">
				<label class="llm-field-label">上下文窗口（Tokens）</label>
				<input
					v-model.number="state.contextSize"
					type="number"
					min="4096"
					max="2000000"
					step="1024"
					class="llm-input"
					@blur="commitContextSize"
					@change="commitContextSize"
					@keydown.stop
					@keyup.stop
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { game, lib, ui } from "noname";
import { DEFAULT_OPENAI_CONTEXT_SIZE, readBackendsFromRawConfig, resolveBackendDisplayName } from "@/llm/backends.js";
import { llmURLProblem, normalizeLLMText } from "@/llm/config.js";
import { clampInt, THINKING_EFFORT_OPTIONS } from "./llmConfigShared.js";

const emit = defineEmits<{
	(e: "labels-change"): void;
}>();

const initialExtra = readBackendsFromRawConfig(lib.config, document);
const showApiKey = ref(false);

const state = reactive({
	displayName: initialExtra.openaiDisplayName,
	url: normalizeLLMText(lib.config.llm_url, document),
	apikey: normalizeLLMText(lib.config.llm_apikey, document),
	model: normalizeLLMText(lib.config.llm_model, document),
	thinkingEffort: String(lib.config.llm_thinking_effort || "medium"),
	maxRetries: String(lib.config.llm_max_retries ?? "0"),
	timeoutSec: clampInt(lib.config.llm_timeout, 30, 1, 300),
	contextSize: initialExtra.openaiContextSize,
});

const openaiPreviewName = computed(() =>
	resolveBackendDisplayName("openai", {
		openaiDisplayName: state.displayName,
		model: state.model,
		url: state.url,
	})
);

const urlWarning = computed(() => {
	const cleaned = normalizeLLMText(state.url, document);
	if (!cleaned) return "";
	return llmURLProblem(cleaned) || "";
});

function notifyLabelsChanged() {
	ui?.updateLLMLogButtons?.();
	emit("labels-change");
}

function saveText(key: "llm_openai_display_name" | "llm_apikey" | "llm_model", raw: string, affectsLabel: boolean) {
	const cleaned = normalizeLLMText(raw, document);
	if (key === "llm_openai_display_name") state.displayName = cleaned;
	if (key === "llm_apikey") state.apikey = cleaned;
	if (key === "llm_model") state.model = cleaned;
	game.saveConfig(key, cleaned);
	if (affectsLabel) notifyLabelsChanged();
}

function handleUrlChange(commitClean: boolean) {
	const cleaned = normalizeLLMText(state.url, document);
	if (commitClean) state.url = cleaned;
	game.saveConfig("llm_url", cleaned);
	notifyLabelsChanged();
}

function commitTimeout() {
	state.timeoutSec = clampInt(state.timeoutSec, 30, 1, 300);
	game.saveConfig("llm_timeout", state.timeoutSec);
}

function commitContextSize() {
	state.contextSize = clampInt(state.contextSize, DEFAULT_OPENAI_CONTEXT_SIZE, 4096, 2_000_000);
	game.saveConfig("llm_context_size", state.contextSize);
}
</script>

<style scoped src="./llm-config-form.css"></style>
<style scoped>
.llm-openai-form {
	display: flex !important;
	flex-direction: column;
	gap: 10px;
}

.llm-input-row {
	display: flex !important;
	gap: 6px;
	align-items: center;
}

.llm-mini-btn {
	flex-shrink: 0;
	padding: 6px 10px;
	border-radius: 5px;
	border: 1px solid rgba(255, 255, 255, 0.22);
	background: rgba(255, 255, 255, 0.1);
	color: #eef3fa;
	font-size: 12px;
	cursor: pointer;
}

.llm-field-error {
	font-size: 12px;
	color: #ff9e9e;
}
</style>
