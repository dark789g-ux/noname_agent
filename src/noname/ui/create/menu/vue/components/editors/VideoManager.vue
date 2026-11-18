<template>
	<div class="video-manager">
		<!-- 录像列表（声明式 v-for + v-char-bg） -->
		<div>
			<div
				v-for="video in videos"
				:key="String(video.time)"
				class="videonode menubutton large"
				:class="{ starred: video.starred, active: selectedVideo === video }"
				@click.stop="toggleSelectVideo(video)"
			>
				<div v-char-bg:character="video.name1" class="menubutton videoavatar"></div>
				<div v-if="video.name2" v-char-bg:character="video.name2" class="menubutton videoavatar2"></div>
				<div class="caption">{{ video.name[0] }}</div>
				<div class="text">
					{{ formatVideoTime(video.time) }}<br />{{ video.name[1] }}
				</div>
				<div v-if="video.win" class="victory">胜</div>
				<div class="video_star" @click.stop="toggleStar(video)">★</div>
			</div>
		</div>

		<!-- 导入录像 -->
		<div class="config switcher pointerspan import-trigger" @click="showImportPanel = !showImportPanel">
			<span class="underlinenode slim">导入录像...</span>
		</div>
		<div v-if="showImportPanel" class="config import-panel">
			<input ref="fileInputRef" type="file" accept="*/*" />
			<button @click="onImportClick">确定</button>
		</div>

		<!-- 浮动按钮：播/存/删 -->
		<div v-if="selectedVideo" class="video-float-buttons">
			<div class="menubutton round highlight" style="left: 215px; transition: opacity 0.3s" @click="playVideo">播</div>
			<div class="menubutton round highlight" style="left: 275px; transition: opacity 0.3s" @click="saveVideo">存</div>
			<div class="menubutton round highlight" style="left: 335px; transition: opacity 0.3s" @click="deleteVideo">删</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { _status, game, lib, ui } from "noname";
import { persistVideo } from "@/storage/videos.js";
import { menuBridge } from "../../utils/menuBridge";
import { vCharBg } from "./shared/vCharBg.js";

interface VideoData {
	time: string | number;
	name: [string, string];
	name1: string;
	name2?: string;
	mode?: string;
	win?: boolean;
	starred?: boolean;
}

const fileInputRef = ref<HTMLInputElement>();
const showImportPanel = ref(false);
const videos = ref<VideoData[]>([]);
const selectedVideo = ref<VideoData | null>(null);

function formatVideoTime(time: string | number): string {
	const date = new Date(time);
	const mins = date.getMinutes();
	return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${date.getHours()}:${mins < 10 ? "0" : ""}${mins}`;
}

function toggleSelectVideo(video: VideoData) {
	selectedVideo.value = selectedVideo.value === video ? null : video;
}

async function toggleStar(video: VideoData) {
	const starred = !video.starred;
	await persistVideo(lib.db, { ...video, starred });
	video.starred = starred;
}

function playVideo() {
	if (!selectedVideo.value) return;
	game.playVideo(selectedVideo.value.time, selectedVideo.value.mode);
}

async function deleteVideo() {
	const target = selectedVideo.value;
	if (!target) return;
	await game.deleteDB("video", target.time);
	lib.videos.remove(target);
	const idx = videos.value.indexOf(target);
	if (idx >= 0) videos.value.splice(idx, 1);
	if (selectedVideo.value === target) {
		selectedVideo.value = null;
	}
}

function saveVideo() {
	if (!selectedVideo.value) return;
	game.export(
		lib.init.encode(JSON.stringify(selectedVideo.value)),
		`无名杀 - 录像 - ${selectedVideo.value.name[0]} - ${selectedVideo.value.name[1]}`
	);
}

function removeFromLists(target: VideoData) {
	lib.videos.remove(target);
	const idx = videos.value.indexOf(target);
	if (idx >= 0) videos.value.splice(idx, 1);
	if (selectedVideo.value === target) selectedVideo.value = null;
}

function insertIntoLists(video: VideoData, before?: boolean) {
	removeFromLists(video);
	if (before === true) {
		lib.videos.unshift(video);
		videos.value.unshift(video);
	} else {
		lib.videos.push(video);
		videos.value.push(video);
	}
}

function onImportClick() {
	const fileToLoad = fileInputRef.value?.files?.[0];
	if (!fileToLoad) return;

	const fileReader = new FileReader();
	fileReader.onload = async fileLoadedEvent => {
		const data = fileLoadedEvent.target?.result;
		if (!data) return;

		let parsed: VideoData;
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
		const nonStarred = lib.videos.filter(video => !video.starred);
		const removed: VideoData[] = [];
		const limit = parseInt(lib.config.video, 10);
		for (let count = 0; count < 5 && nonStarred.length && nonStarred.length >= limit; count++) {
			removed.push(nonStarred.pop()!);
		}
		await persistVideo(
			lib.db,
			parsed,
			removed.map(video => video.time)
		);
		for (const video of removed) {
			removeFromLists(video);
		}
		insertIntoLists(parsed, true);
	};
	fileReader.readAsText(fileToLoad, "UTF-8");
}

onMounted(async () => {
	if (!lib.db) return;
	const dbVideos = await game.getDB("video");
	const sorted = Object.values(dbVideos || {}).sort((a: any, b: any) => Number(b.time) - Number(a.time)) as VideoData[];
	lib.videos = sorted;
	videos.value = [...sorted];

	ui.create.videoNode = (video: VideoData, before?: boolean) => {
		if (_status.over) {
			removeFromLists(video);
			return;
		}
		insertIntoLists(video, before);
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
