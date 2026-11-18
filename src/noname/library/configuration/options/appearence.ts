import { createConfigMenuAppearenceConfig } from "./appearence/config.js";
export function createConfigMenuAppearence() {
	return {
		name: "外观",
		config: createConfigMenuAppearenceConfig(),
	};
}
