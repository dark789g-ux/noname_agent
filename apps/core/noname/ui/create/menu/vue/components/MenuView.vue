<template>
	<div
			ref="rootRef"
			class="main menu dialog popped static"
			:class="{ center: connectMenu }"
			:style="rootStyle"
			@click.stop
	>
		<!-- tab 栏 -->
		<div class="menu-tab" ref="menuTabRef">
			<div
				v-for="tabName in tabNames"
				:key="tabName"
				:class="{ active: activeTab === tabName }"
				@click="onTabClick(tabName)"
			>
				{{ tabName }}
			</div>
		</div>
		<!-- tab 下划线指示器 -->
		<div class="menu-tab-bar" :style="tabBarStyle"></div>
		<!-- 内容区 -->
		<div class="menu-content">
			<div>
				<!-- 左栏 -->
				<div class="left pane">
					<LeftPaneItemComponent
						v-for="item in currentLeftPaneData"
						:key="item.key"
						:item="item"
						:active="activeLeftKey === item.key"
						:unselectable="isItemUnselectable(item)"
						@click="onLeftItemClick"
					/>
				</div>
				<!-- 右栏 -->
				<div class="right pane" ref="rightPaneRef">
					<!-- 自定义右栏组件（如选项页 OptionsRightPane） -->
					<component
						v-if="useCustomRightPane && currentMenuData.rightPaneComponent"
						:is="currentMenuData.rightPaneComponent"
						:ctx="rightPaneCtx"
					/>
					<!-- 默认 NonameConfig 列表（包裹 div 匹配 .right.pane > div > .config 旧版 CSS 契约，否则配置行全部 absolute 重叠） -->
					<div v-else>
						<NonameConfig
							v-for="cfg in rightPaneData"
							:key="cfg.name"
							:config="cfg"
						/>
					</div>
					<!-- TODO: 缓存已挂载的右栏 app，切换左栏时复用而非重建（待实现） -->
				</div>
				<!-- 启动按钮（联机 waitingForPlayer 时文本为 "设"，由 updateWaitingForPlayer 数据驱动） -->
				<div class="menubutton round highlight" ref="startButtonRef" @click="onStartClick">{{ startButtonText }}</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { _status, game, get, lib, ui } from "noname";
import type { LeftPaneItem, RightPaneContext, menuData } from "../types";
import { getTabDataMap } from "../data/tabRegistry";
import LeftPaneItemComponent from "./LeftPaneItem.vue";
import NonameConfig from "./NonameConfig.vue";
import { menuBridge } from "../utils/menuBridge";
import { menuUpdates } from "../menuState";

interface Props {
	connectMenu: boolean;
}

const props = defineProps<Props>();

/** tabDataMap：tabName → menuData */
const tabDataMap = getTabDataMap(props.connectMenu);

/** tab 名称列表（保持插入顺序） */
const tabNames = Array.from(tabDataMap.keys());

/** 当前激活的 tab 名 */
const activeTab = ref(tabNames[0]);

/** 当前左栏选中项的 key */
const activeLeftKey = ref("");

/** 启动按钮文本（联机 waitingForPlayer 时为 "设"，对应旧版 index.js:479） */
const startButtonText = ref("启");

/**
 * 联机 waitingForPlayer 锁定的模式 key（null 为未锁定）。
 * 锁定期间模式 tab 中其它模式项标记 unselectable 且不可点击，
 * 对应旧版 index.js:480-496 的 unselectable / active DOM 遍历。
 */
const lockedModeKey = ref<string | null>(null);

/** 当前 tab 对应的 menuData */
const currentMenuData = computed<menuData>(() => {
	return tabDataMap.get(activeTab.value) as menuData;
});

/** 当前左栏数据列表 */
const currentLeftPaneData = computed<LeftPaneItem[]>(() => {
	const data = currentMenuData.value;
	// 优先使用 getLeftPaneData getter（支持响应式更新，如 togglePack 后刷新 .off 状态）
	const items = data.getLeftPaneData ? data.getLeftPaneData() : data.leftPaneData;
	// 过滤掉 attrs.hidden 的项（如空 mode_banned 不显示）
	return items.filter(item => !item.attrs?.hidden);
});

/** 当前右栏配置项列表 */
const rightPaneData = computed(() => {
	return currentMenuData.value.getRightPane(rightPaneCtx.value);
});

/** 右栏上下文 */
const rightPaneCtx = computed<RightPaneContext>(() => {
	return {
		connectMenu: props.connectMenu,
		item: currentLeftPaneData.value.find(i => i.key === activeLeftKey.value) || { name: "", key: "" },
		startButtonEl: startButtonRef.value ?? null,
	};
});

/** 是否使用自定义右栏组件 */
const useCustomRightPane = computed(() => !!currentMenuData.value.rightPaneComponent);

/** tab bar 下划线样式 */
const tabBarStyle = ref("transform: translateX(0px)");

/** DOM refs */
const menuTabRef = ref<HTMLDivElement>();
const startButtonRef = ref<HTMLDivElement>();
const rightPaneRef = ref<HTMLDivElement>();
/** 根 div（用于 ResizeObserver + inline style 控制宽高） */
const rootRef = ref<HTMLDivElement>();

/** 持久化的对话框尺寸（来自 lib.config） */
// @ts-expect-error menu_dialog_width/height 是运行时挂在 lib.config 上的属性，TS 类型声明缺失
const savedDialogWidth = lib.config.menu_dialog_width as number | undefined;
// @ts-expect-error menu_dialog_width/height 是运行时挂在 lib.config 上的属性，TS 类型声明缺失
const savedDialogHeight = lib.config.menu_dialog_height as number | undefined;

/** 根 div 的 inline style：恢复持久化尺寸 + 设置 CSS 变量（供 .center 居中重算） */
const rootStyle = computed(() => {
	const s: Record<string, string> = {};
	if (savedDialogWidth) {
		s["width"] = savedDialogWidth + "px";
		s["--menu-w"] = savedDialogWidth + "px";
	}
	if (savedDialogHeight) {
		s["height"] = savedDialogHeight + "px";
		s["--menu-h"] = savedDialogHeight + "px";
	}
	return s;
});

/** ResizeObserver 实例（拖拽时实时更新 CSS 变量 + debounce 保存到 localStorage） */
let resizeObserver: ResizeObserver | null = null;
let resizeSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 处理 tab 点击
 * 对应旧版 clickTab：移除旧 active、添加新 active、移动 tab bar、切换内容页
 */
function onTabClick(tabName: string) {
	if (activeTab.value === tabName) return;
	activeTab.value = tabName;
	// 立即重置左栏选中，避免中间态错位
	activeLeftKey.value = "";

	// 用 menuData 的 leftPaneData 重置左栏
	const data = currentMenuData.value;
	const defaultKey = data.getDefaultActiveKey(props.connectMenu);
	// nextTick 中触发默认左栏选中
	nextTick(() => {
		selectDefaultLeftItem(defaultKey);
		updateTabBarStyle();
	});
}

/**
 * 处理左栏项点击
 * 对应旧版 toggleLeftPaneName：高亮选中项、更新右栏内容
 */
function onLeftItemClick(item: LeftPaneItem) {
	// 如果 item 有自定义点击回调（如 help_toggle 的 toggleHelpVisible），拦截并执行
	if (item.attrs?.onClick) {
		item.attrs.onClick();
		return;
	}
	// waitingForPlayer 锁定期间，模式 tab 的非当前模式项不可切换（旧版 unselectable 语义）
	if (isItemUnselectable(item)) {
		return;
	}
	activeLeftKey.value = item.key;
	// rightPaneData 是 computed，会自动更新
	// TODO: 实现缓存逻辑，避免每次切换都重建右栏 app（待实现）
}

/**
 * 判断左栏项是否处于 unselectable 状态。
 * 仅联机 waitingForPlayer 锁定期间、模式 tab（首个 tab）中非当前模式的项。
 */
function isItemUnselectable(item: LeftPaneItem): boolean {
	return lockedModeKey.value !== null && activeTab.value === tabNames[0] && item.key !== lockedModeKey.value;
}

/**
 * 联机 waitingForPlayer 状态刷新（注册到 menuUpdates，打开菜单时执行）。
 * 对应旧版 index.js:479-496 的 ui.click.connectMenu 内 DOM 遍历：
 *   - waitingForPlayer：启动按钮显示 "设"，模式 tab 中非 lib.configOL.mode 的项
 *     标记 unselectable，并强制选中当前模式项（旧版只操作 pages[0]，故仅当前在模式 tab 时强制）；
 *   - 非 waitingForPlayer：恢复 "启" 并解除锁定。
 * 每次执行完整重算，天然幂等；仅写自身 ref，组件卸载后残留调用无副作用。
 */
function updateWaitingForPlayer() {
	if (!props.connectMenu) {
		return;
	}
	// @ts-expect-error waitingForPlayer 是运行时挂在 _status 上的属性，TS 类型声明缺失
	if (_status.waitingForPlayer) {
		const mode = lib.configOL.mode;
		startButtonText.value = "设";
		lockedModeKey.value = mode;
		if (activeTab.value === tabNames[0]) {
			activeLeftKey.value = mode;
		}
	} else {
		startButtonText.value = "启";
		lockedModeKey.value = null;
	}
}
/**
 * 启动按钮点击 handler（迁移自旧版 ui/create/menu/pages/startMenu.js，4 个分支）
 * - 旧版 `active = this.parentNode.querySelector(".active")` → activeLeftKey.value
 * - 旧版 `clickContainer.call(cacheMenuContainer, connectMenu)` → menuBridge.closeMenu?.()
 */
function onStartClick() {
		// 防呆：dim 状态（联机 waitingForPlayer 时非房主被锁定）忽略
		if (startButtonRef.value?.classList.contains("dim")) {
			return;
		}
		// 仅在模式 tab（tabNames[0]）点击启动按钮才有效
		if (activeTab.value !== tabNames[0]) {
			return;
		}
		const mode = activeLeftKey.value;
		if (!mode) {
			return;
		}
		// 运行时访问的联机 API 大多未在 TS 类型声明中，这里用 any 别名集中处理，
		// 避免每行都加 @ts-expect-error 注释（AGENTS.md 要求函数短小）
		const status = _status as any;
		const libAny = lib as any;
		const gameAny = game as any;

		if (props.connectMenu) {
			if (status.waitingForPlayer) {
				// 分支 A：已在房间等待，广播房间配置
				const config: Record<string, any> = {};
				for (const i in libAny.mode[libAny.configOL.mode].connect) {
					if (i === "update") continue;
					config[i.slice(8)] = get.config(i, libAny.configOL.mode);
				}
				config.zhinang_tricks = libAny.config.connect_zhinang_tricks;
				if (gameAny.online) {
					if (gameAny.onlinezhu) {
						gameAny.send("changeRoomConfig", config);
					}
				} else {
					gameAny.broadcastAll(function (config: Record<string, any>) {
						for (const i in config) {
							libAny.configOL[i] = config[i];
						}
					}, config);
					if (libAny.configOL.mode === "identity" &&
						libAny.configOL.identity_mode === "zhong" &&
						gameAny.connectPlayers) {
						for (let i = 0; i < gameAny.connectPlayers.length; i++) {
							gameAny.connectPlayers[i].classList.remove("unselectable2");
						}
						libAny.configOL.number = 8;
						gameAny.updateWaiting();
					}
					if (gameAny.onlineroom) {
						gameAny.send("server", "config", libAny.configOL);
					}
					gameAny.connectPlayers[0].chat("房间设置已更改");
				}
			} else if (status.enteringroom || status.creatingroom) {
				// 分支 B：正在创建/进入房间
				libAny.configOL.mode = mode;
				if (status.enteringroomserver) {
					game.saveConfig("connect_mode", mode);
					const config: Record<string, any> = {};
					for (const i in libAny.mode[libAny.configOL.mode].connect) {
						if (i === "update") continue;
						config[i.slice(8)] = get.config(i, libAny.configOL.mode);
					}
					config.zhinang_tricks = libAny.config.connect_zhinang_tricks;
					config.characterPack = libAny.connectCharacterPack.slice(0);
					config.cardPack = libAny.connectCardPack.slice(0);
					for (let i = 0; i < libAny.config.connect_characters.length; i++) {
						config.characterPack.remove(libAny.config.connect_characters[i]);
					}
					for (let i = 0; i < libAny.config.connect_cards.length; i++) {
						config.cardPack.remove(libAny.config.connect_cards[i]);
					}
					config.banned = libAny.config["connect_" + mode + "_banned"];
					config.bannedcards = libAny.config["connect_" + mode + "_bannedcards"];
					gameAny.send("server", "create", gameAny.onlineKey, get.connectNickname(), libAny.config.connect_avatar, config, mode);
				} else {
					gameAny.send("server", "create", gameAny.onlineKey, get.connectNickname(), libAny.config.connect_avatar);
				}
			} else {
				// 分支 C：联机直接启动
				localStorage.setItem(lib.configprefix + "directstart", "true");
				game.saveConfig("directstartmode", mode);
				game.saveConfig("mode", "connect");
				ui.exitroom = ui.create.system(
					"退出房间",
					function () {
						game.saveConfig("directstartmode");
						game.reload();
					},
					true
				);
				game.switchMode(mode);
				game.requireSandboxOn();
			}
			menuBridge.closeMenu?.();
		} else {
			// 分支 D：非联机，直接启动
			game.saveConfig("mode", mode);
			localStorage.setItem(lib.configprefix + "directstart", "true");
			game.reload();
		}
	}
/**
 * 选中默认左栏项。
 * 如果 defaultKey 为 null 或找不到匹配项，选第一个。
 */
function selectDefaultLeftItem(defaultKey: string | null) {
	const items = currentLeftPaneData.value;
	if (items.length === 0) {
		activeLeftKey.value = "";
		return;
	}
	const match = defaultKey ? items.find(i => i.key === defaultKey) : null;
	activeLeftKey.value = match ? match.key : items[0].key;
}
/**
 * 更新 tab bar 下划线位置
 * 对应旧版 clickTab 中 menuTabBar.style.transform 的计算
 */
function updateTabBarStyle() {
	if (!menuTabRef.value) return;
	const active = menuTabRef.value.querySelector(".active") as HTMLElement | null;
	if (!active) return;
	// 滑块 .menu-tab-bar 是 position:absolute，定位父元素是 .menu.main（即 .menu-tab 的父元素）。
	// 偏移量必须以 .menu.main 左边缘为基准；旧版用「第一个 tab」作基准，
	// 因 .menu-tab 有 padding + text-align:center 使首项不在 x=0，导致蓝线整体偏左。
	const container = menuTabRef.value.parentElement;
	if (!container) return;
	const offset = active.getBoundingClientRect().left - container.getBoundingClientRect().left;
	tabBarStyle.value = `transform: translateX(${offset / get.menuZoom()}px)`;
}

/**
 * 兜底 watch：当左栏可见项变化时，如果当前 activeLeftKey 不在新列表中，
 * 自动选第一个可见项（如帮助切换后旧项被隐藏，或包开关后某项隐藏）
 */
watch(currentLeftPaneData, (items) => {
	if (items.length === 0) {
		activeLeftKey.value = "";
		return;
	}
	if (!items.some(i => i.key === activeLeftKey.value)) {
		activeLeftKey.value = items[0].key;
	}
});

/**
 * mounted 时模拟旧版 mounted 中的首次 tab 切换
 * 对应旧版 this.toggleTabName({ target: this.$refs.menuTabs.firstElementChild })
 */
onMounted(() => {
	// 设置初始 activeTab 的 leftPaneData 的默认选中
	const data = currentMenuData.value;
	const defaultKey = data.getDefaultActiveKey(props.connectMenu);
	selectDefaultLeftItem(defaultKey);
	// 初始化 tab bar 位置
	nextTick(() => {
		updateTabBarStyle();
		// 右栏设置滚动（1:1 迁移旧版 lib.setScroll(right.pane)）
		if (rightPaneRef.value) {
			lib.setScroll(rightPaneRef.value);
		}
		});
		// 注册 menuBridge 回调（供 ui.click.menuTab 等外部 API 调用）
		menuBridge.setActiveTab = (tab: string) => {
		if (tabNames.includes(tab)) {
			onTabClick(tab);
		}
	};
	menuBridge.setActiveLeftItem = (tab: string, itemKey: string) => {
		if (tabNames.includes(tab)) {
			if (activeTab.value !== tab) {
				activeTab.value = tab;
				activeLeftKey.value = "";
			}
			nextTick(() => {
				const items = currentLeftPaneData.value;
				const match = items.find(i => i.key === itemKey);
				if (match) {
					activeLeftKey.value = match.key;
				}
				updateTabBarStyle();
			});
		}
		};
		// 注册联机 waitingForPlayer 刷新（打开菜单时由 menuUpdates 逐个触发），并立即执行一次
		menuUpdates.push(updateWaitingForPlayer);
		updateWaitingForPlayer();
		// 对话框拉伸：ResizeObserver 监听尺寸变化
	if (rootRef.value) {
		resizeObserver = new ResizeObserver(entries => {
			for (const entry of entries) {
				const width = Math.round(entry.contentRect.width);
				const height = Math.round(entry.contentRect.height);
				if (!rootRef.value) continue;
				// 实时更新 CSS 变量（让 .center 居中重算）
				rootRef.value.style.setProperty("--menu-w", width + "px");
				rootRef.value.style.setProperty("--menu-h", height + "px");
				// debounce 300ms 保存到 localStorage，避免拖拽过程中频繁写入
				if (resizeSaveTimer) clearTimeout(resizeSaveTimer);
				resizeSaveTimer = setTimeout(() => {
					game.saveConfig("menu_dialog_width", width);
					game.saveConfig("menu_dialog_height", height);
				}, 300);
			}
		});
		resizeObserver.observe(rootRef.value);
		}
		});
	onUnmounted(() => {
	// 清理 menuBridge 回调，防止组件卸载后外部 API 调用失效引用
	menuBridge.setActiveTab = null;
	menuBridge.setActiveLeftItem = null;
	// 移除 menuUpdates 回调（与 CheatPanel 相同的 indexOf/splice 模式）
	const idx = menuUpdates.indexOf(updateWaitingForPlayer);
	if (idx >= 0) {
		menuUpdates.splice(idx, 1);
	}
	// 清理 ResizeObserver 和防抖定时器
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
	if (resizeSaveTimer) {
		clearTimeout(resizeSaveTimer);
		resizeSaveTimer = null;
	}
	});
</script>
