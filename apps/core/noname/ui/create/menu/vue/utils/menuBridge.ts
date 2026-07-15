/**
 * menuBridge —— index.ts 与 MenuView.vue 之间的通信桥梁。
 *
 * 用于外部 API（ui.click.menuTab、ui.click.extensionTab、ui.click.consoleMenu）
 * 驱动 MenuView 的 tab 切换和左栏选中。
 * MenuView onMounted 时注册回调，onUnmounted 时置 null。
 */

/**
 * 切换到指定 tab。
 * MenuView 注册后，调用此函数即可切换 tab。
 */
export const menuBridge = {
	setActiveTab: null as ((tab: string) => void) | null,

	/**
	 * 切换到指定 tab 的指定左栏项。
	 * 用于 extensionTab（切换到"扩展"tab + 指定扩展项）、consoleMenu（切换到"其它"tab + 命令项）。
	 */
	setActiveLeftItem: null as ((tab: string, itemKey: string) => void) | null,
};
