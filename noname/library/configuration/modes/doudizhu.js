import { createModeDoudizhuNameGroup } from "./doudizhu/connection.js";
import { createModeDoudizhuConfigGroup } from "./doudizhu/rules.js";
function createModeDoudizhu() {
  return {
    ...createModeDoudizhuNameGroup(),
    ...createModeDoudizhuConfigGroup()
  };
}
export {
  createModeDoudizhu
};
