import { after } from "node:test";

/** Only the isolated tests install the legacy array API used by real skills. */
export function installLegacyArrays(runtime) {
	const methods = {
		add(value) {
			if (!this.includes(value)) this.push(value);
			return this;
		},
		addArray(values) {
			for (const value of values) this.add(value);
			return this;
		},
		remove(value) {
			const index = this.indexOf(value);
			if (index >= 0) this.splice(index, 1);
			return this;
		},
		removeArray(values) {
			for (const value of values) this.remove(value);
			return this;
		},
	};
	const originals = Object.fromEntries(Object.keys(methods).map(key => [key, Object.getOwnPropertyDescriptor(Array.prototype, key)]));
	for (const [key, value] of Object.entries(methods)) Object.defineProperty(Array.prototype, key, { value, configurable: true, writable: true });
	after(() => {
		for (const [key, descriptor] of Object.entries(originals)) {
			if (descriptor) Object.defineProperty(Array.prototype, key, descriptor);
			else delete Array.prototype[key];
		}
	});
	runtime.run(
		`const legacyMethods = {${Object.values(methods)
			.map(method => method.toString())
			.join(",")}}; for (const [key,value] of Object.entries(legacyMethods)) Object.defineProperty(Array.prototype,key,{value,configurable:true,writable:true});`
	);
}
