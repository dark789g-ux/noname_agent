<template>
	<div v-if="shouldRender" class="llm-thinking-block" :class="{ 'is-active': active, 'is-expanded': expanded }">
		<div
			class="thinking-header"
			:class="{ clickable: !active && Boolean(thought) }"
			@click="toggleExpand"
		>
			<span class="thinking-glyph" :class="{ spinning: active }">{{ active ? "✻" : "∴" }}</span>
			<span class="thinking-title">{{ headerText }}</span>
			<span v-if="!active && thought" class="thinking-caret">{{ expanded ? "▾" : "▸" }}</span>
		</div>
		<div v-if="showBody" ref="bodyEl" class="thinking-body">
			<div v-if="renderedHtml" class="thinking-markdown" v-html="renderedHtml"></div>
			<div v-else class="thinking-placeholder">模型正在深度思考中…</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { renderLLMMarkdown } from "@/llm/markdown-renderer.js";
import { formatCompactTokens, formatDurationSec } from "./types.js";

const props = defineProps<{
	thought: string;
	active?: boolean;
	thinkingMs?: number;
	thoughtTokens?: number;
	defaultExpanded?: boolean;
}>();

const expanded = ref(Boolean(props.defaultExpanded));
const bodyEl = ref<HTMLElement | null>(null);

const shouldRender = computed(() => Boolean(props.active || props.thought.trim() || (props.thinkingMs && props.thinkingMs > 0)));
const showBody = computed(() => Boolean(props.active || (expanded.value && props.thought.trim())));

const headerText = computed(() => {
	const timePart = props.thinkingMs && props.thinkingMs > 0 ? formatDurationSec(props.thinkingMs) : "";
	const tokenPart = props.thoughtTokens != null ? `↓ ${formatCompactTokens(props.thoughtTokens)} tokens` : "";
	const meta = [timePart, tokenPart].filter(Boolean).join(" · ");
	if (props.active) {
		return meta ? `思考中… (${meta})` : "思考中…";
	}
	if (!props.thought.trim()) {
		return meta ? `已思考 ${meta}（模型未公开思考文本）` : "已完成思考";
	}
	return meta ? `已思考 ${meta}` : "思考过程";
});

const renderedHtml = computed(() => {
	const text = props.thought.trim();
	if (!text) return "";
	return renderLLMMarkdown(text);
});

function toggleExpand(): void {
	if (props.active || !props.thought.trim()) return;
	expanded.value = !expanded.value;
}

watch(
	() => props.thought,
	async () => {
		if (!props.active) return;
		await nextTick();
		if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight;
	}
);
</script>

<style scoped>
.llm-thinking-block, .llm-thinking-block div { position: static !important; }
.llm-thinking-block { margin: 4px 0; border-left: 2px solid #444b57; padding-left: 8px; }
.llm-thinking-block.is-active { border-left-color: #d69e66; }
.thinking-header { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #9aa2b0; line-height: 1.4; user-select: none; }
.thinking-header.clickable { cursor: pointer; }
.thinking-header.clickable:hover { color: #d5dce6; }
.llm-thinking-block.is-active .thinking-header { color: #e2b27d; }
.thinking-glyph { font-size: 12px; display: inline-block; }
.thinking-glyph.spinning { animation: llm-think-pulse 1.2s ease-in-out infinite; }
@keyframes llm-think-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.thinking-caret { margin-left: 2px; font-size: 10px; opacity: 0.85; }
.thinking-body { margin-top: 4px; max-height: 200px; overflow-y: auto; padding: 4px 6px; background: rgba(255, 255, 255, 0.025); border-radius: 3px; color: #9ea6b3; font-size: 11px; font-style: italic; line-height: 1.45; }
.thinking-markdown :deep(p) { margin: 0 0 4px; }
.thinking-markdown :deep(p:last-child) { margin-bottom: 0; }
.thinking-markdown :deep(pre), .thinking-markdown :deep(code) { font-style: normal; font-family: monospace; background: rgba(0, 0, 0, 0.28); padding: 1px 3px; border-radius: 2px; }
.thinking-placeholder { color: #8c95a3; }
</style>
