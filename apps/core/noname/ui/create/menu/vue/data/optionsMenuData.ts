import { markRaw } from "vue";
import { ui, game, get, lib, _status } from "noname";
import type { menuData, LeftPaneItem, RightPaneContext } from "../types";
import type { SelectConfigData } from "../../../../../../typings/type";
import OptionsRightPane from "../components/OptionsRightPane.vue";

/**
 * 选项页 menuData —— 迁移自旧版 pages/optionsMenu.js（1091 行）
 *
 * 特点：
 * - 仅非联机（旧版第 7-9 行 if (connectMenu) return）
 * - 左栏分类来自 lib.configMenu 的各 mode + "others" + 可选"文件"项
 * - 右栏根据 mode 不同渲染不同组件（标准配置列表 / BanSkillEditor / FileManager）
 * - 使用 rightPaneComponent 自定义右栏容器
 */

// ---------------------------------------------------------------------------
// 初始化：填充 lib.configMenu.skill.config 的 autoskill/banskill 预设
// 对应旧版 39-108（模块加载时执行）
// ---------------------------------------------------------------------------

/**
 * 自动发动点击处理
 * 对应旧版 clickAutoSkill（39-48）
 */
function clickAutoSkill(bool: boolean, _name: string) {
	let list = lib.config.autoskilllist;
	if (bool) {
		list.remove(_name);
	} else {
		list.add(_name);
	}
	game.saveConfig("autoskilllist", list);
}

/**
 * 双将禁配点击处理（内置禁配项）
 * 对应旧版 clickBanSkill（64-73）
 */
function clickBanSkill(bool: boolean, _name: string) {
	let list = lib.config.forbidlist;
	if (bool) {
		list.remove(_name);
	} else {
		list.add(_name);
	}
	game.saveConfig("forbidlist", list);
}

/**
 * 初始化 autoskill / banskill 配置到 lib.configMenu.skill.config
 * 对应旧版 49-108
 */
function initSkillConfigPresets() {
	let skilllistexpanded = game.expandSkills(lib.skilllist);
	// 自动发动预设
	for (let i in lib.skill) {
		if (!skilllistexpanded.includes(i)) {
			continue;
		}
		if (lib.skill[i].frequent && lib.translate[i]) {
			(function (skillName) {
				lib.configMenu.skill.config[skillName] = {
					name: lib.translate[skillName + "_noconf"] || lib.translate[skillName],
					init: true,
					type: "autoskill",
					onclick: function (result: boolean) {
						clickAutoSkill(result, skillName);
					},
					intro: lib.translate[skillName + "_info"],
				} as SelectConfigData & { type: string };
			})(i);
		}
	}
	// 内置双将禁配预设
	let forbid = lib.config.forbid;
	if (!lib.config.forbidlist) {
		game.saveConfig("forbidlist", []);
	}
	for (let i = 0; i < forbid.length; i++) {
		let skip = false;
		let str = "";
		let str2 = "";
		let str3 = "";
		for (let j = 0; j < forbid[i].length; j++) {
			if (!lib.skilllist.includes(forbid[i][j])) {
				skip = true;
				break;
			}
			str += get.translation(forbid[i][j]) + "+";
			str2 += forbid[i][j] + "+";
			str3 += get.translation(forbid[i][j]) + "：" + lib.translate[forbid[i][j] + "_info"];
			if (j < forbid[i].length - 1) {
				str3 += '<div class="placeholder slim" style="display:block;height:8px"></div>';
			}
		}
		if (skip) {
			continue;
		}
		str = str.slice(0, str.length - 1);
		str2 = str2.slice(0, str2.length - 1);

		let cfgName = str2;
		(function (banName) {
			lib.configMenu.skill.config[banName] = {
				name: str,
				init: true,
				type: "banskill",
				onclick: function (result: boolean) {
					clickBanSkill(result, banName);
				},
				intro: str3,
			} as SelectConfigData & { type: string };
		})(cfgName);
	}
}

// 模块加载时执行一次预设填充
initSkillConfigPresets();

// ---------------------------------------------------------------------------
// updateView / updateAppearence 闭包（跨 mode 共享）
// 对应旧版 110-111, 303-310
// ---------------------------------------------------------------------------

let updateView: (() => void) | null = null;
let updateAppearence: (() => void) | null = null;

// ---------------------------------------------------------------------------
// 特殊配置项的 onclick 处理
// ---------------------------------------------------------------------------

/**
 * import_data_button 的 onclick —— 数据导入
 * 对应旧版 362-415
 *
 * TODO: 阶段 6 入口切换时评估 ui.import_data_button 外部 API 兼容。
 *   旧版赋值 ui.import_data_button = cfgnode（DOM 节点），外部代码通过该引用操作 DOM。
 *   Vue 版没有 cfgnode DOM，此赋值无法保留。需在阶段 6 评估是否需要保留 ref。
 */
function handleImportDataButton() {
	let fileToLoad = this.files[0];
	if (!fileToLoad) return;
	let fileReader = new FileReader();
	fileReader.onload = function (fileLoadedEvent) {
		let data = fileLoadedEvent.target!.result as string;
		if (!data) return;
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
 * TODO: 阶段 6 入口切换时评估 ui.background_music_setting 外部 API 兼容。
 *   旧版操作 ui.background_music_setting._link.menu（DOM 节点）来更新音乐菜单项。
 *   Vue 版没有 cfgnode DOM，这部分 DOM 操作会失效。保留逻辑，标注需适配。
 */
function handleImportMusic() {
	if (_status.music_importing) return;
	_status.music_importing = true;
	let fileToLoad = this.files[0];
	if (!fileToLoad) {
		_status.music_importing = false;
		return;
	}
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
			// TODO: 阶段 6 适配 —— 旧版这里通过 DOM 操作更新音乐菜单列表：
			//   nodezz.item[link] = ...; ui.create.div(...); nodexx._link.config.updatex.call(nodexx, [])
			//   Vue 版需要通过响应式数据或事件通知菜单更新。
		});
	};
	if (game.writeFile) {
		game.writeFile(fileToLoad, "audio/background", link + ".mp3", callback);
	} else {
		game.putDB("audio", link, fileToLoad, callback);
	}
}

// ---------------------------------------------------------------------------
// 构建 mode 对应的 SelectConfigData 列表
// 对应旧版 createModeConfig 的配置遍历部分（112-518）
// ---------------------------------------------------------------------------

/**
 * @param mode - lib.configMenu 的分类名（如 skill/appearence/view/others 等）
 * @returns 该分类下所有 SelectConfigData（含 autoskill/banskill 特殊标记项）
 */
function buildModeConfigs(mode: string): SelectConfigData[] {
	let info = lib.configMenu[mode];
	if (!info || !info.config) return [];

	let configs: SelectConfigData[] = [];
	let map: Record<string, any> = {};
	let config = lib.config;

	// 捕获 updateView/updateAppearence 闭包
	if (mode == "appearence") {
		updateAppearence = function () {
			info.config.update(config, map);
		};
	} else if (mode == "view") {
		updateView = function () {
			info.config.update(config, map);
		};
	}

	for (let j in info.config) {
		if (j === "update") continue;
		let cfg = get.copy(info.config[j]) as SelectConfigData & { type?: string };
		cfg._name = j;
		if (j in config) {
			cfg.init = config[j];
		} else if (cfg.type != "autoskill" && cfg.type != "banskill") {
			game.saveConfig(j, cfg.init);
		}

		// 默认 onclick：保存配置（this 语义适配 —— 闭包捕获 cfg）
		if (!cfg.onclick) {
			cfg.onclick = function (result: any) {
				game.saveConfig(cfg._name!, result);
				if (cfg.onsave) {
					cfg.onsave.call(this, result);
				}
			};
		}

		// update 函数
		if (info.config.update) {
			if (mode == "appearence" || mode == "view") {
				cfg.update = function () {
					if (updateAppearence) updateAppearence();
					if (updateView) updateView();
				};
			} else {
				cfg.update = function () {
					info.config.update(config, map);
				};
			}
		}

		// 特殊配置项 onclick 覆盖
		if (j == "import_data_button") {
			// TODO: 阶段 6 —— ui.import_data_button 外部 API 兼容
			//   旧版: ui.import_data_button = cfgnode; cfgnode.hide()
			//   Vue 版没有 cfgnode，需在阶段 6 评估替代方案
			//   这里保留 onclick 逻辑（通过 file input 的 change 事件触发）
			cfg.onclick = function () {
				// No-op in Vue: import_data_button is handled by OptionsRightPane's special rendering
			};
		} else if (j == "import_music") {
			// TODO: 阶段 6 —— ui.background_music_setting 外部 API 兼容
			cfg.onclick = function () {
				// No-op in Vue: import_music is handled by OptionsRightPane's special rendering
			};
		} else if (j == "extension_source") {
			// TODO: 阶段 6 —— ui.extension_source 外部 API 兼容
			//   旧版: ui.extension_source = cfgnode; cfgnode.updateInner = function() { ... }
			cfg.onclick = function () {
				// No-op in Vue: extension_source is handled by OptionsRightPane's special rendering
			};
		}

		map[j] = cfg;
		configs.push(cfg);
	}

	// 执行 config.update 初始化（如果存在）
	if (info.config.update) {
		info.config.update(config, map);
	}

	return configs;
}

// ---------------------------------------------------------------------------
// 缓存：每个 mode 的配置列表（避免重复构建）
// ---------------------------------------------------------------------------

let modeConfigsCache: Map<string, SelectConfigData[]> = new Map();

function getModeConfigs(mode: string): SelectConfigData[] {
	if (!modeConfigsCache.has(mode)) {
		modeConfigsCache.set(mode, buildModeConfigs(mode));
	}
	return modeConfigsCache.get(mode)!;
}

// ---------------------------------------------------------------------------
// 检测文件管理器可用性
// 对应旧版 530: if (!lib.node?.fs || !window.resolveLocalFileSystemURL)
// ---------------------------------------------------------------------------

function isFileManagerAvailable(): boolean {
	// @ts-expect-error resolveLocalFileSystemURL 是 Cordova/旧浏览器 API
	return !!(lib.node?.fs || window.resolveLocalFileSystemURL);
}

// ---------------------------------------------------------------------------
// 左栏数据构建
// 对应旧版 520-524 + 529-536 + 1080
// ---------------------------------------------------------------------------

function buildLeftPaneData(): LeftPaneItem[] {
	let items: LeftPaneItem[] = [];

	// 遍历 lib.configMenu（排除 "others"——最后添加）
	for (let mode in lib.configMenu) {
		if (mode != "others") {
			items.push({
				name: lib.configMenu[mode].name,
				key: mode,
			});
		}
	}

	// "文件" 按钮 —— 仅平台支持时
	if (isFileManagerAvailable()) {
		items.push({
			name: "文件",
			key: "create",
		});
	}

	// "others" 最后添加
	if (lib.configMenu.others) {
		items.push({
			name: lib.configMenu.others.name,
			key: "others",
		});
	}

	return items;
}

// ---------------------------------------------------------------------------
// 右栏数据获取（标准模式 —— 返回 SelectConfigData[]）
// ---------------------------------------------------------------------------

function getRightPaneForMode(mode: string): SelectConfigData[] {
	return getModeConfigs(mode);
}

// ---------------------------------------------------------------------------
// 导出 menuData
// ---------------------------------------------------------------------------

const optionsMenuData: menuData = {
	leftPaneData: buildLeftPaneData(),

	getRightPane(ctx: RightPaneContext): SelectConfigData[] {
		let mode = ctx.item.key;
		// "create"（文件管理器）右栏不返回配置项，由 OptionsRightPane 渲染 FileManager
		if (mode === "create") {
			return [];
		}
		return getRightPaneForMode(mode);
	},

	getDefaultActiveKey(_connectMenu: boolean): string | null {
		// 对应旧版 1082-1086：选第一个左栏项
		// 返回 null 表示由 MenuView 回退选第一个
		return null;
	},

	// 自定义右栏组件 —— 根据左栏 item.key 分派渲染逻辑
	// 标准 mode: NonameConfig 列表
	// mode="create": FileManager
	// mode="skill": 包含 BanSkillEditor 的增强配置列表
	rightPaneComponent: markRaw(OptionsRightPane),
};

export default optionsMenuData;

// ---------------------------------------------------------------------------
// 特殊配置项的 DOM 交互逻辑导出（供 OptionsRightPane 使用）
// 这些函数在 Vue 下无法通过 cfgnode DOM 调用，需在 OptionsRightPane 中通过
// file input 的 change 事件或特殊渲染来桥接
// ---------------------------------------------------------------------------

export { handleImportDataButton, handleImportMusic };
