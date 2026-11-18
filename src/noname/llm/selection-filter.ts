/** Apply reviewed filter forms with the engine's object-filter normalizer. */
export function matchesSelectionFilter(filter: any, value: any, player: any, receiver?: any, normalize?: (filter: any) => Function, event?: any): boolean {
	if (filter === true || filter == null) return true;
	if (filter === false) return false;
	if (typeof filter === "function") return filter.call(receiver, value, player, event) === true;
	if (typeof filter === "object" && !Array.isArray(filter) && normalize) return normalize(filter).call(receiver, value, player, event) === true;
	throw new TypeError("Selection filter must be a function, boolean or normalized object");
}
