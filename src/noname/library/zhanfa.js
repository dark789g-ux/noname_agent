import { _status, game, get, lib } from "noname";
import { getRegisteredSkill } from "./skillRegistry.js";
import { dongfengEffects } from "./zhanfaEffects/dongfeng.js";
import { chenqibubeiEffects } from "./zhanfaEffects/chenqibubei.js";
import { fuyiqushanEffects } from "./zhanfaEffects/fuyiqushan.js";
import { jishiyuEffects } from "./zhanfaEffects/jishiyu.js";
import { mopai2Effects } from "./zhanfaEffects/mopai2.js";
import { tijiashuEffects } from "./zhanfaEffects/tijiashu.js";
import { xushiEffects } from "./zhanfaEffects/xushi.js";
import { yuanmou3Effects } from "./zhanfaEffects/yuanmou3.js";

/**
 * 战法定义；保留原注册表契约，回调协议迁移另行收口。
 * @typedef {{skill: Skill | string, rarity: string | undefined, translate: string, info: string, [p: string]: any}} ZhanfaDefinition
 */
/** @type {Record<string, ZhanfaDefinition>} */
const _zhanfa = {
	...dongfengEffects,
	...chenqibubeiEffects,
	...fuyiqushanEffects,
	...jishiyuEffects,
	...mopai2Effects,
	...tijiashuEffects,
	...xushiEffects,
	...yuanmou3Effects,
};

/**
 * @typedef {object} ZhanfaRecord
 * @property {string} skill
 * @property {string} rarity
 * @property {(player?: Player) => boolean} [filterBan]
 */

export class ZhanfaManager {
	//#inited = false;

	/**
	 * @type {Record<string, ZhanfaRecord>}
	 */
	#zhanfa = {};

	/**
	 * @param {Library} lib
	 */
	constructor(lib) {
		this.lib = lib;
		lib.cardPack["zhanfa"] = [];
		lib.translate["zhanfa_card_config"] = "战法";
		lib.translate["zhanfa_cardsInfo"] = "这里是用来浏览战法的，这些不是卡牌！";
		//统一修改模版技能的优先级
		let templateSkill = Object.keys(lib.skill).filter(i => i.startsWith("zf_"));
		templateSkill.forEach(i => {
			const info = getRegisteredSkill(lib.skill, i);
			if (!info) {
				return;
			}
			info.priority ??= 0.99;
			const subSkills = info.subSkill;
			if (subSkills) {
				Object.keys(subSkills).forEach(j => (lib.skill[i + "_" + j] = subSkills[j]));
			}
		});
		for (const id in _zhanfa) {
			this.add({ id, ..._zhanfa[id] });
		}
		//this.#zhanfa = _zhanfa;
	}

	/**
	 * 添加新战法
	 * @param {object} zhanfa 要添加的战法
	 * @param {string} zhanfa.id
	 * @param {Skill | string} zhanfa.skill 战法的对应效果
	 * @param {string} [zhanfa.rarity] 战法的稀有度
	 * @param {string} [zhanfa.translate] 战法的翻译，缺省时使用已有技能翻译
	 * @param {string} [zhanfa.info] 战法的说明，缺省时使用已有技能说明
	 * @param {(player?: Player) => boolean} [zhanfa.filterBan] 战法禁用条件
	 * @param {object} [zhanfa.card] 战法的对应类似卡牌的信息（包括战法的ai），扩展可以在这里添加路径（image属性）或者直接引用已有的卡牌图片（cardimage）
	 * @param {object} [pack] 战法分包，允许自定义用来浏览的分包
	 * @param {string} pack.id 分包的id
	 * @param {string} pack.name 分包id的翻译
	 * @param {string} [pack.info] 分包的简介
	 * @returns {ZhanfaRecord | undefined}
	 */
	add(zhanfa, pack) {
		const lib = this.lib;
		let { id, skill, rarity, translate, info, card, ...args } = zhanfa;
		if (!id || this.get(id)) {
			return;
		}
		if (typeof skill != "string") {
			//对技能统一加工
			let skillInfo = skill ?? {};
			skillInfo.nopop ??= true;
			const setAtt = skill => {
				if (skill.inherit) {
					let skillx = getRegisteredSkill(lib.skill, skill.inherit);
					if (skillx) {
						skill = { ...skillx, ...skill };
						delete skill.inherit;
					}
				}
				skill.charlotte ??= true;
				//优先级给高点
				skill.priority ??= 0.99;
				//默认silent但popup是true
				if (!("silent" in skill)) {
					skill.silent = true;
					skill.popup = true;
				}
				return skill;
			};
			skillInfo = setAtt(skillInfo);
			//子技能也会统一处理
			if ("subSkill" in skillInfo) {
				for (const i in skillInfo.subSkill) {
					skillInfo.subSkill[i] = setAtt(skillInfo.subSkill[i]);
				}
			}
			lib.skill[id] = skillInfo;
			skill = id;
		} else {
			translate ??= lib.translate[skill];
			info ??= lib.translate[skill + "_info"];
		}
		lib.translate[id] = translate;
		lib.translate[id + "_info"] = info;
		if (!card || typeof card !== "object") {
			card = {};
		}
		if (!card.fullskin && !card.fullimage) {
			card.fullskin = true;
		}
		if (!card.cardimage && !card.image) {
			card.image = `image/zhanfa/${id}.png`;
		}
		card.type = "zhanfa";
		rarity ??= "common";
		card.subtype = `zf_${rarity}`;
		lib.card[id] = card;
		if (pack && pack.id) {
			let { id: packId, name, info } = pack;
			packId = `zf_${packId}`;
			lib.cardPack[packId] ??= [];
			lib.translate[`${packId}_card_config`] ??= name || packId;
			lib.translate[`${packId}_cardsInfo`] ??= info || "";
			lib.cardPack[packId].push(id);
		} else {
			lib.cardPack["zhanfa"].push(id);
		}
		this.#zhanfa[id] = { skill, rarity, ...args };
		return { ...this.#zhanfa[id] };
	}

	/**
	 * 获取所有战法的id
	 * @param {boolean} [includeBan] 获取所有战法，包括被ban的战法
	 * @param {Player} [player] 有可能作为filterBan参数的player
	 * @returns {string[]}
	 */
	getList(includeBan, player) {
		let list = [...Object.keys(this.#zhanfa)]; //, ...Object.keys(this.#customZhanfa)
		if (!includeBan) {
			list = list.filter(i => !this.get(i)?.filterBan?.(player));
		}
		return list;
	}

	/**
	 * 获取对应战法的Object
	 * @param {string} id 战法的id
	 * @returns {ZhanfaRecord | undefined}
	 */
	get(id) {
		if (this.#zhanfa[id]) {
			return { ...this.#zhanfa[id] };
		}
		return;
	}

	/**
	 * 修改对应战法的Object
	 * @param {string} id 要修改的战法的id
	 * @param {object} zhanfa 要修改的内容，覆盖已有属性或添加没有的属性
	 * @returns {ZhanfaRecord | Record<string, never>}
	 */
	set(id, zhanfa) {
		if (!this.#zhanfa[id]) {
			console.warn(`不存在战法: ${id}`);
			return {};
		}
		for (const i in zhanfa) {
			this.#zhanfa[id][i] = zhanfa[i];
		}
		return { ...this.#zhanfa[id] };
	}

	/**
	 * 获取对应战法的skill
	 * @param {string} id 战法的id
	 * @returns {string | undefined}
	 */
	getSkill(id) {
		return this.get(id)?.skill;
	}

	/**
	 * 获取对应战法的稀有度
	 * @param {string} id 战法的id
	 * @param {boolean} [raw] 是否返回不带zf_前缀的格式
	 * @returns {string}
	 */
	getRarity(id, raw) {
		const str = this.get(id)?.rarity || "common";
		return raw ? str : `zf_${str}`;
	}

	/**
	 * 设置对应战法的稀有度
	 * @param {string} id 战法的id
	 * @param {string} rarity 要设置的稀有度
	 */
	setRarity(id, rarity) {
		if (!this.#zhanfa[id]) {
			console.warn(`不存在战法: ${id}`);
			return;
		}
		this.#zhanfa[id].rarity = rarity;
	}

	/**
	 * 获取战法所在的分包
	 * @param {string} id 战法的id
	 * @returns {string | null}
	 */
	getPack(id) {
		for (const pack in lib.cardPack) {
			if (pack == "zhanfa" || pack.startsWith("zf_")) {
				if (lib.cardPack[pack].includes(id)) {
					return pack;
				}
			}
		}
		return null;
	}

	/**
	 * @type {string[]} 单骑战法列表
	 */
	danqiList = ["zf_xicongtianjiang", "zf_xicongtianjiang2", "zf_badaoshu", "zf_badaoshu2", "zf_banyun", "zf_bowen", "zf_bowen2", "zf_bowen3", "zf_boming", "zf_buzhen2", "zf_buzhen3", "zf_buzhen", "zf_cangtaohu", "zf_caochuanjiejian", "zf_cedingtianxia", "zf_cedingtianxia2", "zf_chenqibubei", "zf_chenqibubei2", "zf_chijiuzhan", "zf_chijiuzhan4", "zf_chijiuzhan3", "zf_cuixue", "zf_cuixue2", "zf_danliangboduo", "zf_dangtouyibang", "zf_dangtouyibang2", "zf_dushu", "zf_dushu2", "zf_duanliangcao2", "zf_duoduoyishan", "zf_duoduoyishan2", "zf_duoduoyishan3", "zf_erlianji", "zf_sanlianji", "zf_ershengsan", "zf_fanci", "zf_fenjin", "zf_fengshounian", "zf_fuyiqusha", "zf_fuyiquhuo", "zf_fuyiqushan", "zf_fuyiqutao", "zf_fuyiquchai", "zf_fuyiqujue", "zf_fuyiqusuo", "zf_fuyiqushun", "zf_geshandaniu", "zf_guandaozhiji", "zf_guangongren", "zf_hanzhan", "zf_haoshenfa", "zf_hengjiangsuo", "zf_hengfeng", "zf_hengfeng2", "zf_houfaxianzhi", "zf_houshi", "zf_houshi2", "zf_hugujiu", "zf_hugujiu2", "zf_hujia", "zf_hujia2", "zf_jishiyu", "zf_jiyi", "zf_jiyi2", "zf_jiemeng", "zf_jinnangji", "zf_jingjijia", "zf_jingyumoulve", "zf_jingyumoulve2", "zf_jueduiwuxie", "zf_kuangbao", "zf_kuangbao3", "zf_kuangbao4", "zf_kuangbao2", "zf_laoguzhuangbei", "zf_leihuoshi", "zf_leihuoshi2", "zf_leiming", "zf_liebian", "zf_liebian2", "zf_liebian3", "zf_miaoji", "zf_miaoji2", "zf_miaoshoukongkong", "zf_mopai", "zf_mopai2", "zf_muniuliuma", "zf_pinang", "zf_pinang2", "zf_pinang3", "zf_pianzhuanjia", "zf_pofuchenzhou", "zf_qiangquhaoduo", "zf_qiaoquhaoduo", "zf_ruofankui", "zf_ruoxi", "zf_sanbanfu", "zf_sanbanfu2", "zf_shenlongbaiwei", "zf_shenlongbaiwei2", "zf_shiqiboduo", "zf_shixue", "zf_shoudaoqinlai", "zf_shoudaoqinlai2", "zf_shoudaoqinlai3", "zf_shuanglve", "zf_shuangren", "zf_shuangren2", "zf_tijiashu", "zf_tipo", "zf_tipo2", "zf_tipo3", "zf_tianjiangjinnang", "zf_tianjianghengcai", "zf_tianjiangzhuangbei", "zf_tianjiangkapai", "zf_tiebushan", "zf_tiebushan2", "zf_tiebushan3", "zf_touxi", "zf_wendingtizhi", "zf_wendinghouqin", "zf_wendingjingong", "zf_wendingchengzai", "zf_wendingshiqi", "zf_woxinchangdan", "zf_xialuxiangfeng", "zf_xinshounianlai", "zf_xuyan", "zf_xulijian", "zf_xushi", "zf_xuezhan", "zf_xuezhan2", "zf_xuezhan3", "zf_yanxian", "zf_yaoli", "zf_yaoli3", "zf_yaoli4", "zf_yaoli2", "zf_yinyangshufa", "zf_yingjifangan", "zf_yingjizhanshu", "zf_yingjizhanlve", "zf_yongzhan", "zf_yongzhan2", "zf_yuzhanyuyong3", "zf_yuzhanyuyong2", "zf_yuzhanyuyong", "zf_yuanzhu", "zf_yuanzhu2", "zf_yuanzhu3", "zf_yuanjiji", "zf_yuanmou", "zf_yuanmou3", "zf_yuanmou2", "zf_zengshou", "zf_zengshou2", "zf_zhandouxuexi2", "zf_zhandouxuexi3", "zf_zhandouxuexi", "zf_zhongjiji", "zf_zhudao", "zf_zhudao2", "zf_zuiquan"];

	/**
	 * @type {string[]} 山河图战法列表
	 */
	shanhetuList = ["zf_qinmian", "zf_tianrenheyi", "zf_quanli"];
}
