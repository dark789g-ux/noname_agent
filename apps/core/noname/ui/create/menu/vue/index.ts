import { createApp } from "vue";
import { ui, game, _status, lib } from "noname";
import MenuView from "./components/MenuView.vue";
import { menuBridge } from "./utils/menuBridge";
import { refreshCharacterPack } from "./data/characterPackMenuData";
import { refreshCardPack } from "./data/cardPackMenuData";

// ---------------------------------------------------------------------------
// 模块级可变变量 —— 与旧版 menu/index.js 导出签名兼容
// 阶段 6 切换入口时，外部 import { menuContainer, popupContainer, ... }
// from "./menu/vue/index.js" 即可替代旧版 from "./menu/index.js"
// ---------------------------------------------------------------------------

/**
 * 菜单容器（.menu-container.hidden，挂在 ui.window）
 * 也是一个全屏 div，但它的子元素是菜单栏
 */
export let menuContainer: HTMLDivElement;

/**
 * 弹出菜单容器（.popup-container.hidden，挂在 ui.window）
 * 一个全屏 div
 */
export let popupContainer: HTMLDivElement;

/**
 * 当前激活项的更新回调（由 tab 内部模块通过 setUpdateActive 注入）
 */
export let updateActive: Function;

/**
 * 设置 updateActive 回调
 */
export function setUpdateActive(fun: Function) {
	updateActive = fun;
}

/**
 * 卡牌激活项的更新回调
 */
export let updateActiveCard: Function;

/**
 * 设置 updateActiveCard 回调
 */
export function setUpdateActiveCard(fun: Function) {
	updateActiveCard = fun;
}

/**
 * 旧版 createMenu 返回的结构 { menu, pages }
 * 阶段 0 暂保留为 { menu: menuContainer, pages: [] }
 * TODO: 阶段 6 切换入口后，如无外部依赖可移除此导出
 */
export let menux: { menu: HTMLDivElement; pages: HTMLDivElement[] };

/**
 * 旧版各 page 的 DOM 引用
 * TODO: 阶段 6 切换入口后，如无外部依赖可移除此导出
 */
export let menuxpages: HTMLDivElement[];

/**
 * 菜单更新回调数组，打开菜单时逐个调用
 */
export const menuUpdates: Function[] = [];

// ---------------------------------------------------------------------------
// 内部函数（阶段 0 暂不挂载到 ui.click，阶段 6 切换入口时补接）
// ---------------------------------------------------------------------------

/**
 * 点击 menuContainer 背景时的处理（关闭菜单、恢复游戏状态）
 * 对应旧版 clickContainer(connectMenu)
 */
function clickContainer(container: HTMLDivElement, connectMenu: boolean) {
	container.classList.add("hidden");
	if (connectMenu) {
		// @ts-expect-error enteringroom/creatingroom 是运行时挂在 _status 上的属性，TS 类型声明缺失
		if (_status.enteringroom) {
			// @ts-expect-error enteringroom 是运行时挂在 _status 上的属性
			_status.enteringroom = false;
		}
		// @ts-expect-error creatingroom 是运行时挂在 _status 上的属性
		if (_status.creatingroom) {
			// @ts-expect-error creatingroom 是运行时挂在 _status 上的属性
			_status.creatingroom = false;
		}
		ui.window.classList.remove("shortcutpaused");
	} else {
		game.resume2();
		// @ts-expect-error onresume2 是运行时挂在 game 上的回调属性，TS 类型声明缺失
		if (game.onresume2) {
			// @ts-expect-error onresume2 是运行时挂在 game 上的回调属性
			game.onresume2();
		}
		ui.arena.classList.remove("menupaused");
		// @ts-expect-error historybar 是运行时挂在 ui 上的属性，TS 类型声明缺失
		ui.historybar.classList.remove("menupaused");
		ui.window.classList.remove("touchinfohidden");
		// @ts-expect-error config2 是运行时挂在 ui 上的属性，TS 类型声明缺失
		ui.config2.classList.remove("pressdown2");
	}
}

// ---------------------------------------------------------------------------
// 主装配函数 menu(connectMenu)
// ---------------------------------------------------------------------------

/**
 * 创建菜单容器、弹出容器，挂载 Vue 应用。
 * 与旧版 menu() 签名兼容，阶段 6 切换入口时直接替代旧版。
 *
 * @param connectMenu 是否联机菜单
 */
export function menu(connectMenu: boolean) {
	// 0. 重启保护计时器（旧 427-429）：非联机且非同步菜单时，1秒后重置
	let menuTimeout: ReturnType<typeof setTimeout> | null = null;
	if (!connectMenu && !(game as any).syncMenu) {
		// @ts-expect-error reset 是运行时方法
		menuTimeout = setTimeout(() => (lib.init as any).reset(), 1000);
	}

	// 1. 创建 menuContainer（.menu-container.hidden，挂在 ui.window）
	//    点击触发 clickContainer 关闭菜单
	const cacheMenuContainer = (menuContainer = ui.create.div(
		".menu-container.hidden",
		ui.window,
		() => {
			clickContainer(cacheMenuContainer, connectMenu);
		},
		));

	// 联机时添加 centermenu 类，避免被 #window.shortcutpaused > div:not(.centermenu) 设为半透明
	if (connectMenu) {
		cacheMenuContainer.classList.add("centermenu");
	}

	// 2. 创建 popupContainer（.popup-container.hidden，挂在 ui.window）
	//    含 closeMenu + noclose 一次性保护
	const cachePopupContainer = (popupContainer = ui.create.div(
		".popup-container.hidden",
		ui.window,
		function closeMenu() {
			// @ts-expect-error noclose 是运行时挂在 div 上的自定义属性，TS 无声明
			if (cachePopupContainer.noclose) {
				// @ts-expect-error noclose 是运行时挂在 div 上的自定义属性
				cachePopupContainer.noclose = false;
				return;
			}
			cachePopupContainer.classList.add("hidden");
			if (typeof cachePopupContainer.onclose == "function") {
				// @ts-expect-error onclose 是运行时挂在 div 上的自定义属性
				cachePopupContainer.onclose();
			}
		},
	));

	// 3. 挂载 Vue 应用到 menuContainer
	const app = createApp(MenuView, { connectMenu });
	app.mount(cacheMenuContainer);

	// 4. 赋值旧版兼容变量
	menux = { menu: cacheMenuContainer, pages: [] };
	menuxpages = [];

	// 5. 补接外部 API（1:1 迁移旧版 menu/index.js:453-514）

	// 5a. 非联机分支：ui.menuContainer + ui.click.configMenu
	if (!connectMenu) {
		// @ts-expect-error menuContainer 是运行时挂在 ui 上的属性，TS 类型声明缺失
		ui.menuContainer = cacheMenuContainer;
		ui.click.configMenu = function () {
			ui.click.shortcut(false);
			if (cacheMenuContainer.classList.contains("hidden")) {
				// @ts-expect-error config2 是运行时挂在 ui 上的属性，TS 类型声明缺失
				ui.config2.classList.add("pressdown2");
				ui.arena.classList.add("menupaused");
				// @ts-expect-error historybar 是运行时挂在 ui 上的属性，TS 类型声明缺失
				ui.historybar.classList.add("menupaused");
				ui.window.classList.add("touchinfohidden");
				cacheMenuContainer.classList.remove("hidden");
				for (let i = 0; i < menuUpdates.length; i++) {
					menuUpdates[i]();
				}
			} else {
				clickContainer(cacheMenuContainer, connectMenu);
			}
		};
	} else {
		// 5b. 联机分支：ui.connectMenuContainer + ui.click.connectMenu
		// @ts-expect-error connectMenuContainer 是运行时挂在 ui 上的属性，TS 类型声明缺失
		ui.connectMenuContainer = cacheMenuContainer;
		ui.click.connectMenu = function () {
			if (cacheMenuContainer.classList.contains("hidden")) {
				// @ts-expect-error waitingForPlayer 是运行时挂在 _status 上的属性
				if (_status.waitingForPlayer) {
					// TODO: 联机 waitingForPlayer 的 DOM 遍历逻辑（旧版 index.js:480-496）
					// 旧版遍历 menux.pages[0].firstChild 的子节点设置 active/unselectable。
					// 新版数据驱动，menux.pages 为空数组，此处需要重新设计为数据驱动版本。
					// 核心逻辑：设置启动按钮文本为"设"，高亮当前 lib.configOL.mode 对应的项。
					// 暂保留联机菜单基本功能（hidden 切换 + menuUpdates + shortcutpaused）。
				}
				ui.window.classList.add("shortcutpaused");
				cacheMenuContainer.classList.remove("hidden");
				for (let i = 0; i < menuUpdates.length; i++) {
					menuUpdates[i]();
				}
			} else {
				clickContainer(cacheMenuContainer, connectMenu);
			}
		};
	}

	// 5c. ui.click.menuTab —— 切换到指定 tab（被 identity.js、index.js 等调用）
	ui.click.menuTab = function (tab: string) {
		menuBridge.setActiveTab?.(tab);
	};

	// 5d. ui.click.extensionTab —— 切换到"扩展"tab + 指定扩展项（被 brawl.js 调用）
	ui.click.extensionTab = function (name: string) {
		ui.click.menuTab("扩展");
		// TODO: 阶段后续 —— 切到 name 扩展的左栏项
		// 需扩展 menuBridge 支持 setActiveLeftItem("扩展", extensionKey)
	};

	// 5e. ui.click.consoleMenu —— 切换到"其它"tab + 命令页（被 otherMenu、FileManagerImport 调用）
	ui.click.consoleMenu = function () {
		ui.click.menuTab("其它");
		// TODO: 阶段后续 —— 切到命令左栏项
		// 旧版 clickMode.call(ui.commandnode) 触发命令节点点击
	};

	// 5f. ui.updateCharacterPackMenu / ui.updateCardPackMenu —— 动态加载包时刷新
	// 被 library/index.js 的 Proxy set 陷阱调用（forEach）
	if (!ui.updateCharacterPackMenu) {
		// @ts-expect-error updateCharacterPackMenu 是运行时属性，初始为数组
		ui.updateCharacterPackMenu = [];
	}
	// @ts-expect-error updateCharacterPackMenu.push 传入闭包
	ui.updateCharacterPackMenu.push((packName: string) => refreshCharacterPack(packName));

	if (!ui.updateCardPackMenu) {
		// @ts-expect-error updateCardPackMenu 是运行时属性，初始为数组
		ui.updateCardPackMenu = [];
	}
	// @ts-expect-error updateCardPackMenu.push 传入闭包
	ui.updateCardPackMenu.push((packName: string) => refreshCardPack(packName, connectMenu));

	// 6. 重启保护计时器清理（旧 537-541）：各 tab 已就绪，取消重启保护
	if (menuTimeout) {
		clearTimeout(menuTimeout);
		// @ts-expect-error resetExtension 是运行时全局属性
		delete (window as any).resetExtension;
		localStorage.removeItem(lib.configprefix + "disable_extension");
	}
}
