import { get } from "noname";
import { ui } from "noname";

export function createCharacterPack() {
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
					// 新增武将包，且不是“收藏”和“禁用”
					if (!["mode_favourite", "mode_banned"].includes(prop) && !Reflect.has(target, prop)) {
						Promise.resolve().then(() => {
							ui.updateCharacterPackMenu.forEach(fun => fun(packName));
						});
					}

					if (prop.startsWith("mode_extension_")) {
						prop = prop.slice("mode_extension_".length);
						packName = prop;
					}
				}
				const newPack = new Proxy(
					{},
					{
						set(target, prop, newValue) {
							return Reflect.set(target, prop, get.convertedCharacter(newValue));
						},
					}
				);
				Object.assign(newPack, newValue);
				return Reflect.set(target, prop, newPack);
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
