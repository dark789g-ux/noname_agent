import { createIdentityVisibilityOptions } from "./config/visibility.js";
import { createIdentitySelectionOptions } from "./config/selection.js";
function createModeIdentityConfig() {
  return {
    ...createIdentityVisibilityOptions(),
    ...createIdentitySelectionOptions()
  };
}
export {
  createModeIdentityConfig
};
