/** `get.result` 正在评估的技能名或牌描述。 */
type AIResultItem = string | symbol | Card | VCard | CardBaseUIData | undefined;

/** 收益函数在玩家初始化前也可能被调用，不虚构缺失玩家。 */
type AIResultScore = (player: Player | null | undefined, target: Player | undefined, card: AIResultItem, linking?: boolean | EffectLinkContext) => number | void | boolean;

interface AIResultConfig {
	/** 目标收益；正值倾向队友，负值倾向敌人。 */
	target?: number | AIResultScore;
	/** 使用阶段优先于 target。 */
	target_use?: number | boolean | AIResultScore;
	/** 发动者收益。 */
	player?: number | AIResultScore;
	/** 使用阶段优先于 player。 */
	player_use?: number | AIResultScore;
	/** 装备初始化时保留自定义收益。 */
	keepAI?: boolean;
	/** 不根据目标当前状态进一步缩放收益。 */
	ignoreStatus?: boolean;
}

/**
 * 正式支持的动态收益协议：以被评估项为唯一参数，裸调用一次。
 * 作为技能覆盖源时不执行，而是按原 for-in 语义拷贝可枚举属性。
 */
interface AIResultResolver extends AIResultConfig {
	(item: AIResultItem): AIResultConfig | number | null | undefined;
}

type AIResultDefinition = AIResultConfig | number | AIResultResolver;
