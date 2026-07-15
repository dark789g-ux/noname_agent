<template>
	<div
		class="main menu dialog popped static"
		:class="{ center: connectMenu }"
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
						<!-- 默认 NonameConfig 列表 -->
						<template v-else>
							<NonameConfig
								v-for="cfg in rightPaneData"
								:key="cfg.name"
								:config="cfg"
							/>
						</template>
						<!-- TODO: 阶段 1/2 优化：缓存已挂载的右栏 app，切换左栏时复用而非重建 -->
					</div>
					<!-- 启动按钮 -->
				<!-- TODO: 阶段 2 需处理联机 waitingForPlayer 的 "设" 文本切换（旧版 index.js:479） -->
				<div class="menubutton round highlight" ref="startButtonRef">启</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { get, lib } from "noname";
import type { LeftPaneItem, RightPaneContext, menuData } from "../types";
import { getTabDataMap } from "../data/tabRegistry";
import LeftPaneItemComponent from "./LeftPaneItem.vue";
import NonameConfig from "./NonameConfig.vue";
import { menuBridge } from "../utils/menuBridge";

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

/** 当前右栏配置项列表（阶段 0 占位，阶段 1 接入 NonameConfig 渲染） */
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
	activeLeftKey.value = item.key;
	// rightPaneData 是 computed，会自动更新
	// TODO: 阶段 1/2 实现缓存逻辑，避免每次切换都重建右栏 app
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
	const first = menuTabRef.value.firstElementChild;
	const active = menuTabRef.value.querySelector(".active") as HTMLElement | null;
	if (!first || !active) return;
	const offset = active.getBoundingClientRect().left - first.getBoundingClientRect().left;
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
	});

	onUnmounted(() => {
		// 清理 menuBridge 回调，防止组件卸载后外部 API 调用失效引用
		menuBridge.setActiveTab = null;
		menuBridge.setActiveLeftItem = null;
	});
</script>
