import { createModeVersusConnect } from "./versus/connect.js";
import { createModeVersusConfig } from "./versus/config.js";
export function createModeVersus() {
	return {
		name: "对决",
		connect: createModeVersusConnect(),
		config: createModeVersusConfig(),
	};
}
