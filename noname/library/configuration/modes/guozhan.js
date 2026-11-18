import { createModeGuozhanNameGroup } from "./guozhan/connection.js";
import { createModeGuozhanConfigGroup } from "./guozhan/rules.js";
function createModeGuozhan() {
  return {
    ...createModeGuozhanNameGroup(),
    ...createModeGuozhanConfigGroup()
  };
}
export {
  createModeGuozhan
};
