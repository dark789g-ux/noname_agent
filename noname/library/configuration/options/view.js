import { createConfigMenuViewConfig } from "./view/config.js";
function createConfigMenuView() {
  return {
    name: "显示",
    config: createConfigMenuViewConfig()
  };
}
export {
  createConfigMenuView
};
