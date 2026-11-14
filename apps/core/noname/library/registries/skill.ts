import skills from "@/library/skill.js";

export function createSkill() {
	return (() => {
		const target = skills;
		return new Proxy(target, {
			set(target, prop, newValue) {
				if (typeof prop === "string" && typeof newValue === "object") {
					newValue.skill_id ??= prop;
				}
				return Reflect.set(target, prop, newValue);
			},
		});
	})();
}
