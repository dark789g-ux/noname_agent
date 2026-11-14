<template>
	<div class="video-manager" ref="containerRef">
		<!-- 录像列表容器 -->
		<div ref="videoListRef"></div>

		<!-- 导入录像 -->
		<div class="config switcher pointerspan import-trigger" @click="toggleImportPanel">
			<span class="underlinenode slim">导入录像...</span>
		</div>
		<div v-if="showImportPanel" class="config import-panel">
			<input ref="fileInputRef" type="file" accept="*/*" />
			<button @click="onImportClick">确定</button>
		</div>

		<!-- 浮动按钮：播/存/删（选中录像后显示） -->
		<div v-if="selectedVideo" class="video-float-buttons">
			<div class="menubutton round highlight" style="left: 215px; transition: opacity 0.3s" @click="playVideo">播</div>
			<div class="menubutton round highlight" style="left: 275px; transition: opacity 0.3s" @click="saveVideo">存</div>
			<div class="menubutton round highlight" style="left: 335px; transition: opacity 0.3s" @click="deleteVideo">删</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ui, game, lib, _status, get } from "noname";
import { menuBridge } from "../../utils/menuBridge";
import { persistVideo } from "@/storage/videos.js";

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------
const containerRef = ref<HTMLDivElement>();
const videoListRef = ref<HTMLDivElement>();
const fileInputRef = ref<HTMLInputElement>();
const showImportPanel = ref(false);
const selectedVideo = ref<any>(null);
const selectedVideoEl = ref<HTMLElement | null>(null);

// ---------------------------------------------------------------------------
// 录像节点相关 DOM 操作
// 对应旧版 854-885 createNode
// ---------------------------------------------------------------------------

interface VideoData {
	time: string | number;
	name: [string, string];
	name1: string;
	name2?: string;
	mode?: string;
	win?: boolean;
	starred?: boolean;
}

/**
 * 创建单个录像 DOM 节点
 * 对应旧版 createNode（854-885）
 */
function createVideoNode(video: VideoData, before?: boolean) {
	if (!videoListRef.value) return;

	const node = document.createElement("div");
	node.classList.add("videonode", "menubutton", "large");
	(node as any).link = video;

	// 头像
	const nodename1 = ui.create.div(".menubutton.videoavatar", node);
	nodename1.setBackground(video.name1, "character");
	if (video.name2) {
		const nodename2 = ui.create.div(".menubutton.videoavatar2", node);
		nodename2.setBackground(video.name2, "character");
	}

	// 日期字符串
	const date = new Date(video.time);
	const str = date.getFullYear() + "." + (date.getMonth() + 1) + "." + date.getDate() + " " + date.getHours() + ":" + (date.getMinutes() < 10 ? "0" : "") + date.getMinutes();

	ui.create.div(".caption", video.name[0], node);
	ui.create.div(".text", str + "<br>" + video.name[1], node);
	if (video.win) {
		ui.create.div(".victory", "胜", node);
	}

	if (before) {
		videoListRef.value.insertBefore(node, videoListRef.value.firstChild);
	} else {
		videoListRef.value.appendChild(node);
	}

	// 星标
	ui.create.div(".video_star", "★", node, async function () {
		const parent = this.parentNode as HTMLElement & { link: VideoData };
		const starred = !parent.classList.contains("starred");
		await persistVideo(lib.db, { ...parent.link, starred });
		parent.link.starred = starred;
		parent.classList.toggle("starred", starred);
	});

	if (video.starred) {
		node.classList.add("starred");
	}

	// 点击选中（旧版 clickcapt 829-843）
	node.addEventListener("click", function (e: Event) {
		e.stopPropagation();
		const current = videoListRef.value!.querySelector(".videonode.active") as HTMLElement | null;
		if (current && current != this) {
			current.classList.remove("active");
		}
		if (this.classList.toggle("active")) {
			selectedVideo.value = video;
			selectedVideoEl.value = this;
		} else {
			selectedVideo.value = null;
			selectedVideoEl.value = null;
		}
	});
}

// ---------------------------------------------------------------------------
// 浮动按钮操作
// 对应旧版 956-976
// ---------------------------------------------------------------------------
function playVideo() {
	if (!selectedVideo.value) return;
	game.playVideo(selectedVideo.value.time, selectedVideo.value.mode);
}

async function deleteVideo() {
	if (!selectedVideo.value || !selectedVideoEl.value) return;
	const video = selectedVideo.value;
	const element = selectedVideoEl.value;
	await game.deleteDB("video", video.time);
	lib.videos.remove(video);
	element.remove();
	if (selectedVideo.value === video) {
		selectedVideo.value = null;
		selectedVideoEl.value = null;
	}
}

function saveVideo() {
	if (!selectedVideo.value) return;
	game.export(lib.init.encode(JSON.stringify(selectedVideo.value)), "无名杀 - 录像 - " + selectedVideo.value.name[0] + " - " + selectedVideo.value.name[1]);
}

// ---------------------------------------------------------------------------
// 导入录像
// 对应旧版 890-954
// ---------------------------------------------------------------------------
function toggleImportPanel() {
	showImportPanel.value = !showImportPanel.value;
}

function onImportClick() {
	if (!fileInputRef.value) return;
	const fileToLoad = fileInputRef.value.files?.[0];
	if (!fileToLoad) return;

	const fileReader = new FileReader();
	fileReader.onload = async function (fileLoadedEvent) {
		const data = fileLoadedEvent.target?.result;
		if (!data) return;

		let parsed: any;
		try {
			parsed = JSON.parse(lib.init.decode(data as string));
		} catch (e) {
			console.log(e);
			alert("导入失败");
			return;
		}

		if (lib.videos.some(video => video.time === parsed.time)) {
			alert("录像已存在");
			return;
		}
		const videos = lib.videos.filter(video => !video.starred);
		const removed = [];
		for (let count = 0; count < 5 && videos.length && videos.length >= parseInt(lib.config.video); count++) removed.push(videos.pop()!);
		await persistVideo(
			lib.db,
			parsed,
			removed.map(video => video.time)
		);
		for (const video of removed) {
			lib.videos.remove(video);
			for (const node of Array.from(videoListRef.value?.children || [])) {
				if ((node as any).link === video) node.remove();
			}
		}
		lib.videos.unshift(parsed);
		createVideoNode(parsed, true);
	};
	fileReader.readAsText(fileToLoad, "UTF-8");
}

// ---------------------------------------------------------------------------
// 初始化：加载持久化录像
// 对应旧版 node._initLink（817-995）
// ---------------------------------------------------------------------------
onMounted(async () => {
	if (!lib.db) return;
	const videos = await game.getDB("video");
	lib.videos = Object.values(videos || {}).sort((a: any, b: any) => Number(b.time) - Number(a.time));
	for (const video of lib.videos) createVideoNode(video);
	ui.create.videoNode = function (video: VideoData, before?: boolean) {
		lib.videos.remove(video);
		if (_status.over) return;
		lib.videos[before === true ? "unshift" : "push"](video);
		createVideoNode(video, before);
	};
	ui.updateVideoMenu = () => menuBridge.setActiveLeftItem?.("其它", "video");
});
</script>

<style>
.video-manager {
	position: relative;
}
.video-float-buttons {
	position: absolute;
	top: 15px;
	right: 0;
}
.import-trigger {
	margin-left: 12px;
	margin-top: 3px;
}
.import-panel {
	white-space: nowrap;
	margin-bottom: 80px;
	margin-left: 13px;
	width: calc(100% - 30px);
}
.import-panel input {
	width: calc(100% - 40px);
}
.import-panel button {
	width: 40px;
}
</style>
