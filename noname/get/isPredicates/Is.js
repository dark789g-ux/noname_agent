import { cardAndContentPredicates } from "./cardAndContent.js";
import { skillAndTextPredicates } from "./skillAndText.js";
import { platformAndStatePredicates } from "./platformAndState.js";
import "./methodsContract.js";
class Is {
}
for (const methods of [cardAndContentPredicates, skillAndTextPredicates, platformAndStatePredicates]) {
  for (const key of Reflect.ownKeys(methods)) {
    const descriptor = Object.getOwnPropertyDescriptor(methods, key);
    Object.defineProperty(Is.prototype, key, { ...descriptor, enumerable: false });
  }
}
export {
  Is
};
