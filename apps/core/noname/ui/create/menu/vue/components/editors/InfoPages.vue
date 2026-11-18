<template>
	<div>
		<!-- 更新页 -->
		<div v-if="pageKey === 'update'" class="menu-help">
			<ul>
				<li>游戏版本：{{ lib.version }}</li>
				<li>
					由于无名杀正在重构项目结构，在线更新暂时无法使用，请访问github主页获取最新版本。
				</li>
			</ul>
			<p style="white-space: nowrap; margin-top: 8px">
				<button @click="openGithub">访问项目主页</button>
			</p>
		</div>

		<!-- 内核页 -->
		<div v-else-if="pageKey === 'core'" class="menu-sym">
			<div class="core-info" style="margin: 10px 0; text-align: left;">
				<div v-for="(line, idx) in coreInfoLines" :key="idx">{{ line }}</div>
			</div>
			<button class="changeWebviewProvider" @click="changeWebview">点击切换WebView实现</button>
		</div>

		<!-- 战绩页 -->
		<div v-else-if="pageKey === 'record'" style="padding-bottom: 10px">
			<template v-for="(item, idx) in recordItems" :key="item.mode">
				<div class="config indent" style="margin-bottom: -5px">{{ item.modeLabel }}</div>
				<div class="config indent" style="height: auto">
					<span v-html="item.recordHtml"></span>
					<span class="pointerdiv" @click="onResetRecordClick(idx)">
						{{ item.confirming ? "确定" : "重置" }}
					</span>
				</div>
			</template>
		</div>

		<!-- 帮助页 -->
		<div v-else-if="pageKey === 'help'" ref="helpContainerRef" class="menu-help"></div>
	</div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { game, get, lib } from "noname";
import { getHelpPageContent } from "../../data/otherMenuData";

interface RecordEntry {
	mode: string;
	modeLabel: string;
	recordHtml: string;
	confirming: boolean;
}

const props = defineProps<{
	pageKey: string;
	helpName?: string;
}>();

const helpContainerRef = ref<HTMLDivElement>();
const recordItems = ref<RecordEntry[]>([]);
const confirmTimers = new Map<string, number>();

const coreInfoLines = computed<string[]>(() => {
	if (props.pageKey !== "core") return [];
	const coreInfo = get.coreInfo();
	const lines = [
		`浏览器内核: ${coreInfo[0]}`,
		`浏览器版本: ${coreInfo[1]}.${coreInfo[2]}.${coreInfo[3]}`,
	];

	if (lib.device === "android") {
		lines.push("应用平台: 安卓");
		const bridge = (window as any).NonameAndroidBridge;
		if (typeof bridge?.getPackageName === "function") {
			lines.push(`安卓应用包名: ${bridge.getPackageName()}`);
		}
		if (typeof bridge?.getPackageVersionCode === "function") {
			lines.push(`安卓应用版本: ${bridge.getPackageVersionCode()}`);
		}
		if (typeof (window as any).device === "object") {
			const device = (window as any).device;
			lines.push(
				`安卓版本: ${device.version}`,
				`安卓SDK版本: ${device.sdkVersion}`,
				`设备制造商: ${device.manufacturer}`
			);
		}
	} else if (lib.device === "ios") {
		lines.push("应用平台: 苹果");
	} else if (
		typeof window.require === "function" &&
		typeof (window as any).process === "object" &&
		typeof (window as any).__dirname === "string"
	) {
		lines.push("应用平台: Electron", `Electron版本: ${(window as any).process.versions.electron}`);
	}
	return lines;
});

function loadRecordItems() {
	const items: RecordEntry[] = [];
	for (const mode of lib.config.all.mode) {
		const record = lib.config.gameRecord[mode];
		if (!record || !record.str) continue;
		items.push({
			mode,
			modeLabel: lib.translate[mode],
			recordHtml: record.str,
			confirming: false,
		});
	}
	recordItems.value = items;
}

function clearConfirmTimer(mode: string) {
	const timer = confirmTimers.get(mode);
	if (timer !== undefined) {
		window.clearTimeout(timer);
		confirmTimers.delete(mode);
	}
}

function onResetRecordClick(idx: number) {
	const item = recordItems.value[idx];
	if (!item) return;
	if (!item.confirming) {
		item.confirming = true;
		clearConfirmTimer(item.mode);
		const timer = window.setTimeout(() => {
			item.confirming = false;
			confirmTimers.delete(item.mode);
		}, 1000);
		confirmTimers.set(item.mode, timer);
		return;
	}
	clearConfirmTimer(item.mode);
	lib.config.gameRecord[item.mode] = { data: {} };
	game.saveConfig("gameRecord", lib.config.gameRecord);
	recordItems.value.splice(idx, 1);
}

function syncDynamicPageContent() {
	if (props.pageKey === "record") {
		loadRecordItems();
	}
	if (props.pageKey === "help" && helpContainerRef.value) {
		if (props.helpName) {
			helpContainerRef.value.replaceChildren(getHelpPageContent(props.helpName));
		} else {
			helpContainerRef.value.replaceChildren();
		}
	}
}

watch(
	() => [props.pageKey, props.helpName],
	syncDynamicPageContent,
	{ immediate: true, flush: "post" }
);

onUnmounted(() => {
	for (const timer of confirmTimers.values()) {
		window.clearTimeout(timer);
	}
	confirmTimers.clear();
});

function openGithub() {
	window.open("https://github.com/libnoname/noname");
}

function changeWebview() {
	if (typeof (window as any).NonameAndroidBridge?.changeWebviewProvider === "function") {
		(window as any).NonameAndroidBridge.changeWebviewProvider();
	} else {
		alert("此客户端不支持此功能");
	}
}
</script>
