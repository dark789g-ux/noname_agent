declare interface Skill {
/**
	 * 获得技能时是否显示此标记，
	 *
	 * 若为false，可以用 markSkill 来显示此标记，
	 *
	 * 可以用 unmarkSkill 不显示标记
	 *
	 * mark的常量值："card","cards","image","character"，表示，标记显示的特殊形式（UI上）
	 *
	 * 注：character，只能在表示一个角色时使用，标记以角色牌形式显示；
	 *
	 * 注：取值“auto”，在updateMark时，有计数时，执行unmarkSkill(?????)
	 */
	mark?: boolean | string;
/** 标记显示文本，一般为一个字 */
	marktext?: string;
/** 标记显示内容 */
	intro?: {
		/** 自定义mark弹窗的显示内容 */
		mark?: (dialog: Dialog, storage: any, player: Player, event: MouseEvent | TouchEvent | PointerEvent, skill: string) => string | void;
		/** 用于info.mark为“character”，添加，移除标记时，log显示的标记名（好像意义不大） */
		name?: string | ((arg: any, player: Player, skill?: string) => string);
		name2?: string | ((arg: any, player: Player, skill?: string) => string);
		/**
		 * 标记显示内容？
		 * 为cards时显示标记内的牌.
		 *
		 * 当标记显示内容是文本:
		 *
		 *  "mark":有（数）个标记；
		 *
		 *  "card":一张牌；
		 *
		 *  "cards":多张牌；
		 *
		 *  "limited":限定技，觉醒技专用；(若没设置，在info.limited为true下回默认设置这个)
		 *
		 *  "time":剩余发动次数；
		 *
		 *  "turn":剩余回合数；
		 *
		 *  "cardCount":牌数；
		 *
		 *  "info":技能描述；
		 *
		 *  "character":武将牌；
		 *
		 *  "player":一个玩家；
		 *
		 *  "players":多个玩家；
		 *
		 *  可以只是一个描述文本；
		 *
		 * 在get.storageintro 中使用,以上，即为该方法的type，返回标记的描述内容
		 *
		 * 若info.mark为“character”，则一般为一个描述文本；
		 *
		 * 注:info.mark为true时，也可以使用文本描述，比较自由（按道理都可以，不过默认搭配而已）；
		 *
		 * 其中，文本可使用以下占位符：
		 *
		 *  "#"：(this.storage[skill])获取对应的计数,
		 *
		 *  "&"：get.cnNumber(this.storage[skill])获取对应的计数(需要使用到get.cnNumber来获取的数量),
		 *
		 *  "$"：get.translation(this.storage[skill])获取对应描述(一般是描述的角色名)
		 *
		 * 也可以是个自定义的方法
		 */
		content?: string | ((storage: any, player: Player, skill: string) => string | void);
		/**
		 * 标记数
		 *
		 * 主要在player.updateMark时使用，实际顶替this.storage[i+'_markcount']获取标记数
		 */
		markcount?: number | ((storage: any, player: Player) => number | string) | string;
		/** 是否不启用技能标记计数 */
		nocount?: boolean;
		/**
		 * 移除该标记时，在unmarkSkill执行
		 *
		 * 若值为字符串“throw”，该玩家缓存中该技能标记的为牌时，播放丢牌动画；
		 *
		 * 若是方法，则直接使用该回调方法处理。
		 *
		 * 注：该参数原本只在把整个标记移除时执行，后续可能自己扩展；
		 */
		onunmark?: ((storage: any, player: Player, skill?: string) => void) | string | boolean;
		// id?:string; //id名字需带“subplayer”，用于特殊模式显示信息用
	};
//主公技
	/**
	 * 是否为主公技：
	 *
	 * true时，将这个技能设置为主公技
	 *
	 * (目前来看，这个目前单纯是技能标记，在主逻辑上并没使用，但貌似会被某些技能本身用到)
	 */
	zhuSkill?: boolean;
/**
	 * 是否为势力技：
	 *
	 * 请填写对应势力
	 */
	groupSkill?: string;
/**
	 * 是否影响登场势力
	 *
	 * 请填写对应势力
	 */
	initGroup?: string;
/**
	 * 是否与座位号/交换座次相关（若为字符串'changeSeat'则表示与交换座次相关）：
	 *
	 * 必须要用到座位号的技能都应有此标签
	 *
	 * 挑战、战棋、塔防、炉石以及对决模式中部分场景由于可能有自己的phaseLoop来确定玩家执行回合的顺序导致出现使用player.getSeatNum获取座位号信息默认为0的情况（纯本体具体哪些场景请查看神鲁肃【榻谟】）
	 */
	seatRelated?: string | boolean;
/**
	 * 是否与【杀】相关：
	 *
	 * 用于DIY张绣〖百鸣〗检测
	 *
	 * 默认技能描述中含“【杀】”的是“与杀相关的技能”
	 *
	 * 若shaRelated为true，则直接视为该技能是符合条件的技能
	 * 若shaRelated为false，则直接视为该技能不是符合条件的技能
	 *
	 * @deprecated 类似的判断请按照神典韦的“判断技能描述是否含有牌名【杀】”进行
	 */
	shaRelated?: boolean;
/**
	 * 是否会交换/变更座次：
	 *
	 * 必须要交换/变更座次的技能都应有此标签
	 *
	 * 对决模式中固定位置的场景将屏蔽拥有此标签的技能以避免潜在的问题
	 *
	 * @deprecated 与此相关的判断请改为使用seatRelated:'changeSeat'
	 */
	changeSeat?: boolean;
/**
	 * 是否为预亮技能：
	 *
	 * 用于国战模式。有此标签可在暗置状态选择激活此技能，在技能对应触发时机系统将会询问是否发动技能
	 *
	 * 若技能没有预亮，在武将牌没有明置的情况下即使达到技能触发条件也不能发动技能。
	 */
	preHidden?: boolean;
//主动技能（主动使用技能，包含技能使用的相关操作配置）
	/**
	 * 可使用的阶段
	 *
	 * 一般用于主动技能
	 *
	 * 注：从这个info.enable==event.name看出，其实和trigger差不多，所有事件的发动都会阶段时点；
	 *
	 * 即，当前执行的事件，触发game.check，时，检测触发的技能的event.name，即是info.enable;
	 *
	 * 常用的阶段：
	 *
	 * phaseUse：出牌阶段使用；
	 *
	 * chooseToRespond：用以响应；
	 *
	 * chooseToUse：常用于“濒死使用”/打出使用
	 */
	enable?: EnableSignal
/**
	 * 是否显示弹出该技能使用卡牌的文字
	 *
	 * useCard中使用，
	 *
	 * 若为true的话，则执行player.popup
	 *
	 * 例如：player.popup({使用卡牌名name，使用卡牌nature}，'metal')
	 */
	popname?: boolean;
//视为技（转换卡牌的技能）
	/**
	 * (视为)目标卡牌
	 *
	 * 一般用于视为技能
	 *
	 * 【v1.9.102】扩展：可以使用函数式viewAs，目前核心支持使用地方：backup,ok;
	 */
	viewAs?: string | CardBaseUIData | ((cards: Card[], player: Player) => string | VCard | CardBaseUIData | null);
/**
	 * 视为技按钮出现条件（即发动条件）
	 * @param player
	 */
	viewAsFilter?(player: Player): boolean | void;
/**
	 * 使用视为牌时触发内容。
	 *
	 * result.cards是视为前的牌
	 *
	 * 注：实际是useResult，若当前处理的是技能，则先触发这个，后面再更具具体情况执行useCard,useSkill;
	 *
	 * 一般是用于视为技作为，效果处理，作为其他处理，会显得多余，算是视为技的扩展操作
	 *
	 * @param result
	 * @param player
	 */
	onuse?(result: Result, player: Player): void;
/**
	 * 选择按钮（牌）
	 *
	 * 常用于视为技需要实现复杂的功能选项时使用；
	 *
	 * 当前使用范围：
	 *
	 * chooseToUse
	 *
	 * chooseToRespond
	 */
	chooseButton?: ChooseButtonConfigData;
selectionSpec?: SelectionSpec | SelectionSpecFactory | true;
/**
	 * 源技能
	 *
	 * (该属性应该是动态生成的,用于记录执行backup的技能名，即执行backup的视为技能，实质是执行本技能)
	 *
	 * 在chooseToUse，step1中使用，若有，将器添加到event._aiexclude中；
	 *
	 *
	 * 目前来看，该字段不是配置进去的，而是chooseToUse，step3中，执行chooseButton的backup方法，
	 *
	 * 返回一个新的“视为”技能：“技能名_backup”，并设置到lib.skill中，
	 *
	 * 并且将技能名作为该技能的源技能设置到这个新技能的sourceSkill中。
	 */
	sourceSkill?: string;
//具体功能的处理
	//弃牌，失去牌(默认不设置discard，lose，则直接player.discard弃置选择的牌)
	//discard，lose其中一个false，都会为非视为技走lose事件失去卡牌，且提供丰富的参数设置；
	/**
	 * 是否弃牌
	 *
	 * 在useSkill中调用，
	 *
	 * 选择牌发动技能后，被选择的牌都要弃置
	 *
	 * 取值false（因为undefined != false结果为true，故默认不填和true效果一致）
	 */
	discard?: boolean | ContentFuncByAll | OldContentFuncByAll;
/**
	 * 是否失去牌（是否调用player.lose）
	 *
	 * 与discard调用时机一致，都在useSkill中，
	 * 取值为false
	 */
	lose?: boolean;
/**
	 * 不弃牌，准备用这些牌来干什么（用于播放动画）
	 *
	 * 其字符串枚举有：
	 *
	 * give，give2，throw，throw2
	 *
	 * 若不是字符串，则执行该方法
	 */
	prepare?: string | ((cards: Card[], player: Player, targets: Player[]) => string | void);
/** 在lose事件中使用，触发执行“lose_卡牌名”事件的content */
	onLose?: OldContentFuncByAll | OldContentFuncByAll[];
/**
	 *  在lose事件中使用，必须要失去的卡牌为“equips”（装备牌），有onLose才生效。
	 * 若符合以上条件，则检测该牌是否需要后续触发执行“lose_卡牌名”事件，既上面配置的onLose
	 */
	filterLose?: ((card: Card, player: Player) => boolean);
/** 在lose事件中使用，取值为true，作用貌似强制延迟弃牌动画处理 */
	loseDelay?: boolean;
/**
	 * 是否触发lose失去牌阶段
	 *
	 * 取值false；
	 *
	 * 若为false，则跳过该触发
	 *
	 * 适合lose绑定一起使用，为false时，设置丢失牌事件_triggered为null
	 */
	//新版本出牌阶段主动技的新参数（均仅在discard为false且lose不为false时有效），且losetrigger不为false，
	//是默认情况下：执行player.lose(cards,ui.special)，以下为
	losetrigger?: boolean;
/** 让角色失去卡牌的过程中强制视为正面朝上失去(losetrigger不为false时，既默认情况下生效) */
	visible?: boolean;
/**
	 * 指定失去特殊区卡牌的去向 (即设置卡牌的position)
	 *
	 * 其值采用的是ui的成员，即通过ui[info.loseTo]，获取实体对象设置；
	 *
	 * 默认为："special",
	 *
	 * 取值："special","discardPile","cardPile","ordering"，"control"(这一般都不会用上,好像没看见)
	 */
	loseTo?: string;
/**
	 * 需要失去的牌的区域ui.special(默认情况是这个，受loseTo影响)，
	 *
	 * 设置lose事件的toStorage为true，失去的牌到牌记录到自己的storage中；
	 */
	toStorage?: boolean;
/**
	 * 用于将失去的牌置于某个区域的顶端（而非默认的顶端）；【v1.9.108.6】
	 */
	insert?: boolean;
/**
	 * 技能响应前处理(非联机时，不在线时处理，估计时用于自动响应)
	 *
	 * 在chooseToRespond中使用
	 */
	prerespond?(result, player: Player): void;
/**
	 * 技能响应(可直接使用技能来响应，在这里进行响应的处理)
	 *
	 * 在respond中使用
	 */
	onrespond?(event: GameEvent, player: Player): void;
/**
	 * 过滤发动条件，返回true则可以发动此技能
	 *
	 * 主要在filterTrigger,game.check中处理,返回false则不处理（可以不设置该配置，相当于默认true结果）
	 *
	 * 注：
	 *
	 * 1.主动触发：一般走的是game.check,其filter,传入的event指的是当前game.check处理的事件；
	 *
	 * 2.被动触发：一般走的是lib.filter.filterTrigger,其filter,传入的event指的是当前的触发事件，其中还会把触发事件名传入第三个参数；
	 * @param event 事件，即event._trigger,相当于trigger时机（此时的event为触发该技能时机时的事件）
	 * @param player
	 * @param name 触发名，为event.triggername，目前只有在lib.filter.filterTrigger中才传该值，即被动触发，主动触发不检测该值，目前暂未完善
	 * @param indexedData 由`getIndex`返回的对象
	 */
	filter?(event: GameEvent, player: Player, name?: string, indexedData?: any): boolean | void | null;
/**
	 * 选择的目标武将牌上出现什么字。
	 *
	 * 使用地方：ui.click.target/player，....
	 *
	 * 如果是数组第几元素对应第几个目标；
	 *
	 * 如果是方法，则直接根据入参target，判断返回的文本；
	 *
	 * 例子：
	 * targetprompt:['出杀','出闪'],依次就是你点击第一个角色后在其旁边显示出杀，第二个角色显示出闪
	 */
	targetprompt?: string | string[] | ((target: Player) =>  string);
/**
	 * 是否每个目标都结算一次(多个目标)
	 *
	 * true为可选择多名目标
	 */
	multitarget?: boolean | number;
/**
	 * 指向线的颜色枚举：
	 * fire（橙红色FF9244），thunder（浅蓝色8DD8FF），green（青色8DFFD8），
	 */
	line?: string | { color: number[] } | boolean;
/** 是否显示多条指引线 */
	multiline?: boolean;
/**
	 * 选中该技能使用时,进行处理
	 *
	 * 在chooseToUse 的content中调用，
	 *
	 * 目前参考的例子中，大多数多是用于添加一些牌到待选择到event.set(key，收集的牌)中，
	 *
	 * 用于使用前先选牌的效果
	 *
	 * 注：其调用时机应该远早于触发技能的，在选中牌时就开始处理。
	 * @param event
	 */
	onChooseToUse?(event: GameEvent): void;
/**
	 * 改变拼点用的牌
	 *
	 * 在chooseToCompare和chooseToCompareMultiple，step2中使用，返回玩家用于的拼点的牌
	 * @param player
	 */
	onCompare?(player: Player): Card[];
/**
	 * 在chooseToRespond时使用，会前置执行当前chooseToRespond事件player所有的技能该接口；
	 *
	 * 应该时用于chooseToRespond事件时，技能进行一些初始化处理（暂无使用实例）
	 * 【v1.9.106】
	 * @param event
	 */
	onChooseToRespond?(event: GameEvent): void;
}
