import { createApp } from "vue";
import { ui, game, _status, lib } from "noname";
import MenuView from "./components/MenuView.vue";
import { menuBridge } from "./utils/menuBridge";
import { refreshCharacterPack } from "./data/characterPackMenuData";
import { refreshCardPack } from "./data/cardPackMenuData";
import { menuUpdates, menuInits } from "./menuState";

// ---------------------------------------------------------------------------
// 模块级可变导出 —— menuContainer / popupContainer 在 menu() 内赋值，
// 作为当前菜单的容器实例供模块内共享
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

// ---------------------------------------------------------------------------
// 内部函数（ui.click.* 系列 API 在 menu() 内挂载，见下方第 4 步）
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
// 动态包刷新回调 —— 模块级稳定引用。
// menu() 可被多次调用（普通菜单 + 联机菜单），稳定引用配合 includes 去重，
// 保证 ui.updateCharacterPackMenu / ui.updateCardPackMenu 不重复注册。
// ---------------------------------------------------------------------------

/** 新武将包动态加载后刷新菜单（与 connectMenu 无关） */
const updateCharacterPackMenuFn = (packName: string) => refreshCharacterPack(packName);

/** 新卡牌包动态加载后刷新菜单（非联机） */
const updateCardPackMenuFn = (packName: string) => refreshCardPack(packName, false);

/** 新卡牌包动态加载后刷新菜单（联机，额外维护 lib.connectCardPack） */
const updateCardPackMenuConnectFn = (packName: string) => refreshCardPack(packName, true);

/** menuInits 是否已执行（装配期一次性初始化，重复创建菜单不重跑） */
let menuInitsDone = false;

// ---------------------------------------------------------------------------
// 主装配函数 menu(connectMenu)
// ---------------------------------------------------------------------------

/**
 * 创建菜单容器、弹出容器，挂载 Vue 应用。
 * 已替代旧版 menu/index.js 的 menu()，经 ui/create/index.js 挂到 ui.create.menu。
 *
 * @param connectMenu 是否联机菜单
 */
export function menu(connectMenu: boolean = false) {
	// 0. 重启保护计时器（旧 427-429）：非联机且非同步菜单时，1秒后重置
	let menuTimeout: ReturnType<typeof setTimeout> | null = null;
	if (!connectMenu && !(game as any).syncMenu) {
		menuTimeout = setTimeout(() => (lib.init as any).reset(), 1000);
	}

	// 执行菜单初始化钩子（由各 data 模块注册；只执行一次，重复创建菜单不重跑，
	// 首次执行时 polyfill 已加载、lib.configMenu 已就绪）
	if (!menuInitsDone) {
		menuInitsDone = true;
		for (const init of menuInits) {
			init();
		}
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

	// 4. 补接外部 API（1:1 迁移旧版 menu/index.js:453-514）

	// 4a. 非联机分支：ui.menuContainer + ui.click.configMenu
	if (!connectMenu) {
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
		// 4b. 联机分支：ui.connectMenuContainer + ui.click.connectMenu
		// @ts-expect-error connectMenuContainer 是运行时挂在 ui 上的属性，TS 类型声明缺失
		ui.connectMenuContainer = cacheMenuContainer;
		ui.click.connectMenu = function () {
			if (cacheMenuContainer.classList.contains("hidden")) {
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

	// 4b2. menuBridge.closeMenu —— 供 Vue 组件关闭当前菜单
	// （OtherPane 作弊执行后调用，对应旧版 cheatButton listen 中的 clickContainer）
	menuBridge.closeMenu = () => clickContainer(cacheMenuContainer, connectMenu);

	// 4c. ui.click.menuTab —— 切换到指定 tab（被 identity.js、index.js 等调用）
	ui.click.menuTab = function (tab: string) {
		menuBridge.setActiveTab?.(tab);
	};

	// 4d. ui.click.extensionTab —— 切换到"扩展"tab + 指定扩展项（被 brawl.js 调用）
	// 左栏项 key = 扩展名本身（见 extensionMenuData.ts buildLeftPaneData）
	ui.click.extensionTab = function (name: string) {
		ui.click.menuTab("扩展");
		menuBridge.setActiveLeftItem?.("扩展", name);
	};

	// 4e. ui.click.consoleMenu —— 切换到"其它"tab + 命令页（被 otherMenu、FileManagerImport 调用）
	// 旧版 clickMode.call(ui.commandnode) 触发命令节点点击；Vue 版经 menuBridge 切左栏
	ui.click.consoleMenu = function () {
		ui.click.menuTab("其它");
		menuBridge.setActiveLeftItem?.("其它", "command");
	};

	// 4e2. game.editExtension —— 稳定桥：切到"扩展"tab 的"制作扩展"页并加载指定扩展
	// （被扩展菜单"编辑此扩展"按钮调用，见 game/index.js importExtension）。
	// ExtensionMaker 以 v-if 挂载，未挂载窗口期经 menuBridge.pendingEditExtensionName
	// 暂存，组件 onMounted 消费（替代旧版 ExtensionMaker onMounted 直接覆写
	// game.editExtension —— 该引用随组件卸载失效，属不稳定挂载）。
	// @ts-expect-error game.editExtension 是旧版外部 API，TS 类型声明缺失
	game.editExtension = (name?: string) => {
		menuBridge.setActiveLeftItem?.("扩展", "extension_maker");
		if (menuBridge.openExtensionMaker) {
			menuBridge.openExtensionMaker(name);
		} else {
			menuBridge.pendingEditExtensionName = name;
		}
	};

	// 4f. ui.updateCharacterPackMenu / ui.updateCardPackMenu —— 动态加载包时刷新
	// 被 library/index.js 的 Proxy set 陷阱调用（forEach）
	// 两个数组在 ui/index.js 已初始化为 []；稳定引用 + includes 去重注册
	if (!ui.updateCharacterPackMenu.includes(updateCharacterPackMenuFn)) {
		ui.updateCharacterPackMenu.push(updateCharacterPackMenuFn);
	}
	const updateCardPackFn = connectMenu ? updateCardPackMenuConnectFn : updateCardPackMenuFn;
	if (!ui.updateCardPackMenu.includes(updateCardPackFn)) {
		ui.updateCardPackMenu.push(updateCardPackFn);
	}

	// 5. 重启保护计时器清理（旧 537-541）：各 tab 已就绪，取消重启保护
	if (menuTimeout) {
		clearTimeout(menuTimeout);
		delete (window as any).resetExtension;
		localStorage.removeItem(lib.configprefix + "disable_extension");
	}
}
