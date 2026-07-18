<template>
	<div
		class="menubutton large"
		:class="{ active, off: item.attrs?.enabled === false, lefttext: item.attrs?.action, unselectable }"
		@click="$emit('click', item)"
	>
		{{ item.name }}
	</div>
</template>

<script setup lang="ts">
import type { LeftPaneItem } from "../types";

interface Props {
	item: LeftPaneItem;
	active: boolean;
	/** 不可选中（联机 waitingForPlayer 时非当前模式的模式项，对应旧版 unselectable class） */
	unselectable?: boolean;
}

defineProps<Props>();

defineEmits<{
	(e: "click", item: LeftPaneItem): void;
}>();
</script>
