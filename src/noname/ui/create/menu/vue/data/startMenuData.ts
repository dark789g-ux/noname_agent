import { reactive } from "vue";
import type { menuData, LeftPaneItem, RightPaneContext } from "../types";
import { lib, game, get, _status } from "noname";
import { menuUpdates } from "../menuState";
import { makeConfigAdapter } from "../utils/configAdapter";

// ---------------------------------------------------------------------------
// 工厂函数：根据 connectMenu 构建开始页 / 模式页的 menuData
// 对应旧版 pages/startMenu.js 整体
// ---------------------------------------------------------------------------

/**
 * 构建左栏模式列表数据。
 * 对应旧版 startMenu.js:348-367 的 createModeConfig 循环。
 *
 * @param connectMenu 联机时只保留带 connect 属性的模式
 */
function buildLeftPaneData(connectMenu: boolean): LeftPaneItem[] {
	let modeorder: string[] = lib.config.modeorder || [];
	for (const i in lib.mode) {
		modeorder.add(i);
	}

	const leftPaneNames: string[] = modeorder.filter(function (mode) {
		if (connectMenu) {
			if (!lib.mode[mode].connect) return false;
			// 初始化联机封禁数组
			if (!lib.config["connect_" + mode + "_banned"])
				lib.config["connect_" + mode + "_banned"] = [];
			if (!lib.config["connect_" + mode + "_bannedcards"])
				lib.config["connect_" + mode + "_bannedcards"] = [];
		}
		if (lib.config.all.mode.includes(mode)) return true;
		return false;
	});

	return leftPaneNames.map(function (mode) {
		return {
			name: lib.mode[mode]?.name || mode,
			key: mode,
		};
	});
}

/**
 * 获取默认选中模式的 key。
 * 对应旧版 startMenu.js:157-163 的 active 判断。
 *
 * @param connectMenu 联机返回 connect_mode，非联机返回 mode
 */
function getDefaultActiveKey(connectMenu: boolean): string | null {
	if (connectMenu) {
		return lib.config.connect_mode || null;
	}
	return lib.config.mode || null;
}

/**
 * 联机分支：updateConnectDisplayMap 是否已 push 到 menuUpdates 的标记。
 * 避免多次 getRightPane 调用导致重复 push。
 * 对应旧版 startMenu.js:156 的 menuUpdates.push(updateConnectDisplayMap)。
 */
let _connectUpdatePushed = false;

/**
 * 构建某模式右栏配置项列表。
 * 对应旧版 startMenu.js:165-336 的 node._initLink。
 *
 * 核心逻辑：
 *   1. 取 info.connect / info.config 作为 infoconfig
 *   2. 联机时注入 4 个固定配置项
 *   3. 遍历 infoconfig，get.copy 深拷贝后设置 _name / mode / init
 *   4. 构建默认 onclick（保存配置 + restart 高亮）
 *   5. 传递 infoconfig.update 的 map 参数
 *
 * @param ctx 右栏上下文（含 connectMenu、item、startButtonEl）
 */
function getRightPane(ctx: RightPaneContext): any[] {
	const mode = ctx.item.key;
	let connectMenu = ctx.connectMenu;
	const startButtonEl = ctx.startButtonEl;
	const info = lib.mode[mode];
	if (!info) return [];

	const infoconfig = connectMenu ? info.connect : info.config;
	if (!infoconfig) return [];

	const config = lib.config.mode_config[mode] || {};

	// 联机时注入 4 个固定配置项（直接写入 infoconfig，与旧版一致）
	if (connectMenu) {
		infoconfig.connect_choose_timeout = {
			name: "出牌时限",
			init: "30",
			item: { 10: "10秒", 15: "15秒", 30: "30秒", 60: "60秒", 90: "90秒" },
			connect: true,
			frequent: true,
		};
		infoconfig.connect_observe = { name: "允许旁观", init: true, connect: true };
		infoconfig.connect_observe_handcard = { name: "允许观看手牌", init: false, connect: true };
		infoconfig.connect_mount_combine = { name: "合并坐骑栏", init: false, connect: true };
	}

	// 联机时 push updateConnectDisplayMap（仅一次）
	if (connectMenu && !_connectUpdatePushed) {
		// 对应旧版 startMenu.js:141-154 的 updateConnectDisplayMap
		const updateConnectDisplayMap = function () {
			// TODO: Vue 版没有 cfgnode DOM，updateConnectDisplayMap 需要适配（当前未实现）。
			// 旧版通过 connectDisplayMap.map[j] = cfgnode（DOM 节点）来隐藏
			// connect_player_number / connect_versus_mode 的 display。
			// 待 NonameConfig 增强（如 v-show 支持或 ref 收集）后补全。
		};
		menuUpdates.push(updateConnectDisplayMap);
		_connectUpdatePushed = true;
	}

	let result: any[] = [];

	// map：key → makeConfigAdapter 适配器（与 optionsMenuData 共用同一套桥接）
	// 旧版 map[j] 是 DOM 节点（polyfill 注入 hide()/show()），模式自带 infoconfig.update
	// 会直接调用这些方法（如 identity 模式的 round_one_use_fury.hide()），
	// 纯数据对象会抛 TypeError，所以这里放适配器而不是 cfg 本身。
	// hide/show 翻译为 cfg._hidden，由 NonameConfig 的 v-show 生效；
	// _link / classList / updatex 由适配器 shim，updatex 内有 try/catch 兜底，
	// 操作 DOM 的部分失效时静默跳过。
	const map: Record<string, any> = {};

	for (const j in infoconfig) {
		if (j === "update") continue;

		let cfg = reactive(get.copy(infoconfig[j]));
		cfg._hidden = false;
		cfg._name = j;
		cfg.mode = mode;

		// 已保存值优先，否则存默认值
		if (j in config) {
			cfg.init = config[j];
		} else {
			game.saveConfig(j, cfg.init, mode);
		}

		// 默认 onclick：保存配置 + restart 高亮启动按钮
		// ---- this 语义适配说明 ----
		// 旧版 onclick 通过 clickToggle → config.onclick.call(nodeEl, ...) 调用，
		// 旧版 onclick 内部用 `this._link.config` 取回 cfg（从 DOM 节点的 _link 属性）。
		// Vue 版 doToggle / doMenuItem 直接传 config 参数给 onclick，不再依赖 DOM._link。
		// 因此这里 onclick 内直接通过闭包访问 cfg，而非 this._link.config。
		if (!cfg.onclick) {
			(function (cfgCapture) {
				cfgCapture.onclick = function (result: any) {
					// 旧版 this 语义：原为 this._link.config，Vue 版通过闭包直接访问
					game.saveConfig(cfgCapture._name, result, mode);
					if (cfgCapture.onsave) {
						cfgCapture.onsave.call(this, result);
					}
					// restart 高亮：非联机模式 或 联机房主
					if (!_status.connectMode || game.online) {
						if (typeof cfgCapture.restart == "function") {
							if (cfgCapture.restart()) {
								if (startButtonEl) startButtonEl.classList.add("glowing");
							}
						} else if (cfgCapture.restart) {
							if (startButtonEl) startButtonEl.classList.add("glowing");
						}
					}
				};
			})(cfg);
		}

		// infoconfig.update：传递 map 供 update 函数操作其它配置项
		if (infoconfig.update) {
			(function (cfgCapture) {
				cfgCapture.update = function () {
					infoconfig.update(config, map);
				};
			})(cfg);
		}

		map[j] = makeConfigAdapter(cfg);
		result.push(cfg);

		// TODO: 折叠功能（fold_mode / "更多"按钮）（当前未实现，旧版的折叠 UI，Vue 版暂无等价）
		// 旧版把 unfrequent 项放入"更多"折叠区（startMenu.js:275-310），
		// 有"更多"按钮 + expanded 状态 + mousewheel 展开。
		// NonameConfig 目前是平铺 v-for 渲染所有项，不识别 unfrequent 标记。
		// cfg.unfrequent 字段保留在 cfg 对象上，待 NonameConfig 增强（支持折叠渲染）后补全。
		// 当前平铺所有项（含 unfrequent 项）。
	}

	// TODO: 模式排序按钮（上移↑ / 下移↓）（当前未实现，旧版的左栏增强 UI，Vue 版暂无等价）
	// 旧版 startMenu.js:248-273 在非联机模式下添加上移/下移按钮到隐藏区。
	// 这属于左栏增强功能，涉及左栏 UI 交互（不在 getRightPane 返回范围）。

	// TODO: "隐藏此模式"按钮（当前未实现，旧版的额外 UI（非配置项），Vue 版暂无等价）
	// 旧版 startMenu.js:312-329 在非联机模式下添加"隐藏此模式"按钮。

	// 首次构建时调用 infoconfig.update
	if (infoconfig.update) {
		infoconfig.update(config, map);
	}

	return result;
}

/**
 * 工厂函数：创建开始页（非联机）或模式页（联机）的 menuData。
 *
 * - leftPaneData 在调用时一次性计算（connectMenu 固定）
 * - getRightPane 通过 ctx.connectMenu / ctx.item.key 动态构建配置项
 * - getDefaultActiveKey 通过 connectMenu 参数返回对应默认模式
 *
 * @param connectMenu 是否联机菜单
 */
export function createStartMenuData(connectMenu: boolean): menuData {
	return {
		leftPaneData: buildLeftPaneData(connectMenu),
		getRightPane: getRightPane,
		getDefaultActiveKey: getDefaultActiveKey,
	};
}
