import { lordAndWeiSkills } from "./skills/lordAndWei.js";
import { weiJudgementSkills } from "./skills/weiJudgement.js";
import { weiAndShuSkills } from "./skills/weiAndShu.js";
import { shuCombatSkills } from "./skills/shuCombat.js";
import { wuTacticsSkills } from "./skills/wuTactics.js";
import { wuAndVariantsSkills } from "./skills/wuAndVariants.js";
import { variantSupportSkills } from "./skills/variantSupport.js";

/** @type { importCharacterConfig["skill"] } */
const skills = {
	...lordAndWeiSkills,
	...weiJudgementSkills,
	...weiAndShuSkills,
	...shuCombatSkills,
	...wuTacticsSkills,
	...wuAndVariantsSkills,
	...variantSupportSkills,
};

export default skills;
