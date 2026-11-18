import { _status, game, lib } from "noname";
import { security } from "@/util/sandbox";

export type ExtensionItemStatus = "download" | "update" | "installed" | "downloading" | "install_failed" | "download_failed";

export interface CatalogExtensionItem {
	name: string;
	author: string;
	size: string;
	date: string;
	intro: string;
	version?: string;
	files?: string[];
	diskURL?: string;
	forumURL?: string;
	status: ExtensionItemStatus;
	progressPercent: number;
}

export function resolveExtensionRepoURL(): string {
	const source = lib.config.extension_sources;
	const index = lib.config.extension_source;
	if (source && source[index]) {
		return source[index];
	}
	return lib.updateURL.replace(/noname/g, "noname-extension") + "/master/";
}

function resolveInitialItemStatus(item: any): ExtensionItemStatus {
	if (!lib.config.extensions.includes(item.name)) {
		return "download";
	}
	if (lib.extensionPack[item.name]?.version === item.version) {
		return "installed";
	}
	if (lib.config[`extension_${item.name}_version`] !== item.version) {
		return "update";
	}
	return "installed";
}

/** 从远程 `catalog.js` 拉取扩展列表并映射为响应式条目。 */
export async function fetchExtensionCatalog(extensionURL: string): Promise<CatalogExtensionItem[]> {
	// @ts-expect-error catalog.js 通过 security.eval 写入 window.extension
	delete window.extension;
	// @ts-expect-error catalog.js 通过 security.eval 写入 window.extension
	window.extension = {};
	try {
		const response = await fetch(`${extensionURL}catalog.js`, { referrerPolicy: "no-referrer" });
		const source = await response.text();
		await security.eval(source);
		// @ts-expect-error catalog.js 设置 window.extension
		const extension = window.extension || {};
		const list: any[] = [];
		for (const key in extension) {
			extension[key].name = key;
			list.push(extension[key]);
		}
		list.randomSort();
		return list.map(raw => ({
			...raw,
			status: resolveInitialItemStatus(raw),
			progressPercent: 0,
		}));
	} finally {
		// @ts-expect-error catalog.js 临时变量
		delete window.extension;
	}
}

/** 读取本地 ZIP 文件并调用 `game.importExtension`。 */
export async function importExtensionZipFile(file: File): Promise<boolean> {
	const result = await new Promise<ArrayBuffer>((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = reject;
		reader.onload = e => resolve(e.target?.result as ArrayBuffer);
		reader.readAsArrayBuffer(file);
	});
	const imported = await game.importExtension(result, () => {
		game.print("导入成功，3秒后将重启");
		setTimeout(game.reload, 3000);
	});
	return imported !== false;
}

/** 下载扩展条目并在完成后加载与激活配置。 */
export function downloadCatalogExtension(
	item: CatalogExtensionItem,
	extensionURL: string,
	onInstalled: () => void
): void {
	if (item.status !== "download" && item.status !== "update") return;
	item.status = "downloading";
	item.progressPercent = 0;

	let size = parseFloat(item.size) || 0;
	if (size) {
		if (item.size.includes("MB")) size *= 1024 * 1024;
		else if (item.size.includes("KB")) size *= 1024;
	}

	const updateProgress = (byte: number, total: number) => {
		if (total) size = total;
		if (byte === -1) byte = size;
		item.progressPercent = size > 0 ? Math.round((100 * byte) / size) : 100;
	};

	const rawFiles = [...(item.files || [])];
	const files = rawFiles.map(f => `extension/${item.name}/${f}`);

	game.checkFileList(files, () => {
		files.unshift(`extension/${item.name}/extension.js`);
		for (let i = 0; i < files.length; i++) {
			files[i] = `${extensionURL}${item.name}/${files[i].slice(10 + item.name.length + 1)}`;
		}
		let finished = 0;
		const totalFiles = files.length;

		game.multiDownload(
			files,
			() => {
				finished++;
				updateProgress(finished, totalFiles);
			},
			(e: any) => {
				game.print(`下载失败：${e.source}`);
			},
			() => {
				updateProgress(-1, totalFiles);
				_status.importingExtension = true;
				(window as any).game = game;
				lib.init.js(
					`${lib.assetURL}extension/${item.name}`,
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
							game.saveConfig(`extension_${extname}_enable`, true);
							game.saveConfig(`extension_${extname}_version`, item.version);
							for (const key in game.importedPack.config) {
								const entry = game.importedPack.config[key];
								if (entry && "init" in entry) {
									game.saveConfig(`extension_${extname}_${key}`, entry.init);
								}
							}
							onInstalled();
							item.status = "installed";
							delete game.importedPack;
						} else {
							item.status = "install_failed";
						}
						_status.importingExtension = false;
					},
					() => {
						item.status = "download_failed";
						_status.importingExtension = false;
					}
				);
			},
			(current: string) => `extension/${current.slice(extensionURL.length)}`
		);
	});
}
