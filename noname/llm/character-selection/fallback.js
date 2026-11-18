function localSelection(snapshot, identity, monarchGroup, preferred = [], random = Math.random) {
  const remaining = snapshot.candidates.slice();
  const selected = [];
  for (let i = 0; i < snapshot.count; i++) {
    let index = Math.floor(random() * remaining.length);
    if (i === 0 && identity === "zhu" && random() < 0.8) {
      const found = remaining.findIndex((candidate) => preferred.includes(candidate.source));
      if (found >= 0) index = found;
    } else if (i === 0 && identity === "zhong" && random() < 0.5) {
      const found = remaining.findIndex((candidate) => candidate.versions.some((version) => version.faction === monarchGroup));
      if (found >= 0) index = found;
    }
    selected.push(remaining.splice(index, 1)[0]);
  }
  const versions = selected.map((candidate) => candidate.versions[Math.floor(random() * candidate.versions.length)]);
  const groups = versions[0].groups;
  const group = groups.includes(monarchGroup || "") ? monarchGroup : groups[Math.floor(random() * groups.length)];
  return { characters: versions.map((version) => version.name), sources: selected.map((candidate) => candidate.source), ...group ? { group } : {} };
}
export {
  localSelection
};
