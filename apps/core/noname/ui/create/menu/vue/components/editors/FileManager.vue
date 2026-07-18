<template>
	<!--
		文件管理器 —— @deprecated
		1:1 迁移自旧版 optionsMenu.js 529-1079 行
		仅在 lib.node?.fs || window.resolveLocalFileSystemURL 存在时渲染
	-->
	<div id="create-extension">
		<!-- 素材包导入区域（拆分到 FileManagerImport.vue） -->
		<FileManagerImport />

		<!-- Dashboard 按钮区域 -->
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

		<!-- 主内容区域（文件浏览 / dashboard 子页面） -->
		<div v-if="activeDash" ref="contentRef" class="menu-buttons">
			<!-- 返按钮 -->
			<div
				class="menubutton round"
				:style="{ zIndex: 1, right: '10px', bottom: '15px' }"
				@click="onBackClick"
			>
				返
			</div>
			<!-- Dashboard 子页面（图片/音频子目录） -->
			<template v-if="activeDash.type === 'subdir'">
				<div v-for="sd in activeDash.subdirs" :key="sd.path" class="menubutton large dashboard dashboard2" @click="enterDirectory(sd.path)">
					<div>{{ sd.abbr }}</div>
					<div>{{ sd.label }}</div>
				</div>
			</template>
			<!-- 文件浏览 -->
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
						@click="onFolderClick($event, folder)"
					>
						<span>{{ folder }}</span>
					</div>
					<div
						v-for="file in currentFiles"
						:key="'file-' + file.name"
						@click="onFileClick($event, file)"
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
import { ref, onMounted, nextTick } from "vue";
import { lib, game, _status, ui } from "noname";
import FileManagerImport from "./FileManagerImport.vue";
import { openPopup, setNoclose } from "../../utils/popupHost";

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

const activeDash = ref<{ type: string; path?: string; subdirs?: any[] } | null>(null);
const currentPath = ref("");
const currentFolders = ref<string[]>([]);
const currentFiles = ref<{ name: string; ext: string; path: string; selected: boolean }[]>([]);
const deleteMode = ref(false);
const fileListRef = ref<HTMLDivElement>();
const contentRef = ref<HTMLDivElement>();
const isDirectoryView = ref(false);
// 音频预览节点（对应旧版 previewnode，mp3/ogg 选中时播放）
const audioPreviews = new Map<string, HTMLAudioElement>();
// 对应旧版 page.clicked：文件项点击后阻止 fileList 的取消选中
let fileClicked = false;

// ---------------------------------------------------------------------------
// Dashboard 定义
// 对应旧版 991-1074
// ---------------------------------------------------------------------------

interface DashItem {
	abbr: string;
	label: string;
	type: string;
	path?: string;
	subdirs?: { abbr: string; label: string; path: string }[];
}

const dashboards: DashItem[] = [
	{ abbr: "图", label: "图片文件", type: "subdir", subdirs: [
		{ abbr: "将", label: "武将图片", path: "image/character" },
		{ abbr: "肤", label: "皮肤图片", path: "image/skin" },
		{ abbr: "卡", label: "卡牌图片", path: "image/card" },
		{ abbr: "模", label: "模式图片", path: "image/mode" },
		{ abbr: "始", label: "开始图片", path: "image/splash" },
		{ abbr: "景", label: "背景图片", path: "image/background" },
	]},
	{ abbr: "音", label: "音频文件", type: "subdir", subdirs: [
		{ abbr: "技", label: "技能配音", path: "audio/skill" },
		{ abbr: "卡", label: "男性卡牌", path: "audio/card/male" },
		{ abbr: "牌", label: "女性卡牌", path: "audio/card/female" },
		{ abbr: "亡", label: "阵亡配音", path: "audio/die" },
		{ abbr: "效", label: "游戏音效", path: "audio/effect" },
		{ abbr: "景", label: "背景音乐", path: "audio/background" },
	]},
	{ abbr: "字", label: "字体文件", type: "directory", path: "font" },
	{ abbr: "全", label: "全部文件", type: "directory", path: "" },
];

// ---------------------------------------------------------------------------
// Dashboard 点击
// 对应旧版 clickDash（687-694）+ createDash（695-705）+ createDash2（706-714）
// ---------------------------------------------------------------------------

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
	if (isDirectoryView.value) {
		if (currentPath.value.includes("/")) {
			enterDirectory(currentPath.value.slice(0, currentPath.value.lastIndexOf("/")));
		} else {
			activeDash.value = null;
			isDirectoryView.value = false;
		}
	} else {
		activeDash.value = null;
	}
}

// ---------------------------------------------------------------------------
// 进入目录
// 对应旧版 enterDirectory（848-990）
// ---------------------------------------------------------------------------

function enterDirectory(path: string) {
	currentPath.value = path;
	currentFolders.value = [];
	currentFiles.value = [];
	deleteMode.value = false;
	isDirectoryView.value = true;

	nextTick(() => {
		if (fileListRef.value) lib.setScroll(fileListRef.value);
	});

	game.getFileList(path, function (folders: string[], files: string[]) {
		folders.sort();
		files.sort();
		let parent = path ? path + "/" : "";

		let filteredFolders = folders.filter(f => !(path === "" && f === "app"));
		currentFolders.value = filteredFolders;

		let filteredFiles: { name: string; ext: string; path: string; selected: boolean }[] = [];
		for (let i = 0; i < files.length; i++) {
			if (path === "") {
				if (files[i] === "app.html" || files[i] === "main.js" || files[i] === "package.json") continue;
			}
			filteredFiles.push({
				name: files[i],
				ext: files[i].slice(files[i].lastIndexOf(".") + 1),
				path: parent + files[i],
				selected: false,
			});
		}
		currentFiles.value = filteredFiles;
	});
}

// ---------------------------------------------------------------------------
// 文件/文件夹点击
// 对应旧版 clickFile（790-830）+ clickDirectory（741-789）
// ---------------------------------------------------------------------------

function onFolderClick(_event: MouseEvent, folder: string) {
	if (_status.dragged) return;
	if (deleteMode.value) {
		let parent = currentPath.value ? currentPath.value + "/" : "";
		if (confirm("确认删除" + folder + "文件夹？（此操作不可撤销）")) {
			deleteDirectory(parent + folder);
		}
		return;
	}
	enterDirectory((currentPath.value ? currentPath.value + "/" : "") + folder);
}

function onFileClick(_event: MouseEvent, file: { name: string; ext: string; path: string; selected: boolean }) {
	if (_status.dragged) return;
	if (deleteMode.value) {
		if (confirm("确认删除" + file.name + "？（此操作不可撤销）")) {
			removeFile([file]);
		}
		return;
	}
	file.selected = !file.selected;
	fileClicked = true;
	if (file.ext === "mp3" || file.ext === "ogg") {
		if (file.selected) {
			if (!audioPreviews.has(file.path)) {
				// 旧版：game.playAudio(this.path.slice(6))，playAudio 内部自动补 "audio/" 前缀
				let audio = game.playAudio(file.path.slice(6));
				if (audio) audioPreviews.set(file.path, audio);
			}
		} else {
			let audio = audioPreviews.get(file.path);
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
	for (let i = 0; i < currentFiles.value.length; i++) {
		currentFiles.value[i].selected = false;
	}
	for (let audio of audioPreviews.values()) {
		audio.remove();
	}
	audioPreviews.clear();
}

// ---------------------------------------------------------------------------
// 删除操作
// 对应旧版 removeFile（716-740）+ deleteDirectory（750-783）
// ---------------------------------------------------------------------------

function removeFile(selected: { path: string }[]) {
	if (lib.node && lib.node.fs) {
		let unlink = function () {
			if (selected.length) {
				lib.node.fs.unlink(__dirname + "/" + selected.shift()!.path, unlink);
			} else {
				enterDirectory(currentPath.value);
			}
		};
		unlink();
	} else {
		// @ts-expect-error resolveLocalFileSystemURL 是 Cordova API
		window.resolveLocalFileSystemURL(localStorage.getItem("noname_inited") + currentPath.value, function (entry: any) {
			let unlink = function () {
				if (selected.length) {
					entry.getFile(selected.shift()!.path.split("/").pop()!, { create: false }, function (fileEntry: any) {
						fileEntry.remove(unlink);
					});
				} else {
					enterDirectory(currentPath.value);
				}
			};
			unlink();
		});
	}
}

function deleteDirectory(path: string) {
	if (lib.node && lib.node.fs) {
		let removeDirectory = function (p: string, callback: () => void) {
			lib.node.fs.readdir(__dirname + "/" + p, function (err: any, list: string[]) {
				if (err) { console.log(err); return; }
				let removeFile = function () {
					if (list.length) {
						let filename = list.shift()!;
						let url = __dirname + "/" + p + "/" + filename;
						if (lib.node.fs.statSync(url).isDirectory()) {
							removeDirectory(p + "/" + filename, removeFile);
						} else {
							lib.node.fs.unlink(url, removeFile);
						}
					} else {
						lib.node.fs.rmdir(__dirname + "/" + p, callback);
					}
				};
				removeFile();
			});
		};
		removeDirectory(path, function () { enterDirectory(currentPath.value); });
	} else {
		// @ts-expect-error resolveLocalFileSystemURL 是 Cordova API
		window.resolveLocalFileSystemURL(localStorage.getItem("noname_inited") + path, function (entry: any) {
			entry.removeRecursively(function () { enterDirectory(currentPath.value); });
		});
	}
}

// ---------------------------------------------------------------------------
// 添加操作
// 对应旧版 addbutton（871-914）
// ---------------------------------------------------------------------------

function onAddClick(event: MouseEvent) {
	// 对应旧版 addbutton.menu：构建 .menu 节点，通过 popupHost.openPopup 桥接旧版 openMenu
	let menu = ui.create.div(".menu");
	// 添加文件（菜单项内嵌全尺寸透明 fileinput，点击菜单项即触发文件选择）
	let addFileItem = ui.create.div("", "添加文件", menu, function () {
		setNoclose();
	});
	let input = document.createElement("input");
	input.className = "fileinput";
	input.type = "file";
	input.onchange = function () {
		let fileToLoad = input.files![0];
		game.print(fileToLoad.name);
		if (fileToLoad) {
			let fileReader = new FileReader();
			fileReader.onload = function (e) {
				game.writeFile(e.target!.result, currentPath.value, fileToLoad.name, function () {
					enterDirectory(currentPath.value);
				});
			};
			fileReader.readAsArrayBuffer(fileToLoad, "UTF-8");
		}
	};
	addFileItem.appendChild(input);
	// 添加目录
	ui.create.div("", "添加目录", menu, function () {
		ui.create.templayer();
		game.prompt("输入目录名称", function (str: string) {
			if (str) {
				createDirectory(str);
			}
		});
	});
	// 定位逻辑与旧版一致：在「添」按钮右侧弹出
	let pos1 = (event.currentTarget as HTMLElement).getBoundingClientRect();
	let pos2 = ui.window.getBoundingClientRect();
	openPopup(menu, pos1.left + pos1.width + 5 - pos2.left, pos1.top - pos2.top);
}

function createDirectory(str: string) {
	let refresh = function () {
		enterDirectory(currentPath.value);
	};
	if (lib.node && lib.node.fs) {
		lib.node.fs.mkdir(__dirname + "/" + currentPath.value + "/" + str, refresh);
	} else {
		// @ts-expect-error resolveLocalFileSystemURL 是 Cordova API
		window.resolveLocalFileSystemURL(localStorage.getItem("noname_inited") + currentPath.value, function (entry: any) {
			entry.getDirectory(str, { create: true }, refresh);
		});
	}
}

function onDeleteClick() {
	if (deleteMode.value) { deleteMode.value = false; return; }
	let selected = currentFiles.value.filter(f => f.selected);
	if (selected.length) {
		if (confirm("一共要删除" + selected.length + "个文件，此操作不可撤销，是否确定？")) {
			removeFile(selected);
		}
	} else {
		deleteMode.value = true;
	}
}
</script>
