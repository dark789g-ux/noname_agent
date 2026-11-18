import { createGeneralRuntimeAndInputOptions } from "./config/runtimeAndInput.js";
import { createGeneralAdvancedOptions } from "./config/advanced.js";
import { createGeneralVisibilityOptions } from "./config/visibility.js";
function createConfigMenuGeneralConfig() {
  return {
    ...createGeneralRuntimeAndInputOptions(),
    ...createGeneralAdvancedOptions(),
    ...createGeneralVisibilityOptions()
  };
}
export {
  createConfigMenuGeneralConfig
};
