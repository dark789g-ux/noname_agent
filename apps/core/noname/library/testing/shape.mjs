import { createHash } from "node:crypto";

/** Read descriptors instead of invoking runtime getters such as menu.item. */
function shape(value, seen = new Set()) {
	if (typeof value === "function") return ["function", value.length];
	if (value === undefined) return ["undefined"];
	if (value === null || typeof value !== "object") return [typeof value, String(value)];
	if (seen.has(value)) return ["reference"];
	seen.add(value);
	if (value instanceof Map) return ["Map", [...value].map(([key, item]) => [shape(key, seen), shape(item, seen)])];
	if (value instanceof Set) return ["Set", [...value].map(item => shape(item, seen))];
	return [
		Object.getPrototypeOf(value)?.constructor?.name,
		Object.getOwnPropertyNames(value).map(key => {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor) throw new Error(`Missing own descriptor: ${key}`);
			return [key, descriptor.enumerable, descriptor.configurable, descriptor.writable, "value" in descriptor ? shape(descriptor.value, seen) : ["accessor", Boolean(descriptor.get), Boolean(descriptor.set)]];
		}),
	];
}

export function libraryShape(library) {
	return Object.fromEntries(
		Object.getOwnPropertyNames(library).map(key => [
			key,
			createHash("sha256")
				.update(JSON.stringify(shape(library[key])))
				.digest("hex"),
		])
	);
}
