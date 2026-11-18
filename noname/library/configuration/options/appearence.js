import { createConfigMenuAppearenceConfig } from "./appearence/config.js";
function createConfigMenuAppearence() {
  return {
    name: "外观",
    config: createConfigMenuAppearenceConfig()
  };
}
export {
  createConfigMenuAppearence
};
