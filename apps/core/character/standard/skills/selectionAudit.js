/** Extensions may replace rules; an old pure adapter must then fail explicitly. */
export function auditSelectionSpec(skill) {
	const original = { filterCard: skill.filterCard, filterTarget: skill.filterTarget };
	const spec = skill.selectionSpec;
	skill.selectionSpec = function (event, player) {
		for (const key of Object.keys(original)) {
			if (skill[key] !== original[key]) throw new Error(`Reviewed selection contract invalidated by replacement of ${key}`);
		}
		return typeof spec === "function" ? spec(event, player) : spec;
	};
}
