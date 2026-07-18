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
		<div v-else-if="pageKey === 'core'" class="menu-sym" ref="coreContainerRef">
			<div ref="agentRef" class="core-info" style="margin: 10px 0; text-align: left;"></div>
			<button class="changeWebviewProvider" @click="changeWebview">点击切换WebView实现</button>
		</div>

		<!-- 战绩页 -->
		<div v-else-if="pageKey === 'record'" ref="recordContainerRef" style="padding-bottom: 10px">
			<!-- 由 onMounted 命令式创建 -->
		</div>

		<!-- 帮助页 -->
		<div v-else-if="pageKey === 'help'" ref="helpContainerRef" class="menu-help"></div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { ui, game, get, lib, _status } from "noname";
import { getHelpPageContent } from "../../data/otherMenuData";
import dedent from "dedent";

interface Props {
	pageKey: string;
	helpName?: string;
}

const props = defineProps<Props>();

const coreContainerRef = ref<HTMLDivElement>();
const agentRef = ref<HTMLDivElement>();
const recordContainerRef = ref<HTMLDivElement>();
const helpContainerRef = ref<HTMLDivElement>();

// ---------------------------------------------------------------------------
// 更新页
// 对应旧版 92-116
// ---------------------------------------------------------------------------
function openGithub() {
	window.open("https://github.com/libnoname/noname");
}

// ---------------------------------------------------------------------------
// 内核页
// 对应旧版 703-762
// ---------------------------------------------------------------------------
onMounted(() => {
	if (props.pageKey === "core" && agentRef.value) {
		const coreInfo = get.coreInfo();
		let agentText = dedent`浏览器内核: ${coreInfo[0]}<br/>
		浏览器版本: ${coreInfo[1]}.${coreInfo[2]}.${coreInfo[3]}<br/>`;

		if (lib.device === "android") {
			agentText += dedent`应用平台: 安卓<br/>`;
			if (typeof (window as any).NonameAndroidBridge?.getPackageName === "function") {
				agentText += dedent`安卓应用包名: ${(window as any).NonameAndroidBridge.getPackageName()}<br/>`;
			}
			if (typeof (window as any).NonameAndroidBridge?.getPackageVersionCode === "function") {
				agentText += dedent`安卓应用版本: ${(window as any).NonameAndroidBridge.getPackageVersionCode()}<br/>`;
			}
			if (typeof (window as any).device === "object") {
				const device = (window as any).device;
				agentText += dedent`安卓版本: ${device.version}<br/>
				安卓SDK版本: ${device.sdkVersion}<br/>
				设备制造商: ${device.manufacturer}<br/>`;
			}
		} else if (lib.device === "ios") {
			agentText += dedent`应用平台: 苹果<br/>`;
		} else if (
			typeof window.require == "function" &&
			typeof (window as any).process == "object" &&
			typeof (window as any).__dirname == "string"
		) {
			agentText += dedent`应用平台: Electron<br/>
			Electron版本: ${(window as any).process.versions.electron}<br/>`;
		}

		agentRef.value.innerHTML = agentText;
	}
});

function changeWebview() {
	if (typeof (window as any).NonameAndroidBridge?.changeWebviewProvider === "function") {
		(window as any).NonameAndroidBridge.changeWebviewProvider();
	} else {
		alert("此客户端不支持此功能");
	}
}

// ---------------------------------------------------------------------------
// 战绩页
// 对应旧版 763-801
// ---------------------------------------------------------------------------
onMounted(() => {
	if (props.pageKey === "record" && recordContainerRef.value) {
		for (let i = 0; i < lib.config.all.mode.length; i++) {
			const mode = lib.config.all.mode[i];
			if (!lib.config.gameRecord[mode]) continue;
			if (!lib.config.gameRecord[mode].str) continue;

			// 模式名称
			const modeDiv = ui.create.div(
				".config.indent",
				lib.translate[mode],
				recordContainerRef.value,
			);
			modeDiv.style.marginBottom = "-5px";

			// 战绩文本 + 重置按钮
			const item = ui.create.div(
				".config.indent",
				lib.config.gameRecord[mode].str + "<span>重置</span>",
				recordContainerRef.value,
			);
			item.style.height = "auto";
			(item as any).link = mode;

			// 重置按钮逻辑（旧版 770-783）
			const resetSpan = item.lastChild as HTMLElement;
			resetSpan.classList.add("pointerdiv");
			resetSpan.addEventListener("click", function () {
				const that = this;
				if (that.innerHTML == "重置") {
					that.innerHTML = "确定";
					setTimeout(function () {
						that.innerHTML = "重置";
					}, 1000);
				} else {
					// 删除战绩记录
					modeDiv.remove();
					item.remove();
					lib.config.gameRecord[(item as any).link] = { data: {} };
					game.saveConfig("gameRecord", lib.config.gameRecord);
				}
			});
		}
	}
});

// ---------------------------------------------------------------------------
// 帮助页
// 对应旧版 998-1038（内容创建）/ OtherPane 分派
// ---------------------------------------------------------------------------
onMounted(() => {
	if (props.pageKey === "help" && props.helpName && helpContainerRef.value) {
		const pageContent = getHelpPageContent(props.helpName);
		helpContainerRef.value.appendChild(pageContent);
	}
});
</script>
