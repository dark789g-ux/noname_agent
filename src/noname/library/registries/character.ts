import { get } from "noname";

export function createCharacter() {
	return new Proxy(
		{},
		{
			set(target, prop, newValue) {
				return Reflect.set(target, prop, get.convertedCharacter(newValue));
			},
		}
	);
}
