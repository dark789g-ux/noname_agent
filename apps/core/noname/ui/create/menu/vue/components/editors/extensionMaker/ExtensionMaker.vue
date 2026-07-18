<template>
	<div ref="makerRoot" class="extension-maker">
		<!-- pageboard：主内容区域 -->
		<div ref="pageboardRef" class="maker-pageboard">
			<!-- 顶部：扩展名输入行（旧 189-216/259-312） -->
			<div class="maker-ext-line" :style="extLineStyle">
				<span v-if="showNameLabel">扩展{{ isNewExtension ? '名' : '名称' }}：</span>
				<input
					v-show="showNameInput"
					ref="extNameInput"
					v-model="extName"
					type="text"
					:disabled="nameInputDisabled"
					:style="nameInputStyle"
				/>
			</div>

			<!-- 扩展信息行（旧 227-257）：作者/描述/网盘/论坛/版本 -->
			<div
				v-show="showExtInfo"
				class="maker-info-line"
			>
				<div v-for="field in infoFields" :key="field.key" class="maker-info-item">
					<span>{{ field.label }}：</span>
					<input v-model="field.value" type="text" style="width:100px" />
				</div>
				<div v-if="showConfirmBtn" class="maker-info-item">
					<button @click="onConfirm">确定</button>
				</div>
			</div>

			<!-- 操作按钮行 -->
			<div class="maker-actions">
				<button v-show="showConfirmBtn" @click="onConfirm">确定</button>
				<button v-show="!isNewExtension" @click="onRename">选项</button>
				<button v-show="!isNewExtension" @click="onReset">重置</button>
				<button v-show="!isNewExtension" @click="onSave">保存</button>
				<button v-show="!isNewExtension" @click="onExport">导出</button>
			</div>

			<!-- 保存成功提示（旧 579-595） -->
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

			<!-- 分享提示（旧 597-611） -->
			<div v-if="shareMsgVisible" class="maker-share-msg" style="width:calc(100% - 40px);text-align:left;margin-bottom:5px">
				已导出扩展。<span class="hrefnode" @click="onShare">分享扩展</span>
				<span class="closenode" @click="shareMsgVisible = false">&times;</span>
			</div>

			<!-- Dashboard 区域（旧 613/622-632）：4 个 tab 切换 -->
			<div v-show="showDashboard" ref="dashboardRef" class="maker-dashboard">
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

			<!-- 子编辑器容器 -->
			<div v-show="showDashboard">
				<CharacterEditor
						v-show="activeDash === 'character'"
						ref="characterEditorRef"
						:ext-name="extName"
						:is-new="isNewExtension"
						@create-skill="onCreateSkillFromCharacter"
					/>
				<CardEditor
					v-show="activeDash === 'card'"
					ref="cardEditorRef"
					:ext-name="extName"
					:is-new="isNewExtension"
				/>
				<SkillEditor
					v-show="activeDash === 'skill'"
					ref="skillEditorRef"
					:ext-name="extName"
					:is-new="isNewExtension"
				/>
				<CodeEditor
					v-show="activeDash === 'code'"
					ref="codeEditorRef"
					:ext-name="extName"
					:is-new="isNewExtension"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { lib, game, get, ui } from "noname";
import { security } from "@/util/sandbox";
import { delay } from "@/util/index";
import { menuBridge } from "../../../utils/menuBridge";
import CharacterEditor from "./CharacterEditor.vue";
import CardEditor from "./CardEditor.vue";
import SkillEditor from "./SkillEditor.vue";
import CodeEditor from "./CodeEditor.vue";

// ---------------------------------------------------------------------------
// 扩展元信息（旧 227-257）
// ---------------------------------------------------------------------------
const extName = ref("无名扩展");
let currentExtensionName: string | undefined;
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

// 子编辑器 ref
const characterEditorRef = ref<InstanceType<typeof CharacterEditor> | null>(null);
const cardEditorRef = ref<InstanceType<typeof CardEditor> | null>(null);
const skillEditorRef = ref<InstanceType<typeof SkillEditor> | null>(null);
const codeEditorRef = ref<InstanceType<typeof CodeEditor> | null>(null);

// ---------------------------------------------------------------------------
// 计算属性
// ---------------------------------------------------------------------------
const isIOS = computed(() => lib.device === "ios");

const extLineStyle = computed(() => {
	if (showExtInfo.value) {
		return { padding: "20px 10px 10px 10px", height: "22px", lineHeight: "22px", whiteSpace: "nowrap", overflow: "visible" };
	}
	return { padding: "10px", height: "22px", lineHeight: "22px", whiteSpace: "nowrap", overflow: "visible" };
});

const nameInputStyle = computed(() => {
	if (isNewExtension.value) {
		return { width: "80px", textAlign: "center" as const };
	}
	return { width: "100px", textAlign: "" as const };
});

// ---------------------------------------------------------------------------
// dashboard 切换（旧 614-621）
// ---------------------------------------------------------------------------
function switchDash(key: string) {
	activeDash.value = key;
}

// ---------------------------------------------------------------------------
// 从武将编辑器跳转到技能编辑器（旧 1126-1132 createSkillButton）
// ---------------------------------------------------------------------------
function onCreateSkillFromCharacter() {
	switchDash("skill");
}

// ---------------------------------------------------------------------------
// 确认创建（旧 206-225）
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 重命名/选项（旧 493-513）
// ---------------------------------------------------------------------------
function onRename() {
	showConfirmBtn.value = true;
	showNameInput.value = true;
	showNameLabel.value = true;
	showExtInfo.value = true;
	showDashboard.value = false;
	nameInputDisabled.value = false;
}

// ---------------------------------------------------------------------------
// 重置（旧 520-524）
// ---------------------------------------------------------------------------
function onReset() {
	if (confirm("当前扩展将被清除，是否确定？")) {
		editExtension();
	}
}

// ---------------------------------------------------------------------------
// processExtension —— 核心打包逻辑（旧 326-481）
// ---------------------------------------------------------------------------
function processExtension(exportext: boolean) {
	// 旧版 326-331：扩展名改变时先移除旧扩展
	if (!isNewExtension.value && currentExtensionName) {
		if (currentExtensionName !== extName.value) {
			// @ts-expect-error removeExtension 运行时方法
			game.removeExtension(currentExtensionName);
		}
	}

	const currentExtName = extName.value;

	const waitingImage = Promise.allSettled([
		...(characterEditorRef.value?.imagePromises || []),
		...(cardEditorRef.value?.imagePromises || []),
	]);
	const waitDelay = delay(500);

	Promise.allSettled([waitingImage, waitDelay]).then(() => {
		const ext: Record<string, any> = {};
		const dash4Content = codeEditorRef.value?.content || {};
		for (const i in dash4Content) {
			try {
				if (["arenaReady", "content", "prepare", "precontent"].includes(i)) {
					ext[i] = security.exec2(`return (${dash4Content[i]});`).return;
					if (typeof ext[i] !== "function") {
						throw new Error("err");
					} else {
						ext[i] = ext[i].toString();
					}
				} else {
					ext[i] = security.exec2(dash4Content[i])[i];
					if (ext[i] == null || typeof ext[i] !== "object") {
						throw new Error("err");
					} else {
						ext[i] = JSON.stringify(ext[i]);
					}
				}
			} catch (e) {
				console.log(e);
				delete ext[i];
			}
		}

		extName.value = extName.value || "无名扩展";
		let str = `{name:"${extName.value}",editable:true,connect:false`;
		for (const i in ext) {
			str += "," + i + ":" + ext[i];
		}

		// 卡牌 pack.list（旧 366-369）
		const cardPack = cardEditorRef.value?.packData || { card: {}, translate: {}, list: [] };
		const cardPackList = cardEditorRef.value?.pileList || [];
		const cardPackCopy = get.copy(cardPack);
		cardPackCopy.list = cardPackList;

		str +=
			",package:" +
			get.stringify({
				character: ((pack: any) => {
					const { character } = pack;
					for (const [key, info] of Object.entries(character)) {
						if (Array.isArray(info)) {
							const tag = (info[4] as string[])?.find((tag: string) => /^die:.+$/.test(tag));
							if (tag) {
								info[4].remove(tag);
								const audio = `die:${typeof game.readFile === "function" ? "ext:" : "db:extension-"}${extName.value}/audio/die/${tag.slice(tag.lastIndexOf("/") + 1)}`;
								info[4].push(audio);
							}
						} else if (Array.isArray((info as any).dieAudios)) {
							const dieAudios = (info as any).dieAudios;
							const tag = dieAudios.find((tag: string) => /^ext:.+$/.test(tag));
							if (tag) {
								dieAudios.remove(tag);
								const audio = `${typeof game.readFile === "function" ? "ext:" : "db:extension-"}${extName.value}/audio/die/${tag.slice(tag.lastIndexOf("/") + 1)}`;
								dieAudios.push(audio);
							}
						}
					}
					return pack;
				})(characterEditorRef.value?.packData || { character: {}, translate: {} }),
				card: cardPackCopy,
				skill: skillEditorRef.value?.packData || { skill: {}, translate: {} },
				intro: infoFields.find(f => f.key === "intro")?.value ?? "",
				author: infoFields.find(f => f.key === "author")?.value ?? "",
				diskURL: infoFields.find(f => f.key === "diskURL")?.value ?? "",
				forumURL: infoFields.find(f => f.key === "forumURL")?.value ?? "",
				version: infoFields.find(f => f.key === "version")?.value ?? "",
			});

		const files: Record<string, string[]> = { character: [], card: [], skill: [], audio: [] };
		const charImages = characterEditorRef.value?.imageData || {};
		const charAudios = characterEditorRef.value?.audioData || {};
		const cardImages = cardEditorRef.value?.imageData || {};
		const skillAudios = skillEditorRef.value?.audioData || {};

		for (const i in charImages) {
			files.character.push(i);
		}
		for (const i in charAudios) {
			files.audio.push("audio/die/" + i);
		}
		for (const i in cardImages) {
			files.card.push(i);
		}
		for (const i in skillAudios) {
			files.skill.push(i);
		}
		str += ",files:" + JSON.stringify(files) + "}";

		const extension: Record<string, string> = {
			"extension.js": `import { lib, game, ui, get, ai, _status } from "noname";\nexport const type = "extension";\nexport default function(){\n\treturn ${str} \n};`,
			"info.json": JSON.stringify({
				name: extName.value,
				intro: infoFields.find(f => f.key === "intro")?.value ?? "",
				author: infoFields.find(f => f.key === "author")?.value ?? "",
				diskURL: infoFields.find(f => f.key === "diskURL")?.value ?? "",
				forumURL: infoFields.find(f => f.key === "forumURL")?.value ?? "",
				version: infoFields.find(f => f.key === "version")?.value ?? "",
			}),
			"README.md": "",
		};

		for (const id in charImages) {
			extension[id] = charImages[id];
		}
		for (const id in charAudios) {
			extension["audio/die/" + id] = charAudios[id];
		}
		for (const id in cardImages) {
			extension[id] = cardImages[id];
		}

		if (exportext) {
			game.importExtension(extension, null, extName.value);
		} else {
			game.importExtension(extension, () => {
				exportMsgVisible.value = true;
			});
		}
	});
}

// ---------------------------------------------------------------------------
// 保存（旧 531-537）
// ---------------------------------------------------------------------------
function onSave() {
	activeDash.value = "";
	processExtension(false);
}

// ---------------------------------------------------------------------------
// 导出（旧 544-577）
// ---------------------------------------------------------------------------
function onExport() {
	function oldExport() {
		processExtension(true);
		if (lib.config.show_extensionshare) {
			shareMsgVisible.value = true;
		}
	}
	if (
		typeof game.readFile === "function" &&
		(window as any).noname_shijianInterfaces &&
		typeof (window as any).noname_shijianInterfaces.shareExtensionWithPassWordAsync === "function" &&
		confirm("是否使用诗笺版自带的导出功能来导出扩展？")
	) {
		const extNameVal = extName.value;
		if (!extNameVal) {
			alert("未检测到扩展名，将使用无名杀自带的导出功能");
			oldExport();
			return;
		}
		game.readFile(
			`extension/${extNameVal}/extension.js`,
			() => {
				const pwd = prompt("请输入压缩包密码，不设密码直接点确定");
				if (pwd === "" || pwd === null) {
					(window as any).noname_shijianInterfaces.shareExtensionAsync(extNameVal);
				} else {
					(window as any).noname_shijianInterfaces.shareExtensionWithPassWordAsync(extNameVal, pwd);
				}
			},
			() => {
				alert("未检测到扩展文件，将使用无名杀自带的导出功能");
				oldExport();
			}
		);
	} else {
		oldExport();
	}
}

// ---------------------------------------------------------------------------
// 分享（旧 603-611）
// ---------------------------------------------------------------------------
function onShare() {
	game.open("https://tieba.baidu.com/f?ie=utf-8&kw=%E6%97%A0%E5%90%8D%E6%9D%80");
}

// ---------------------------------------------------------------------------
// editExtension —— 编辑/创建扩展（旧 182/259-325）
// 对应旧版 game.editExtension(name)
// ---------------------------------------------------------------------------
function editExtension(name?: string) {
	extName.value = name || "无名扩展";
	currentExtensionName = name;
	const pack = name ? lib.extensionPack[name] : null;

	if (pack) {
		infoFields[0].value = pack.author || "";
		infoFields[1].value = pack.intro || "";
		infoFields[3].value = pack.diskURL || "";
		infoFields[4].value = pack.forumURL || "";
		infoFields[2].value = pack.version || "";
	} else {
		infoFields[0].value = get.connectNickname() || "";
		infoFields[1].value = "";
		infoFields[3].value = "";
		infoFields[4].value = "";
		infoFields[2].value = "1.0";
	}

	if (name) {
		nameInputDisabled.value = true;
		isNewExtension.value = false;
		showConfirmBtn.value = false;
		showNameInput.value = true;
		showNameLabel.value = true;
		showDashboard.value = true;
	} else {
		nameInputDisabled.value = false;
		isNewExtension.value = true;
		showConfirmBtn.value = true;
		showNameInput.value = true;
		showNameLabel.value = true;
		showDashboard.value = false;
	}

	showExtInfo.value = false;
	exportMsgVisible.value = false;
	shareMsgVisible.value = false;
	activeDash.value = "";

	// 重置各编辑器
	characterEditorRef.value?.reset(name);
	cardEditorRef.value?.reset(name);
	skillEditorRef.value?.reset(name);
	codeEditorRef.value?.reset(name);
}

// ---------------------------------------------------------------------------
// 外部 API 桥接（旧 182/259）
// game.editExtension 稳定桥挂在 vue/index.ts menu() 内，经 menuBridge 分发：
// 本组件以 v-if 挂载，onMounted 注册 openExtensionMaker 并消费
// 未挂载窗口期暂存的 pendingEditExtensionName，onUnmounted 置 null。
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 暴露 editExtension 供外部调用
// ---------------------------------------------------------------------------
defineExpose({ editExtension });
</script>
