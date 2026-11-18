function forwardEventLogSkill(receiver, logSkill) {
  if (typeof logSkill === "string") {
    receiver.logSkill(logSkill);
  } else if (logSkill) {
    receiver.logSkill(...logSkill);
  }
}
function resultSkillName(result) {
  if (typeof result !== "object" || result === null || !("skill" in result)) {
    return;
  }
  const skill = result.skill;
  return typeof skill === "string" && skill ? skill : void 0;
}
function getLogSkillName(result, logSkill) {
  return resultSkillName(result) ?? (typeof logSkill === "string" && logSkill ? logSkill : Array.isArray(logSkill) && typeof logSkill[0] === "string" && logSkill[0] ? logSkill[0] : void 0);
}
export {
  forwardEventLogSkill,
  getLogSkillName
};
