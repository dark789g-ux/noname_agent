<template>
	<div class="llm-cfg-root">
		<!-- 全局开关与决策预算 -->
		<div class="llm-global-card">
			<div class="llm-section-title">全局开关与决策预算</div>

			<div class="llm-switch-row" role="switch" :aria-checked="enabled" tabindex="0" @click="toggleEnabled" @keydown.enter.space.prevent="toggleEnabled">
				<div class="llm-switch-text">
					<div class="llm-switch-name">启用 LLM AI 助手</div>
					<div class="llm-switch-desc">启用后，AI 玩家由 LLM/CLI 接管决策；失败或超时自动回退本地规则 AI。</div>
				</div>
				<span class="llm-switch-pill" :class="{ on: enabled }">
					<span class="llm-switch-knob"></span>
				</span>
			</div>

			<div class="llm-switch-row" role="switch" :aria-checked="controlSelf" tabindex="0" @click="toggleControlSelf" @keydown.enter.space.prevent="toggleControlSelf">
				<div class="llm-switch-text">
					<div class="llm-switch-name">玩家角色接入 LLM</div>
					<div class="llm-switch-desc">需同时开启助手开关（下一局生效）；选将仍手动完成，进局后完全由 AI 操控。</div>
				</div>
				<span class="llm-switch-pill" :class="{ on: controlSelf }">
					<span class="llm-switch-knob"></span>
				</span>
			</div>

			<div class="llm-budget-grid">
				<div class="llm-field">
					<label class="llm-field-label">默认 AI 后端</label>
					<select
						v-model="defaultBackend"
						class="llm-select"
						@change="saveDefaultBackend"
						@keydown.stop
						@keyup.stop
					>
						<option value="openai">OpenAI API（{{ backendLabels.openai }}）</option>
						<option value="agy">agy CLI（{{ backendLabels.agy }}）</option>
						<option value="codex">codex CLI（{{ backendLabels.codex }}）</option>
						<option value="local">本地规则 AI</option>
					</select>
				</div>

				<div class="llm-field">
					<label class="llm-field-label">最大决策轮次</label>
					<select
						v-model="maxTurns"
						class="llm-select"
						@change="saveMaxTurns"
						@keydown.stop
						@keyup.stop
					>
						<option v-for="n in turnOptions" :key="n" :value="String(n)">
							{{ n }} 轮
						</option>
					</select>
				</div>

				<div class="llm-field">
					<label class="llm-field-label">决策总超时（秒）</label>
					<input
						v-model.number="decisionTimeoutSec"
						type="number"
						min="10"
						max="300"
						class="llm-input"
						@blur="commitDecisionTimeout"
						@change="commitDecisionTimeout"
						@keydown.stop
						@keyup.stop
					/>
				</div>
			</div>
		</div>

		<!-- 三类外部后端详细配置 -->
		<LLMBackendConfigForm @labels-change="refreshLabels" />

		<!-- 按行动顺位 1~10 号位单独分配 -->
		<LLMSeatAssignmentTable :default-backend="defaultBackend" :backend-labels="backendLabels" />
	</div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { game, lib, ui } from "noname";
import { readBackendsFromRawConfig, resolveBackendDisplayName, type LLMBackendKind } from "@/llm/backends.js";
import { normalizeLLMText } from "@/llm/config.js";
import LLMBackendConfigForm from "./LLMBackendConfigForm.vue";
import LLMSeatAssignmentTable from "./LLMSeatAssignmentTable.vue";

const turnOptions = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(n)));
}

function readBackendLabels() {
	const extra = readBackendsFromRawConfig(lib.config, document);
	const model = normalizeLLMText(lib.config.llm_model, document);
	const url = normalizeLLMText(lib.config.llm_url, document);
	return {
		openai: resolveBackendDisplayName("openai", { openaiDisplayName: extra.openaiDisplayName, model, url }),
		agy: resolveBackendDisplayName("agy", { agy: extra.agy }),
		codex: resolveBackendDisplayName("codex", { codex: extra.codex }),
	};
}

const initialExtra = readBackendsFromRawConfig(lib.config, document);
const enabled = ref(!!lib.config.llm_enabled);
const controlSelf = ref(!!lib.config.llm_control_self);
const defaultBackend = ref<LLMBackendKind>(initialExtra.defaultBackend);
const maxTurns = ref(String(clampInt(lib.config.llm_max_turns, 4, 1, 8)));
const decisionTimeoutSec = ref(clampInt(lib.config.llm_decision_timeout, 60, 10, 300));
const backendLabels = reactive(readBackendLabels());

function refreshLabels() {
	const next = readBackendLabels();
	backendLabels.openai = next.openai;
	backendLabels.agy = next.agy;
	backendLabels.codex = next.codex;
}

function toggleEnabled() {
	enabled.value = !enabled.value;
	game.saveConfig("llm_enabled", enabled.value);
	try {
		ui?.updateAIModeIndicator?.();
		ui?.updateLLMLogButtons?.();
	} catch {}
}

function toggleControlSelf() {
	controlSelf.value = !controlSelf.value;
	game.saveConfig("llm_control_self", controlSelf.value);
	try {
		ui?.updateLLMLogButtons?.();
	} catch {}
}

function saveDefaultBackend() {
	game.saveConfig("llm_default_backend", defaultBackend.value);
	try {
		ui?.updateLLMLogButtons?.();
	} catch {}
}

function saveMaxTurns() {
	const clamped = String(clampInt(maxTurns.value, 4, 1, 8));
	maxTurns.value = clamped;
	game.saveConfig("llm_max_turns", clamped);
}

function commitDecisionTimeout() {
	decisionTimeoutSec.value = clampInt(decisionTimeoutSec.value, 60, 10, 300);
	game.saveConfig("llm_decision_timeout", decisionTimeoutSec.value);
}
</script>

<style scoped>
.llm-cfg-root,
.llm-cfg-root div {
	position: relative;
	display: block;
	transition: none;
	box-sizing: border-box;
}

.llm-cfg-root {
	padding: 8px 10px 18px;
	color: #eef3fa;
	font-size: 13px;
}

.llm-global-card {
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.14);
	border-radius: 8px;
	padding: 12px;
	display: flex !important;
	flex-direction: column;
	gap: 10px;
}

.llm-section-title {
	font-size: 14px;
	font-weight: bold;
	color: #eef3fa;
}

.llm-switch-row {
	display: flex !important;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 8px 10px;
	border-radius: 6px;
	background: rgba(0, 0, 0, 0.22);
	border: 1px solid rgba(255, 255, 255, 0.09);
	cursor: pointer;
}

.llm-switch-row:hover {
	background: rgba(255, 255, 255, 0.06);
}

.llm-switch-text {
	flex: 1;
	min-width: 0;
}

.llm-switch-name {
	font-size: 13px;
	font-weight: 600;
	color: #f3f6fb;
}

.llm-switch-desc {
	font-size: 12px;
	color: #aebccf;
	margin-top: 2px;
	line-height: 1.35;
}

.llm-switch-pill {
	position: relative;
	display: inline-block;
	width: 44px;
	height: 24px;
	border-radius: 12px;
	background: rgba(255, 255, 255, 0.2);
	flex-shrink: 0;
	transition: background 0.18s;
}

.llm-switch-pill.on {
	background: rgba(56, 128, 232, 0.95);
}

.llm-switch-knob {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 18px;
	height: 18px;
	border-radius: 50%;
	background: #ffffff;
	transition: transform 0.18s;
}

.llm-switch-pill.on .llm-switch-knob {
	transform: translateX(20px);
}

.llm-budget-grid {
	display: grid !important;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
</style>
