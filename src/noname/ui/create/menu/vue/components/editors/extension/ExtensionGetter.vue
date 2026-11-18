<template>
	<div class="extension-get-page">
		<div class="config more" :class="{ on: importExpanded }" @click="importExpanded = !importExpanded">
			导入扩展 <div>&gt;</div>
		</div>
		<div
			v-show="importExpanded"
			class="new_character export import"
			style="margin-left:5px;margin-top:5px;margin-bottom:5px;width:100%;text-align:left"
		>
			<div>
				<input
					ref="importFileInput"
					type="file"
					accept="application/zip"
					style="width:153px"
				/>
				<button @click="onImportClick">确定</button>
			</div>
		</div>

		<div class="config" @click="alertDownloadURL">修改下载地址</div>

		<div v-if="showReload" class="config toggle pointerdiv" @click="game.reload">
			重新启动
		</div>

		<div class="config toggle" style="height:0;margin-top:5px"></div>

		<div class="extension-list">
			<div
				v-for="item in catalogItems"
				:key="item.name"
				class="videonode menubutton extension large"
			>
				<div class="caption">
					{{ item.name }}
					<div
						v-if="hasDownload"
						class="menubutton text"
						:class="{
							active: item.status === 'download',
							transparent2: item.status === 'installed',
							highlight: item.status === 'update',
							update: item.status === 'update',
							nopointer: item.status !== 'download' && item.status !== 'update',
							'button-downloading': item.status === 'downloading',
						}"
						style="z-index: 5"
						@click.stop="onDownloadItem(item)"
					>
						<template v-if="item.status === 'downloading'">
							<span>正在下载</span>
							<div>正在下载</div>
							<div class="button-progress">
								<div :style="{ width: `${item.progressPercent}%` }"></div>
							</div>
						</template>
						<template v-else>{{ statusLabel(item.status) }}</template>
					</div>
				</div>
				<div class="text author">
					作者：{{ item.author }}<span>({{ item.size }})</span>
				</div>
				<div class="text">更新日期：{{ item.date }}</div>
				<div class="text">{{ item.intro }}</div>
				<div v-if="!hasDownload && (item.diskURL || item.forumURL)" class="text">
					<a v-if="item.diskURL" :href="item.diskURL" target="_blank">网盘下载</a>
					<template v-if="item.diskURL && item.forumURL">&nbsp;&nbsp;</template>
					<a v-if="item.forumURL" :href="item.forumURL" target="_blank">论坛讨论</a>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { game, lib } from "noname";
import {
	downloadCatalogExtension,
	fetchExtensionCatalog,
	importExtensionZipFile,
	resolveExtensionRepoURL,
	type CatalogExtensionItem,
	type ExtensionItemStatus,
} from "./extensionDownloader.js";

const importExpanded = ref(false);
const importFileInput = ref<HTMLInputElement | null>(null);
const showReload = ref(false);
const catalogItems = ref<CatalogExtensionItem[]>([]);
let repoUrl = "";

const hasDownload = computed(() => Boolean(game.download));

const STATUS_LABELS: Record<Exclude<ExtensionItemStatus, "downloading">, string> = {
	download: "下载扩展",
	update: "更新扩展",
	installed: "已安装",
	install_failed: "安装失败",
	download_failed: "下载失败",
};

function statusLabel(status: ExtensionItemStatus): string {
	return status === "downloading" ? "正在下载" : STATUS_LABELS[status];
}

async function onImportClick() {
	const fileToLoad = importFileInput.value?.files?.[0];
	if (!fileToLoad) return;
	if (await importExtensionZipFile(fileToLoad)) {
		importExpanded.value = false;
	}
}

function alertDownloadURL() {
	alert('您可以在"设置→通用→获取扩展地址"中，修改下载扩展时所采用的地址。');
}

function onDownloadItem(item: CatalogExtensionItem) {
	downloadCatalogExtension(item, repoUrl, () => {
		showReload.value = true;
	});
}

async function loadCatalog() {
	repoUrl = resolveExtensionRepoURL();
	try {
		catalogItems.value = await fetchExtensionCatalog(repoUrl);
	} catch (reason) {
		console.log(reason);
	}
}

onMounted(() => {
	if (!lib.config.menu_loadondemand) {
		void loadCatalog();
	}
});
</script>
