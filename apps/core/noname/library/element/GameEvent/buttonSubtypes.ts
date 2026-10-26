import { get } from "noname";

/** Custom selection buttons may carry links other than physical or virtual cards. */
export function getButtonSubtypes(link: unknown): unknown[] {
	const subtypes: unknown = Reflect.apply(get.subtypes, get, [link, false]);
	if (!Array.isArray(subtypes)) {
		throw new TypeError("button subtypes must be an array");
	}
	return subtypes;
}
