/**
 * Installs extracted method groups onto `Player.prototype`, preserving
 * non-enumerable class-method descriptors and guarding against duplicate keys.
 */
export function installPlayerMethods(prototype: object, groups: readonly object[]): void {
	const seen = new Set<PropertyKey>();
	for (const group of groups) {
		for (const key of Reflect.ownKeys(group)) {
			if (seen.has(key) || Object.hasOwn(prototype, key)) {
				throw new Error(`Duplicate Player prototype member: ${String(key)}`);
			}
			const descriptor = Object.getOwnPropertyDescriptor(group, key);
			if (!descriptor) {
				throw new Error(`Missing descriptor for Player member: ${String(key)}`);
			}
			seen.add(key);
			Object.defineProperty(prototype, key, { ...descriptor, enumerable: false });
		}
	}
}
