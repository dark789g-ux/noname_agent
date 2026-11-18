import { createFilterSkill } from "./skill.js";
import { createFilterSelection } from "./selection.js";
import { createFilterTargets } from "./targets.js";
import { createFilterCards } from "./cards.js";
function createFilter() {
  return {
    ...createFilterSkill(),
    ...createFilterSelection(),
    ...createFilterTargets(),
    ...createFilterCards()
  };
}
export {
  createFilter
};
