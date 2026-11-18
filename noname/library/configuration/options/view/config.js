import { createViewVisibilityOptions } from "./config/visibility.js";
import { createViewDialogsOptions } from "./config/dialogs.js";
import { createViewInformationOptions } from "./config/information.js";
function createConfigMenuViewConfig() {
  return {
    ...createViewVisibilityOptions(),
    ...createViewDialogsOptions(),
    ...createViewInformationOptions()
  };
}
export {
  createConfigMenuViewConfig
};
