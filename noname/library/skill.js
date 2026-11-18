import { defineBuiltinSkills } from "./skillRegistry.js";
import { equipmentSkills } from "./builtinSkills/equipment.js";
import { battleModifiersSkills } from "./builtinSkills/battleModifiers.js";
import { cooperationSkills } from "./builtinSkills/cooperation.js";
import { zhengsuSkills } from "./builtinSkills/zhengsu.js";
import { modeStateSkills } from "./builtinSkills/modeState.js";
import { statusAndRecastSkills } from "./builtinSkills/statusAndRecast.js";
import { identitySkills } from "./builtinSkills/identity.js";
const builtinSkills = {
  ...equipmentSkills,
  ...battleModifiersSkills,
  ...cooperationSkills,
  ...zhengsuSkills,
  ...modeStateSkills,
  ...statusAndRecastSkills,
  ...identitySkills
};
const skills = defineBuiltinSkills(builtinSkills);
export {
  skills as default
};
