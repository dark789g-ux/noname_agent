import "../../../noname.js";
import { get } from "../../get/binding.js";
function createCharacter() {
  return new Proxy(
    {},
    {
      set(target, prop, newValue) {
        return Reflect.set(target, prop, get.convertedCharacter(newValue));
      }
    }
  );
}
export {
  createCharacter
};
