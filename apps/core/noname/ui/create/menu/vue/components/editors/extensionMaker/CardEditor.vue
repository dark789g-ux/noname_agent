<template>
	<div ref="containerRef" class="menu-buttons card-editor">
		<!-- 返回按钮（旧 1455） -->
		<div class="config more margin-bottom" @click="$emit('back')">
			<div style="transform:none;margin-right:3px">&larr;</div>返回
		</div>

		<!-- 已有卡牌按钮区域（命令式渲染） -->
		<div ref="buttonsRef"></div>

		<!-- 创建/编辑卡牌表单（旧 1499-1734） -->
		<div v-show="showForm" class="new_character" style="height:173px">
			<!-- 卡牌预览（旧 1501-1538） -->
			<div class="card fullskin" :class="{ inited: fakemeInited, fullskin: isFullskin }" :style="fakemeStyle">
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

			<!-- 名称（旧 1540） -->
			<div class="indent" style="padding-top:8px">
				名称：<input v-model="cardName" type="text" @blur="updateButton" />
			</div>
			<!-- 描述（旧 1541） -->
			<div class="indent" style="padding-top:6px">
				描述：<input v-model="cardDescription" type="text" />
			</div>
			<!-- 编辑代码/引用代码（旧 1543-1623） -->
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
			<!-- 创建/编辑/取消按钮（旧 1642-1747） -->
			<div class="menubutton large new_card" :class="{ disabled: editDisabled }" @click="onCreateCard">
				{{ editButtonText }}
			</div>
			<div class="menubutton large new_card_delete" style="margin-left:13px" @click="onDeleteCard">
				{{ deleteButtonText }}
			</div>
		</div>

		<!-- 编辑牌堆（旧 1750-1836） -->
		<div v-show="showPileEditor" class="config more" :class="{ on: showPileEditor }">
			编辑牌堆 <div>&gt;</div>
		</div>
		<div v-if="showPileEditor" class="edit_pile">
			<div class="config toggle cardpilecfg cardpilecfgadd">
				<select v-model="pileAddName" style="width:75px;margin-right:2px;margin-left:-1px">
					<option v-for="item in cardPackList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<select v-model="pileAddSuit" style="width:53px;margin-right:2px">
					<option value="heart">红桃</option>
					<option value="diamond">方片</option>
					<option value="club">梅花</option>
					<option value="spade">黑桃</option>
				</select>
				<select v-model="pileAddNumber" style="width:43px;margin-right:2px">
					<option v-for="n in 13" :key="n" :value="n">{{ n }}</option>
				</select>
				<button style="width:40px" @click="onAddPile">确定</button>
			</div>
			<div ref="pileRef"></div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { lib, game, get, ui } from "noname";
import { security } from "@/util/sandbox";

interface Props {
	extName: string;
	isNew: boolean;
}

const props = defineProps<Props>();
defineEmits(["back"]);

// ---------------------------------------------------------------------------
// 响应式表单状态
// ---------------------------------------------------------------------------
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
const editButtonText = ref("创建卡牌");
const deleteButtonText = ref("取消");
const showPileEditor = ref(false);

// 头像数据
let fakemeImage64: string | undefined;
let fakemeImage: ArrayBuffer | undefined;

// 牌堆相关
const pileAddName = ref("");
const pileAddSuit = ref("heart");
const pileAddNumber = ref(1);
const pileList: any[] = [];

// 容器 ref
const containerRef = ref<HTMLElement | null>(null);
const buttonsRef = ref<HTMLElement | null>(null);
const cardImageInput = ref<HTMLInputElement | null>(null);
const pileRef = ref<HTMLElement | null>(null);

// ---------------------------------------------------------------------------
// 代码内容（旧 1612/1640）
// ---------------------------------------------------------------------------
const DEFAULT_CODE = 'card={\n    \n}\n\n/*\n示例：\ncard={\n    type:"basic",\n    enable:true,\n    filterTarget:true,\n    content:function(){\n        target.draw()\n    },\n    ai:{\n        order:1,\n        result:{\n            target:1\n        }\n    }\n}\n此例的效果为目标摸一张牌\n导出时本段代码中的换行、缩进以及注释将被清除\n*/';
let code = DEFAULT_CODE;

// ---------------------------------------------------------------------------
// 卡牌列表（旧 1563-1584）
// ---------------------------------------------------------------------------
const cardList: string[][] = [];
for (const i in lib.card) {
	if (lib.translate[i]) {
		cardList.push([i, lib.translate[i]]);
	}
}
cardList.sort((a, b) => {
	let aa = a[0], bb = b[0];
	if (aa.includes("_")) aa = aa.slice(aa.lastIndexOf("_") + 1);
	if (bb.includes("_")) bb = bb.slice(bb.lastIndexOf("_") + 1);
	if (aa !== bb) return aa > bb ? 1 : -1;
	return a[0] > b[0] ? 1 : -1;
});

// ---------------------------------------------------------------------------
// 内容数据（供 ExtensionMaker.processExtension 使用）
// ---------------------------------------------------------------------------
const packData = reactive({
	card: {} as Record<string, any>,
	translate: {} as Record<string, string>,
	list: [] as any[],
});
const imageData: Record<string, string> = {};
const imagePromises: Promise<any>[] = [];

const cardPackList = computed(() => {
	const list: string[][] = [];
	for (const i in packData.card) {
		list.push([i, packData.translate[i]]);
	}
	return list;
});

// ---------------------------------------------------------------------------
// 卡牌图片上传（旧 1507-1534）
// ---------------------------------------------------------------------------
function onCardImageChange() {
	if (!cardImageInput.value?.files?.length) return;
	const file = cardImageInput.value.files[0];
	const isJpg = file.name.includes(".jpg");
	const reader = new FileReader();
	reader.onload = (e: any) => {
		fakemeImage64 = e.target.result;
		if (isJpg) {
			fakemeStyle.backgroundImage = `url(${fakemeImage64})`;
			cardImageStyle.backgroundImage = "";
			isFullskin.value = false;
		} else {
			fakemeStyle.backgroundImage = "";
			cardImageStyle.backgroundImage = `url(${fakemeImage64})`;
			isFullskin.value = true;
		}
		fakemeInited.value = true;
		const reader2 = new FileReader();
		reader2.onload = (e2: any) => {
			fakemeImage = e2.target.result;
			updateButton();
		};
		reader2.readAsArrayBuffer(file, "UTF-8");
	};
	reader.readAsDataURL(file, "UTF-8");
}

// ---------------------------------------------------------------------------
// updateButton（旧 1309-1335）
// ---------------------------------------------------------------------------
function updateButton() {
	const name = cardName.value;
	if (!name) {
		editDisabled.value = true;
		return;
	}
	const id = name.split("|")[0];
	if (currentButton) {
		// 编辑态：仅当改成已存在的其它 id 时才禁用（旧 1317-1323）
		if ((currentButton as any).link !== id && (lib.card[id] || packData.card[id])) {
			editDisabled.value = true;
			return;
		}
	} else if (lib.card[id] || packData.card[id]) {
		editDisabled.value = true;
		return;
	}
	if (!fakemeImage && !fakemeInited.value) {
		editDisabled.value = true;
		return;
	}
	editDisabled.value = false;
}

// ---------------------------------------------------------------------------
// 编辑已有卡牌（旧 1336-1380 clickButton）：
// 点击已有卡牌按钮切换编辑模式，加载卡牌数据到表单；再次点击同一按钮退出编辑
// ---------------------------------------------------------------------------
let currentButton: HTMLElement | null = null;

function onCardButtonClick(button: HTMLElement) {
	if (currentButton === button) {
		resetEditor();
		return;
	}
	resetEditor();
	currentButton = button;
	showForm.value = true;
	const id = (button as any).link as string;
	const translate = packData.translate[id];
	cardName.value = translate && translate !== id ? `${id}|${translate}` : id;
	cardDescription.value = packData.translate[id + "_info"] || "";
	const fullskin = packData.card[id]?.fullskin ? true : false;
	isFullskin.value = fullskin;
	if (fullskin) {
		cardImageStyle.backgroundImage = button.style.backgroundImage;
		fakemeStyle.backgroundImage = "";
	} else {
		fakemeStyle.backgroundImage = button.style.backgroundImage;
		cardImageStyle.backgroundImage = "";
	}
	fakemeInited.value = true;
	code = "card=" + get.stringify(packData.card[id]);
	editButtonText.value = "编辑卡牌";
	deleteButtonText.value = "删除";
	editDisabled.value = false;
}

// ---------------------------------------------------------------------------
// 编辑代码（旧 1625-1638）
// ---------------------------------------------------------------------------
function onEditCode() {
	ui.create.editor({
		language: "javascript",
		value: code,
		saveInput: (result: string) => {
			const { card } = security.exec2(result);
			if (card == null || typeof card !== "object") {
				throw new Error("代码格式有错误，请对比示例代码仔细检查");
			}
			code = result;
		},
	});
}

// ---------------------------------------------------------------------------
// 引用代码（旧 1600-1610）
// ---------------------------------------------------------------------------
function onCiteConfirm() {
	showCitePanel.value = false;
	code = "card=" + get.stringify(lib.card[citeSelect.value]);
	if (lib.translate[citeSelect.value + "_info"]) {
		cardDescription.value = lib.translate[citeSelect.value + "_info"];
	}
}

// ---------------------------------------------------------------------------
// 创建/编辑卡牌（旧 1642-1734）
// ---------------------------------------------------------------------------
function onCreateCard() {
	let name = cardName.value;
	if (!name) {
		alert("请填写卡牌名\n提示：卡牌名格式为id+|+中文名，其中id必须惟一");
		return;
	}
	name = name.split("|");
	const translate = name[1] || name[0];
	const id = name[0];
	if (currentButton) {
		// 编辑态：id 未变走更新路径；改名则校验新 id 并迁移数据（旧 1655-1674）
		const oldId = (currentButton as any).link as string;
		if (oldId !== id) {
			if (lib.card[id] || packData.card[id]) {
				alert("卡牌名与现有卡牌重复，请更改");
				return;
			}
			for (const ext of [".png", ".jpg"]) {
				if (imageData[oldId + ext]) {
					imageData[id + ext] = imageData[oldId + ext];
					delete imageData[oldId + ext];
				}
			}
			delete packData.card[oldId];
			delete packData.translate[oldId];
			delete packData.translate[oldId + "_info"];
			(currentButton as any).link = id;
			// 旧 updatePile：改名后旧 id 的牌堆条目一并移除
			prunePile(oldId);
		}
	} else if (lib.card[id] || packData.card[id]) {
		alert("卡牌名与现有卡牌重复，请更改");
		return;
	}
	if (fakemeImage) {
		if (isFullskin.value) {
			imageData[id + ".png"] = fakemeImage as unknown as string;
			delete imageData[id + ".jpg"];
		} else {
			imageData[id + ".jpg"] = fakemeImage as unknown as string;
			delete imageData[id + ".png"];
		}
	} else if (!fakemeInited.value) {
		alert("请选择一个卡牌背景");
		return;
	}
	packData.translate[id] = translate;
	packData.translate[id + "_info"] = cardDescription.value;
	try {
		const { card } = security.exec2(code);
		if (card == null || typeof card !== "object") throw new Error("err");
		packData.card[id] = card;
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
	if (currentButton) {
		// 编辑态：更新已有按钮的显示（旧 1716-1731）
		if (fakemeImage64) {
			currentButton.style.backgroundImage = `url(${fakemeImage64})`;
		}
		(currentButton as any).nodename.innerHTML = translate;
	} else {
		createButton(id, isFullskin.value);
	}
	resetEditor();
}

// ---------------------------------------------------------------------------
// 删除卡牌（旧 1735-1747）
// ---------------------------------------------------------------------------
function onDeleteCard() {
	if (deleteButtonText.value === "删除" && currentButton) {
		const id = (currentButton as any).link as string;
		currentButton.remove();
		delete packData.card[id];
		delete packData.translate[id];
		delete packData.translate[id + "_info"];
		delete imageData[id + ".png"];
		delete imageData[id + ".jpg"];
		// 旧 updatePile：删除后该 id 的牌堆条目一并移除
		prunePile(id);
	}
	resetEditor();
}

// ---------------------------------------------------------------------------
// 牌堆编辑（旧 1766-1833）
// ---------------------------------------------------------------------------
// 旧 updatePile 的裁剪行为：从 pileList 与牌堆 DOM 中移除指定卡牌 id 的条目
function prunePile(id: string) {
	for (let i = pileList.length - 1; i >= 0; i--) {
		if (pileList[i][2] === id) pileList.splice(i, 1);
	}
	if (pileRef.value) {
		for (let i = pileRef.value.childNodes.length - 1; i >= 0; i--) {
			const node = pileRef.value.childNodes[i] as HTMLElement;
			if ((node as any).link?.[2] === id) node.remove();
		}
	}
}

function onAddPile() {
	const card = [pileAddSuit.value, pileAddNumber.value, pileAddName.value];
	pileList.push(card);
	if (pileRef.value) {
		const node = document.createElement("button");
		node.innerHTML = packData.translate[card[2]] + " " + lib.translate[card[0]] + card[1];
		(node as any).link = card;
		node.onclick = () => node.remove();
		pileRef.value.appendChild(node);
	}
}

// ---------------------------------------------------------------------------
// resetEditor（旧 1477-1496）
// ---------------------------------------------------------------------------
function resetEditor() {
	currentButton = null;
	cardName.value = "";
	cardDescription.value = "";
	fakemeInited.value = false;
	isFullskin.value = true;
	fakemeImage64 = undefined;
	fakemeImage = undefined;
	fakemeStyle.backgroundImage = "";
	cardImageStyle.backgroundImage = "";
	showForm.value = false;
	editButtonText.value = "创建卡牌";
	deleteButtonText.value = "取消";
	editDisabled.value = true;
	code = DEFAULT_CODE;
}

// 创建卡牌按钮（旧 1394-1410）
function createButton(name: string, fullskin: boolean) {
	if (!buttonsRef.value) return;
	const button = ui.create.div(".button.card");
	(button as any).link = name;
	(button as any).setBackground = (n: string) => {
		button.style.backgroundImage = `url(${lib.assetURL}image/card/${n})`;
	};
	(button as any).setBackground(name + (fullskin ? ".png" : ".jpg"));
	button.style.backgroundSize = "cover";
	button.noclick = true;
	button.classList.add("noclick");
	button.onclick = () => onCardButtonClick(button as unknown as HTMLElement);
	(button as any).nodename = ui.create.div(button, ".name", packData.translate[name]);
	buttonsRef.value.insertBefore(button, buttonsRef.value.childNodes[0] || null);
}

// ---------------------------------------------------------------------------
// reset（旧 1394-1453）
// ---------------------------------------------------------------------------
function reset(name?: string) {
	resetEditor();
	imagePromises.length = 0;
	// 切换/新建扩展时重置资源池（旧 1414）：先清空，下方再从扩展目录读图填入
	for (const key in imageData) delete imageData[key];
	if (buttonsRef.value) buttonsRef.value.innerHTML = "";
	if (pileRef.value) pileRef.value.innerHTML = "";
	if (name && lib.extensionPack[name]) {
		const pack = lib.extensionPack[name].card || { card: {}, translate: {} };
		packData.card = get.copy(pack.card);
		packData.translate = get.copy(pack.translate);
		if (Array.isArray(pack.list)) {
			packData.list = get.copy(pack.list);
			pileList.length = 0;
			pileList.push(...packData.list);
		}
		for (const id in packData.card) {
				const fullskin = packData.card[id].fullskin ? true : false;
				const file = id + (fullskin ? ".png" : ".jpg");
				const url = lib.assetURL + "extension/" + name + "/" + file;
				imagePromises.push(
					game.promises
						.readFile(url)
						.then((result: any) => {
							imageData[file] = result;
						})
						.catch((e: any) => console.error(e))
				);
				createButton(id, fullskin);
			}
	} else {
		packData.card = {};
		packData.translate = {};
		packData.list = [];
		showForm.value = true;
	}
}

// ---------------------------------------------------------------------------
// 暴露数据/方法供 ExtensionMaker 使用
// ---------------------------------------------------------------------------
defineExpose({
	packData,
	imageData,
	imagePromises,
	pileList,
	reset,
});
</script>
