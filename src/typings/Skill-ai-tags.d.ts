declare interface SkillAI {
//ai的tag【可用于标记卡牌的属性】
	//get.tag(卡牌,标签名) 检测是否有指定卡牌标签：
	/** 主要是使用在card中，独立制定的一些标记来描述自身得一些特性,有则标记1，默认是没有（实质上用bool也行），可能有少许标记参与运算 */
	tag?: {
		//比较常用：（以下为自己得理解）
		/** 【响应杀】：即手上没有杀时，也有可能响应杀 */
		respondSha?: CardTagType;
		/** 【响应闪】：即手上没有闪时，也有可能响应闪 */
		respondShan?: CardTagType;
		/** 【不会受到伤害】 */
		damage?: CardTagType;
		/** 【不受元素伤害】 */
		natureDamage?: CardTagType;
		/** 【不受雷属性伤害】 */
		thunderDamage?: CardTagType;
		/** 【不受冰属性伤害】【v1.9.107】 */
		iceDamage?: CardTagType;
		/** 【不受火属性伤害】 */
		fireDamage?: CardTagType;
		/** 【可以指定多个目标】 */
		multitarget?: CardTagType;
		/** 【回复体力】 */
		recover?: CardTagType;
		/** 【失去体力】 */
		loseHp?: CardTagType;
		/** 【可获得牌】 */
		gain?: CardTagType;
		/** 【可自救】 */
		save?: CardTagType;
		/** 【可弃牌】，即弃牌可以有收益 */
		discard?: CardTagType;
		/** 【失去牌】 */
		loseCard?: CardTagType;
		/** 【多个目标结算时（？存疑）】 */
		multineg?: CardTagType;
		/** 【可多次/再次判定/改变判定】 */
		rejudge?: CardTagType;
		draw?: CardTagType;
		norepeat?: CardTagType;
		/** 【装备替换价值】 */
		valueswap?: CardTagType;

		[key: string]: CardTagType | void;
	}
/**
	 * 是否要对“连锁”状态下的目标处理；
	 *
	 * 新增，在get.effect中使用；
	 * @param player 使用者
	 * @param target 目标（伤害传导的起点）
	 * @param card 所使用卡牌
	 * @returns 返回是否处理(boolean)，或在确定要处理时返回一个存放所需数据的字典（默认设返回值.source为target）
	 */
	canLink?(player: Player, target: Player, card: string | Card | VCard): boolean | EffectLinkContext;
//日后还有很多属性要添加的
	[key: string]: any;
}
