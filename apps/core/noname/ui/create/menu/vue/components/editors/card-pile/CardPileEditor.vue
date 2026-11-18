<template>
	<!-- fragment（多根）：直接子代即父级 .menu-buttons 的直系子节点，命中引擎 CSS 直接子代选择器 -->
	<div
		class="config more pile"
		:class="{ on: expanded }"
		@click="toggleExpand"
	>
		编辑牌堆 <div>&gt;</div>
	</div>

	<div
		class="config pointerspan cardpilecfg toggle"
		:style="{ display: expanded ? '' : 'none', marginTop: '5px' }"
	>
		<button @click="showAddPanel = !showAddPanel">添加卡牌</button>
		<button style="margin-left: 5px" @click="setAllDefaultEnabled(false)">全部关闭</button>
		<button style="margin-left: 5px" @click="setAllDefaultEnabled(true)">全部开启</button>
	</div>

	<div
		v-if="showAddPanel"
		class="config toggle cardpilecfg cardpilecfgadd"
		style="white-space: nowrap"
	>
		<select v-model="addName" style="width: 75px; margin-right: 2px; margin-left: -1px">
			<option v-for="opt in cardOptions" :key="opt[0]" :value="opt[0]">{{ opt[1] }}</option>
		</select>
		<select v-model="addSuit" style="width: 53px; margin-right: 2px">
			<option v-for="suit in PILE_SUIT_OPTIONS" :key="suit.value" :value="suit.value">{{ suit.label }}</option>
		</select>
		<select v-model="addNumber" style="width: 43px; margin-right: 2px">
			<option v-for="n in PILE_NUMBER_OPTIONS" :key="n" :value="n">{{ n }}</option>
		</select>
		<button style="width: 40px" @click="onAddCard">确定</button>
	</div>

	<div
		v-for="(item, idx) in addedCards"
		v-show="expanded"
		:key="`added-${mode}-${idx}`"
		class="config toggle cardpilecfg"
	>
		<span>{{ item.label }}</span>
		<span class="cardpiledelete" @click.stop="onDeleteAddedCard(idx)">删除</span>
	</div>

	<div
		v-for="item in defaultCards"
		v-show="expanded"
		:key="`default-${mode}-${item.index}`"
		class="config toggle cardpilecfg"
		:class="{ on: item.enabled }"
		type="defaultcards"
		@click="onToggleDefaultCard(item)"
	>
		<span>{{ item.label }}</span>
		<NonameToggle />
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import NonameToggle from "../../NonameToggle.vue";
import type { OptionPair } from "../shared/entityOptions.js";
import {
	addCardToModePile,
	getAddableCardOptions,
	loadModeAddedCards,
	loadModeDefaultCards,
	PILE_NUMBER_OPTIONS,
	PILE_SUIT_OPTIONS,
	removeAddedCardAt,
	setModeCardEnabled,
	type AddedPileItem,
	type PileCardItem,
} from "./cardPileService.js";

const props = defineProps<{
	mode: string;
}>();

const expanded = ref(false);
const showAddPanel = ref(false);
const addedCards = ref<AddedPileItem[]>([]);
const defaultCards = ref<PileCardItem[]>([]);
const cardOptions = ref<OptionPair[]>([]);
const addName = ref("");
const addSuit = ref(PILE_SUIT_OPTIONS[0].value);
const addNumber = ref<number>(PILE_NUMBER_OPTIONS[0]);

function reloadPileLists() {
	addedCards.value = loadModeAddedCards(props.mode);
	defaultCards.value = loadModeDefaultCards(props.mode);
	if (!cardOptions.value.length) {
		cardOptions.value = getAddableCardOptions();
		if (cardOptions.value.length) addName.value = cardOptions.value[0][0];
	}
}

function toggleExpand() {
	expanded.value = !expanded.value;
	if (!expanded.value) showAddPanel.value = false;
}

function onToggleDefaultCard(item: PileCardItem) {
	item.enabled = !item.enabled;
	setModeCardEnabled(props.mode, item.index, item.enabled);
}

function setAllDefaultEnabled(enabled: boolean) {
	for (const item of defaultCards.value) {
		if (item.enabled === enabled) continue;
		item.enabled = enabled;
		setModeCardEnabled(props.mode, item.index, enabled);
	}
}

function onAddCard() {
	if (!addName.value) return;
	const created = addCardToModePile(props.mode, [addSuit.value, addNumber.value, addName.value]);
	addedCards.value.unshift(created);
}

function onDeleteAddedCard(uiIndex: number) {
	// addedCards.value 头部插入新牌，而底层 lib.config.addedpile[mode] 追加或按同序保存；
	// 以对象引用定位底层索引，避免重复牌误删。
	const target = addedCards.value[uiIndex];
	if (!target) return;
	const backingList = loadModeAddedCards(props.mode);
	const backingIdx = backingList.findIndex(item => item.card === target.card);
	if (backingIdx >= 0) {
		removeAddedCardAt(props.mode, backingIdx);
	}
	addedCards.value.splice(uiIndex, 1);
}

onMounted(reloadPileLists);

watch(
	() => props.mode,
	() => {
		expanded.value = false;
		showAddPanel.value = false;
		reloadPileLists();
	}
);
</script>

<style>
.cardpiledelete {
	position: absolute;
	right: 5px;
	top: 50%;
	transform: translateY(-50%);
	color: #aaa;
	cursor: pointer;
	font-size: 12px;
}
.cardpiledelete:hover {
	color: #f44;
}
</style>
