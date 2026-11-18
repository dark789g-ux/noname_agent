import { menuBridge } from "../../ui/create/menu/vue/utils/menuBridge.js";
function refreshExtensionSourceMenu() {
  const refresh = menuBridge.refreshOptionsConfig;
  if (!refresh) {
    throw new TypeError("扩展地址菜单尚未初始化");
  }
  refresh("extension_source");
}
function requestImportData() {
  const request = menuBridge.requestImportData;
  if (!request) {
    throw new TypeError("导入设置菜单尚未初始化");
  }
  request();
}
export {
  refreshExtensionSourceMenu,
  requestImportData
};
