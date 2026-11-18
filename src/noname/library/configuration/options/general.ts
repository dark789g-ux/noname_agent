import { createConfigMenuGeneralConfig } from "./general/config.js";
export function createConfigMenuGeneral() {
	return {
		name: "通用",
		config: createConfigMenuGeneralConfig(),
	};
}
