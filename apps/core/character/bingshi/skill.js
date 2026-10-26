import { groupSkills as potchiyunSkills } from "./skills/potchiyun.js";
import { groupSkills as potxiongziSkills } from "./skills/potxiongzi.js";
import { groupSkills as potsifengSkills } from "./skills/potsifeng.js";
import { groupSkills as potdianyiSkills } from "./skills/potdianyi.js";
import { groupSkills as potfuanSkills } from "./skills/potfuan.js";
import { groupSkills as pottuntianSkills } from "./skills/pottuntian.js";
import { groupSkills as pot_liezhiSkills } from "./skills/pot_liezhi.js";
import { groupSkills as old_potjixiSkills } from "./skills/old_potjixi.js";
import { groupSkills as mbquanchongSkills } from "./skills/mbquanchong.js";
import { groupSkills as mbxiongtuSkills } from "./skills/mbxiongtu.js";
import { groupSkills as potyinzhanSkills } from "./skills/potyinzhan.js";
import { groupSkills as mbqingdaoSkills } from "./skills/mbqingdao.js";
import { groupSkills as mbganggengSkills } from "./skills/mbganggeng.js";
import { groupSkills as mbshuanghuaiSkills } from "./skills/mbshuanghuai.js";
import { groupSkills as mbjianjiSkills } from "./skills/mbjianji.js";
import { groupSkills as mbzhujiSkills } from "./skills/mbzhuji.js";
import { groupSkills as potdaozhuanSkills } from "./skills/potdaozhuan.js";
import { groupSkills as potfujiSkills } from "./skills/potfuji.js";
import { groupSkills as potzhanlieSkills } from "./skills/potzhanlie.js";

/** @type { importCharacterConfig["skill"] } */
const skills = {
	...potchiyunSkills,
	...potxiongziSkills,
	...potsifengSkills,
	...potdianyiSkills,
	...potfuanSkills,
	...pottuntianSkills,
	...pot_liezhiSkills,
	...old_potjixiSkills,
	...mbquanchongSkills,
	...mbxiongtuSkills,
	...potyinzhanSkills,
	...mbqingdaoSkills,
	...mbganggengSkills,
	...mbshuanghuaiSkills,
	...mbjianjiSkills,
	...mbzhujiSkills,
	...potdaozhuanSkills,
	...potfujiSkills,
	...potzhanlieSkills,
};

export default skills;
