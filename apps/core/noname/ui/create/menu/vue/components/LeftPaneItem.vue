<template>
	<div
		class="menubutton large"
		:class="{ active, off: item.attrs?.enabled === false }"
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
}

defineProps<Props>();

defineEmits<{
	(e: "click", item: LeftPaneItem): void;
}>();
</script>
