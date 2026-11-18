const traversableTypes = {
	"[object Map]": true,
	"[object Set]": true,
	"[object Object]": true,
	"[object Array]": true,
	"[object Arguments]": true,
	"[object Date]": true,
};

/**
 * @param {object} source
 * @returns {object}
 */
function createCopyTarget(source) {
	const constructor = source.constructor;
	if (!constructor) {
		return Object.create(null);
	}
	if (Array.isArray(source) || source instanceof Map || source instanceof Set || constructor === Object) {
		if (typeof constructor !== "function") {
			throw new TypeError("copy constructor must be callable");
		}
		return Reflect.construct(constructor, []);
	}
	if (typeof constructor === "function" && constructor.name in window && /\[native code\]/.test(constructor.toString())) {
		return Reflect.construct(constructor, [source]);
	}
	return source;
}

/**
 * @param {object} source
 * @param {object} target
 * @param {boolean} copyKeyDeep
 * @param {WeakMap<object, unknown>} map
 */
function copyProperties(source, target, copyKeyDeep, map) {
	const descriptors = Object.getOwnPropertyDescriptors(source);
	for (const [key, descriptor] of Object.entries(descriptors)) {
		if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
		const copiedDescriptor = Object.prototype.hasOwnProperty.call(descriptor, "value")
			? {
					enumerable: descriptor.enumerable,
					configurable: descriptor.configurable,
					value: copyValue(descriptor.value, copyKeyDeep, map),
					writable: descriptor.writable,
				}
			: {
					enumerable: descriptor.enumerable,
					configurable: descriptor.configurable,
					get: descriptor.get,
					set: descriptor.set,
				};
		Reflect.defineProperty(target, key, copiedDescriptor);
	}
	for (const symbol of Object.getOwnPropertySymbols(source)) {
		if (!Reflect.set(target, symbol, copyValue(source[symbol], copyKeyDeep, map))) {
			throw new TypeError("Cannot assign copied symbol property");
		}
	}
}

/**
 * @param {unknown} value
 * @param {boolean} copyKeyDeep
 * @param {WeakMap<object, unknown>} map
 * @returns {unknown}
 */
export function copyValue(value, copyKeyDeep, map) {
	if (typeof value !== "object" || value === null) {
		return value;
	}
	const type = Object.prototype.toString.call(value);
	if (!traversableTypes[type]) {
		return value;
	}
	if (map.has(value)) {
		return map.get(value);
	}
	const target = createCopyTarget(value);
	if (target === value) {
		return target;
	}
	map.set(value, target);
	if (value instanceof Map) {
		value.forEach((mapValue, key) => {
			const set = Reflect.get(target, "set");
			const copiedKey = copyKeyDeep ? copyValue(key, copyKeyDeep, map) : key;
			const copiedValue = copyValue(mapValue, copyKeyDeep, map);
			if (typeof set !== "function") {
				throw new TypeError("Map copy target must provide set");
			}
			Reflect.apply(set, target, [copiedKey, copiedValue]);
		});
	} else if (value instanceof Set) {
		value.forEach(setValue => {
			const add = Reflect.get(target, "add");
			const copiedValue = copyValue(setValue, copyKeyDeep, map);
			if (typeof add !== "function") {
				throw new TypeError("Set copy target must provide add");
			}
			Reflect.apply(add, target, [copiedValue]);
		});
	}
	copyProperties(value, target, copyKeyDeep, map);
	return target;
}
