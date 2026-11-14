import { createVersusVisibilityOptions } from "./config/visibility.js";
import { createVersusTeamsOptions } from "./config/teams.js";
export function createModeVersusConfig() {
	return {
		...createVersusVisibilityOptions(),
		...createVersusTeamsOptions(),
	};
}
