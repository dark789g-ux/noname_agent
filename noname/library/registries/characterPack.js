import "../../../noname.js";
import { ui } from "../../ui/index.js";
import { get } from "../../get/binding.js";
function createCharacterPack() {
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
          if (!["mode_favourite", "mode_banned"].includes(prop) && !Reflect.has(target, prop)) {
            Promise.resolve().then(() => {
              ui.updateCharacterPackMenu.forEach((fun) => fun(packName));
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
            set(target2, prop2, newValue2) {
              return Reflect.set(target2, prop2, get.convertedCharacter(newValue2));
            }
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
      }
    }
  );
}
export {
  createCharacterPack
};
