/** Install exact class-method descriptors, preserving the historical order. */
export function installGetMethods(prototype: object, groups: readonly object[], order: readonly string[]): void {
	const descriptors = new Map<PropertyKey, PropertyDescriptor>();
	for (const key of Reflect.ownKeys(prototype)) {
		if (key === "constructor") continue;
		descriptors.set(key, Object.getOwnPropertyDescriptor(prototype, key)!);
		Reflect.deleteProperty(prototype, key);
	}
	for (const group of groups) {
		for (const key of Reflect.ownKeys(group)) {
			if (descriptors.has(key)) throw new Error(`Duplicate Get prototype member: ${String(key)}`);
			descriptors.set(key, { ...Object.getOwnPropertyDescriptor(group, key)!, enumerable: false });
		}
	}
	if (descriptors.size !== order.length) throw new Error("Get method inventory mismatch");
	for (const key of order) {
		const descriptor = descriptors.get(key);
		if (!descriptor) throw new Error(`Missing Get prototype member: ${key}`);
		Object.defineProperty(prototype, key, descriptor);
	}
	for (const key of ["isFunctionBody", "pureFunctionStr", "funcInfoOL", "infoFuncOL"]) {
		Object.defineProperty(prototype, key, { writable: false, configurable: false });
	}
}
