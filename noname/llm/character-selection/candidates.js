function buildSelectionCandidates(sources, count, runtime) {
  const seen = /* @__PURE__ */ new Set();
  const candidates = [];
  for (const entry of sources) {
    const source = runtime.source(entry);
    if (seen.has(source)) continue;
    seen.add(source);
    const names = runtime.versions(entry).filter((name) => runtime.allowed(name));
    const versions = [...new Set(names)].map((name) => Object.freeze(runtime.describe(name)));
    if (versions.length) candidates.push(Object.freeze({ ref: `c${candidates.length}`, source, versions: Object.freeze(versions) }));
  }
  if (candidates.length < count) throw new Error("合法候选不足");
  return Object.freeze({ candidates: Object.freeze(candidates), count });
}
export {
  buildSelectionCandidates
};
