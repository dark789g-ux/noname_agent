import { jilinSkills } from "./skills/jilin.js";
import { diliSkills } from "./skills/dili.js";
import { yuhengSkills } from "./skills/yuheng.js";
import { ol_wuqianSkills } from "./skills/ol_wuqian.js";
import { jilue_guicaiSkills } from "./skills/jilue_guicai.js";
import { qixingSkills } from "./skills/qixing.js";
import { yeyanSkills } from "./skills/yeyan.js";
import { relonghunSkills } from "./skills/relonghun.js";
import { nzry_longnuSkills } from "./skills/nzry_longnu.js";
import { drlt_zhitiSkills } from "./skills/drlt_zhiti.js";

/** @type { importCharacterConfig["skill"] } */
const skills = {
	...jilinSkills,
	...diliSkills,
	...yuhengSkills,
	...ol_wuqianSkills,
	...jilue_guicaiSkills,
	...qixingSkills,
	...yeyanSkills,
	...relonghunSkills,
	...nzry_longnuSkills,
	...drlt_zhitiSkills,
};

export default skills;
