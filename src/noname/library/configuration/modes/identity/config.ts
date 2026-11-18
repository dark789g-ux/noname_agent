import { createIdentityVisibilityOptions } from "./config/visibility.js";
import { createIdentitySelectionOptions } from "./config/selection.js";
export function createModeIdentityConfig() {
	return {
		...createIdentityVisibilityOptions(),
		...createIdentitySelectionOptions(),
	};
}
