import JSZip from "jszip";
import { game, lib } from "noname";

function getNonameInitialized(): string {
	return localStorage.getItem("noname_inited") || "";
}

function resolveCordovaDir(relativePath: string, onResolved: (entry: any) => void): void {
	// @ts-expect-error resolveLocalFileSystemURL 是 Cordova API
	window.resolveLocalFileSystemURL(getNonameInitialized() + relativePath, onResolved);
}

/** 递归/批量删除文件，全部完成后回调。 */
export function removePlatformFiles(currentPath: string, paths: string[], onDone: () => void): void {
	const queue = [...paths];
	if (lib.node && lib.node.fs) {
		const next = () => {
			const rel = queue.shift();
			if (!rel) {
				onDone();
				return;
			}
			lib.node.fs.unlink(`${__dirname}/${rel}`, next);
		};
		next();
		return;
	}

	resolveCordovaDir(currentPath, entry => {
		const next = () => {
			const rel = queue.shift();
			if (!rel) {
				onDone();
				return;
			}
			const filename = rel.split("/").pop()!;
			entry.getFile(filename, { create: false }, (fileEntry: any) => {
				fileEntry.remove(next);
			});
		};
		next();
	});
}

/** 递归删除目录及其所有子项。 */
export function removePlatformDirectory(relativePath: string, onDone: () => void): void {
	if (lib.node && lib.node.fs) {
		const removeDir = (p: string, callback: () => void) => {
			lib.node.fs.readdir(`${__dirname}/${p}`, (err: any, list: string[]) => {
				if (err) {
					console.log(err);
					return;
				}
				const next = () => {
					const filename = list.shift();
					if (!filename) {
						lib.node.fs.rmdir(`${__dirname}/${p}`, callback);
						return;
					}
					const url = `${__dirname}/${p}/${filename}`;
					if (lib.node.fs.statSync(url).isDirectory()) {
						removeDir(`${p}/${filename}`, next);
					} else {
						lib.node.fs.unlink(url, next);
					}
				};
				next();
			});
		};
		removeDir(relativePath, onDone);
		return;
	}

	resolveCordovaDir(relativePath, entry => {
		entry.removeRecursively(onDone);
	});
}

/** 在指定父目录下新建子目录。 */
export function createPlatformDirectory(parentPath: string, folderName: string, onDone: () => void): void {
	if (lib.node && lib.node.fs) {
		lib.node.fs.mkdir(`${__dirname}/${parentPath}/${folderName}`, onDone);
		return;
	}
	resolveCordovaDir(parentPath, entry => {
		entry.getDirectory(folderName, { create: true }, onDone);
	});
}

export interface AssetZipPlan {
	zip: JSZip;
	audios: string[];
	fonts: string[];
	images: string[];
	directories: Record<string, string[]>;
	directoryList: string[];
	filelist: string[];
	summaryText: string;
}

/** 解析 ZIP 素材压缩包中的音频/字体/图片清单。 */
export function parseAssetZipBuffer(data: ArrayBuffer): AssetZipPlan {
	const zip = new JSZip();
	zip.load(data);
	const audios: string[] = [];
	const fonts: string[] = [];
	const images: string[] = [];
	const directories: Record<string, string[]> = {};
	const directoryList: string[] = [];

	for (const file of Object.keys(zip.files)) {
		const parsedPath = lib.path.parse(file);
		const directory = parsedPath.dir;
		const fileExtension = parsedPath.ext.toLowerCase();
		if (directory.startsWith("audio") && (fileExtension === ".mp3" || fileExtension === ".ogg")) {
			audios.push(file);
		} else if (directory.startsWith("font") && fileExtension === ".woff2") {
			fonts.push(file);
		} else if (directory.startsWith("image") && (fileExtension === ".jpg" || fileExtension === ".png")) {
			images.push(file);
		} else {
			continue;
		}
		if (!directories[directory]) {
			directories[directory] = [];
			directoryList.push(directory);
		}
		directories[directory].push(parsedPath.base);
	}

	const summaryParts: string[] = [];
	if (audios.length) summaryParts.push(`${audios.length}个音频文件`);
	if (fonts.length) summaryParts.push(`${fonts.length}个字体文件`);
	if (images.length) summaryParts.push(`${images.length}个图片文件`);
	const filelist = audios.concat(fonts, images);
	let summaryText = summaryParts.join("、");
	if (filelist.length > 200) summaryText += "，导入时间可能较长";

	return { zip, audios, fonts, images, directories, directoryList, filelist, summaryText };
}

/** 将解析后的 ZIP 素材按平台写入本地目录。 */
export function writeAssetZipPlan(plan: AssetZipPlan, onDone: () => void): void {
	const filelist = [...plan.filelist];
	const directoryList = [...plan.directoryList];

	if (lib.node && lib.node.fs) {
		const writeNext = () => {
			const f = filelist.shift();
			if (!f) {
				onDone();
				return;
			}
			game.print(f.slice(f.lastIndexOf("/") + 1));
			lib.node.fs.writeFile(`${__dirname}/${f}`, plan.zip.files[f].asNodeBuffer(), null, writeNext);
		};
		game.ensureDirectory(directoryList, writeNext);
		return;
	}

	const writeNextDirectory = () => {
		const dir = directoryList.shift();
		if (!dir) {
			onDone();
			return;
		}
		const files = [...plan.directories[dir]];
		resolveCordovaDir(dir, entry => {
			const writeNextFile = () => {
				const filename = files.shift();
				if (!filename) {
					writeNextDirectory();
					return;
				}
				game.print(filename);
				entry.getFile(filename, { create: true }, (fileEntry: any) => {
					fileEntry.createWriter((fileWriter: any) => {
						fileWriter.onwriteend = writeNextFile;
						fileWriter.onerror = (e: any) => {
							game.print("Write failed: " + e.toString());
						};
						fileWriter.write(plan.zip.files[`${dir}/${filename}`].asArrayBuffer());
					});
				});
			};
			writeNextFile();
		});
	};
	game.ensureDirectory(directoryList, writeNextDirectory);
}
