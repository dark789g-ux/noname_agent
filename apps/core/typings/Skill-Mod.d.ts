/** mod的配置 */
declare interface Mod {
	/**
	 * 卡牌能否主动弃置
	 */
	cardDiscardable?(card: Card | VCard, player: Player, eventName: string | undefined, result: boolean | "unchanged"): boolean | "unchanged" | void;
	/**
	 * 卡牌是否可用(卡牌能否被选择)
	 * 比cardEnabled2更弱一些
	 *
	 * 适用范围：player.canUse，lib.filter.cardEnabled，默认lib.filter.filterCard
	 *
	 */
	cardEnabled?(card: Card | VCard | CardBaseUIData, player: Player, event: GameEvent | GameEventParentFallback | "forceEnable" | undefined, result: boolean | "unchanged"): boolean | "unchanged" | void;
	/**
	 * 卡牌是否可用（适用范围基本可以视为所有情况下）
	 *
	 * 比cardEnable更弱一些
	 *
	 * 适用范围：event.backup中技能信息触发（viewAS），cardEnabled（优先于该mod的触发），cardRespondable（优先于该mod的触发），_save（优先于cardSavable的mod触发）中均触发
	 */
	cardEnabled2?(card: Card | VCard | CardBaseUIData, player: Player, event: GameEvent | GameEventParentFallback | "forceEnable" | undefined, result: boolean | "unchanged"): boolean | "unchanged" | void;
	/**卡牌能否被赠与 */
	cardGiftable?(card: Card, player: Player, target: Player, current: boolean | "unchanged"): boolean | "unchanged" | void;
	/**卡牌能否被重铸 */
	cardRecastable?(card: Card, player: Player, source: Player, result: boolean | "unchanged"): boolean | "unchanged" | void
	/**
	 * 卡牌是否可用（改变卡牌的使用次数）
	 *
	 * 要与cardEnabled一起使用（目前看来两个效果一致）
	 *
	 * @param card - 牌
	 * @param player - 玩家
	 * @param num - 使用次数
	 */
	cardUsable?(card: Card | VCard, player: Player, num: number | undefined): boolean | number | void;
	/**
	 * 卡牌是否可以响应
	 *
	 * 要与cardEnabled一起使用（目前看来两个效果一致）
	 *
	 */
	cardRespondable?(card: Card | VCard, player: Player, result: boolean | "unchanged"): boolean | "unchanged" | void;
	/**
	 * 卡牌是否可以救人
	 *
	 * 要与cardEnabled一起使用（目前看来两个效果一致）
	 *
	 * 注：还是和cardEnabled不同，设置了该mod检测，只要是在_save，濒死求救阶段，都可以触发；
	 *
	 * 不过前提，可能还是要通过该阶段的cardEnabled的检测，目前还没确定，日后再做分析
	 *
	 * 适用范围：濒死阶段的filterCard
	 *
	 * @param card - 牌
	 * @param player - 玩家
	 * @param taregt - 当前处于濒死求救得玩家
	 */
	cardSavable?(card: Card | VCard | CardBaseUIData, player: Player, taregt: Player, result: boolean | "unchanged"): boolean | "unchanged" | void;
	/**
	 * 在全局的防御范围 （globalToYou其他玩家到你的距离）
	 * 注：防御距离就是要和别人的距离越远，所以，拉开距离需要增加；
	 * @param from 表示其他玩家
	 * @param to 表示技能的拥有者
	 * @param current 当前的数值
	 */
	globalTo?(from: Player, to: Player, current: number): number | void;
	/**
	 * 在全局的进攻距离 （globalFormYou其他玩家远离你的距离）
	 * 注：进攻距离就是要和别人的距离越近，所以，要打到别人需要减少；
	 * @param from 技能的拥有者
	 * @param to 表示其他玩家
	 * @param current 当前的距离
	 */
	globalFrom?(from: Player, to: Player, current: number): number | void;
	/**
	 * 你对其他角色的攻击范围
	 * @param from 技能的拥有者
	 * @param to 自带到谁的攻击距离
	 * @param range 当前的数值
	 *
	 * 注：和globalForm同理，减少距离，减少；
	 */
	attackFrom?(from: Player, to: Player, range: number): number | void;
	/**
	 * 其他角色对你的攻击距离
	 * @param from 表示其他玩家
	 * @param to 表示技能的拥有者
	 * @param current 当前的数值
	 *  注：和globalTo同理，拉开距离，增加；
	 */
	attackTo?(from: Player, to: Player, range: number): number | void;
	/**
	 * 蓄力值上限
	 * @param player 玩家
	 * @param max 当前上限
	 */
	maxCharge?(player: Player, max: number): number | void;
	/** 手牌上限 */
	maxHandcard?(player: Player, num: number): number | void;
	/**
	 * 选择的目标范围,直接对range进行修改即可，无需返回值。
	 */
	selectTarget?(card: Card | VCard | CardBaseUIData, player: Player, range: Select): void;
	/**
	* 【表示能否成为你的目标，返回true表示必须是你的目标，false不能成为你的目标】
	* @param card
	* @param player 源玩家（使用牌的角色）
	* @param target 目标玩家
	*/
	playerEnabled?(card: Card | VCard | CardBaseUIData, player: Player, target: Player, result: boolean | "unchanged"): boolean | "unchanged" | void;
	/**
	* 【表示你能否成为其他角色的目标】
	* @param card
	* @param player 使用牌的角色
	* @param target 玩家
	*/
	targetEnabled?(card: Card | VCard | CardBaseUIData, player: Player, target: Player, result: boolean | "unchanged"): boolean | "unchanged" | void;

	/**
	 * 可以指定任意（范围内）目标
	 * @param card 牌
	 * @param player 玩家(使用牌的角色)
	 * @param target 目标
	 * @return 返回bool值可以不接受，范围检测，使用返回的结果;返回number，即计算距离是增加该距离；不返回，默认正常的范围检测
	 */
	targetInRange?(card: Card | VCard | CardBaseUIData, player: Player, target: Player, result: boolean | "unchanged" | number): boolean | number | "unchanged" | void;
	/**
	 * 弃牌阶段时，忽略弃置的手牌
	 * @param card
	 * @param player
	 */
	ignoredHandcard?(card: Card, player: Player, current: boolean): boolean | void;
	/** 表示自己牌能否被别人弃置 */
	canBeDiscarded?(card: Card | VCard, player: Player, target: Player, eventName: string | undefined, result: boolean | "unchanged"): boolean | "unchanged" | void;
	/**
	 * 自己的牌能否被别人获得
	 * 装备区的牌能否被移动到其他角色装备区内
	 */
	canBeGained?(card: Card, player: Player, target: Player, eventName: string | undefined, reslut: boolean | "unchanged"): boolean | "unchanged" | void;
	/**往往用于装备牌，能否被顶替 */
	canBeReplaced?(card: Card | VCard, player: Player, current: boolean | "unchanged"): boolean | "unchanged" | void;
	/**
	 * 改变花色	用于get.suit
	 */
	suit?(card: Card | VCard | CardBaseUIData, suit: string | null | undefined): string | void;
	/**
	 * 改变最终的判定结果
	 * @param player
	 * @param result
	 */
	judge?(player: Player, result: Partial<Result>): Partial<Result> | void;

	/** 是否能在判定阶段使用无懈 */
	wuxieJudgeEnabled?(card: Card, player: Player, current: Player, reslut: boolean): boolean | void;
	/** 是否能在判定阶段响应无懈 */
	wuxieJudgeRespondable?(card: Card, player: Player, current: Player, result: boolean): boolean | void;
	/** 是否能使用无懈 */
	wuxieEnabled?(card: Card, player: Player, target: Player, current: Player, result: boolean): boolean | void;
	/** 是否能响应无懈 */
	wuxieRespondable?(card: Card, player: Player, target: Player, current: Player, result: boolean): boolean | void;

	/** 改变卡牌名字  用于get.name*/
	cardname?(card: Card | VCard | CardBaseUIData, player: Player, currentname: string | undefined): string | void;
	/** 改变卡牌伤害属性   用于get.nature*/
	cardnature?(card: Card | VCard | CardBaseUIData, player: Player, currentnature: string | null | undefined): string | boolean | null | void;
	/** 改变卡牌的点数	用于get.number*/
	cardnumber?(card: Card | VCard | CardBaseUIData, player: Player, num: number | null): number | void;
	/** 改变最终花色	用于get.suit*/
	cardsuit?(card: Card | VCard | CardBaseUIData, player: Player, suit: string | null | undefined): string | void;
	/** 对特定角色使用牌的次数限制（用于优化【对特定角色使用牌无次数限制】的机制）【v1.9.105】 */
	cardUsableTarget?(card: Card | VCard | CardBaseUIData, player: Player, target: Player, result: boolean): boolean | void;

	/** 用于get.value，对最后得返回value结果做处理 */
	aiValue?(player: Player, card: Card, num: number): number | void;
	/** 用于get.order，对最后得返回order结果做处理 */
	aiOrder?(player: Player, card: Card, num: number): number | void;

	/**
	 * 其他角色（to）是否在玩家（from）攻击范围内
	 * @param from 指代技能的拥有者
	 * @param to 表示其他迭代玩家
	 * */
	inRange?(from: Player, to: Player, current: boolean | "unchanged"): boolean | void;
	/**
	* 玩家（to）是否在其他角色（from）的攻击范围内
	* @param from 表示其他人，迭代玩家
	* @param to 表示技能拥有者，即自己
	* */
	inRangeOf?(from: Player, to: Player, current: boolean | "unchanged"): boolean | void;
	/** 用于手牌上限的判断，最先生效，主要用于改变手牌上限基数 */
	maxHandcardBase?(player: Player, num: number): number | void;
	/** 用于手牌上限的判断，最后生效，主要用于实现固定手牌上限 */
	maxHandcardFinal?(player: Player, num: number): number | void;

	/** 用于get.useful，对最后得返回useful结果做处理 */
	aiUseful?(player: Player, card: Card, num: number): number | void;
	/**
	 * 玩家的攻击范围
	 * @param player 玩家
	 * @param num 当前的数值
	 */
	attackRange?(player: Player, num: number): number | void;
	/**
	 * 玩家的攻击范围的基数
	 * @param player 玩家
	 * @param num 当前的数值
	 */
	attackRangeBase?(player: Player, num: number | "unchanged"): number | "unchanged" | void
	/**
	 * 玩家的攻击范围的最终数值
	 * @param player 玩家
	 * @param num 当前的数值
	 */
	attackRangeFinal?(player: Player, num: number): number | void
	chessMove?(player: Player, move: number): number | void

}
