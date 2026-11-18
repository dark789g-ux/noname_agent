import { createConfigMenuViewConfig } from "./view/config.js";
export function createConfigMenuView() {
	return {
		name: "显示",
		config: createConfigMenuViewConfig(),
	};
}
