import { createGeneralRuntimeAndInputOptions } from "./config/runtimeAndInput.js";
import { createGeneralAdvancedOptions } from "./config/advanced.js";
import { createGeneralVisibilityOptions } from "./config/visibility.js";
export function createConfigMenuGeneralConfig() {
	return {
		...createGeneralRuntimeAndInputOptions(),
		...createGeneralAdvancedOptions(),
		...createGeneralVisibilityOptions(),
	};
}
