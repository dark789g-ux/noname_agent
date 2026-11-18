import "../../../../noname.js";
import { get } from "../../../get/binding.js";
function getButtonSubtypes(link) {
  const subtypes = Reflect.apply(get.subtypes, get, [link, false]);
  if (!Array.isArray(subtypes)) {
    throw new TypeError("button subtypes must be an array");
  }
  return subtypes;
}
export {
  getButtonSubtypes
};
