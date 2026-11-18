import "./index.js";
import { get } from "./binding.js";
class Promises {
  zip() {
    return new Promise((resolve) => get.zip(resolve));
  }
}
export {
  Promises
};
