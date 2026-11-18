import skills from "../skill.js";
function createSkill() {
  return (() => {
    const target = skills;
    return new Proxy(target, {
      set(target2, prop, newValue) {
        if (typeof prop === "string" && typeof newValue === "object") {
          newValue.skill_id ??= prop;
        }
        return Reflect.set(target2, prop, newValue);
      }
    });
  })();
}
export {
  createSkill
};
