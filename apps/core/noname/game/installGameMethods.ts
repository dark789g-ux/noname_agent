/**
 * Installs extracted method groups onto `Game.prototype`, preserving
 * non-enumerable class-method descriptors and guarding against duplicate keys.
 */
export function installGameMethods(prototype: object, groups: readonly object[]): void {
	const seen = new Set<PropertyKey>();
	for (const group of groups) {
		for (const key of Reflect.ownKeys(group)) {
			if (seen.has(key) || Object.hasOwn(prototype, key)) {
				throw new Error(`Duplicate Game prototype member: ${String(key)}`);
			}
			const descriptor = Object.getOwnPropertyDescriptor(group, key);
			if (!descriptor) {
				throw new Error(`Missing descriptor for Game member: ${String(key)}`);
			}
			seen.add(key);
			Object.defineProperty(prototype, key, { ...descriptor, enumerable: false });
		}
	}
}
