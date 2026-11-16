/**
 * 将拆分的原型方法组挂载到目标原型上：
 * - 保持与 class 原型方法一致的不可枚举描述符（`enumerable: false`）；
 * - 校验方法组之间及与原型已有属性之间不存在重名覆盖。
 */
export function installPrototypeMethods(targetName: string, prototype: object, groups: readonly object[]): void {
	const seen = new Set<PropertyKey>();
	for (const group of groups) {
		for (const key of Reflect.ownKeys(group)) {
			if (seen.has(key) || Object.hasOwn(prototype, key)) {
				throw new Error(`Duplicate ${targetName} prototype member: ${String(key)}`);
			}
			const descriptor = Object.getOwnPropertyDescriptor(group, key);
			if (!descriptor) {
				throw new Error(`Missing descriptor for ${targetName} member: ${String(key)}`);
			}
			seen.add(key);
			Object.defineProperty(prototype, key, { ...descriptor, enumerable: false });
		}
	}
}
