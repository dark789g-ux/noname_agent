<template>
	<section class="llm-log-content">
		<div class="llm-log-content-header">
			<span class="llm-log-content-label">{{ label }}</span>
			<div class="llm-log-content-actions">
				<button
					v-if="isMarkdown"
					type="button"
					class="llm-log-content-button"
					:aria-pressed="showSource"
					@click="showSource = !showSource"
				>
					原文
				</button>
				<button
					v-if="isOverflowing"
					type="button"
					class="llm-log-content-button"
					:aria-controls="contentId"
					:aria-expanded="expanded"
					@click="expanded = !expanded"
				>
					{{ expanded ? "收起" : "展开" }}
				</button>
			</div>
		</div>
		<div :id="contentId" ref="contentElement" class="llm-log-content-body" :class="{ 'is-collapsed': isOverflowing && !expanded }">
			<pre v-if="showSource || !isMarkdown" class="llm-log-content-json">{{ textValue }}</pre>
			<div v-else class="llm-log-markdown" v-html="renderedMarkdown"></div>
		</div>
	</section>
</template>

<script lang="ts">
let contentSequence = 0;

function nextContentId(): string {
	return `llm-log-content-${++contentSequence}`;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { formatLLMLogValue, renderLLMMarkdown } from "@/llm/markdown-renderer.js";

const props = defineProps<{
	value: unknown;
	mode: "auto" | "json";
	defaultExpanded: boolean;
	label: string;
}>();

const PREVIEW_MAX_HEIGHT = 200;
const contentId = nextContentId();
const contentElement = ref<HTMLElement | null>(null);
const expanded = ref(props.defaultExpanded);
const showSource = ref(false);
const isOverflowing = ref(false);
let resizeObserver: ResizeObserver | undefined;

const isMarkdown = computed(() => props.mode === "auto" && typeof props.value === "string");
const textValue = computed(() => (isMarkdown.value ? (props.value as string) : formatLLMLogValue(props.value)));
const renderedMarkdown = computed(() => (isMarkdown.value ? renderLLMMarkdown(textValue.value) : ""));

function measureOverflow(): void {
	const element = contentElement.value;
	if (!element) return;
	isOverflowing.value = element.scrollHeight > PREVIEW_MAX_HEIGHT;
}

async function resetState(): Promise<void> {
	expanded.value = props.defaultExpanded;
	showSource.value = false;
	await nextTick();
	measureOverflow();
}

watch(() => [props.value, props.mode, props.defaultExpanded, props.label], () => void resetState(), { deep: false });
watch(showSource, async () => {
	await nextTick();
	measureOverflow();
});

onMounted(async () => {
	resizeObserver = new ResizeObserver(measureOverflow);
	if (contentElement.value) resizeObserver.observe(contentElement.value);
	await nextTick();
	measureOverflow();
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<style scoped>
.llm-log-content { margin: 4px 0; border: 1px solid #3a3a3a; border-radius: 3px; overflow: hidden; }
.llm-log-content-header { display: flex; align-items: center; gap: 8px; padding: 4px 6px; background: #2a2a2a; border-bottom: 1px solid #3a3a3a; }
.llm-log-content-label { flex: 1; min-width: 0; color: #aaa; font-size: 11px; font-weight: bold; word-break: break-all; }
.llm-log-content-actions { display: flex; flex: 0 0 auto; gap: 4px; }
.llm-log-content-button { border: 1px solid #555; border-radius: 3px; padding: 1px 5px; color: #ddd; background: #333; cursor: pointer; font-size: 11px; }
.llm-log-content-button:hover, .llm-log-content-button:focus-visible { outline: 2px solid #64b5f6; outline-offset: 1px; background: #444; }
.llm-log-content-body { box-sizing: border-box; padding: 6px 8px; overflow: hidden; }
.llm-log-content-body.is-collapsed { max-height: 200px; }
.llm-log-content-json { margin: 0; color: #ccc; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
.llm-log-markdown { color: #ddd; line-height: 1.5; overflow-wrap: anywhere; }
.llm-log-markdown :deep(p), .llm-log-markdown :deep(ul), .llm-log-markdown :deep(ol), .llm-log-markdown :deep(blockquote), .llm-log-markdown :deep(pre), .llm-log-markdown :deep(table) { margin: 0 0 8px; }
.llm-log-markdown :deep(:last-child) { margin-bottom: 0; }
.llm-log-markdown :deep(pre) { overflow-x: auto; padding: 6px; background: #202020; border-radius: 3px; }
.llm-log-markdown :deep(code) { font-family: monospace; }
.llm-log-markdown :deep(table) { max-width: 100%; border-collapse: collapse; }
.llm-log-markdown :deep(th), .llm-log-markdown :deep(td) { border: 1px solid #555; padding: 3px 5px; }
.llm-log-markdown :deep(a) { color: #64b5f6; }
.llm-log-markdown :deep(.llm-markdown-image-placeholder) { color: #ffb74d; }
</style>
