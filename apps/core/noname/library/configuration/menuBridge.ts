import { menuBridge } from "@/ui/create/menu/vue/utils/menuBridge";

/**
 * 扩展地址的菜单项在 Vue 选项菜单中由数据层缓存。旧实现直接操作该菜单的
 * DOM 节点；这里通过其已注册的刷新桥接更新缓存。地址创建/删除只能由已打开的
 * 菜单触发，桥接缺失代表菜单生命周期不完整，保留原来会失败的必需性。
 */
export function refreshExtensionSourceMenu() {
	const refresh = menuBridge.refreshOptionsConfig;
	if (!refresh) {
		throw new TypeError("扩展地址菜单尚未初始化");
	}
	refresh("extension_source");
}

/**
 * 导入设置的文件控件由当前 Vue 选项面板持有，而不是全局 UI 节点。
 */
export function requestImportData() {
	const request = menuBridge.requestImportData;
	if (!request) {
		throw new TypeError("导入设置菜单尚未初始化");
	}
	request();
}
