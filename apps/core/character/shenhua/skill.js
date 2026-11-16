import { groupSkills as lianhuanSkills } from "./skills/lianhuan.js";
import { groupSkills as olliangyinSkills } from "./skills/olliangyin.js";
import { groupSkills as zhengrongSkills } from "./skills/zhengrong.js";
import { groupSkills as xinfu_zuilunSkills } from "./skills/xinfu_zuilun.js";
import { groupSkills as drlt_yongsiSkills } from "./skills/drlt_yongsi.js";
import { groupSkills as drlt_wanglie2Skills } from "./skills/drlt_wanglie2.js";
import { groupSkills as nzry_yiliSkills } from "./skills/nzry_yili.js";
import { groupSkills as nzry_shicaiSkills } from "./skills/nzry_shicai.js";
import { groupSkills as nzry_shenshiSkills } from "./skills/nzry_shenshi.js";
import { groupSkills as redimengSkills } from "./skills/redimeng.js";
import { groupSkills as xinliegongSkills } from "./skills/xinliegong.js";
import { groupSkills as qiaobianSkills } from "./skills/qiaobian.js";
import { groupSkills as zhibaSkills } from "./skills/zhiba.js";
import { groupSkills as huashenSkills } from "./skills/huashen.js";
import { groupSkills as huashen2Skills } from "./skills/huashen2.js";
import { groupSkills as haoshi2Skills } from "./skills/haoshi2.js";
import { groupSkills as benghuaiSkills } from "./skills/benghuai.js";
import { groupSkills as oldniepanSkills } from "./skills/oldniepan.js";
import { groupSkills as tianyiSkills } from "./skills/tianyi.js";
import { groupSkills as releijiSkills } from "./skills/releiji.js";
import { groupSkills as retianxiangSkills } from "./skills/retianxiang.js";
import { groupSkills as gzbuquSkills } from "./skills/gzbuqu.js";
import { groupSkills as guidaoSkills } from "./skills/guidao.js";
import { groupSkills as guhuo_guessSkills } from "./skills/guhuo_guess.js";

/** @type { importCharacterConfig["skill"] } */
const skills = {
	...lianhuanSkills,
	...olliangyinSkills,
	...zhengrongSkills,
	...xinfu_zuilunSkills,
	...drlt_yongsiSkills,
	...drlt_wanglie2Skills,
	...nzry_yiliSkills,
	...nzry_shicaiSkills,
	...nzry_shenshiSkills,
	...redimengSkills,
	...xinliegongSkills,
	...qiaobianSkills,
	...zhibaSkills,
	...huashenSkills,
	...huashen2Skills,
	...haoshi2Skills,
	...benghuaiSkills,
	...oldniepanSkills,
	...tianyiSkills,
	...releijiSkills,
	...retianxiangSkills,
	...gzbuquSkills,
	...guidaoSkills,
	...guhuo_guessSkills,
};

export default skills;
