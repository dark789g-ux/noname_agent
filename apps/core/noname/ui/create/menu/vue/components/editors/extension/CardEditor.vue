<template>
	<div class="menu-buttons card-editor">
		<div class="config more margin-bottom" @click="$emit('back')">
			<div style="transform:none;margin-right:3px">&larr;</div>返回
		</div>

		<!-- 已有卡牌按钮（直挂 .menu-buttons，匹配 .menu-buttons > .button.card > .name） -->
		<div
			v-for="item in cardButtons"
			:key="item.id"
			class="button card noclick"
			:class="{ fullskin: item.fullskin }"
			:style="cardButtonContainerStyle(item)"
			@click="onCardButtonClick(item)"
		>
			<div class="image" :style="cardButtonInnerStyle(item)"></div>
			<div class="name">{{ packData.translate[item.id] || item.id }}</div>
		</div>

		<div class="config more" :class="{ on: showForm }" @click="showForm = !showForm">
			{{ formHeaderText }} <div>&gt;</div>
		</div>

		<div v-show="showForm" class="new_character" style="height:173px">
			<div class="card" :class="{ inited: fakemeInited, fullskin: isFullskin }" :style="fakemeStyle">
				<input
					ref="cardImageInput"
					type="file"
					accept="image/*"
					class="fileinput"
					@change="onCardImageChange"
				/>
				<div class="image" :style="cardImageStyle"></div>
				<div class="name">选择背景</div>
			</div>

			<div class="indent" style="padding-top:8px">
				名称：<input v-model="cardName" type="text" @blur="updateButton" />
			</div>
			<div class="indent" style="padding-top:6px">
				描述：<input v-model="cardDescription" type="text" />
			</div>

			<div style="position:relative">
				<button v-show="!showCitePanel" style="left:123px;top:66px;position:absolute" @click="onEditCode">编辑代码</button>
				<button v-show="!showCitePanel" style="left:123px;top:90px;position:absolute" @click="showCitePanel = true">引用代码</button>
				<select
					v-show="showCitePanel"
					v-model="citeSelect"
					style="left:123px;top:66px;position:absolute;max-width:120px"
				>
					<option v-for="item in cardList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<div v-show="showCitePanel" style="left:123px;top:90px;position:absolute">
					<button @click="onCiteConfirm">引用</button>
					<button style="margin-left:3px" @click="showCitePanel = false">取消</button>
				</div>
			</div>

			<div class="menubutton large new_card" :class="{ disabled: editDisabled }" @click="onCreateCard">
				{{ editButtonText }}
			</div>
			<div class="menubutton large new_card_delete" style="margin-left:13px" @click="onDeleteCard">
				{{ deleteButtonText }}
			</div>
		</div>

		<!-- 编辑牌堆折叠头 + 内嵌牌堆区 -->
		<div v-show="cardPackList.length > 0" class="config more" :class="{ on: showPileEditor }" @click="showPileEditor = !showPileEditor">
			编辑牌堆 <div>&gt;</div>
		</div>
		<div v-show="showPileEditor && cardPackList.length > 0" class="edit_pile">
			<div class="config toggle cardpilecfg cardpilecfgadd">
				<select v-model="pileAddName" style="width:75px;margin-right:2px;margin-left:-1px">
					<option v-for="item in cardPackList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<select v-model="pileAddSuit" style="width:53px;margin-right:2px">
					<option v-for="suit in SUIT_OPTIONS" :key="suit.value" :value="suit.value">{{ suit.label }}</option>
				</select>
				<select v-model="pileAddNumber" style="width:43px;margin-right:2px">
					<option v-for="n in 13" :key="n" :value="n">{{ n }}</option>
				</select>
				<button style="width:40px" @click="onAddPile">确定</button>
			</div>
			<div>
				<button
					v-for="(card, idx) in pileList"
					:key="`${card[2]}-${card[0]}-${card[1]}-${idx}`"
					@click="pileList.splice(idx, 1)"
				>
					{{ `${packData.translate[card[2]] || lib.translate[card[2]] || card[2]} ${lib.translate[card[0]] || card[0]}${card[1]}` }}
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { game, get, lib } from "noname";
import { security } from "@/util/sandbox";
import { getTranslatedCardOptions, SUIT_OPTIONS, type OptionPair } from "../shared/entityOptions.js";
import { hasEntityIdConflict, openValidatedCodeEditor, parseEntityName, readImageAsDataUrlAndBuffer, validateNamedObjectCode } from "./makerShared.js";

interface CardButtonItem {
	id: string;
	fullskin: boolean;
	imageUrl?: string;
}

defineProps<{ extName: string; isNew: boolean }>();
defineEmits(["back"]);

const DEFAULT_CODE =
	'card={\n    \n}\n\n/*\n示例：\ncard={\n    type:"basic",\n    enable:true,\n    filterTarget:true,\n    content:function(){\n        target.draw()\n    },\n    ai:{\n        order:1,\n        result:{\n            target:1\n        }\n    }\n}\n此例的效果为目标摸一张牌\n导出时本段代码中的换行、缩进以及注释将被清除\n*/';

const cardName = ref("");
const cardDescription = ref("");
const showForm = ref(false);
const fakemeInited = ref(false);
const editDisabled = ref(true);
const isFullskin = ref(true);
const fakemeStyle = reactive<Record<string, string>>({});
const cardImageStyle = reactive<Record<string, string>>({});
const showCitePanel = ref(false);
const citeSelect = ref("");
const showPileEditor = ref(false);
const editingId = ref<string | null>(null);
const cardButtons = ref<CardButtonItem[]>([]);

let fakemeImage64: string | undefined;
let fakemeImage: ArrayBuffer | undefined;
let code = DEFAULT_CODE;

const pileAddName = ref("");
const pileAddSuit = ref("heart");
const pileAddNumber = ref(1);
const pileList = ref<any[]>([]);

const cardImageInput = ref<HTMLInputElement | null>(null);
const cardList: OptionPair[] = getTranslatedCardOptions();
if (cardList.length) citeSelect.value = cardList[0][0];

const packData = reactive({
	card: {} as Record<string, any>,
	translate: {} as Record<string, string>,
	list: [] as any[],
});
const imageData: Record<string, any> = {};
const imagePromises: Promise<any>[] = [];

const editButtonText = computed(() => (editingId.value ? "编辑卡牌" : "创建卡牌"));
const deleteButtonText = computed(() => (editingId.value ? "删除" : "取消"));
const formHeaderText = computed(() => (editingId.value ? "编辑卡牌" : "创建卡牌"));

const cardPackList = computed<OptionPair[]>(() =>
	Object.keys(packData.card).map(id => [id, packData.translate[id] || id])
);

watch(
	cardPackList,
	list => {
		if (!list.length) {
			pileAddName.value = "";
		} else if (!list.some(([id]) => id === pileAddName.value)) {
			pileAddName.value = list[0][0];
		}
	},
	{ immediate: true }
);

function cardButtonContainerStyle(item: CardButtonItem) {
	if (!item.imageUrl || item.fullskin) return undefined;
	return {
		color: "white",
		textShadow: "black 0 0 2px",
		backgroundImage: `url(${item.imageUrl})`,
		backgroundSize: "cover",
	};
}

function cardButtonInnerStyle(item: CardButtonItem) {
	if (!item.imageUrl || !item.fullskin) return undefined;
	return { backgroundImage: `url(${item.imageUrl})` };
}

async function onCardImageChange() {
	const file = cardImageInput.value?.files?.[0];
	if (!file) return;
	const isJpg = file.name.includes(".jpg");
	const { dataUrl, buffer } = await readImageAsDataUrlAndBuffer(file);
	fakemeImage64 = dataUrl;
	if (isJpg) {
		fakemeStyle.backgroundImage = `url(${dataUrl})`;
		cardImageStyle.backgroundImage = "";
		isFullskin.value = false;
	} else {
		fakemeStyle.backgroundImage = "";
		cardImageStyle.backgroundImage = `url(${dataUrl})`;
		isFullskin.value = true;
	}
	fakemeInited.value = true;
	fakemeImage = buffer;
	updateButton();
}

function updateButton() {
	const parsed = parseEntityName(cardName.value);
	if (!parsed) {
		editDisabled.value = true;
		return;
	}
	if (hasEntityIdConflict(parsed.id, editingId.value, lib.card, packData.card)) {
		editDisabled.value = true;
		return;
	}
	editDisabled.value = !fakemeImage && !fakemeInited.value;
}

function onCardButtonClick(item: CardButtonItem) {
	if (editingId.value === item.id) {
		resetEditor();
		return;
	}
	resetEditor();
	editingId.value = item.id;
	showForm.value = true;
	const translate = packData.translate[item.id];
	cardName.value = translate && translate !== item.id ? `${item.id}|${translate}` : item.id;
	cardDescription.value = packData.translate[`${item.id}_info`] || "";
	isFullskin.value = item.fullskin;
	const bgUrl = item.imageUrl ? `url(${item.imageUrl})` : "";
	if (item.fullskin) {
		cardImageStyle.backgroundImage = bgUrl;
		fakemeStyle.backgroundImage = "";
	} else {
		fakemeStyle.backgroundImage = bgUrl;
		cardImageStyle.backgroundImage = "";
	}
	fakemeInited.value = true;
	code = `card=${get.stringify(packData.card[item.id])}`;
	editDisabled.value = false;
}

function onEditCode() {
	openValidatedCodeEditor(
		code,
		result => validateNamedObjectCode("card", result),
		result => {
			code = result;
		}
	);
}

function onCiteConfirm() {
	showCitePanel.value = false;
	if (!citeSelect.value) return;
	code = `card=${get.stringify(lib.card[citeSelect.value])}`;
	if (lib.translate[`${citeSelect.value}_info`]) {
		cardDescription.value = lib.translate[`${citeSelect.value}_info`];
	}
}

function prunePile(id: string) {
	pileList.value = pileList.value.filter(entry => entry[2] !== id);
}

function onCreateCard() {
	const parsed = parseEntityName(cardName.value);
	if (!parsed) {
		alert("请填写卡牌名\n提示：卡牌名格式为id+|+中文名，其中id必须惟一");
		return;
	}
	const { id, translate } = parsed;
	const oldId = editingId.value;
	if (hasEntityIdConflict(id, oldId, lib.card, packData.card)) {
		alert("卡牌名与现有卡牌重复，请更改");
		return;
	}
	if (oldId !== null && oldId !== id) {
		for (const ext of [".png", ".jpg"]) {
			if (imageData[oldId + ext]) {
				imageData[id + ext] = imageData[oldId + ext];
				delete imageData[oldId + ext];
			}
		}
		delete packData.card[oldId];
		delete packData.translate[oldId];
		delete packData.translate[`${oldId}_info`];
		prunePile(oldId);
	}
	if (fakemeImage) {
		if (isFullskin.value) {
			imageData[`${id}.png`] = fakemeImage;
			delete imageData[`${id}.jpg`];
		} else {
			imageData[`${id}.jpg`] = fakemeImage;
			delete imageData[`${id}.png`];
		}
	} else if (!fakemeInited.value) {
		alert("请选择一个卡牌背景");
		return;
	}

	packData.translate[id] = translate;
	packData.translate[`${id}_info`] = cardDescription.value;
	try {
		packData.card[id] = validateNamedObjectCode("card", code);
	} catch {
		packData.card[id] = {};
	}
	if (fakemeInited.value) {
		if (isFullskin.value) {
			packData.card[id].fullskin = true;
			delete packData.card[id].fullimage;
		} else {
			packData.card[id].fullimage = true;
			delete packData.card[id].fullskin;
		}
	}

	if (oldId !== null) {
		const btn = cardButtons.value.find(b => b.id === oldId);
		if (btn) {
			btn.id = id;
			btn.fullskin = isFullskin.value;
			if (fakemeImage64) btn.imageUrl = fakemeImage64;
		}
	} else {
		cardButtons.value.unshift({ id, fullskin: isFullskin.value, imageUrl: fakemeImage64 });
	}
	resetEditor();
}

function onDeleteCard() {
	if (editingId.value) {
		const id = editingId.value;
		const idx = cardButtons.value.findIndex(b => b.id === id);
		if (idx >= 0) cardButtons.value.splice(idx, 1);
		delete packData.card[id];
		delete packData.translate[id];
		delete packData.translate[`${id}_info`];
		delete imageData[`${id}.png`];
		delete imageData[`${id}.jpg`];
		prunePile(id);
	}
	resetEditor();
}

function onAddPile() {
	if (!pileAddName.value) return;
	pileList.value.push([pileAddSuit.value, pileAddNumber.value, pileAddName.value]);
}

function resetEditor() {
	editingId.value = null;
	cardName.value = "";
	cardDescription.value = "";
	fakemeInited.value = false;
	isFullskin.value = true;
	fakemeImage64 = undefined;
	fakemeImage = undefined;
	fakemeStyle.backgroundImage = "";
	cardImageStyle.backgroundImage = "";
	showForm.value = false;
	showCitePanel.value = false;
	editDisabled.value = true;
	code = DEFAULT_CODE;
}

function reset(name?: string) {
	resetEditor();
	imagePromises.length = 0;
	cardButtons.value = [];
	pileList.value = [];
	showPileEditor.value = false;
	for (const key in imageData) delete imageData[key];

	if (name && lib.extensionPack[name]) {
		const pack = lib.extensionPack[name].card || { card: {}, translate: {} };
		packData.card = get.copy(pack.card);
		packData.translate = get.copy(pack.translate);
		if (Array.isArray(pack.list)) {
			packData.list = get.copy(pack.list);
			pileList.value = [...packData.list];
		}
		for (const id in packData.card) {
			const fullskin = Boolean(packData.card[id].fullskin);
			const file = id + (fullskin ? ".png" : ".jpg");
			const url = `${lib.assetURL}extension/${name}/${file}`;
			cardButtons.value.unshift({ id, fullskin, imageUrl: url });
			imagePromises.push(
				game.promises
					.readFile(url)
					.then((result: any) => {
						imageData[file] = result;
					})
					.catch((e: any) => console.error(e))
			);
		}
	} else {
		packData.card = {};
		packData.translate = {};
		packData.list = [];
		showForm.value = true;
	}
}

defineExpose({
	packData,
	imageData,
	imagePromises,
	pileList,
	reset,
});
</script>
