import { menuBridge } from "./menuBridge.js";
function registerOptionsMenuLifecycle(requestImportData, clearOptionsMenuState) {
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
export {
  registerOptionsMenuLifecycle
};
