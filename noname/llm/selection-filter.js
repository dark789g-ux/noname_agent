function matchesSelectionFilter(filter, value, player, receiver, normalize, event) {
  if (filter === true || filter == null) return true;
  if (filter === false) return false;
  if (typeof filter === "function") return filter.call(receiver, value, player, event) === true;
  if (typeof filter === "object" && !Array.isArray(filter) && normalize) return normalize(filter).call(receiver, value, player, event) === true;
  throw new TypeError("Selection filter must be a function, boolean or normalized object");
}
export {
  matchesSelectionFilter
};
