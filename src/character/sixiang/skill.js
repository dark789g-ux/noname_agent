import { groupSkills as stdkoujingSkills } from "./skills/stdkoujing.js";
import { groupSkills as stdshuangruiSkills } from "./skills/stdshuangrui.js";
import { groupSkills as stdtongliSkills } from "./skills/stdtongli.js";
import { groupSkills as stdwangluSkills } from "./skills/stdwanglu.js";
import { groupSkills as stdwuweiSkills } from "./skills/stdwuwei.js";
import { groupSkills as stdzhituSkills } from "./skills/stdzhitu.js";
import { groupSkills as stdgangjianSkills } from "./skills/stdgangjian.js";
import { groupSkills as stdaocaiSkills } from "./skills/stdaocai.js";
import { groupSkills as stdqijianSkills } from "./skills/stdqijian.js";
import { groupSkills as stdzhengnanSkills } from "./skills/stdzhengnan.js";
import { groupSkills as stdduanbingSkills } from "./skills/stdduanbing.js";
import { groupSkills as stdyunjiSkills } from "./skills/stdyunji.js";
import { groupSkills as stdfunanSkills } from "./skills/stdfunan.js";
import { groupSkills as stdruwuSkills } from "./skills/stdruwu.js";
import { groupSkills as stdqiuyuanSkills } from "./skills/stdqiuyuan.js";
import { groupSkills as stdxiongxiaSkills } from "./skills/stdxiongxia.js";
import { groupSkills as stdzhiyinmengSkills } from "./skills/stdzhiyinmeng.js";
import { groupSkills as stdtiaoheSkills } from "./skills/stdtiaohe.js";

/** @type { importCharacterConfig["skill"] } */
const skills = {
	...stdkoujingSkills,
	...stdshuangruiSkills,
	...stdtongliSkills,
	...stdwangluSkills,
	...stdwuweiSkills,
	...stdzhituSkills,
	...stdgangjianSkills,
	...stdaocaiSkills,
	...stdqijianSkills,
	...stdzhengnanSkills,
	...stdduanbingSkills,
	...stdyunjiSkills,
	...stdfunanSkills,
	...stdruwuSkills,
	...stdqiuyuanSkills,
	...stdxiongxiaSkills,
	...stdzhiyinmengSkills,
	...stdtiaoheSkills,
};

export default skills;
