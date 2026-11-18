<template>
	<!--
		素材包导入 —— @deprecated
		仅在 lib.node?.fs || window.resolveLocalFileSystemURL 存在时随 FileManager 渲染
	-->
	<div class="file-import-board">
		<div
			class="config more"
			:class="{ on: expanded }"
			:style="{ padding: '13px 33px 4px', left: '0px' }"
			@click="expanded = !expanded"
		>
			导入素材包 <div>&gt;</div>
		</div>
		<div
			v-if="expanded"
			class="new_character export import"
			:style="{ padding: '0px 33px 10px', width: '100%', textAlign: 'left' }"
		>
			<div>
				<input
					ref="zipFileInputRef"
					type="file"
					accept="application/zip"
					style="width: 153px"
				/>
				<button @click="onZipImportClick">确定</button>
			</div>
			<div v-if="status !== 'idle'" style="width: 153px; font-size: small; margin-top: 8px">
				<span v-if="status === 'reading'">正在解压...</span>
				<span v-else-if="status === 'importing'">
					正在导入... <span class="hrefnode" @click="ui.click.consoleMenu()">详细信息</span>
				</span>
				<span v-else-if="status === 'done'">
					导入成功。<span class="hrefnode" @click="game.reload()">重新启动</span><span class="closenode" @click="status = 'idle'">&times;</span>
				</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { game, ui } from "noname";
import { parseAssetZipBuffer, writeAssetZipPlan } from "./platformFileOps.js";

const expanded = ref(false);
const status = ref<"idle" | "reading" | "importing" | "done">("idle");
const zipFileInputRef = ref<HTMLInputElement>();

function onZipImportClick() {
	if (status.value !== "idle") return;
	const fileToLoad = zipFileInputRef.value?.files?.[0];
	if (!fileToLoad) return;

	status.value = "reading";
	const fileReader = new FileReader();
	fileReader.onload = e => {
		const data = e.target?.result;
		if (!(data instanceof ArrayBuffer)) {
			status.value = "idle";
			return;
		}
		const plan = parseAssetZipBuffer(data);
		if (!plan.filelist.length) {
			alert("没有检测到素材");
			status.value = "idle";
			return;
		}
		if (!confirm(`本次将导入${plan.summaryText}，是否继续？`)) {
			status.value = "idle";
			return;
		}
		status.value = "importing";
		writeAssetZipPlan(plan, () => {
			status.value = "done";
		});
	};
	fileReader.readAsArrayBuffer(fileToLoad);
}
</script>
