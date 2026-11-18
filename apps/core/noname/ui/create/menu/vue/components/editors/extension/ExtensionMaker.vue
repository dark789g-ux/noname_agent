<template>
	<div ref="makerRoot" class="extension-maker">
		<!-- pageboard：主元信息与功能入口（进入子编辑器时隐藏，@back 恢复显示） -->
		<div v-show="!activeDash" class="maker-pageboard">
			<div class="maker-ext-line" :style="extLineStyle">
				<span v-if="showNameLabel">扩展{{ isNewExtension ? "名" : "名称" }}：</span>
				<input
					v-show="showNameInput"
					ref="extNameInput"
					v-model="extName"
					type="text"
					:disabled="nameInputDisabled"
					:style="nameInputStyle"
				/>
			</div>

			<div v-show="showExtInfo" class="maker-info-line">
				<div v-for="field in infoFields" :key="field.key" class="maker-info-item">
					<span>{{ field.label }}：</span>
					<input v-model="field.value" type="text" style="width:100px" />
				</div>
				<div v-if="showConfirmBtn" class="maker-info-item">
					<button @click="onConfirm">确定</button>
				</div>
			</div>

			<div class="maker-actions">
				<button v-show="showConfirmBtn" @click="onConfirm">确定</button>
				<button v-show="!isNewExtension" @click="onRename">选项</button>
				<button v-show="!isNewExtension" @click="onReset">重置</button>
				<button v-show="!isNewExtension" @click="onSave">保存</button>
				<button v-show="!isNewExtension" @click="onExport">导出</button>
			</div>

			<div v-if="exportMsgVisible" class="maker-export-msg" style="width:calc(100% - 40px);text-align:left;margin-bottom:5px">
				<template v-if="isIOS">
					已保存。退出游戏并重新打开后生效
					<span class="closenode" @click="exportMsgVisible = false">&times;</span>
				</template>
				<template v-else>
					重启后生效。<span class="hrefnode" @click="game.reload">立即重启</span>
					<span class="closenode" @click="exportMsgVisible = false">&times;</span>
				</template>
			</div>

			<div v-if="shareMsgVisible" class="maker-share-msg" style="width:calc(100% - 40px);text-align:left;margin-bottom:5px">
				已导出扩展。<span class="hrefnode" @click="onShare">分享扩展</span>
				<span class="closenode" @click="shareMsgVisible = false">&times;</span>
			</div>

			<div v-show="showDashboard" class="maker-dashboard">
				<div
					v-for="dash in dashboardItems"
					:key="dash.key"
					class="menubutton large dashboard"
					:class="{ active: activeDash === dash.key }"
					@click="switchDash(dash.key)"
				>
					<div>{{ dash.short }}</div>
					<div>{{ dash.label }}</div>
				</div>
			</div>
		</div>

		<!-- 子编辑器容器（仅在进入某项 dashboard 时显示） -->
		<div v-show="showDashboard && activeDash">
			<CharacterEditor
				v-show="activeDash === 'character'"
				ref="characterEditorRef"
				:ext-name="extName"
				:is-new="isNewExtension"
				@back="activeDash = ''"
				@create-skill="onCreateSkillFromCharacter"
			/>
			<CardEditor
				v-show="activeDash === 'card'"
				ref="cardEditorRef"
				:ext-name="extName"
				:is-new="isNewExtension"
				@back="activeDash = ''"
			/>
			<SkillEditor
				v-show="activeDash === 'skill'"
				ref="skillEditorRef"
				:ext-name="extName"
				:is-new="isNewExtension"
				@back="onBackFromSkill"
			/>
			<CodeEditor
				v-show="activeDash === 'code'"
				ref="codeEditorRef"
				:ext-name="extName"
				:is-new="isNewExtension"
				@back="activeDash = ''"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { game, get, lib } from "noname";
import { menuBridge } from "../../../utils/menuBridge";
import CardEditor from "./CardEditor.vue";
import CharacterEditor from "./CharacterEditor.vue";
import CodeEditor from "./CodeEditor.vue";
import { packageAndImportExtension, triggerExtensionExport, type ExtensionMetaFields } from "./extensionPackager.js";
import SkillEditor from "./SkillEditor.vue";

const extName = ref("无名扩展");
let currentExtensionName: string | undefined;
let fromCharacter = false;
const showNameInput = ref(true);
const showNameLabel = ref(true);
const nameInputDisabled = ref(false);
const isNewExtension = ref(true);
const showDashboard = ref(false);
const showExtInfo = ref(false);
const showConfirmBtn = ref(true);
const exportMsgVisible = ref(false);
const shareMsgVisible = ref(false);
const activeDash = ref("");

const extNameInput = ref<HTMLInputElement | null>(null);

const infoFields = reactive([
	{ key: "author", label: "扩展作者", value: "" },
	{ key: "intro", label: "扩展描述", value: "" },
	{ key: "version", label: "扩展版本", value: "1.0" },
	{ key: "diskURL", label: "网盘地址", value: "" },
	{ key: "forumURL", label: "讨论地址", value: "" },
]);

const dashboardItems = [
	{ key: "character", short: "将", label: "编辑武将" },
	{ key: "card", short: "卡", label: "编辑卡牌" },
	{ key: "skill", short: "技", label: "编辑技能" },
	{ key: "code", short: "码", label: "编辑代码" },
];

const characterEditorRef = ref<InstanceType<typeof CharacterEditor> | null>(null);
const cardEditorRef = ref<InstanceType<typeof CardEditor> | null>(null);
const skillEditorRef = ref<InstanceType<typeof SkillEditor> | null>(null);
const codeEditorRef = ref<InstanceType<typeof CodeEditor> | null>(null);

const isIOS = computed(() => lib.device === "ios");

const extLineStyle = computed(() => ({
	padding: showExtInfo.value ? "20px 10px 10px 10px" : "10px",
	height: "22px",
	lineHeight: "22px",
	whiteSpace: "nowrap" as const,
	overflow: "visible" as const,
}));

const nameInputStyle = computed(() =>
	isNewExtension.value
		? { width: "80px", textAlign: "center" as const }
		: { width: "100px", textAlign: "" as const }
);

function readMetaFields(): ExtensionMetaFields {
	const getVal = (key: string) => infoFields.find(f => f.key === key)?.value ?? "";
	return {
		author: getVal("author"),
		intro: getVal("intro"),
		version: getVal("version"),
		diskURL: getVal("diskURL"),
		forumURL: getVal("forumURL"),
	};
}

function switchDash(key: string) {
	fromCharacter = false;
	activeDash.value = key;
}

function onCreateSkillFromCharacter() {
	fromCharacter = true;
	activeDash.value = "skill";
}

function onBackFromSkill() {
	if (fromCharacter) {
		fromCharacter = false;
		activeDash.value = "character";
		characterEditorRef.value?.updateSkill();
		return;
	}
	activeDash.value = "";
}

function onConfirm() {
	isNewExtension.value = false;
	showConfirmBtn.value = false;
	showNameLabel.value = true;
	showNameInput.value = true;
	showExtInfo.value = false;
	showDashboard.value = true;
	nameInputDisabled.value = true;
	activeDash.value = "character";
}

function onRename() {
	showConfirmBtn.value = true;
	showNameInput.value = true;
	showNameLabel.value = true;
	showExtInfo.value = true;
	showDashboard.value = false;
	nameInputDisabled.value = false;
}

function onReset() {
	if (confirm("当前扩展将被清除，是否确定？")) {
		editExtension();
	}
}

function runPackage(exportMode: boolean) {
	extName.value = extName.value || "无名扩展";
	packageAndImportExtension({
		extName: extName.value,
		previousExtensionName: currentExtensionName,
		isNewExtension: isNewExtension.value,
		meta: readMetaFields(),
		codeSections: codeEditorRef.value?.content || {},
		characterPack: {
			packData: characterEditorRef.value?.packData || { character: {}, translate: {} },
			imageData: characterEditorRef.value?.imageData || {},
			audioData: characterEditorRef.value?.audioData || {},
			imagePromises: characterEditorRef.value?.imagePromises || [],
		},
		cardPack: {
			packData: cardEditorRef.value?.packData || { card: {}, translate: {}, list: [] },
			pileList: cardEditorRef.value?.pileList || [],
			imageData: cardEditorRef.value?.imageData || {},
			imagePromises: cardEditorRef.value?.imagePromises || [],
		},
		skillPack: {
			packData: skillEditorRef.value?.packData || { skill: {}, translate: {} },
			audioData: skillEditorRef.value?.audioData || {},
		},
		exportMode,
		onSaved: () => {
			exportMsgVisible.value = true;
		},
	});
}

function onSave() {
	fromCharacter = false;
	activeDash.value = "";
	runPackage(false);
}

function onExport() {
	const fallbackExport = () => {
		runPackage(true);
		if (lib.config.show_extensionshare) {
			shareMsgVisible.value = true;
		}
	};
	triggerExtensionExport(extName.value, fallbackExport);
}

function onShare() {
	game.open("https://tieba.baidu.com/f?ie=utf-8&kw=%E6%97%A0%E5%90%8D%E6%9D%80");
}

function editExtension(name?: string) {
	extName.value = name || "无名扩展";
	currentExtensionName = name;
	fromCharacter = false;
	const pack = name ? lib.extensionPack[name] : null;

	infoFields[0].value = pack ? pack.author || "" : get.connectNickname() || "";
	infoFields[1].value = pack ? pack.intro || "" : "";
	infoFields[2].value = pack ? pack.version || "" : "1.0";
	infoFields[3].value = pack ? pack.diskURL || "" : "";
	infoFields[4].value = pack ? pack.forumURL || "" : "";

	nameInputDisabled.value = Boolean(name);
	isNewExtension.value = !name;
	showConfirmBtn.value = !name;
	showNameInput.value = true;
	showNameLabel.value = true;
	showDashboard.value = Boolean(name);
	showExtInfo.value = false;
	exportMsgVisible.value = false;
	shareMsgVisible.value = false;
	activeDash.value = "";

	characterEditorRef.value?.reset(name);
	cardEditorRef.value?.reset(name);
	skillEditorRef.value?.reset(name);
	codeEditorRef.value?.reset(name);
}

onMounted(() => {
	menuBridge.openExtensionMaker = editExtension;
	if (menuBridge.pendingEditExtensionName != null) {
		const name = menuBridge.pendingEditExtensionName;
		menuBridge.pendingEditExtensionName = null;
		editExtension(name);
	}
});

onUnmounted(() => {
	menuBridge.openExtensionMaker = null;
});

defineExpose({ editExtension });
</script>
