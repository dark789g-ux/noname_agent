const ZONE_LABELS = [
  { zone: "x", label: "武将牌上(x区)" },
  { zone: "s", label: "特殊区(s区)" }
];
function collectPlayerMarks(player, options) {
  const markKeys = Object.keys(player?.marks || {});
  const marks = [];
  for (const key of markKeys) {
    if (!key || key === "ghujia") continue;
    const count = resolveMarkCount(player, key, options.getSkillMeta(key));
    const name = options.translate(key) || key;
    marks.push(count !== void 0 ? { id: key, name, count } : { id: key, name });
  }
  return marks;
}
function resolveMarkCount(player, key, meta) {
  if (meta?.intro?.nocount) return void 0;
  const storageValue = player?.storage?.[key];
  const markcount = meta?.intro?.markcount;
  try {
    if (typeof markcount === "function") {
      const val = markcount(storageValue, player, key);
      if (typeof val === "number" || typeof val === "string") return val === Infinity ? "∞" : val;
    } else if (markcount === "expansion") {
      const expCount = Number(player?.countCards?.("x", (c) => c?.hasGaintag?.(key)) ?? 0);
      if (expCount > 0) return expCount;
    }
  } catch {
  }
  const override = player?.storage?.[`${key}_markcount`];
  if (typeof override === "number") return override;
  if (typeof storageValue === "number") return storageValue === Infinity ? "∞" : storageValue;
  if (Array.isArray(storageValue)) return storageValue.length;
  const fallback = player?.countMark?.(key);
  return typeof fallback === "number" && fallback > 0 ? fallback : void 0;
}
function collectExtraZones(player, observer, options) {
  const result = [];
  for (const { zone, label } of ZONE_LABELS) {
    let cards = [];
    try {
      cards = Array.from(player?.getCards?.(zone) || []);
    } catch {
      cards = [];
    }
    if (!cards.length) continue;
    const visibleCards = [];
    let hiddenCount = 0;
    for (const card of cards) {
      const known = isZoneCardKnown(card, player, observer, options.isCardKnown);
      if (known) visibleCards.push(options.getCardName(card));
      else hiddenCount += 1;
    }
    result.push({ zone, label, totalCount: cards.length, visibleCards, hiddenCount });
  }
  return result;
}
function isZoneCardKnown(card, owner, observer, customCheck) {
  try {
    if (customCheck) return Boolean(customCheck(card, observer));
    if (typeof card?.isKnownBy === "function") return Boolean(card.isKnownBy(observer));
  } catch {
    return false;
  }
  return Boolean(observer && observer === owner);
}
function collectPlayerSkillStates(player, skills, options) {
  const awakened = new Set(Array.isArray(player?.awakenedSkills) ? player.awakenedSkills : []);
  const states = [];
  const seen = /* @__PURE__ */ new Set();
  for (const skill of skills) {
    if (!skill || seen.has(skill)) continue;
    seen.add(skill);
    const meta = options.getSkillMeta(skill);
    if (!meta) continue;
    const name = options.getSkillName(skill) || skill;
    const zhuanhuan = options.isZhuanhuanji ? options.isZhuanhuanji(skill, player) : Boolean(meta.zhuanhuanji || meta.zhuanhuanji2);
    if (zhuanhuan) {
      const val = player?.storage?.[skill];
      const status = typeof val === "number" ? `阶段${val}` : val ? "阴" : "阳";
      states.push({ skill, name, kind: "zhuanhuanji", status });
      continue;
    }
    if (meta.limited) {
      states.push({ skill, name, kind: "limited", status: awakened.has(skill) ? "已发动" : "未发动" });
    }
    if (meta.juexingji) {
      states.push({ skill, name, kind: "juexingji", status: awakened.has(skill) ? "已觉醒" : "未觉醒" });
    }
  }
  return states;
}
function formatPlayerStateExtras(state) {
  const lines = [];
  if (state.marks?.length) {
    const text = state.marks.map((mark) => mark.count !== void 0 && mark.count !== "" ? `${mark.name}(${mark.count})` : mark.name).join("、");
    lines.push(`标记：${text}`);
  }
  if (state.extraZones?.length) {
    for (const zone of state.extraZones) {
      if (!zone.totalCount) continue;
      const parts = [...zone.visibleCards];
      if (zone.hiddenCount > 0) parts.push(`暗置 ${zone.hiddenCount} 张`);
      lines.push(`${zone.label}：${parts.join("、")}`);
    }
  }
  if (state.skillStates?.length) {
    lines.push(`技能状态：${state.skillStates.map((item) => `${item.name}[${item.status}]`).join("、")}`);
  }
  return lines;
}
export {
  collectExtraZones,
  collectPlayerMarks,
  collectPlayerSkillStates,
  formatPlayerStateExtras
};
