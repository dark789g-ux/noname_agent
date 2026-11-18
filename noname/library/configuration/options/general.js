import { createConfigMenuGeneralConfig } from "./general/config.js";
function createConfigMenuGeneral() {
  return {
    name: "通用",
    config: createConfigMenuGeneralConfig()
  };
}
export {
  createConfigMenuGeneral
};
