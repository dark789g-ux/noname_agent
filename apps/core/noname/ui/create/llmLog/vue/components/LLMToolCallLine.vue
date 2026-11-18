<template>
	<div class="llm-tool-call-line">
		<div class="tool-main">
			<span class="tool-bullet" :class="{ pending, error: Boolean(error) }">●</span>
			<span class="tool-summary">{{ summary }}</span>
			<span v-if="pending" class="tool-badge badge-pending">执行中</span>
			<span v-else-if="error" class="tool-badge badge-error" :title="error">失败</span>
			<span v-else-if="resultLabel" class="tool-badge badge-ok">{{ resultLabel }}</span>
		</div>
		<div v-if="reason" class="tool-reason">
			<span class="reason-branch">⎿</span>
			<span class="reason-text">{{ reason }}</span>
		</div>
		<div v-if="error" class="tool-error-msg">
			<span class="reason-branch">⎿</span>
			<span class="error-text">{{ error }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatToolCallSummary } from "../timelineTypes.js";

const props = defineProps<{
	name: string;
	args?: unknown;
	reason?: string;
	refLabels?: Record<string, string>;
	result?: unknown;
	error?: string;
	pending?: boolean;
}>();

const summary = computed(() => formatToolCallSummary(props.name, props.args, props.refLabels));

const resultLabel = computed(() => {
	if (props.result === undefined || props.result === null) return "";
	if (typeof props.result === "object") {
		const rec = props.result as Record<string, unknown>;
		if (typeof rec.ok === "boolean") return rec.ok ? "已采纳" : "无效";
		if (typeof rec.bool === "boolean") return rec.bool ? "确认" : "取消";
	}
	return "已完成";
});
</script>

<style scoped>
.llm-tool-call-line, .llm-tool-call-line div { position: static !important; }
.llm-tool-call-line { margin: 4px 0; font-size: 12px; color: #dde3ec; }
.tool-main { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.tool-bullet { font-size: 10px; color: #7dc788; flex-shrink: 0; }
.tool-bullet.pending { color: #4a9eff; }
.tool-bullet.error { color: #f44336; }
.tool-summary { font-family: monospace; font-size: 11px; color: #d8e1ed; word-break: break-word; }
.tool-badge { font-size: 10px; padding: 0 4px; border-radius: 3px; border: 1px solid #444; }
.badge-pending { color: #8cc4ff; border-color: #365c87; }
.badge-ok { color: #8be09e; border-color: #315c3d; }
.badge-error { color: #ff8a80; border-color: #7c3530; }
.tool-reason, .tool-error-msg { display: flex; align-items: flex-start; gap: 5px; padding-left: 12px; margin-top: 2px; font-size: 11px; line-height: 1.4; }
.reason-branch { color: #67707d; flex-shrink: 0; }
.reason-text { color: #b5becb; word-break: break-word; }
.error-text { color: #ff9e96; word-break: break-word; }
</style>
