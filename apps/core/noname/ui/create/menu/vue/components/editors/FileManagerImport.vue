<template>
	<!--
		素材包导入 —— @deprecated
		1:1 迁移自旧版 optionsMenu.js 542-684 行
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
			<div v-if="promptVisible" style="width: 153px; font-size: small; margin-top: 8px">
				<span v-html="promptHtml"></span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, nextTick } from "vue";
import JSZip from "jszip";
import { lib, game, ui } from "noname";

const expanded = ref(false);
const promptVisible = ref(false);
const promptHtml = ref("");
const zipFileInputRef = ref<HTMLInputElement>();

/**
 * ZIP 素材包导入
 * 对应旧版 542-684
 */
function onZipImportClick() {
	if (promptVisible.value) return;
	let fileToLoad = zipFileInputRef.value?.files?.[0];
	if (!fileToLoad) return;

	promptVisible.value = true;
	promptHtml.value = "正在解压...";

	let fileReader = new FileReader();
	fileReader.onload = function (fileLoadedEvent) {
		let data = fileLoadedEvent.target!.result;
		let loadData = function () {
			let zip = new JSZip();
			zip.load(data);
			let images: string[] = [], audios: string[] = [], fonts: string[] = [];
			let directories: Record<string, string[]> = {};
			let directoryList: string[] = [];

			Object.keys(zip.files).forEach(function (file) {
				let parsedPath = lib.path.parse(file);
				let directory = parsedPath.dir;
				let fileExtension = parsedPath.ext.toLowerCase();
				if (directory.startsWith("audio") && (fileExtension == ".mp3" || fileExtension == ".ogg")) {
					audios.push(file);
				} else if (directory.startsWith("font") && fileExtension == ".woff2") {
					fonts.push(file);
				} else if (directory.startsWith("image") && (fileExtension == ".jpg" || fileExtension == ".png")) {
					images.push(file);
				} else {
					return;
				}
				if (!directories[directory]) {
					directories[directory] = [];
					directoryList.push(directory);
				}
				directories[directory].push(parsedPath.base);
			});

			if (audios.length || fonts.length || images.length) {
				let str = "";
				if (audios.length) str += audios.length + "个音频文件";
				if (fonts.length) { if (str.length) str += "、"; str += fonts.length + "个字体文件"; }
				if (images.length) { if (str.length) str += "、"; str += images.length + "个图片文件"; }
				let filelist = audios.concat(fonts).concat(images);
				if (filelist.length > 200) str += "，导入时间可能较长";

				let assetLoaded = function () {
					promptHtml.value = '导入成功。<span class="hrefnode">重新启动</span><span class="closenode">&times;</span>';
					nextTick(() => {
						let promptEl = zipFileInputRef.value?.parentElement?.nextElementSibling?.querySelector(".hrefnode") as HTMLElement;
						if (promptEl) promptEl.onclick = game.reload;
						let closeEl = zipFileInputRef.value?.parentElement?.nextElementSibling?.querySelector(".closenode") as HTMLElement;
						if (closeEl) closeEl.onclick = function () { promptVisible.value = false; };
					});
				};

				if (confirm("本次将导入" + str + "，是否继续？")) {
					promptHtml.value = '正在导入... <span class="hrefnode">详细信息</span>';
					nextTick(() => {
						let infoEl = zipFileInputRef.value?.parentElement?.nextElementSibling?.querySelector(".hrefnode") as HTMLElement;
						if (infoEl) infoEl.onclick = function () { ui.click.consoleMenu(); };
					});

					if (lib.node && lib.node.fs) {
						let writeFile = function () {
							if (filelist.length) {
								let f = filelist.shift()!;
								game.print(f.slice(f.lastIndexOf("/") + 1));
								lib.node.fs.writeFile(__dirname + "/" + f, zip.files[f].asNodeBuffer(), null, writeFile);
							} else {
								assetLoaded();
							}
						};
						game.ensureDirectory(directoryList, writeFile);
					} else {
						let getDirectory = function () {
							if (directoryList.length) {
								let dir = directoryList.shift()!;
								let fl = directories[dir];
								// @ts-expect-error resolveLocalFileSystemURL 是 Cordova API
								window.resolveLocalFileSystemURL(nonameInitialized + dir, function (entry: any) {
									let writeFile = function () {
										if (fl.length) {
											let filename = fl.shift()!;
											game.print(filename);
											entry.getFile(filename, { create: true }, function (fileEntry: any) {
												fileEntry.createWriter(function (fileWriter: any) {
													fileWriter.onwriteend = writeFile;
													fileWriter.onerror = function (e: any) {
														game.print("Write failed: " + e.toString());
													};
													fileWriter.write(zip.files[dir + "/" + filename].asArrayBuffer());
												});
											});
										} else {
											getDirectory();
										}
									};
									writeFile();
								});
							} else {
								assetLoaded();
							}
						};
						game.ensureDirectory(directoryList, getDirectory);
					}
				} else {
					promptVisible.value = false;
				}
			} else {
				alert("没有检测到素材");
			}
		};
		loadData();
	};
	fileReader.readAsArrayBuffer(fileToLoad, "UTF-8");
}

// TODO: 阶段 6 —— nonameInitialized 导入路径需确认
//   旧版通过 import { nonameInitialized } from "@/util/index.js"
let nonameInitialized: string = localStorage.getItem("noname_inited") || "";
</script>
