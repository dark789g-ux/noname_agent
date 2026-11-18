import { menuBridge } from "./menuBridge";

/**
 * 注册当前 OptionsRightPane 的短生命周期能力，并返回仅撤销自身注册的清理器。
 * 菜单可重建而旧 Vue 实例稍后卸载；身份比较保证该卸载不会撤销新实例的桥接。
 */
export function registerOptionsMenuLifecycle(requestImportData: () => void, clearOptionsMenuState: () => void) {
	menuBridge.requestImportData = requestImportData;
	menuBridge.clearOptionsMenuState = clearOptionsMenuState;
	return () => {
		if (menuBridge.requestImportData === requestImportData) {
			menuBridge.requestImportData = null;
		}
		if (menuBridge.clearOptionsMenuState === clearOptionsMenuState) {
			menuBridge.clearOptionsMenuState = null;
		}
		clearOptionsMenuState();
	};
}
