declare interface Skill {
//核心
	//event.bakcup设置的信息，game.check使用到的一些参数，其实就是把game.check需要的一些参数设置到技能中，作为check时的条件
	// 追加：这个主要用于game.check检测中，取代当前事件的条件；若没有主动申请检测，则其实用不上；
	// 在表现上，主要用于：主动技，视为技
	/* 这些就是作为前提条件的主要属性
	filterButton
	selectButton
	filterTarget
	selectTarget
	filterCard
	selectCard
	position
	forced
	complexSelect?:boolean;
	complexCard?:boolean;
	complexTarget
	ai1
	ai2
	*/
	//目标
	/**
	 * 需要选择多少张牌才能发动
	 *
	 * 选择的牌数
	 *
	 * -1时，选择所有牌,否则就是指定数量的牌
	 *
	 * 数组时，这个数组就是选择牌数的区间,其中任意（至少一张）：[1,Infinity]
	 *
	 * 为变量时（具体情况具体分析），例：()=>number
	 */
	selectCard?: number | Select | (() => number | Select);
/**
	 * 需要选择多少个目标才能发动
	 *
	 * 选择的目标数：
	 *
	 * 为-1时，选择全部人
	 *
	 * 为数组时，这个数组就是选择目标数的区间
	 */
	selectTarget?: number | Select | (() => number | Select);
/**
	 * 选择的牌需要满足的条件
	 *
	 * 可以使用键值对的简便写法
	 *
	 * 也可以使用函数返回值（推荐）
	 *
	 * 都是通过get.filter处理成事件的filterCard的方法；
	 *
	 * 直接填true，则有些地方，会优先触发过滤可使用的卡牌，例如ui.click.skill,ai.basic.chooseCard
	 *
	 * 注：game.check时，如果当前时viewAs“视为技”，则其过滤技能时filterCard,作为方法，多入参一个event参数，需要时可以使用；
	 * （一般没有）
	 */
	filterCard?: boolean | CardBaseUIData | ((card: Card, player: Player) => boolean) | boolean;
/**
	 * 是否使用mod检测
	 *
	 * 取值true;
	 *
	 * 在event.backup使用，
	 *
	 * 当info.viewAs有值的时候（即该技能为视为技），
	 *
	 * 若没有设置filterCard，默认设置一个filterCard：
	 *      可以优先使用“cardEnabled2”的mod检测卡牌是否可使用；
	 *
	 *
	 * 已找不到，可能就是改成cardEnabled2
	 *
	 * 则若当前事件为”chooseToUse“（选择卡牌使用）,使用”cardEnabled“卡牌是否能使用mod检测；
	 *
	 * 则若当前事件为”chooseToRespond“（选择卡牌响应），使用”cardRespondable“卡牌是否能响应mod检测；
	 */
	ignoreMod?: boolean;
/**
	 * 选择的目标需要满足的条件
	 */
	filterTarget?: ((card: Card, player: Player, target: Player) => boolean) | boolean;
/**
	 * 指定位置：
	 * 'h'：手牌区, 'e'：装备区, 'j'：判定区
	 */
	position?: string;
/**
	 * 选择时弹出的提示
	 *
	 * 单参数的方法，主要用再技能点击使用时的提示；
	 *
	 * 注：即触发技能/主动发动技能的提示描述信息；
	 */
	prompt?: string | ((event: GameEvent, player: Player) => string);
//| TwoParmFun<Trigger, Player, String> | TwoParmFun<Links, Player, string> //好像没见到用
	/**
	 * 二次提示
	 *
	 * 主要在createTrigger，step1中，设置event.prompt2
	 *
	 * 若是boolean类型，则取值false,不显示prompt2，默认使用lib.translate[“技能名_info”]的描述
	 *
	 * 注：即发动技能时，prompt提示下的提示（默认显示技能描述）；
	 */
	prompt2?: string | ((event: GameEvent, player: Player, triggername?: string, indexedData?: GameEvent["indexedData"]) => string) | boolean;
/**
	 * 在ui.click.skill中使用，若当前event.skillDialog不存在，可以用该方法生成的文本的dialog作为skillDialog；
	 *
	 * 若没有该方法，可以使用翻译中该技能的info信息代替。
	 */
	promptfunc?: ((event: GameEvent, player: Player) => string);
/** 表示这次描述非常长(涉及用了h5文本)，设置为true，重新执行ui.update()，设置skillDialog.forcebutton为true */
	longprompt?: boolean;
//补充game.check相关参数的声明：
	/** 过滤不可选择按钮 */
	filterButton?(button: Button, player: Player): boolean;
/** 按钮的可选数量，大多数情况下，默认1 */
	selectButton?: number | Select | (() => number | Select);
complexSelect?: boolean;
/** 复合选牌：即每选完一次牌后，都会重新下一次对所有牌的过滤 */
	complexCard?: boolean;
complexTarget?: boolean;
/**
	 * 是否允许主动技能选牌时可以使用全选/反选按钮
	 * 仅在没有complexCard和complexSelect的情况下生效喵
	 */
	allowChooseAll?: boolean;
/** 一般作为chooseCard相关ai */
	ai1?: Function;
/** 一般作为chooseTarget相关ai */
	ai2?: Function;
/**
	 * 是否检测隐藏的卡牌
	 *
	 * 使用范围：player.hasUsableCard，player.hasWuxie
	 *
	 * 常用：让系统知道玩家“有无懈”；
	 *
	 * 例子：可以参考“muniu”（木牛流马）
	 * @param player
	 * @param name
	 */
	hiddenCard?(player: Player, name: string): boolean | number | void;
/** 录像相关，game.videoContent.skill中相关 */
	video?(player: Player, data?: string | any[]): void;
process?(player: Player): void;
//在skillDisabled中，根据以下5个属性，检测技能是否是不能使用（若其中有一个时true都排除掉），在chooseSkill,选择获得技能时筛选列表
	//在getStockSkills中，有前3个标签属性的技能也是无法获取的
	/**
	 * 唯一
	 *
	 * 在skillintro中使用（左慈不能化身）
	 *
	 * 注：该技能是否为特殊技能，即左慈化身能否获取等等，常与部分锁定技、主公技、觉醒技连用
	 */
	unique?: boolean;
/** 临时技能，在die死亡时，会被移除 */
	temp?: boolean;
/** 子技能标签，在subSkill的技能中，会默认标记该属性为true */
	sub?: boolean;
/** 固有技，不能被removeSkill移除 */
	fixed?: boolean;
/** 一次性技能，在resetSkills时，直接移除该技能 */
	vanish?: boolean;
/**
	 * 异能技标签，同时也作为状态技的标签。
	 *
	 * 异能技是 \@Spmario233 Key包角色被赋予特权的能力技能，比固定技优先级还高，
	 * 不会受“fengyin”，“baiban”等技能移除，不会被【化身】之类的技能获得、删除，
	 * 在clearSkills时，如果不是“删除所有的all为true”的情况下，不会被移除。
	 *
	 * 同时，该标签也用于当作全局状态的技能，使这类效果不会因为【断肠】等技能而失去，
	 * 如【天义】可额外使用一张【杀】和使用【杀】时可额外指定一个目标的效果，
	 * 【双雄】可以于此回合内将任意一张与此判定牌不同颜色的手牌当做【决斗】使用的效果。
	 */
	charlotte?: boolean;
/** 在clearSkills中使用,标记此标记，永远不会被该方法删除，该标记独立使用，一般其他方法没有对其进行处理 */
	superCharlotte?: boolean;
/** 作用不明，并没有什么用，与ui相关，在skillintro中使用,值为true */
	gainable?: boolean;
/** 在nodeintro中使用，添加classname:thundertext,值为true */
	thundertext?: boolean;
//在nodeintro中使用的（这几个配置都没什么意义）
	/** 设置nodeintro的点击事件 */
	clickable?(player: Player): void;
/** 过滤点击，应该是过滤弹出面板是否能点击，具体作用日后细究 */
	clickableFilter?(player: Player): boolean;
/** 设置技能重复时此技能的前缀 */
	duplicatePrefix?: string | ((player: Player, skill: string) => string);
/** 技能名不带【】括号 */
	nobracket?: boolean;
//日志相关：
	/** 是否在历史日志中显示，取值未false不显示 */
	logv?: boolean;
/**
	 * 显示场上日志中显示
	 *
	 * 在useSkill时，若值为“notarget”，则不显示出对所有“对...”目标相关描述的日志;
	 *
	 * 在useCard时，若该设置未false，则不执行player.logSkill;
	 */
	log?: boolean | string;
/**
	 * 目标日志
	 *
	 * 若是字符串，则配置一个当前处理的trigger事件的一个玩家元素，例如"player","source","target"...；
	 *
	 * 若是方法，则配置一个方法直接返回文本,或者玩家
	 *
	 * 若没有配置prompt，显示该配置的提示
	 *
	 * @param indexedData 由`getIndex`返回的对象
	 */
	logTarget?: string | ((event?: GameEvent, player?: Player, triggername?: string, indexedData?: any) => string | Player | Player[] | null | undefined);
/**
	 * 是否通过logTarget显示触发者的目标日志；
	 *
	 * 目的：应该是为了细节化显示日志；在createTrigger，step3中使用，取值false，不使用logTarget，显示logSkill;
	 */
	logLine?: boolean;
//技能的信息显示：
	/**
	 * 内容描述
	 *
	 * 在addCard时，设置“技能名_info”的翻译；（addCard很少使用）
	 *
	 * 若时subSkill子技能，则设置“技能名_子技能名_info”的翻译；(主要适用于子技能描述)
	 *
	 * 该技能的描述（自定义，非子技能时和game逻辑无关,用于自己的解析逻辑）
	 */
	description?: string;
/** 该技能的描述（自定义，和game逻辑无关,用于自己的解析逻辑） */
	// infoDescription?:string;
	/**
	 * 来源：
	 *
	 * 若该来源技能不存在，则当前技能会被移除；
	 */
	derivation?: string[] | string;
/**
	 * 强制加载该card配置，
	 * 例如，一些原本不用于contect模式得卡，设置该值可强制加载该card
	 */
	forceLoad?: boolean;
//AI相关
	/** ai的详细配置 */
	ai?: SkillAI;
/**
	 * ai用于检测的方法：
	 *
	 * 第一个参数好想有些不一样：event，card,子技能button；
	 *
	 * 基本ai.basic使用的check方法(既涉及choose系列时用的ai自动选择)：
	 *
	 * 1）ai如何选牌：
	 *
	 * 在ai.basic.chooseCard中使用；
	 *
	 * 2）ai如何选按钮：
	 *
	 * 在ai.basic.chooseButton中使用；
	 *
	 * 3）ai如何选玩家：
	 *
	 * 在ai.basic.chooseTarget中使用；
	 *
	 * 注：其实这些应该都有两个参数的，既第二个参数其实当前所有选中的数据；
	 *
	 * 有时甚至不传参，所以遇到保存，做好健壮性屏蔽；
	 *
	 * 特殊作用：
	 *
	 * 在触发createTrigger中使用,参数：trigger事件，player玩家；
	 *
	 * 1）在技能过滤触发时作为过滤条件（当前技能info.frequent=='check'）：
	 *
	 * 2）告诉ai是否发动这个技能：返回true则发动此技能，即作为createTrigger过程中，设置ai如何chooseBool这个技能；
	 *
	 * 例：
	 *
	 * a.触发技判断敌友，大于0为选择队友发动，若<=0是对敌方发动:return get.attitude(player,event.player)>0;
	 *
	 * b.选取价值小于8的牌：return 8-get.value(card); 数字越大，会选用的牌范围越广，8以上甚至会选用桃发动技能，一般为6-get.value(card);
	 *
	 * 注：
	 *
	 * 两个参数，用于事件触发技能：event:GameEvent,player:Player；
	 *
	 * 一个参数，用于主动使用触发技能：card:Card；
	 *
	 * 无参，简洁写法；
	 */
	check?: ((card: Card) => number | boolean | void) |
	((event: GameEvent, player: Player, triggername?: string, indexedData?: any) => number | boolean | void) |
	(() => number | boolean | void);
// check?(...any:any):number|boolean;
	// /** ai用于检测的方法：用于主动使用触发技能 */
	// check?(card:Card):number|boolean;
	// /** ai用于检测的方法：用于事件触发技能 */
	// check?(event:GameEvent,player:Player):number|boolean;
	// check?():number|boolean;
	// check?:((arg: Card) => number|boolean) | ((arg: Button) => number|boolean) | ((arg: Player) => number|boolean) | ((arg0: GameEvent, arg1: Player) => number | boolean);

	//event.addTrigger,默认对于技能优先度的标记：rule<card<equip（注：silent默认比同级多1优先度）
	/** 装备技能 */
	equipSkill?: boolean;
/** 卡牌技能 */
	cardSkill?: boolean;
/** 规则技能 */
	ruleSkill?: boolean;
zhuanhuanji?: 'number' | boolean | ((player: Player, skill: string) => any);
/**
	 * 手动设置技能的标签
	 */
	categories?: (skill: string, player: Player) => string[];
/**
	 * v1.10.11
	 *
	 * 将技能的cost选择和content执行分离，从而回避原本的含糊不清的情况。
	 *
	 * 对于原本使用direct:true取消logSkill，然后在技能内部选择消耗，再logSkill的情况而言，虽然有效，但是难以区分“技能选择消耗的过程”和“技能本身的效果”，不是一件好事。
	 *
	 * 因此，我们决定将技能的cost和content分离（旧的写法仍然有效，不受影响）。使用例见张辽【突袭】
	 */
	cost?: (event: GameEvent, trigger: GameEvent, player: Player) => Promise<any>;
//2020-2-23版本：
	/**
	 * 为技能配置一个自定义在事件中处理的回调事件，该事件的使用需要自己使用，实际是一个自定义事件，没什么实际意义；
	 *
	 * 其设置的位置在技能content期间设置，设置在期间引发的事件中；
	 *
	 * 用于以下场合：judge，chooseToCompareMultiple，chooseToCompare
	 *
	 * 新版本的judge事件中 可以通过设置callback事件 在judgeEnd和judgeAfter时机之前对判定牌进行操作
	 *
	 * 在判断结果出来后，若事件event.callback存在，则发送“judgeCallback”事件
	 *
	 * 同理拼点,在拼点结果出来后，发送“compareMultiple”事件（“compare”暂时没有）
	 *
	 * callback就是作为以上事件的content使用
	 */
	callback?: ContentFuncByAll | OldContentFuncByAll;
/**
	 * v1.10.11
	 *
	 * “按点卖血”类技能和“同时机多个目标分别结算”的技能。
	 *
	 * 现在，无名杀的“按点卖血”技能可以和OL线上一样，在同时触发多个技能时，自选技能的顺序了。
	 *
	 * 用例见郭嘉【遗计】。
	 *
	 * 而对于一些牌移动事件的技能而言，不仅要“多次发动”，每次发动时还都有不同的目标，
	 * 比如伊籍的【急援】，可能会出现“同时将一些牌交给了多名角色”的情况。
	 *
	 * 如果返回值为数组或任意可遍历对象，则会分别结算每个目标；目标将存放在`event.indexedData`中，供cost和content使用。
	 */
	getIndex?(event: RuntimeGameEvent, player: Player, triggername: string): number | Iterable<any> | undefined;
/**
	 * 持恒技
	 */
	persevereSkill?: boolean;
/**
	 * 变身技
	 */
	transformSkill?: boolean;
/**
	 * 设置手动确认
	 * 为true时必须手动确认
	 */
	manualConfirm?: boolean;
//日后还有很多属性要添加的
	[key: string]: any;
}
