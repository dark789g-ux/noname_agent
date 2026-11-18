import { createFilterSkill } from "./skill.js";
import { createFilterSelection } from "./selection.js";
import { createFilterTargets } from "./targets.js";
import { createFilterCards } from "./cards.js";
export function createFilter() {
	return {
		...createFilterSkill(),
		...createFilterSelection(),
		...createFilterTargets(),
		...createFilterCards(),
	};
}
