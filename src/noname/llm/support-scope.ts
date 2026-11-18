/** Fixed, reviewed scope. Expanding a pack or group must update its audit. */
export const standardCharacters = ["std_yuejin", "old_re_lidian", "ganfuren", "std_panfeng", "caocao", "simayi", "xiahoudun", "zhangliao", "xuzhu", "guojia", "zhenji", "liubei", "guanyu", "zhangfei", "zhugeliang", "zhaoyun", "machao", "huangyueying", "sunquan", "ganning", "lvmeng", "huanggai", "zhouyu", "daqiao", "luxun", "sunshangxiang", "huatuo", "lvbu", "diaochan", "huaxiong", "gongsunzan", "xf_yiji", "re_yuanshu"] as const;

export const refreshStandardCharacters = ["re_caocao", "re_simayi", "re_guojia", "re_zhangliao", "re_xuzhu", "re_xiahoudun", "re_zhangfei", "re_zhaoyun", "re_guanyu", "re_machao", "re_zhouyu", "re_lvmeng", "re_ganning", "re_luxun", "re_daqiao", "re_huanggai", "re_lvbu", "re_huatuo", "re_liubei", "re_diaochan", "re_huangyueying", "re_sunquan", "re_sunshangxiang", "re_zhenji", "re_zhugeliang", "re_huaxiong", "re_gongsunzan", "re_lidian", "re_xushu"] as const;

export const standardActiveSkills = ["qingguo", "rende", "jijiang", "wusheng", "longdan_sha", "longdan_shan", "zhiheng", "qixi", "kurou", "fanjian", "guose", "jieyin", "qingnang", "jijiu", "lijian", "xinfu_jijie"] as const;

export const refreshActiveSkills = ["ollongdan", "new_rewusheng", "new_yijue", "refanjian", "gongxin", "qixi", "reguose", "rekurou", "jijiu", "new_reqingnang", "rerende", "rejijiang", "lijian", "rezhiheng", "rejieyin", "qingguo", "shizhan", "jianyan"] as const;

/** Additional active roots are acquired by these awakening effects. */
export const acquiredSkills = { qinxue: ["gongxin"], qianxin: ["jianyan"] } as const;

export const activeDecisionFlows: Record<string, string[]> = {
	qingguo: ["黑色手牌 → 闪响应"],
	rende: ["选手牌 → 其他角色 → 交给 → 达到两张后的回复"],
	jijiang: ["杀目标 → jijiang1 → 蜀势力依次 chooseToRespond"],
	wusheng: ["红色材料 → 杀 → 动态目标／响应"],
	longdan_sha: ["闪材料 → 杀 → 目标／响应"],
	longdan_shan: ["杀材料 → 闪响应"],
	zhiheng: ["任意张材料 → 弃置 → 等量摸牌"],
	qixi: ["黑色材料 → 过河拆桥 → discardPlayerCard"],
	kurou: ["失去体力 → 摸牌"],
	fanjian: ["目标 → 目标 chooseControl 花色 → gainPlayerCard → 花色结算"],
	guose: ["方块材料 → 乐不思蜀 → 合法目标"],
	jieyin: ["两张手牌 → 受伤男性 → 双方回复"],
	qingnang: ["一张手牌 → 受伤角色 → 回复"],
	jijiu: ["回合外红色材料 → 桃 → 救援目标"],
	lijian: ["一张代价牌 → 两名有序男性目标 → 决斗 → 杀响应"],
	xinfu_jijie: ["查看牌堆底牌 → chooseTarget → 交给"],
	ollongdan: ["合法杀闪桃酒材料 → 相应视为牌 → 动态目标／响应"],
	new_rewusheng: ["红色或主公技允许的材料 → 杀 → 目标／响应"],
	new_yijue: ["弃一牌 → 目标 chooseCard 展示 → 黑色封锁／红色 chooseBool 回复"],
	refanjian: ["材料交给目标 → 目标选项 → 展示弃牌／失去体力"],
	gongxin: ["有手牌的目标 → 查看手牌 → chooseToMove_new → 红桃弃置／置顶"],
	reguose: ["方块材料 → 延后目标 → 移除乐不思蜀／使用乐不思蜀 → 摸牌"],
	rekurou: ["弃牌 → 失去体力 → 诈降后续"],
	new_reqingnang: ["弃牌 → 未被标记的受伤目标 → 回复 → 黑牌禁用后续"],
	rerende: ["材料 → 未给过的目标 → 交给 → chooseButton 基本牌 → chooseUseTarget"],
	rejijiang: ["杀目标 → rejijiang1 → 蜀势力依次 chooseToRespond → 次数后续"],
	rezhiheng: ["材料 → 弃置 → 摸牌与全手牌奖励"],
	rejieyin: ["材料 → 延后男性目标 → chooseControl 装备／弃置 → 摸牌与回复"],
	shizhan: ["可对自己使用决斗的其他角色 → 目标对自己使用决斗 → 杀响应"],
	jianyan: ["chooseControl 颜色／类别 → 检索并展示 → chooseTarget 男性 → 交给"],
};

/** Every optional standard flow is audited, including externally defined skills. */
export const standardDecisionFlows: Record<string, string[]> = {
	stdxiaoguo: ["chooseToDiscard", "chooseToDiscard"],
	xunxun: ["chooseBool", "chooseToMove"],
	wangxi: ["chooseBool"],
	stdshushen: ["chooseTarget", "chooseDrawRecover"],
	shenzhi: ["chooseBool"],
	stdkuangfu: ["chooseBool", "discardPlayerCard", "chooseBool", "chooseUseTarget"],
	jianxiong: ["chooseBool"],
	hujia: ["chooseBool", "chooseToRespond"],
	fankui: ["chooseBool", "gainPlayerCard"],
	guicai: ["chooseCard"],
	ganglie: ["chooseBool", "chooseToDiscard"],
	tuxi: ["chooseTarget", "gainPlayerCard"],
	luoyi: ["chooseBool"],
	tiandu: ["chooseBool"],
	yiji: ["chooseBool", "chooseButton", "chooseTarget"],
	luoshen: ["chooseBool"],
	guanxing: ["chooseBool", "chooseToGuanxing", "chooseToMove"],
	tieji: ["chooseBool"],
	jizhi: ["chooseBool"],
	keji: ["chooseBool"],
	yingzi: ["chooseBool"],
	liuli: ["chooseCardTarget"],
	lianying: ["chooseBool"],
	xiaoji: ["chooseBool"],
	biyue: ["chooseBool"],
	yaowu: ["chooseDrawRecover"],
	xinfu_jiyuan: ["chooseBool"],
	retongji: ["chooseToDiscard"],
};

export interface SkillSupportRecord {
	id: string;
	characters: string[];
	kind: "active" | "decision" | "automatic";
	flows: string[];
	acquiredBy?: string;
	selectionSpecDeclared: boolean;
	tests: string[];
	conditions: string[];
	fallbacks: string[];
}

/** Expand actual group/subSkill declarations; no name-prefix inference. */
export function collectSkillScope(characters: Record<string, any>, roster: readonly string[], registry: Record<string, any>): SkillSupportRecord[] {
	const records = new Map<string, SkillSupportRecord>();
	function add(id: string, owner: string, info = registry[id], acquiredBy?: string) {
		if (!info) throw new Error(`Missing scoped skill ${id} (${owner})`);
		const existing = records.get(id);
		if (existing) {
			if (!existing.characters.includes(owner)) existing.characters.push(owner);
			return;
		}
		const flows = activeDecisionFlows[id] || standardDecisionFlows[id] || [];
		records.set(id, {
			id,
			characters: [owner],
			kind: info.enable ? "active" : flows.length ? "decision" : "automatic",
			flows,
			acquiredBy,
			selectionSpecDeclared: !!info.selectionSpec,
			tests: info.enable ? ["active-skills.test.mjs", "scope.test.mjs"] : ["scope.test.mjs", "共享选择事件回归"],
			conditions: ["引擎原有可用条件成立", "控制权属于本机 AI", "引用、状态和审核契约仍有效"],
			fallbacks: ["请求／总时限或轮次耗尽", "非法或过期选择", "已声明契约异常／扩展替换纯适配源规则"],
		});
		for (const group of [info.group].flat().filter(Boolean)) add(group, owner);
		for (const [key, sub] of Object.entries(info.subSkill || {})) add(`${id}_${key}`, owner, sub);
		for (const acquired of acquiredSkills[id] || []) add(acquired, owner, registry[acquired], id);
	}
	for (const owner of roster) {
		if (!characters[owner]) throw new Error(`Missing scoped character ${owner}`);
		for (const id of characters[owner].skills) add(id, owner);
	}
	return Array.from(records.values());
}
