function validateCharacterSelection(snapshot, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("选将结果必须是对象");
  const data = value;
  if (!Array.isArray(data.characters) || data.characters.length !== snapshot.count) throw new Error("选将数量不正确");
  const characters = [];
  const sources = [];
  let main;
  for (const item of data.characters) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("武将选择必须是对象");
    const choice = item;
    const matching = snapshot.candidates.filter((candidate2) => candidate2.ref === choice.ref);
    if (matching.length !== 1) throw new Error("武将引用无效");
    const candidate = matching[0];
    if (sources.includes(candidate.source)) throw new Error("不能重复选择同一来源武将");
    const version = candidate.versions.find((entry) => entry.name === choice.version);
    if (!version) throw new Error("武将版本不在候选范围内");
    if (characters.includes(version.name)) throw new Error("不能重复选择同一武将版本");
    sources.push(candidate.source);
    characters.push(version.name);
    main ??= version;
  }
  const groups = main?.groups ?? [];
  if (groups.length > 1 && (typeof data.group !== "string" || !groups.includes(data.group))) {
    throw new Error("势力不在合法范围内");
  }
  const group = groups.length === 1 ? groups[0] : groups.length > 1 ? data.group : void 0;
  return { characters, sources, ...group ? { group } : {} };
}
export {
  validateCharacterSelection
};
