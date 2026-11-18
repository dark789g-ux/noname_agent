import { createModeDoudizhuNameGroup } from "./doudizhu/connection.js";
import { createModeDoudizhuConfigGroup } from "./doudizhu/rules.js";
export function createModeDoudizhu() {
	return {
		...createModeDoudizhuNameGroup(),
		...createModeDoudizhuConfigGroup(),
	};
}
