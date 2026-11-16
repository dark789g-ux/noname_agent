<template>
	<div ref="avatarRef" class="avatar hidden">
		<div ref="actionRef" class="action"></div>
	</div>
	<div ref="avatar2Ref" class="avatar2 hidden"></div>
	<div ref="turnedoverRef" class="turned">
		<div>翻面</div>
	</div>
	<div ref="framebgRef" class="framebg"></div>
	<div ref="introRef" class="intro"></div>
	<PlayerIdentityBadge :state="state" :on-node-ready="onNodeReady" />
	<PlayerHpBar :state="state" :on-node-ready="onNodeReady" />
	<div
		ref="nameRef"
		class="name"
		:class="{ long: state.nameLong }"
		:data-nature="state.nameNature || undefined"
		v-html="state.nameHtml"
	></div>
	<div ref="name2Ref" class="name name2" v-html="state.name2Html"></div>
	<div ref="nameolRef" class="nameol"></div>
	<div
		ref="countRef"
		class="count hidden"
		:data-condition="state.countCondition || undefined"
	>
		{{ state.count }}
	</div>
	<div ref="equipsRef" class="equips hidden"></div>
	<div ref="judgesRef" class="judges"></div>
	<div ref="marksRef" class="marks"></div>
	<div ref="chainRef" class="chain">
		<div>
			<div
				v-for="n in state.chainLength"
				:key="n"
				class="cardbg"
				:style="{ transform: `translateX(${(n - 1) * 5 - 5}px)` }"
			></div>
		</div>
	</div>
	<PlayerLLMBadge :player="player" :state="state" :on-node-ready="onNodeReady" />
	<PlayerMainSwitchBtn :player="player" :state="state" :on-node-ready="onNodeReady" />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ui } from "noname";
import type { Player } from "../../../../library/element/player.js";
import type { PlayerCardState } from "../playerCardState.js";
import PlayerHpBar from "./PlayerHpBar.vue";
import PlayerIdentityBadge from "./PlayerIdentityBadge.vue";
import PlayerLLMBadge from "./PlayerLLMBadge.vue";
import PlayerMainSwitchBtn from "./PlayerMainSwitchBtn.vue";

const props = defineProps<{
	player: Player;
	state: PlayerCardState;
	onNodeReady: (key: string, el: HTMLDivElement) => void;
}>();

const avatarRef = ref<HTMLDivElement | null>(null);
const actionRef = ref<HTMLDivElement | null>(null);
const avatar2Ref = ref<HTMLDivElement | null>(null);
const turnedoverRef = ref<HTMLDivElement | null>(null);
const framebgRef = ref<HTMLDivElement | null>(null);
const introRef = ref<HTMLDivElement | null>(null);
const nameRef = ref<HTMLDivElement | null>(null);
const name2Ref = ref<HTMLDivElement | null>(null);
const nameolRef = ref<HTMLDivElement | null>(null);
const countRef = ref<HTMLDivElement | null>(null);
const equipsRef = ref<HTMLDivElement | null>(null);
const judgesRef = ref<HTMLDivElement | null>(null);
const marksRef = ref<HTMLDivElement | null>(null);
const chainRef = ref<HTMLDivElement | null>(null);

onMounted(() => {
	const refs: Array<[string, HTMLDivElement | null]> = [
		["avatar", avatarRef.value],
		["action", actionRef.value],
		["avatar2", avatar2Ref.value],
		["turnedover", turnedoverRef.value],
		["framebg", framebgRef.value],
		["intro", introRef.value],
		["name", nameRef.value],
		["name2", name2Ref.value],
		["nameol", nameolRef.value],
		["count", countRef.value],
		["equips", equipsRef.value],
		["judges", judgesRef.value],
		["marks", marksRef.value],
		["chain", chainRef.value],
	];

	for (const [key, el] of refs) {
		if (el) {
			props.onNodeReady(key, el);
		}
	}

	if (avatarRef.value && ui?.click?.avatar) {
		avatarRef.value.addEventListener("click", ui.click.avatar);
	}
	if (avatar2Ref.value && ui?.click?.avatar2) {
		avatar2Ref.value.addEventListener("click", ui.click.avatar2);
	}
});
</script>
