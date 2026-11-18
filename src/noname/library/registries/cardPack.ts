import { ui } from "noname";

export function createCardPack() {
	return new Proxy(
		{},
		{
			get(target, prop, receiver) {
				if (typeof prop == "string" && prop.startsWith("mode_extension_")) {
					prop = prop.slice("mode_extension_".length);
				}
				return Reflect.get(target, prop, receiver);
			},
			set(target, prop, newValue) {
				if (typeof prop == "string") {
					let packName = prop;
					if (!Reflect.has(target, prop)) {
						Promise.resolve().then(() => {
							ui.updateCardPackMenu.forEach(fun => fun(packName));
						});
					}
					if (prop.startsWith("mode_extension_")) {
						prop = prop.slice("mode_extension_".length);
						packName = prop;
					}
				} else {
					throw new TypeError("prop.startsWith is not a function");
				}
				return Reflect.set(target, prop, newValue);
			},
			defineProperty(target, prop, descriptor) {
				if (typeof prop == "string" && prop.startsWith("mode_extension_")) {
					prop = prop.slice("mode_extension_".length);
				}
				return Reflect.defineProperty(target, prop, descriptor);
			},
		}
	);
}
