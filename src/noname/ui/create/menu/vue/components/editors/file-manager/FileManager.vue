<template>
	<!--
		文件管理器 —— @deprecated
		仅在 lib.node?.fs || window.resolveLocalFileSystemURL 存在时渲染
	-->
	<div id="create-extension">
		<FileManagerImport />

		<div class="file-dashboard">
			<div
				v-for="dash in dashboards"
				:key="dash.label"
				class="menubutton large dashboard"
				@click="onDashClick(dash)"
			>
				<div>{{ dash.abbr }}</div>
				<div>{{ dash.label }}</div>
			</div>
		</div>

		<div v-if="activeDash" ref="contentRef" class="menu-buttons">
			<div
				class="menubutton round"
				:style="{ zIndex: 1, right: '10px', bottom: '15px' }"
				@click="onBackClick"
			>
				返
			</div>

			<template v-if="activeDash.type === 'subdir'">
				<div
					v-for="sd in activeDash.subdirs"
					:key="sd.path"
					class="menubutton large dashboard dashboard2"
					@click="enterDirectory(sd.path)"
				>
					<div>{{ sd.abbr }}</div>
					<div>{{ sd.label }}</div>
				</div>
			</template>

			<template v-if="isDirectoryView">
				<div
					class="menubutton round"
					:style="{ zIndex: 1, right: '10px', bottom: '80px' }"
					@click="onAddClick"
				>
					添
				</div>
				<div
					class="menubutton round"
					:class="{ active: deleteMode }"
					:style="{ zIndex: 1, right: '10px', bottom: '145px' }"
					@click="onDeleteClick"
				>
					删
				</div>
				<div ref="fileListRef" class="file-container" @click="onFileListClick">
					<div
						v-for="folder in currentFolders"
						:key="'folder-' + folder"
						@click="onFolderClick(folder)"
					>
						<span>{{ folder }}</span>
					</div>
					<div
						v-for="file in currentFiles"
						:key="'file-' + file.name"
						@click="onFileClick(file)"
					>
						<span :class="{ thundertext: file.selected }">{{ file.name }}</span>
						<img
							v-if="file.selected && (file.ext === 'jpg' || file.ext === 'png')"
							:src="lib.assetURL + file.path"
							width="60"
							style="max-height: 120px"
						/>
					</div>
				</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import { _status, game, lib, ui } from "noname";
import { openPopup, setNoclose } from "../../../utils/popupHost";
import FileManagerImport from "./FileManagerImport.vue";
import { createPlatformDirectory, removePlatformDirectory, removePlatformFiles } from "./platformFileOps.js";

interface DashItem {
	abbr: string;
	label: string;
	type: string;
	path?: string;
	subdirs?: { abbr: string; label: string; path: string }[];
}

interface FileEntryItem {
	name: string;
	ext: string;
	path: string;
	selected: boolean;
}

const activeDash = ref<DashItem | null>(null);
const currentPath = ref("");
const currentFolders = ref<string[]>([]);
const currentFiles = ref<FileEntryItem[]>([]);
const deleteMode = ref(false);
const fileListRef = ref<HTMLDivElement>();
const contentRef = ref<HTMLDivElement>();
const isDirectoryView = ref(false);
const audioPreviews = new Map<string, HTMLAudioElement>();
let fileClicked = false;

const dashboards: DashItem[] = [
	{
		abbr: "图",
		label: "图片文件",
		type: "subdir",
		subdirs: [
			{ abbr: "将", label: "武将图片", path: "image/character" },
			{ abbr: "肤", label: "皮肤图片", path: "image/skin" },
			{ abbr: "卡", label: "卡牌图片", path: "image/card" },
			{ abbr: "模", label: "模式图片", path: "image/mode" },
			{ abbr: "始", label: "开始图片", path: "image/splash" },
			{ abbr: "景", label: "背景图片", path: "image/background" },
		],
	},
	{
		abbr: "音",
		label: "音频文件",
		type: "subdir",
		subdirs: [
			{ abbr: "技", label: "技能配音", path: "audio/skill" },
			{ abbr: "卡", label: "男性卡牌", path: "audio/card/male" },
			{ abbr: "牌", label: "女性卡牌", path: "audio/card/female" },
			{ abbr: "亡", label: "阵亡配音", path: "audio/die" },
			{ abbr: "效", label: "游戏音效", path: "audio/effect" },
			{ abbr: "景", label: "背景音乐", path: "audio/background" },
		],
	},
	{ abbr: "字", label: "字体文件", type: "directory", path: "font" },
	{ abbr: "全", label: "全部文件", type: "directory", path: "" },
];

function onDashClick(dash: DashItem) {
	ui.create.templayer();
	if (dash.type === "subdir") {
		activeDash.value = dash;
		isDirectoryView.value = false;
	} else if (dash.type === "directory") {
		activeDash.value = dash;
		isDirectoryView.value = true;
		enterDirectory(dash.path || "");
	}
	nextTick(() => {
		if (contentRef.value) lib.setScroll(contentRef.value);
	});
}

function onBackClick() {
	ui.create.templayer();
	if (isDirectoryView.value && currentPath.value.includes("/")) {
		enterDirectory(currentPath.value.slice(0, currentPath.value.lastIndexOf("/")));
		return;
	}
	activeDash.value = null;
	isDirectoryView.value = false;
}

function enterDirectory(path: string) {
	currentPath.value = path;
	currentFolders.value = [];
	currentFiles.value = [];
	deleteMode.value = false;
	isDirectoryView.value = true;

	nextTick(() => {
		if (fileListRef.value) lib.setScroll(fileListRef.value);
	});

	game.getFileList(path, (folders: string[], files: string[]) => {
		folders.sort();
		files.sort();
		const parent = path ? `${path}/` : "";
		currentFolders.value = folders.filter(f => !(path === "" && f === "app"));

		const filteredFiles: FileEntryItem[] = [];
		for (const fileName of files) {
			if (path === "" && (fileName === "app.html" || fileName === "main.js" || fileName === "package.json")) {
				continue;
			}
			filteredFiles.push({
				name: fileName,
				ext: fileName.slice(fileName.lastIndexOf(".") + 1),
				path: parent + fileName,
				selected: false,
			});
		}
		currentFiles.value = filteredFiles;
	});
}

function onFolderClick(folder: string) {
	if (_status.dragged) return;
	const target = currentPath.value ? `${currentPath.value}/${folder}` : folder;
	if (deleteMode.value) {
		if (confirm(`确认删除${folder}文件夹？（此操作不可撤销）`)) {
			removePlatformDirectory(target, () => enterDirectory(currentPath.value));
		}
		return;
	}
	enterDirectory(target);
}

function onFileClick(file: FileEntryItem) {
	if (_status.dragged) return;
	if (deleteMode.value) {
		if (confirm(`确认删除${file.name}？（此操作不可撤销）`)) {
			removePlatformFiles(currentPath.value, [file.path], () => enterDirectory(currentPath.value));
		}
		return;
	}
	file.selected = !file.selected;
	fileClicked = true;
	if (file.ext === "mp3" || file.ext === "ogg") {
		if (file.selected) {
			if (!audioPreviews.has(file.path)) {
				const audio = game.playAudio(file.path.slice(6));
				if (audio) audioPreviews.set(file.path, audio);
			}
		} else {
			const audio = audioPreviews.get(file.path);
			if (audio) {
				audio.remove();
				audioPreviews.delete(file.path);
			}
		}
	}
}

function onFileListClick() {
	if (fileClicked) {
		fileClicked = false;
		return;
	}
	for (const file of currentFiles.value) {
		file.selected = false;
	}
	for (const audio of audioPreviews.values()) {
		audio.remove();
	}
	audioPreviews.clear();
}

function onAddClick(event: MouseEvent) {
	const menu = ui.create.div(".menu");
	const addFileItem = ui.create.div("", "添加文件", menu, () => {
		setNoclose();
	});
	const input = document.createElement("input");
	input.className = "fileinput";
	input.type = "file";
	input.onchange = () => {
		const fileToLoad = input.files?.[0];
		if (!fileToLoad) return;
		game.print(fileToLoad.name);
		const fileReader = new FileReader();
		fileReader.onload = e => {
			game.writeFile(e.target!.result, currentPath.value, fileToLoad.name, () => {
				enterDirectory(currentPath.value);
			});
		};
		fileReader.readAsArrayBuffer(fileToLoad);
	};
	addFileItem.appendChild(input);

	ui.create.div("", "添加目录", menu, () => {
		ui.create.templayer();
		game.prompt("输入目录名称", (str: string) => {
			if (str) {
				createPlatformDirectory(currentPath.value, str, () => enterDirectory(currentPath.value));
			}
		});
	});

	const pos1 = (event.currentTarget as HTMLElement).getBoundingClientRect();
	const pos2 = ui.window.getBoundingClientRect();
	openPopup(menu, pos1.left + pos1.width + 5 - pos2.left, pos1.top - pos2.top);
}

function onDeleteClick() {
	if (deleteMode.value) {
		deleteMode.value = false;
		return;
	}
	const selected = currentFiles.value.filter(f => f.selected);
	if (selected.length) {
		if (confirm(`一共要删除${selected.length}个文件，此操作不可撤销，是否确定？`)) {
			removePlatformFiles(
				currentPath.value,
				selected.map(f => f.path),
				() => enterDirectory(currentPath.value)
			);
		}
	} else {
		deleteMode.value = true;
	}
}
</script>
