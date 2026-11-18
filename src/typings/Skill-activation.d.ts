/** 技能 */
declare interface Skill {
/** 【主动技中使用】能否选择死亡的玩家	*/
	deadTarget?: boolean
/**
	 * 【主动技中使用】能否在战棋/塔防模式中无视距离上限选择玩家
	 */
	chessForceAll?: boolean,
/** 【主动技中使用】能否选择离场的玩家，例如调虎离山等*/
	includeOut?: boolean
/**
	 * 技能按钮名字，不写则默认为此技能的翻译（可认为为该技能用于显示的翻译名）
	 * 注：用得挺少得，貌似主要是使用翻译得
	 */
	name?: string;
/**
	 * 新版：用于记录自身名字key，希望能用于自身某些配置上直接使用......，需要测试过才肯定；【结果：失败，还是没用，屏蔽掉】
	 *
	 * 旧版：用于解析用的key，不直接参与游戏逻辑，参与自己定义的解析流程，实质就是技能的名字，规范按技能名命名
	 */
	// key?:string;

	/**
	 * 继承
	 *
	 * 比较特殊的属性，继承当前技能没有的，而inherit继承技能中有的属性；
	 * 其中“audio”属性，尽可能直接继承赋值为inherit的名字；
	 * 同时，对应的翻译会覆盖成继承技能的翻译。
	 */
	inherit?: string;
//声音
	/**
	 * 配音：
	 *
	 * 主要分为：audioname（默认技能名），audioinfo（默认info.audio）
	 *
	 * 若为字符串时，带有“ext:”，则使用无名杀录目\extension\扩展名内的配音（扩展的配音）
	 *
	 * ，命名方法：技能名+这是第几个配音
	 *
	 *
	 * 否则，该字符串指代的是另一个技能的名字，若该技能名存在，则audioinfo为该技能的audio;
	 *
	 * 若为数组，则是[audioname,audioinfo]，分布覆盖原有的值。
	 *
	 * audioinfo为数字时，数字为配音数量索引（同一技能有多个配音），从1开始，使用无名杀目录\audio\skill内的配音（audioname1~audioinfo序号）;
	 *
	 * audioinfo为布尔值true或者字符串非空时，执行game.playSkillAudio(audioname)，使用无名杀目录\audio\skill内的配音;
	 *
	 * 否则，若为false，空字符串，null结果，则不播音，
	 *
	 * 若info.audio:true，则使用game.playSkillAudio(audioname)。
	 *
	 * 扩展(以game.trySkillAudio为准)：
	 *
	 * 若info.audio是字符串：
	 *
	 *     1.则主要是播放扩展声音,格式：ext:扩展包的名字:额外参数；
	 *
	 *     2.直接就是技能名，即继承该技能的播放信息，audioinfo；
	 *
	 * 若info.audio是数组，则[扩展名,额外参数]；
	 *
	 * 额外参数：1."true"，则直接播放该名字的声音；2.数字，则是随机选一个该"技能名+1-数字范围"的声音播放；
	 *
	 * 若info.audio是数字，则直接就是用解析出来的"audioname+1-数字范围";
	 */
	audio?: number | string | boolean | [string, number];
/**
	 * 指定武将名的音频。
	 *
	 * 强制使用该audioname覆盖上面解析出来的audioname，其解析出来的audioname为“audioname_玩家武将名”,
	 *
	 * 最终路径为：无名杀目录\audio\“audioname_玩家武将名”
	 *
	 * 扩展：
	 *  若info.audioname存在，且是数组，且方法参数有player，则播放"audioname_玩家名"的声音（即可同一个技能，不同人播放不同声音）
	 */
	audioname?: string[];
//【v1.9.102】
	/**
	 * 添加audioname2机制，用于重定向特定角色的语音到特定技能
	 *
	 * 其key值为人物的name；
	 */
	audioname2?: Record<string, string>;
/** 强制播放音频 */
	forceaudio?: boolean;
//时机与触发相关
	/**
	 * 触发的时机
	 *
	 * 一般用于触发技能（被动技能）
	 *
	 * 注1：主动触发enable，是没有event._trigger;
	 *
	 * 注2：有trigger，就表示这是一个触发技能，触发技能必须要有触发内容“content”，没有会引发报错；
	 */
	trigger?: SkillTrigger;
/**
	 * 为true时，将该技能加入到_hookTrigger
	 *
	 * 根据代码理解：
	 *
	 * 通过addSkillTrigger，挂载在player._hookTrigger中；
	 *
	 * 作为一个单独触发的方式，每次createTrigger，logSkill，filterTriggers时执行所有挂载在_hookTrigger所有对应的hookTrigger；
	 *
	 * 目前可知，其相关使用方法：after,block,log【目前只有于国战方法中，应该是作为全局执行方法的一种简约写法，实用不大】
	 */
	hookTrigger?: SkillHookTrigger;
/** 同时机技能发动的优先度 */
	priority?: number;
//基本都在核心createTrigger，addTrigger，trigger中逻辑触发相关，属于重要得属性
	/**
	 * 目前具体不知什么功能，当前所知，非常重要，和createTrigger，addTrigger，trigger相关
	 * （推测，这属性是指明客户端是否显示该技能的操作按钮）
	 *
	 * 1.用于双将，若该设置不为true，该技能时在hiddenSkills隐藏技能列表中，且为“非明置”状态，结束当前“createTrigger”事件的触发；
	 * 即该设置，可以让隐藏技能触发；
	 *
	 * 2.用于event.addTrigger，event.trigger中，若该设置为true，默认为其priority+1，影响技能的触发顺序
	 * （该顺序从代码看起来主要受priority影响，因为会*100，设置这个，会比其他同级优先一点）
	 *
	 * 3.当设置了该值为true，
	 *  若forced没设置到，则默认为true；
	 *  若popup没设置到，则默认为false；
	 *
	 * 故该设置核心功能：表明该技能是强行触发技能,并且不提示
	 */
	silent?: boolean;
/**
	 * 使用content接管整个skill发动流程
	 */
	direct?: boolean;
/**
	 * 此技能是否可以被设置为自动发动（不询问）
	 *
	 * 设置了该属性的技能，可加入到配置选项中，自己设置是否自动发动（即该技能非必发技能）
	 *
	 * 若该属性值是“check”，则调用当前技能得check方法检测
	 */
	frequent?: boolean | string | ((event: GameEvent, player: Player) => number | boolean);
/**
	 * 此技能是否可以被设置为自动发动2
	 *
	 * 可以细分当前技能强制发动选项，（应该是为了细分子技能），保存到lib.config.autoskilllist，
	 *
	 * 在ui.click.autoskill2中执行,
	 *
	 * 取值为子技能的名字（注：目前，看来，只是在UI上作用，自动发动，更多是依赖frequent参数）
	 */
	subfrequent?: string[];
/**
	 * 自动延迟的时间
	 *
	 * 可以影响技能触发响应时间（主要影响loop之间的时间,即game.delayx的调用情况）
	 */
	autodelay?: boolean | number | ((event: GameEvent, player: Player) => number);
/** 第一时刻执行？（将发动顺序前置到列表前） */
	firstDo?: boolean;
/** 最后一刻做？（将发动顺序置于列表后方） */
	lastDo?: boolean;
/**
	 * 此技能是否能固定触发（即自动发动）。
	 *
	 * true为固定触发（可视为一种锁定技的，锁定技实质是mod里的技能）
	 * 国战可以触发亮将。
	 *
	 * 【核心】作为game.check检测用的标准属性之一，在满足条件下强制执行。
	 */
	forced?: boolean;
/**
	 * 死亡后是否可以发动技能
	 */
	forceDie?: boolean;
/**
	 * 是否触发技能发动(logSkill)
	 *
	 * 若为false，发动技能将不会自动在武将牌上弹出技能发动文本，记录中也不会有发动技能的记录
	 *
	 * 若为字符串，则在createTrigger【step 3】触发技能时，使用player.popup弹出该提示文本；
	 */
	popup?: boolean | string;
/**
	 * 获得此技能后武将信息栏将不会显示此技能描述
	 *
	 * 一般用于有技能描述但不属于“主技能”的技能，如曹嵩的6枚“金”
	 */
	nopop?: boolean;
/**
	 * 取消触发后的处理
	 *
	 * 在createTrigger中step 3处理
	 *
	 * @param trigger
	 * @param player
	 */
	oncancel?(trigger: GameEvent, player: Player): void;
//触发内容基本触发流程
	/**
	 * 在content之前执行
	 *
	 * 在chooseToUse，step2中执行：
	 *  其执行时机和chooseButton一致，当chooseButton不存在时且game.online为false，则会执行这个
	 * @param config
	 */
	precontent?: ContentFuncByAll | OldContentFuncByAll;
/**
	 * 在content之前触发内容
	 *
	 * 在useSkill中使用，主动触发技能content之前
	 */
	contentBefore?: ContentFuncByAll | OldContentFuncByAll;
/**
	 * 触发内容（技能内容）
	 *
	 * 作为被动触发技能：
	 *  在createTrigger，step3中创建当前技能的事件，设置该content为事件content作为触发内容；
	 *
	 * 作为主动触发技能：
	 *  在useSkill中创建当前技能的事件
	 * 分步执行(通过step x分割开执行逻辑步骤)
	 *
	 * 注：此时的content，已经为触发该技能的效果而创建的，该技能执行中的事件，此时的event一般是不具备
	 *  触发信息，触发的信息，主要在trigger触发事件中获取。
	 */
	content?: ContentFuncByAll | ContentFuncsByAll | OldContentFuncByAll;
/**
	 * 在content之后触发内容
	 *
	 * 在useSkill中使用，主动触发技能content之后
	 */
	contentAfter?: ContentFuncByAll | OldContentFuncByAll;
//技能初始化与移除：
	/**
	 * 获得技能时发动，初始化技能
	 *
	 * 技能的话，则在addSkillTrigger，若第三个参数triggeronly取值为true，只设置触发，不初始化该技能；
	 *
	 * 正常在addSkill处理，this.addSkillTrigger(skill)，使用此初始化；
	 */
	init?(player: Player, skill: string): void;
/**
	 * 添加技能时，初始化技能信息
	 *
	 * 在addSkill中调用，每次添加都会执行
	 */
	init2?(player: Player, skill: string): void;
/** 在执行player.disableSkill丧失技能时，若该属性为true，则执行技能的onremove */
	ondisable?: boolean;
/**
	 * 失去技能时发动
	 * 当值为string时:
	 *
	 *  若为“storage”，删除player.storage中该技能的缓存（用于保存标记等信息）；
	 *      注：失去这个技能时销毁标记。
	 *
	 *  若为“discard”，若player.storage[skill]缓存的是卡牌时，执行game.cardsDiscard，并播放丢牌动画，然后移除player.storage[skill]；
	 *
	 *  若为“lose”，和“discard”差不多，不过不播丢牌动画；
	 *
	 * 当值为true时，直接移除player.storage[skill]；
	 *
	 * 当值为字符串集合时，则是删除集合中对应player.storage（即删除多个指定storage）
	 *
	 * 注：当前disableSkill中，若当前info.ondisable，调用onremove必须是方法，且不注入skill参数；
	 */
	onremove?: ((player: Player, type: string) => void) | string | string[] | boolean;
/** 是否持续的附加技能，在removeSkill中使用 */
	keepSkill?: boolean;
//以下3个属性基本功能时一致：在某些模式下是否能使用，只使用一个就差不多
	/**
	 * 指定该技能在哪些模式下禁用
	 *
	 * 注：在指定模式被禁用的技能，会被设置成空对象，并且“技能_info”的描述变成“此模式下不可用”。
	 */
	forbid?: string[];
/** 与forbid相反，只能在指定玩法模式下才能被使用，其他逻辑一致 */
	mode?: string[];
/** 当前模式下是否能使用，返回false则不能使用，其实和forbid逻辑一致 */
	available?(mode: string): boolean | void;
//技能相关设置：
	/**
	 * 技能组：
	 *
	 * 拥有这个技能时相当于拥有技能组内的技能
	 *
	 * 注：一些特殊技能标签：
	 *
	 * “undist”：不计入距离的计算且不能使用牌且不是牌的合法目标
	 *
	 *  （被隔离玩家，目前确定的作用：player.getNext获取下一位玩家，player.getPrevious确定上一位玩家，player.distance计算玩家距离）；
	 */
	group?: string | string[];
/**
	 * 子技能：
	 *
	 * 你不会拥有写在这里面的技能，可以调用，可以用技能组联系起来;
	 *
	 * 子技能名字：“主技能_子技能”，翻译为主技能翻译
	 *
	 * 注：子技能，会被视为“技能_子技能”独立保存起来。
	 */
	subSkill?: Record<string, Skill>;
/**
	 * 全局技能?:
	 *
	 * 你拥有此技能时，所有角色拥有此技能（global的值为技能名）
	 *
	 * 注：无论是否拥有此技能，此技能都为全局技能写法：技能名前 + _
	 */
	global?: string | string[];
/**
	 * 在game.addGlobalSkill中使用：
	 *
	 * 强行设置global技能；
	 */
	globalSilent?: boolean;
//技能相关设置=>功能设置
	/**
	 * 每回合限制使用次数
	 *
	 * 主要在createTrigger，step3中触发计数。
	 *
	 * enable类技能触发后，若当前技能事件的addCount属性不为false，会在玩家的stat[玩家最新stat属性于stat位数].skill属性中添加此技能的发动计数，获取方式为：player.stat[获取所需回合数].skill[当前技能名]
	 *
	 * trigger类技能触发后，若此技能设有此属性，会在玩家身上添加“counttrigger”技能，计数记录在：player.storage.counttrigger[当前技能名]
	 * @param skill 获取发动次数的技能
	 * @param player
	 */
	usable?: ((skill: string, player: Player) => number) | number;
/**
	 * 每一轮的使用次数
	 *
	 * 设置了该属性，会创建一个“技能名_roundcount”技能，将其加入group（技能组）中；
	 *
	 * 该技能的触发阶段“roundStart”（一轮的开始），用于记录当前技能的在一轮中使用的次数
	 */
	round?: number;
/** 用于“技能名_roundcount”技能中，当前技能不可使用时，“n轮后”xxx，中xxx的部分显示（即后面部分） */
	roundtext?: string;
/** 增加显示的信息，这部分时增加，“n轮后”前面部分 */
	addintro?(storage: Record<string, any>, player: Player): string;
/** 延迟的时间 */
	delay?: number | boolean;
/**
	 * 锁定技
	 *
	 * 若取值false，则get.is.locked，直接返回就false了；
	 *
	 * （锁定技的判定：1.info.trigger&&info.forced；2.info.mod；3.info.locked）
	 *
	 * 是否可以被“封印”（内置技能“fengyin”）的技能，取值为false时，get.is.locked返回为false；true则正常逻辑
	 */
	locked?: boolean | ((skill: string, player?: Player) => boolean);
/** 是否是旧版技能，值为true，添加到lib.config.vintageSkills中，可以实现新/旧版技能切换，如果该为true，则“原翻译名_alter”即作为当前的翻译 */
	alter?: boolean;
//锁定技
	/**
	 * mod技能的设置
	 *
	 * 如果有，技能视为锁定技
	 * */
	mod?: Mod;
//【重点】标记的key需要和技能名一致，游戏内都是通过对应skill取得对应的标记key，即player.storage[skill]
	//限定技与觉醒技与技能标记
	/*
	关于限定技规范：
		一般情况下，需要在filter中，可加入!player.storage.xxx==true判定，
		在发动后，content内设置player.storage.xxx=true，代表已经触发了；
		目前，可以采用另一种简洁的方法，即觉醒技方法：
			player.awakenSkill("xxx");
		这样就会屏蔽发动过的技能，不会发动第二次；
	*/

	/**
	 * 限定技（标记）
	 *
	 * 该标记为true时，若没有设置以下内容，则会自动设置：
	 *
	 *  mark设置为true；
	 *
	 *  intro.content设置为“limited”；
	 *
	 *  skillAnimation设置为true；
	 *
	 *  init设置为初始化玩家缓存的该技能名标记为false；
	 */
	limited?: boolean;
/**
	 * 是否开启觉醒动画
	 *
	 * 准备来说，常用于觉醒动画，实际是指技能动画
	 *
	 * 字符串时取值：epic，legend
	 */
	skillAnimation?: boolean | string;
/** 是否只显示文字特效 */
	textAnimation?: boolean;
/** 动画文字(可用于觉醒文字) */
	animationStr?: string;
/** 动画文字颜色(觉醒文字颜色) */
	animationColor?: string;
/**
	 * 觉醒技标记：
	 *
	 * (目前来看，这个目前单纯是技能标记，在主逻辑上并没使用，但貌似会被某些技能本身用到，或者类似左慈判断不能获得的技能的)
	 */
	juexingji?: boolean;
}
