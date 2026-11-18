<template>
	<!-- fragment（多根）：直接子代即 CardPackPane .menu-buttons.leftbutton 的直系子节点 -->
	<div class="config toggle cardpilecfg nomarginleft">
		选择牌堆
		<select
			v-model="selectedPile"
			style="float: right; width: 100px"
			@change="onSelectPile"
		>
			<option v-for="name in pileOptions" :key="name" :value="name">{{ name }}</option>
		</select>
	</div>

	<div
		v-for="name in customPileKeys"
		:key="name"
		class="config toggle cardpilecfg nomarginleft"
	>
		<span>{{ name }}</span>
		<span class="cardpiledelete" @click.stop="onDeletePile(name)">删除</span>
	</div>

	<div
		class="config more"
		:style="{ display: showRestart ? '' : 'none' }"
		@click="game.reload"
	>
		重新启动
	</div>

	<div
		class="config more"
		:class="{ on: saveExpanded }"
		@click="saveExpanded = !saveExpanded"
	>
		保存当前牌堆 <div>&gt;</div>
	</div>

	<div
		v-if="saveExpanded"
		class="config cardpileadd indent"
	>
		名称：<input
			v-model="saveName"
			type="text"
			style="margin-right: 3px; width: 120px"
		/><button @click="onSavePile">确定</button>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { game } from "noname";
import {
	deleteNamedCustomPile,
	ensureGlobalPileContainers,
	getAvailablePileOptions,
	getCustomPileKeys,
	resolveCurrentPileSelection,
	saveNamedCustomPile,
} from "./cardPileService.js";

const showRestart = ref(false);
const saveExpanded = ref(false);
const saveName = ref("自定义牌堆");
const pileOptions = ref<string[]>([]);
const customPileKeys = ref<string[]>([]);
const selectedPile = ref("默认牌堆");

function syncOptionsAndKeys() {
	const options = getAvailablePileOptions();
	pileOptions.value = options;
	customPileKeys.value = getCustomPileKeys();
	selectedPile.value = resolveCurrentPileSelection(options);
}

function onSelectPile() {
	game.saveConfig("cardpilename", selectedPile.value, true);
	showRestart.value = true;
}

function onDeletePile(name: string) {
	deleteNamedCustomPile(name);
	syncOptionsAndKeys();
}

function onSavePile() {
	saveNamedCustomPile(saveName.value);
	syncOptionsAndKeys();
}

onMounted(() => {
	ensureGlobalPileContainers();
	syncOptionsAndKeys();
});
</script>
