<template>
	<div
		ref="identityRef"
		class="identity"
		:data-color="state.identityColor || undefined"
	>
		<div v-html="state.identityText"></div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { PlayerCardState } from "../playerCardState.js";

const props = defineProps<{
	state: PlayerCardState;
	onNodeReady: (key: "identity", el: HTMLDivElement) => void;
}>();

const identityRef = ref<HTMLDivElement | null>(null);

onMounted(() => {
	if (identityRef.value) {
		props.onNodeReady("identity", identityRef.value);
	}
});
</script>
