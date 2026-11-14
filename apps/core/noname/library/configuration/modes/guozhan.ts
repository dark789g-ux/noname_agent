import { createModeGuozhanNameGroup } from "./guozhan/connection.js";
import { createModeGuozhanConfigGroup } from "./guozhan/rules.js";
export function createModeGuozhan() {
	return {
		...createModeGuozhanNameGroup(),
		...createModeGuozhanConfigGroup(),
	};
}
