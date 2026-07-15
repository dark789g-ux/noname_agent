<template>
	<div class="options-right-pane">
		<!-- 标准 mode：渲染 NonameConfig 列表 -->
		<template v-if="currentMode !== 'create'">
			<!-- mode="skill" 时渲染 BanSkillEditor + 非 autoskill/banskill 配置项 -->
			<template v-if="currentMode === 'skill'">
				<BanSkillEditor
					v-if="skillBanEditorConfigs.length"
					:skill-configs="skillBanEditorConfigs"
				/>
				<NonameConfig
					v-for="cfg in standardConfigs"
					:key="cfg.name"
					:config="cfg"
				/>
			</template>

			<!-- mode != "skill" 的标准配置列表 -->
			<template v-else>
				<NonameConfig
					v-for="cfg in rightPaneConfigs"
					:key="cfg.name"
					:config="cfg"
				/>
				<!-- import_data_button 特殊渲染 -->
				<div v-if="hasImportDataButton" class="config" style="display: none">
					<!-- TODO: 阶段 6 —— 旧版 ui.import_data_button = cfgnode 外部 API -->
					<input type="file" style="width: 153px" @change="onImportDataChange" />
					<button @click="onImportDataClick">确定</button>
				</div>
				<!-- import_music 特殊渲染 -->
				<div v-if="hasImportMusic" class="config">
					<!-- TODO: 阶段 6 —— 旧版 ui.background_music_setting 外部 API -->
					<input type="file" accept="audio/*" style="width: 153px" @change="onImportMusicChange" />
					<button @click="onImportMusicClick">导入音乐</button>
				</div>
			</template>
		</template>

		<!-- mode="create"（文件）：渲染 FileManager -->
		<FileManager v-if="currentMode === 'create'" />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { game, lib, _status, ui } from "noname";
import type { RightPaneContext } from "../types";
import type { SelectConfigData } from "../../../../../../typings/type";
import optionsMenuData, { handleImportDataButton, handleImportMusic } from "../data/optionsMenuData";
import NonameConfig from "./NonameConfig.vue";
import BanSkillEditor from "./editors/BanSkillEditor.vue";
import FileManager from "./editors/FileManager.vue";

interface Props {
	ctx: RightPaneContext;
}

const props = defineProps<Props>();

/** 当前左栏 mode */
const currentMode = computed(() => props.ctx.item.key);

/**
 * 通过 menuData.getRightPane 获取配置列表
 * （optionsMenuData.getRightPane 已处理 mode="create" 返回空数组）
 */
const rightPaneConfigs = computed(() => {
	return optionsMenuData.getRightPane(props.ctx);
});

/**
 * mode="skill" 时：
 * - autoskill/banskill 项交给 BanSkillEditor 渲染
 * - 其余项作为标准 NonameConfig 渲染
 */
const skillBanEditorConfigs = computed(() => {
	if (currentMode.value !== "skill") return [];
	return rightPaneConfigs.value.filter(c => {
		// @ts-expect-error type 是旧版扩展属性，不在 SelectConfigData 类型声明中
		return c.type === "autoskill" || c.type === "banskill";
	});
});

const standardConfigs = computed(() => {
	if (currentMode.value !== "skill") return rightPaneConfigs.value;
	return rightPaneConfigs.value.filter(c => {
		// @ts-expect-error type 是旧版扩展属性
		return c.type !== "autoskill" && c.type !== "banskill";
	});
});

/** 是否包含 import_data_button 配置项 */
const hasImportDataButton = computed(() => {
	return rightPaneConfigs.value.some(c => c._name === "import_data_button");
});

/** 是否包含 import_music 配置项 */
const hasImportMusic = computed(() => {
	return rightPaneConfigs.value.some(c => c._name === "import_music");
});

// ---------------------------------------------------------------------------
// import_data_button 的桥接
// 对应旧版 362-415：通过 cfgnode.querySelector("button").onclick 处理
// Vue 版通过 @click 直接调用
// ---------------------------------------------------------------------------

let importDataFile: File | null = null;

function onImportDataChange(e: Event) {
	importDataFile = (e.target as HTMLInputElement).files?.[0] || null;
}

function onImportDataClick() {
	if (!importDataFile) return;
	// 构造模拟的 this 上下文（旧版 this = button element，this.previousSibling = input）
	let fakeThis = { files: [importDataFile] } as any;
	handleImportDataButton.call(fakeThis);
}

// ---------------------------------------------------------------------------
// import_music 的桥接
// 对应旧版 416-474
// ---------------------------------------------------------------------------

let importMusicFile: File | null = null;

function onImportMusicChange(e: Event) {
	importMusicFile = (e.target as HTMLInputElement).files?.[0] || null;
}

function onImportMusicClick() {
	if (!importMusicFile) return;
	let fakeThis = { files: [importMusicFile] } as any;
	handleImportMusic.call(fakeThis);
}
</script>
