function defineBuiltinSkills(skills) {
  return skills;
}
function getRegisteredSkill(registry, name) {
  if (typeof name === "string") {
    if (name === "global" || name === "globalmap") {
      return;
    }
    const entry = registry[name];
    if (Array.isArray(entry)) {
      throw new TypeError(`Non-metadata skill entry must not be an array: ${name}`);
    }
    return entry;
  }
  return registry[name];
}
function requireRegisteredSkill(registry, name) {
  const skill = getRegisteredSkill(registry, name);
  if (!skill) {
    throw new TypeError(`Expected registered skill: ${String(name)}`);
  }
  return skill;
}
export {
  defineBuiltinSkills,
  getRegisteredSkill,
  requireRegisteredSkill
};
