import { game, lib, _status } from "noname";
import { menuBridge } from "../utils/menuBridge";

// ---------------------------------------------------------------------------
// 特殊配置项的 onclick 处理
// ---------------------------------------------------------------------------

/**
 * import_data_button 的 onclick —— 数据导入
 * 对应旧版 362-415
 *
 * Vue 版由 OptionsRightPane 的生命周期桥接接收文件。数据层保留旧有
 * 「读取 → 解码 → 写入 → reload」顺序，不再依赖全局 DOM 引用。
 */
export function handleImportDataButton(fileToLoad: File) {
	let fileReader = new FileReader();
	fileReader.onload = function (fileLoadedEvent) {
		let data = fileLoadedEvent.target?.result;
		if (typeof data !== "string" || !data) return;
		try {
			data = JSON.parse(lib.init.decode(data));
			if (!data || typeof data != "object") {
				throw new Error("err");
			}
			if (lib.db && (!data.config || !data.data)) {
				throw new Error("err");
			}
		} catch (e) {
			console.log(e);
			alert("导入失败");
			return;
		}
		alert("导入成功");
		if (!lib.db) {
			let noname_inited = localStorage.getItem("noname_inited");
			let onlineKey = localStorage.getItem(lib.configprefix + "key");
			localStorage.clear();
			if (noname_inited) {
				localStorage.setItem("noname_inited", noname_inited);
			}
			if (onlineKey) {
				localStorage.setItem(lib.configprefix + "key", onlineKey);
			}
			for (let i in data) {
				localStorage.setItem(i, data[i]);
			}
		} else {
			for (let i in data.config) {
				game.putDB("config", i, data.config[i]);
				lib.config[i] = data.config[i];
			}
			for (let i in data.data) {
				game.putDB("data", i, data.data[i]);
			}
		}
		lib.init.background();
		game.reload();
	};
	fileReader.readAsText(fileToLoad, "UTF-8");
}

/**
 * import_music 的 onclick —— 音乐导入
 * 对应旧版 416-474
 *
 * ui.background_music_setting 已数据驱动化：导入完成后写源配置项
 * （lib.configMenu.audio.config.background_music.item）并经
 * menuBridge.refreshOptionsConfig 刷新选项菜单，替代旧版对
 * ui.background_music_setting._link.menu 的 DOM 操作。
 */
export function handleImportMusic(fileToLoad: File) {
	if (_status.music_importing) return;
	_status.music_importing = true;
	if (!lib.config.customBackgroundMusic) {
		lib.config.customBackgroundMusic = {};
	}
	let name = fileToLoad.name;
	if (name.includes(".")) {
		name = name.slice(0, name.indexOf("."));
	}
	let link = (game.writeFile ? "cdv_" : "custom_") + name;
	if (lib.config.customBackgroundMusic[link]) {
		if (!confirm("已经存在文件名称相同的背景音乐，是否仍然要继续导入？")) {
			_status.music_importing = false;
			return;
		}
		for (let i = 1; i < 1000; i++) {
			if (!lib.config.customBackgroundMusic[link + "_" + i]) {
				link = link + "_" + i;
				break;
			}
		}
	}
	let callback = function () {
		let musicname = link.slice(link.indexOf("_") + 1);
		game.prompt("###请输入音乐的名称###" + musicname, true, function (str: string) {
			if (str) {
				musicname = str;
			}
			lib.config.customBackgroundMusic[link] = musicname;
			lib.config.background_music = link;
			lib.config.all.background_music.add(link);
			game.saveConfig("background_music", link);
			game.saveConfig("customBackgroundMusic", lib.config.customBackgroundMusic);
			_status.music_importing = false;
			if (!_status._aozhan) {
				game.playBackgroundMusic();
			}
			// 数据驱动：写源配置项后经 menuBridge 刷新选项菜单音乐列表
			// （替代旧版 nodezz.item[link] = ... + ui.create.div + updatex 的 DOM 操作）
			lib.configMenu.audio.config.background_music.item[link] = musicname;
			menuBridge.refreshOptionsConfig?.("background_music");
		});
	};
	if (game.writeFile) {
		game.writeFile(fileToLoad, "audio/background", link + ".mp3", callback);
	} else {
		game.putDB("audio", link, fileToLoad, callback);
	}
}
