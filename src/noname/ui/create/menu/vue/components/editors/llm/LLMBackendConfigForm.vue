<template>
	<div class="llm-backend-panel">
		<div class="llm-backend-header">
			<div class="llm-section-title">后端详细配置</div>
			<div class="llm-tabs" role="tablist" aria-label="AI 后端配置切换">
				<button
					v-for="tab in CLI_BACKEND_TABS"
					:key="tab.key"
					type="button"
					role="tab"
					class="llm-tab-btn"
					:class="{ active: activeTab === tab.key }"
					:aria-selected="activeTab === tab.key"
					@click="activeTab = tab.key"
				>
					{{ tab.label }}
				</button>
			</div>
		</div>

		<LLMOpenAIBackendForm
			v-show="activeTab === 'openai'"
			@labels-change="emit('labels-change')"
		/>
		<LLMCLIBackendForm
			v-show="activeTab !== 'openai'"
			:provider="activeCliProvider"
			@labels-change="emit('labels-change')"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { lib } from "noname";
import { readBackendsFromRawConfig, type ExternalBackendKind } from "@/llm/backends.js";
import { CLI_BACKEND_TABS } from "./llmConfigShared.js";
import LLMCLIBackendForm from "./LLMCLIBackendForm.vue";
import LLMOpenAIBackendForm from "./LLMOpenAIBackendForm.vue";

const emit = defineEmits<{
	(e: "labels-change"): void;
}>();

const initialExtra = readBackendsFromRawConfig(lib.config, document);
const initialTab: ExternalBackendKind =
	initialExtra.defaultBackend === "agy" || initialExtra.defaultBackend === "codex"
		? initialExtra.defaultBackend
		: "openai";

const activeTab = ref<ExternalBackendKind>(initialTab);
const activeCliProvider = computed<"agy" | "codex">(() => (activeTab.value === "codex" ? "codex" : "agy"));
</script>

<style scoped src="./llm-config-form.css"></style>
<style scoped>
.llm-backend-panel {
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.14);
	border-radius: 8px;
	padding: 12px;
	margin-top: 10px;
}

.llm-backend-header {
	display: flex !important;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 10px;
}

.llm-tabs {
	display: flex !important;
	flex-wrap: wrap;
	gap: 6px;
}

.llm-tab-btn {
	padding: 5px 10px;
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.18);
	background: rgba(255, 255, 255, 0.06);
	color: #d6deea;
	font-size: 12px;
	cursor: pointer;
}

.llm-tab-btn.active {
	background: rgba(52, 114, 214, 0.9);
	border-color: rgba(125, 180, 255, 0.75);
	color: #ffffff;
	font-weight: bold;
}
</style>
