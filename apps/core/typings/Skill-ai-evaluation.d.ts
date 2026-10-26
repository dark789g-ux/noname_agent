/** ai的配置信息 */
declare interface SkillAI {
//****************************技能标签 start****************************** */
	//技能标签(告诉ai的细致的信息，用来自己处理时使用，甚至可以视为一般标记使用)
	/*
		player.hasSkillTag('xxxx') 检测是否有指定技能标签：

		在流程中，优先检测
		info.ai.skillTagFilter
		若有这个，先用它过滤检测的技能标记，通过后，
		再检测ai[tag],
		若是字符串，则info.ai[tag]==arg；
		非字符串，则，只有true才可以成功（其实按代码，可以判定非0数字）
	*/

	//无视防具系列：
	/**
	 * 【无视防具1】
	 *
	 * 放在自己身上。表示自己无视别人的防具
	 */
	unequip?: boolean;
/**
	 * 【无视防具2】
	 *
	 * 放在自己身上，表示自己的防具失效2
	 */
	unequip2?: boolean;
/** 无视防具3 */
	unequip_ai?: boolean;
/**
	 * 【响应闪】
	 * 作用是告诉AI手里没『闪』也可能出『闪』,防止没『闪』直接掉血;
	 * 常用于视为技；
	 */
	respondShan?: boolean;
/**
	 * 【响应杀】
	 * 作用是告诉AI手里没『杀』也可能出『杀』,防止没『杀』直接掉血;
	 * 常用于视为技；
	 */
	respondSha?: boolean;
/**
	 * 在createTrigger中使用，可以指示技能不强制发动，暂无用；
	 */
	nofrequent?: boolean;
/**
	 * 【卖血】
	 * 用于其他AI检测是否是卖血流(if(target.hasSkillTag('maixie')))。并非加了这个AI就会卖血。
	 */
	maixie?: boolean;
/**
	 * 【卖血2】
	 * 用于chooseDrawRecover 选择抽牌还是回血，即表示该角色血量重要，告诉AI主动优先选择回血。
	 */
	maixie_hp?: boolean;
/**
	 * 【卖血3】
	 */
	maixie_defend?: boolean;
/**
	 * 【负面技】
	 * 仅拥有此技能时整体为强制发动的负面效果技能
	 */
	neg?: boolean;
/**
	 * 【半负面技】
	 * 仅拥有此技能(combo技则额外考虑有combo技)时发动技能会有较大负面代价、但可能得到正收益的技能
	 */
	halfneg?: boolean;
/**
	 * 【无护甲】
	 * 视为无护甲，用于damage，作用是告诉AI，即使有护甲，也不不使用护甲抵扣伤害；
	 */
	nohujia?: boolean;
/**
	 * 【失去装备正收益】
	 * 视为失去装备正收益，即失去装备可以发动某些效果，用于get.buttonValue中,
	 * 影响ui的选择项；
	 */
	noe?: boolean;
/**
	 * 【无手牌】
	 * 视为无手牌，用于get.buttonValue中，目前只出现在“连营”和“伤逝”中,用于其它AI检测是否含有标签『无牌』,从而告诉其他AI不要拆迁(因为生生不息)。
	 * 应该是影响ui的选择项
	 */
	noh?: boolean;
/**
	 * 【不能发起拼点】
	 * 用于player.canCompare 检测玩家是否能发起拼点（作为来源），可用于常规判定；
	 */
	noCompareSource?: boolean;
/**
	 * 【不能成为拼点目标】
	 * 用于player.canCompare 检测目标是否能成为拼点的目标，可用于常规判定；
	 */
	noCompareTarget?: boolean;
/**
	 * 用于lib.filter.cardRespondable,检测是否可以响应卡牌（这个竟然参加逻辑中）；
	 */
	norespond?: boolean;
/**
	 * 【不能自动无懈】
	 * 影响lib.filter.wuxieSwap的检测；
	 */
	noautowuxie?: boolean;
/**
	 * 【可救助】
	 * 在_save全局技能中检测，标记该技能是可用于濒死阶段救助；（即此技能可以用于自救）
	 * 现在参数3为寻求帮助的濒死角色【v1.9.108.2.1】。
	 */
	save?: boolean;
/**
	 * 【响应桃】
	 * 此技能可以用于救人，
	 * 一般用于视为技
	 */
	respondTao?: boolean;
/**
	 * 【不明置】
	 * 影响game.check的检测；
	 */
	nomingzhi?: boolean;
/**
	 * 反转装备的优先值，用于设置装备卡牌card.ai.basic.order的默认优先度；
	 * 一般是用来顶装备刷收益的，如〖枭姬〗
	 */
	reverseEquip?: boolean;
/** 非身份，国战使用，濒死阶段，有该标记，可以强行进行复活求帮助 */
	revertsave?: boolean;
/** 改变判定 */
	rejudge?: boolean;
/**
	 * 组合技
	 *
	 * 拥有此标签技能的角色在有标签对应ID的技能时此技能收益远比没有时高
	 *
	 * 如武陆逊〖彰才〗，在没有〖雄幕〗时即使能用也大打折扣则需要combo: "dcxiongmu"
	 *
	 * 不过对于如战役篇钟会这种两个技能互相combo的情况，由于失去〖排异〗后〖权计〗仍然能够发挥一定作用，故〖权计〗改用notemp标签
	 */
	combo?: string | string[];
/**
	 * 【非临时技】
	 * 暂时无法发挥预期效果，如神关羽〖武魂〗
	 * 有combo标签的无需添加
	 */
	notemp?: boolean;
//inRange方法相关标记，影响距离计算
	/** 逆时针计算距离 */
	left_hand?: boolean;
/** 顺时针计算距离 */
	right_hand?: boolean;
/** 计算距离时，无视本单位 */
	undist?: boolean;
//其余一些有些少出场的：
	/** 不会受到火焰伤害 */
	nofire?: boolean;
/** 不会受到雷电伤害 */
	nothunder?: boolean;
/** 不会受到伤害 */
	nodamage?: boolean;
/** 使用毒会有收益 */
	usedu?: boolean;
/** 不受毒影响 */
	nodu?: boolean;
/** 免疫锦囊伤害（暂定） */
	notrick?: boolean;
/** 无效化（暂定，参考无言徐庶）自己使用的锦囊 */
	notricksource?: boolean;
/** 【杀】能用则用，即使数量不够 */
	useSha?: boolean | "use" | "respond";
/** 不用【杀】，即使挨打要濒死 */
	noSha?: boolean | "use" | "respond";
/**
	 * 无消耗的【杀】，如通过〖傲才〗等白嫖的【杀】
	 *
	 * 有此标签时，即使【杀】不足人机也会尝试打出
	 */
	freeSha?: boolean;
/** 【闪】能用则用，即使数量不够 */
	useShan?: boolean | "use" | "respond";
/** 不用【闪】，即使挨打要濒死 */
	noShan?: boolean | "use" | "respond";
/**
	 * 无消耗的【闪】，如通过【八卦阵】、〖傲才〗等白嫖的【闪】
	 *
	 * 有此标签时，即使【闪】不足人机也会尝试打出
	 */
	freeShan?: boolean;
/** 此时让技能持有者获得牌没有收益，如〖自书〗 */
	nogain?: boolean;
/** 此时让技能持有者失去牌没有收益，如〖屯田〗 */
	nolose?: boolean;
/** 此时让技能持有者弃置牌没有收益，如〖屯田〗 */
	nodiscard?: boolean;
/**
	 * 是否是观星类技能
	 *
	 * 目前主要用于延时锦囊的无懈AI
	 *
	 * 若有此标签且没有"guanxing_fail"技能，人机（队友）将不会对你判定区的延时锦囊使用【无懈可击】
	 */
	guanxing?: boolean;
/** 玩家不响应无懈 */
	playernowuxie?: boolean;
/** 【响应酒】当你需要使用“酒”时，标记技能可响应 */
	jiuOther?: boolean;
/** 【伤害减免】当你收到伤害时，伤害会减免 */
	filterDamage?: boolean;
/** 此技能能在不使用火属性伤害牌的情况下造成火属性伤害 */
	fireAttack?: boolean;
//个人额外扩展：
	/** 不能被横置 */
	noLink?: boolean;
/** 不能被翻面 */
	noTurnover?: boolean;
//【v1.9.102】
	/**
	 * 用于观看其他角色的手牌
	 *
	 * 令其他角色的手牌对自己可见；
	 * 只需令自己拥有viewHandcard的技能标签即可，通过调整skillTagFilter即可实现对特定角色的手牌可见；
	 * 例：
	 * @example
	 * ai:{
			viewHandcard:true,
			skillTagFilter:function(player,tag,arg){ //arg为目标，通过调整skillTagFilter即可实现对特定角色的手牌可见；
				if(player==arg) return false;
			}, //可看见除自己外所有人的手牌；
		}
	 */
	viewHandcard?: boolean;
/**
	 * 是否忽略技能检测
	 *
	 * 用于get.effect，处理target时，检测是否处理target的result；
	 */
	ignoreSkill?: boolean;
//********************************技能标签 end********************************** */


	//ai基础属性值
	/**
	 * ai发动技能的优先度 【也用于卡牌的优先度】
	 * 要具体比什么先发发动，可以使用函数返回结果
	 */
	order?: number | ((item?: string | Card | { name: string }, player?: Player | null) => number | void);
/**
	 * 发动技能是身份暴露度（0~1，相当于概率）
	 * 取值范围为0~1,用于帮助AI判断身份,AI中未写expose其他AI将会无法判断其身份
	 */
	expose?: number;
/**
	 * 嘲讽值：
	 * 嘲讽值越大的角色越容易遭受到敌方的攻击,默认为1,一般在0~4中取值即可(缔盟threaten值为3)
	 */
	threaten?: number | ((player: Player, target: Player) => number | void) | { target?: number | ((player: Player, target: Player) => number | void) };
/**
	 * 态度：
	 * 态度只由identity决定。不同身份对不同身份的att不同。
	 * 例如：在身份局中,主对忠att值为6,忠对主att值为10;
	 * 注：配置不配该值；
	 */
	// attitude?: number;

	/**
	 * 效果：
	 * 影响ai出牌（例如什么时候不出杀）等
	 * 效果值为正代表正效果,反之为负效果,AI会倾向于最大效果的目标/卡牌;
	 *
	 * 告诉ai有某技能时某牌的使用效果发生改变。
	 *
	 * ai里面的effect是上帝视角,target不代表目标角色,player也不代表拥有此技能的玩家本身,
		因为effect是写给别的AI看的,所以target代表玩家本身,player代表其他人,可以是正在犹豫是否要杀你的任何一位玩家。

	 * 注：若不是个对象，可以直接是一个target(一种简写形式，不收录了)
	 *
	 * 应用：
	 * 〖主动技〗
			如果技能发动无须指定目标: effect=result*get.attitude(player,player);
			如果技能发动须指定目标 总效果=对使用者的收益值 * 使用者对自己的att+对目标的收益值 * 使用者对目标的att; 实际还会考虑嘲讽值,这里简化了;
	   〖卖血技〗
			总效果=对使用者的收益值 * 使用者对自己的att+对目标的收益值 * 使用者对目标的att; 实际还会考虑嘲讽值,这里简化了;

		设对目标的原收益为n,对使用者的原收益为n',n>0代表正收益,n<0代表负收益;
		函数传入4个参数,分别为卡牌、使用者、目标以及n;
		返回值可有3种形式
		1. 一个数a,对目标总的收益为a*n;
		2. 一个长度为2的数组[a,b],对目标的总收益为a*n+b;
		3. 一个长度为4的数组[a,b,c,d],对目标的总收益为a*n+b,对使用者的总收益为c*n'+d;
		假设n代表火杀对目标的效果
		1. 技能为防止火焰伤害：return 0;
		2. 技能为防止火焰伤害并令目标摸一张牌：return [0,1];
		3. 技能为防止火焰伤害并令使用者弃置一张牌：return [0,0,1,-1];

		〖倾向技〗
		对确定的意向，反应准确的收益

		【收益论的检验】示例：
		content:function(){
			game.log(player,'对',target,'的att是',get.attitude(player,target));
			game.log(player,'对',player,'的att是',get.attitude(player,player));
			game.log(player,'对',target,'发动【测试】的eff是',get.effect(target,'测试',player,player));
			game.log(player,'对',target,'使用【杀】的eff是',get.effect(target,{name:'sha'},player,player));
		},

		永远的萌新大佬的示例：
		effect的返回值：
			effect有3种可能的返回值,1个数字，长度为2的数组，长度为4的数组。
			1个数字n:收益*n
			长度为2的数组[a,b]:a*收益+b
			长度为4的数组[a,b,c,d]:对目标为a*收益+b，对使用者为c*收益+d
			*注意 zeroplayertarget 实际上是[0,0,0,0]  zerotarget  实际上是[0,0
			"下面以target:function(){},别人对你使用杀为例，括号里为可能的技能描述"
				return -1;//负影响(杀对你造成伤害时改为等量回复)
				return 0;//无影响(杀对你无效)
				return 2;//2倍影响(杀对你的伤害翻倍)
				return 0.5;//一半影响(杀对你的伤害减半)
				return [1,1];//正常影响+1(成为杀的目标摸一张牌)
				return [1,-1];//正常影响-1(成为杀的目标弃一张牌)
				return [0,1];//无影响+1(杀对你造成伤害时改为摸一张牌);
				return [0,-1];//无影响-1(杀对你造成伤害时改为弃一张牌)
				return [1,0,0,-1];//对你正常影响，对使用者无影响-1(刚烈)
				return [1,1,1,1];//对双方正常影响+1(你成为杀的目标时你和使用者各摸一张牌)
	 */
	effect?: {
		/**
		 * 返回你作为使用者时，对目标（对被使用者的影响）的修正。
		 *
		 * 返回结果的字符串："zeroplayer","zerotarget","zeroplayertarget",指定最终结果的:对使用者的收益值,对目标的收益值为0
		 *
		 * 返回数组的情况[a,b,c,d]:对被使用者 a*result+b 对被使用者c*result+d
		 * @param result1 即当前ai.result.player的结果
		 */
		player?(card: string | Card | VCard | CardBaseUIData | undefined, player: Player, target: Player | undefined, result1: number, linking?: boolean | EffectLinkContext): "zeroplayer" | "zerotarget" | "zeroplayertarget" | number | number[] | void | boolean;
		/**
		 * 你作为目标时，即你成为牌的目标时。返回的是对被使用者的影响（对你的影响）
		 *
		 * 返回结果的字符串："zeroplayer","zerotarget","zeroplayertarget",指定最终结果的:对使用者的收益值,对目标的收益值为0
		 *
		 * 返回数组的情况[a,b,c,d]:对被使用者a*result+b 对被使用者c*result+d
		 * @param result2 即当前ai.result.target的结果
		 */
		target?(card: string | Card | VCard | CardBaseUIData | undefined, player: Player, target: Player, result2: number, linking?: boolean | EffectLinkContext): "zeroplayer" | "zerotarget" | "zeroplayertarget" | number | number[] | boolean | void;
		/** 使用阶段对使用者收益的修正。 */
		player_use?(card: string | Card | VCard | CardBaseUIData | undefined, player: Player, target: Player | undefined, result1: number, linking?: boolean | EffectLinkContext): "zeroplayer" | "zerotarget" | "zeroplayertarget" | number | number[] | void | boolean;
		/** 使用阶段对目标收益的修正。 */
		target_use?(card: string | Card | VCard | CardBaseUIData | undefined, player: Player, target: Player, result2: number, linking?: boolean | EffectLinkContext): "zeroplayer" | "zerotarget" | "zeroplayertarget" | number | number[] | boolean | void;
	};
/**
	 * 收益：
	 * 收益值未在AI声明默认为0(对玩家对目标均是如此)。
	 * 一般用于主动技;
	 * 关于收益的算法，待会再详细描述
	 *
	 * 在get.result中使用；
	 *
	 */
	result?: AIResultDefinition;
/**
	 * 技能标签的生效限制条件
	 *
	 * 例：视为技中使用，ai什么时候可以发动视为技（决定某些技能标签的true/false）
	 * 在player.hasSkillTag,player.hasGlobalTag中使用
	 */
	skillTagFilter?(player: Player, tag: string, arg: any): boolean | void;
//------------------------------主要给卡牌使用的ai配置（也共享上面一些配置）--------------------------------
	//若武将使用以下配置，一般为该武将的“视为技”时使用，其配置对应“视为”的卡牌

	//这些时在外的简写，一般详细处理，在basic内
	/**
	 * 回合外留牌的价值【一般用于卡牌的ai】
	 *
	 * 大致的价值标准：
	 * tao [8,6.5,5,4]>shan [7,2]>wuxie [6,4]>sha,nanman [5,1]>wuzhong 4.5>shunshou,tiesuo 4
	 *      wugu,wanjian,juedou,guohe,jiedao,lebu,huogong,bingliang 1>shandian 0
	 * 注：当value的结果为一个数组时，则标识当前card在手牌中位置，根据该牌所处位置，获得对应下标不同的value；
	 */
	useful?: number;
/**
	 * 牌的使用价值【一般用于卡牌的ai】
	 *
	 * 数字越大，在一些ai会选用的牌范围越广，8以上甚至会选用桃发动技能，一般为6-get.value(card);
	 * 大致的价值标准：
	 * wuzhong 9.2>shunshou 9>lebu 8>tao [8,6.5,5,4]>shan [7,2]>wuxie [6,4]>juedou 5.5>guohe,nanman,wanjian 5>sha [5,1]
	 *      tiesuo,bingliang 4>huogong [3,1]>jiedao 2>taoyuan,shandian 0
	 * 注：当value的结果为一个数组时，则标识当前card在手牌中位置，根据该牌所处位置，获得对应下标不同的value；
	 */
	value?: number | number[] | ((player: Player, arg1: any) => number);
/** 该装备的价值 */
	equipValue?: number | ((card: Card, player: Player) => number);
/** 主要是使用在card的ai属性，武将技能可以无视 */
	basic?: {
		/** 该装备的价值，同equipValue，优先使用equipValue，没有则ai.basic.equipValue */
		equipValue?: number | ((card: Card, player: Player) => number);
		/** 优先度 */
		order?: number | ((card: Card, player: Player | null | undefined) => number);
		/** 回合外留牌的价值(该牌可用价值),number为当前事件玩家的手牌的下标 */
		useful?: SAAType<number> | ((card: Card, cardIndex: number) => SAAType<number>);
		/** 该牌的使用价值 */
		value?: SAAType<number> | ((card: Card, player: Player, num: number, method: any) => number);

		[key: string]: any;
	};
}
