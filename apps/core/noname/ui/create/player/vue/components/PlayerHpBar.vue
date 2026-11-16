<template>
	<div
		ref="hpRef"
		class="hp"
		:class="{ textstyle: isTextStyle }"
		:data-condition="state.hpCondition"
	>
		<template v-if="isInfiniteMax">
			<template v-if="isInfiniteHp">∞</template>
			<template v-else>{{ state.hp }}<br />/<br />∞<div></div></template>
		</template>
		<template v-else-if="isTextStyle">
			{{ state.hp }}<br />/<br />{{ state.maxHp }}<div :class="{ lost: state.hp == 0 }"></div>
		</template>
		<template v-else-if="segmentCount > 0">
			<div
				v-for="idx in segmentCount"
				:key="idx"
				:class="{ lost: isSegmentLost(idx - 1) }"
			></div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { PlayerCardState } from "../playerCardState.js";

const props = defineProps<{
	state: PlayerCardState;
	onNodeReady: (key: "hp", el: HTMLDivElement) => void;
}>();

const hpRef = ref<HTMLDivElement | null>(null);

const isInfiniteMax = computed(() => props.state.maxHp === Infinity);
const isInfiniteHp = computed(() => props.state.hp === Infinity);
const isTextStyle = computed(() => {
	const maxHp = props.state.maxHp;
	return maxHp !== undefined && maxHp !== Infinity && Number(maxHp) > 5;
});
const segmentCount = computed(() => {
	const maxHp = props.state.maxHp;
	if (maxHp === undefined || maxHp === Infinity || Number(maxHp) > 5) {
		return 0;
	}
	return Math.max(0, Number(maxHp));
});

function isSegmentLost(domIndex: number): boolean {
	const logicalIndex = props.state.isNewLayout ? segmentCount.value - domIndex - 1 : domIndex;
	return !(logicalIndex < Number(props.state.hp));
}

onMounted(() => {
	if (hpRef.value) {
		props.onNodeReady("hp", hpRef.value);
	}
});
</script>
