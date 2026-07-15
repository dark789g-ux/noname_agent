<template>
	<div class="extension-get-page">
		<!-- 导入扩展（旧 2383-2448） -->
		<div class="config more" :class="{ on: importExpanded }" @click="importExpanded = !importExpanded">
			导入扩展 <div>&gt;</div>
		</div>
		<div v-show="importExpanded" class="new_character export import" style="margin-left:5px;margin-top:5px;margin-bottom:5px;width:100%;text-align:left">
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

		<!-- 修改下载地址（旧 2401-2403） -->
		<div class="config" @click="alertDownloadURL">修改下载地址</div>

		<!-- 重新启动（旧 2414-2415） -->
		<div v-if="showReload" class="config toggle pointerdiv" @click="game.reload">
			重新启动
		</div>

		<!-- 占位 -->
		<div class="config toggle" style="height:0;margin-top:5px"></div>

		<!-- 扩展列表（旧 2568-2684） -->
		<div v-if="updateTrigger" class="extension-list"></div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { lib, game, ui, _status } from "noname";
import { security } from "@/util/sandbox";

const importExpanded = ref(false);
const importFileInput = ref<HTMLInputElement | null>(null);
const showReload = ref(false);
const updateTrigger = ref(0);

/**
 * 导入扩展（旧 2420-2448）
 * ZIP 文件通过 FileReader 读取后调用 game.importExtension
 */
function onImportClick() {
	if (!importFileInput.value || !importFileInput.value.files?.length) return;
	const fileToLoad = importFileInput.value.files[0];

	new Promise((resolve, reject) => {
		const fileReader = new FileReader();
		fileReader.onerror = reject;
		fileReader.onload = resolve;
		fileReader.readAsArrayBuffer(fileToLoad, "UTF-8");
	}).then(async (progressEvent: any) => {
		if (
			(await game.importExtension(progressEvent.target.result, () => {
				game.print("导入成功，3秒后将重启");
				setTimeout(game.reload, 3000);
			})) !== false
		) {
			importExpanded.value = false;
		}
	});
}

function alertDownloadURL() {
	alert("您可以在\"设置→通用→获取扩展地址\"中，修改下载扩展时所采用的地址。");
}

/**
 * 更新扩展列表（旧 2568-2684）
 * 从远程 catalog.js 加载扩展列表并渲染
 */
function updateExtensionList() {
	// @ts-expect-error catalog.js 通过 security.eval 加载到 window.extension
	delete window.extension;
	updateTrigger.value++;

	let extensionURL: string;
	const source = lib.config.extension_sources;
	const index = lib.config.extension_source;
	if (source && source[index]) {
		extensionURL = source[index];
	} else {
		extensionURL = lib.updateURL.replace(/noname/g, "noname-extension") + "/master/";
	}

	// @ts-expect-error catalog.js 通过 security.eval 设置 window.extension
	window.extension = {};
	fetch(`${extensionURL}catalog.js`, {
		referrerPolicy: "no-referrer",
	})
		.then(response => response.text())
		.then(security.eval)
		.then((loaded: Function) => {
			// @ts-expect-error catalog.js 设置 window.extension
			const extension = window.extension;
			const list: any[] = [];
			for (const i in extension) {
				extension[i].name = i;
				list.push(extension[i]);
			}
			list.randomSort();
			// @ts-expect-error catalog.js 临时变量
			delete window.extension;
			updateTrigger.value++;

			// 渲染扩展列表到 DOM（保持旧版命令式渲染）
			nextTick(() => {
				const container = document.querySelector(".extension-list");
				if (!container) return;
				for (const item of list) {
					const node = ui.create.div(".videonode.menubutton.extension.large", container);
					ui.create.div(".caption", item.name, node);
					ui.create.div(
						".text.author",
						"作者：" + item.author + "<span>(" + item.size + ")</span>",
						node
					);
					ui.create.div(".text", "更新日期：" + item.date, node);
					ui.create.div(".text", item.intro, node);

					if (game.download) {
						const download = ui.create.div(
							".menubutton.text.active",
							"下载扩展",
							node.firstChild as HTMLElement,
							{ zIndex: "5" }
						);
						if (lib.config.extensions.includes(item.name)) {
							download.classList.remove("active");
							if (
								lib.extensionPack[item.name] &&
								lib.extensionPack[item.name].version == item.version
							) {
								download.classList.add("transparent2");
								download.innerHTML = "已安装";
							} else if (
								lib.config["extension_" + item.name + "_version"] != item.version
							) {
								download.innerHTML = "更新扩展";
								download.classList.add("highlight");
								download.classList.add("update");
							} else {
								download.classList.add("transparent2");
								download.innerHTML = "已安装";
							}
						}
						(download as any).info = item;
							download.listen((e: Event) => {
								downloadExtension(e, download as any, item, extensionURL);
							});
						} else {
							// 旧版 2653-2670：无 game.download 时显示网盘/论坛链接
							const links: string[] = [];
							if (item.diskURL) links.push(`<a href="${item.diskURL}" target="_blank">网盘下载</a>`);
							if (item.forumURL) links.push(`<a href="${item.forumURL}" target="_blank">论坛讨论</a>`);
							if (links.length) {
								ui.create.div(
									".text",
									links.join("&nbsp;&nbsp;"),
									node
								);
							}
						}
				}
			});
		})
		.catch((reason: any) => {
			console.log(reason);
			// @ts-expect-error catalog.js 临时变量
			delete window.extension;
			updateTrigger.value++;
		});
}

/**
 * 下载扩展（旧 2462-2566）
 * TODO: 完整保留下载逻辑
 */
function downloadExtension(
	_e: Event,
	that: any,
	info: any,
	extensionURL: string
) {
	if (that.innerHTML != "下载扩展" && that.innerHTML != "更新扩展") return;
	that.classList.remove("update");
	that.innerHTML = "<span>正在下载</span><div>正在下载</div>";
	that.classList.add("nopointer");
	that.classList.add("button-downloading");

	let size = parseFloat(info.size) || 0;
	if (size) {
		if (info.size.includes("MB")) size *= 1024 * 1024;
		else if (info.size.includes("KB")) size *= 1024;
	}

	const progress = ui.create.div(".button-progress", that);
	ui.create.div(progress);

	const url = extensionURL + info.name + ".zip";
	const onprogress = (byte: number, total: number) => {
		if (total) size = total;
		if (byte == -1) byte = size;
		progress.firstChild.style.width = Math.round((100 * byte) / size) + "%";
	};

	const files = info.files || [];
	for (let i = 0; i < files.length; i++) {
		files[i] = "extension/" + info.name + "/" + files[i];
	}

	game.checkFileList(files, () => {
		files.unshift("extension/" + info.name + "/extension.js");
		for (let i = 0; i < files.length; i++) {
			files[i] =
				extensionURL + info.name + "/" + files[i].slice(10 + info.name.length + 1);
		}
		let n1 = 0;
		const n2 = files.length;

		game.multiDownload(
			files,
			() => {
				n1++;
				onprogress(n1, n2);
			},
			(e: any) => {
				game.print("下载失败：" + e.source);
			},
			() => {
				onprogress(-1);
				_status.importingExtension = true;
				(window as any).game = game;
				lib.init.js(
					lib.assetURL + "extension/" + info.name,
					"extension",
					() => {
						if (!lib.config.dev) delete (window as any).game;
						if (game.importedPack) {
							const extname = game.importedPack.name;
							if (lib.config.extensions.includes(extname)) {
								game.removeExtension(extname, true);
							}
							lib.config.extensions.add(extname);
							game.saveConfig("extensions", lib.config.extensions);
							game.saveConfig("extension_" + extname + "_enable", true);
							game.saveConfig(
								"extension_" + extname + "_version",
								info.version
							);
							for (const i in game.importedPack.config) {
								if (
									game.importedPack.config[i] &&
									"init" in game.importedPack.config[i]
								) {
									game.saveConfig(
										"extension_" + extname + "_" + i,
										game.importedPack.config[i].init
									);
								}
							}
							showReload.value = true;
							that.childNodes[0].innerHTML = "安装成功";
							that.childNodes[1].innerHTML = "安装成功";
							that.classList.remove("active");
							that.classList.remove("highlight");
							delete game.importedPack;
						} else {
							that.innerHTML = "安装失败";
							that.classList.add("nopointer");
						}
						_status.importingExtension = false;
					},
					() => {
						that.innerHTML = "下载失败";
						that.classList.add("nopointer");
						_status.importingExtension = false;
					}
				);
			},
			(current: string) => {
				return "extension/" + current.slice(extensionURL.length);
			}
		);
	});
}

onMounted(() => {
	if (!lib.config.menu_loadondemand) {
		updateExtensionList();
	}
});
</script>
