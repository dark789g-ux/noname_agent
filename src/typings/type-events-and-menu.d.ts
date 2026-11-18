interface When {
    /**一次性技能的内容，一个then中写一个step中的内容 */
    then(fun: ContentFuncByAll): When
    /**
     * ```plain
     * 闭包用法的then，不再提供parsex变量，改为使用闭包访问
     * 传参为 event, trigger, player
     *
     * 闭包即你可以直接在when里面访问when外面的变量
     * 如下：
     * ```
     * ```javascript
     * var att = get.attitude(player, target);
     *
     * player.when("phaseEnd")
     *     .step(() => {
     *         if (att > 0) // 闭包访问了外面定义的变量 att
     *             player.say("你好喵!");
     *     });
     * ```
     */
    step(fun: ContentFuncByAll): When
    /**添加临时技能的必要筛选条件，只有当添加的筛选条件都通过时，才能触发 */
    filter(fun: Required<Skill>['filter']): When
    /**
     * 向临时技能中添加技能可以拥有的一切属性
     *  */
    assign(obj: Skill): When
    /**触发时，弹出的显示提示字样 */
    popup(str: string): When
    /**
     * 用于在then中用到的变量
     * ```
     * player.when('useCard').vars({
     * targets:result.targets
     * }).then(()=>{
     * //这里面可以使用vars中传递的参数
     * targets.gain()
     * })
     * ```
    */
    vars(obj: Record<string, any>): When
    translation(str: string): When
    /**
     * 获得技能
     * 如果instantlyAdd为false，则需要以此法获得技能
     **/
    finish(): When
}

type _AllCardName = "caoyao" | "dinvxuanshuang" | "du" | "fengyinzhidan" | "hufu" | "jiu" | "sha" | "shan" | "shenmiguo" |
    "shoulijian" | "tao" | "tianxianjiu" | "xuejibingbao" | "yunvyuanshen" | "ziyangdan" | "caochuan" | "caochuanjiejian" |
    "zhulu_card" | "chenghuodajie" | "chenhuodajie" | "chiyuxi" | "chuansongmen" | "chuqibuyi" | "diaobingqianjiang" |
    "diaohulishan" | "dongzhuxianji" | "dunpaigedang" | "fudichouxin" | "geanguanhuo" | "guaguliaodu" | "guisheqi" | "guohe" |
    "heilonglinpian" | "huogong" | "huoshaolianying" | "jiedao" | "jiejia" | "jihuocard" | "jinchan" | "jingleishan" |
    "jinlianzhu" | "juedou" | "kaihua" | "linghunzhihuo" | "liufengsan" | "liuxinghuoyu" | "nanman" | "qijia" | "shandianjian" |
    "shatang" | "shencaojie" | "shenenshu" | "shengdong" | "shezhanqunru" | "shihuifen" | "shijieshu" | "shuiyanqijun" |
    "shuiyanqijunx" | "shujinsan" | "shunshou" | "suijiyingbian" | "tanshezhiren" | "taoyuan" | "tiesuo" | "toulianghuanzhu" |
    "tuixinzhifu" | "wangmeizhike" | "wanjian" | "wugu" | "wuxie" | "wuzhong" | "xianluhui" | "xietianzi" | "xingjiegoutong" |
    "yangpijuan" | "yiyi" | "youdishenru" | "yuanjiao" | "yuansuhuimie" | "zengbin" | "zhaomingdan" | "zhiliaobo" | "zhufangshenshi" |
    "zhujinqiyuan" | "bingliang" | "caomu" | "fulei" | "guiyoujie" | "hongshui" | "huoshan" | "lebu" | "shandian" | "chilongya" |
    "cixiong" | "duanjian" | "fangtian" | "fengxueren" | "guanshi" | "guding" | "guiyanfadao" | "hanbing" | "kuwu" | "pangufu" |
    "qibaodao" | "qilin" | "qinggang" | "qinglong" | "qixingbaodao" | "sanjian" | "wufengjian" | "wutiesuolian" | "wuxinghelingshan" |
    "xuanyuanjian" | "yajiaoqiang" | "yinyueqiang" | "yitianjian" | "zhangba" | "zheji" | "zhuge" | "zhungangshuo" | "zhuque" |
    "bagua" | "baihupifeng" | "baiyin" | "guangshatianyi" | "heiguangkai" | "huxinjing" | "lanyinjia" | "mianju" | "mutoumianju" |
    "nvzhuang" | "qinglianxindeng" | "renwang" | "serafuku" | "suolianjia" | "tengjia" | "yexingyi" | "yinfengjia" | "yinfengyi" |
    "dilu" | "hualiu" | "jueying" | "xiayuncailing" | "zhanxiang" | "zhuahuang" | "chitu" | "daihuofenglun" | "dawan" | "jingfanma" |
    "numa" | "yonglv" | "zixin" | "donghuangzhong" | "fuxiqin" | "gjyuheng" | "guilingzhitao" | "haotianta" | "jinhe" | "jiuwei" |
    "kongdongyin" | "kunlunjingc" | "langeguaiyi" | "lianyaohu" | "monkey" | "muniu" | "nvwashi" | "qiankundai" | "qinglonglingzhu" |
    "sadengjinhuan" | "shennongding" | "shentoumianju" | "shuchui" | "sifeizhenmian" | "taigongyinfu" | "tianjitu" | "tongque" | "xinge" |
    "xingjunyan" | "xixueguizhihuan" | "xuelunyang" | "yufulu" | "yuruyi" | "baishouzhihu" | "bingpotong" | "cangchizhibi" | "chunbing" |
    "feibiao" | "gouhunluo" | "gudonggeng" | "huanglinzhicong" | "jiguanfeng" | "jiguanshu" | "jiguantong" | "jiguanyaoshu" | "jiguanyuan" |
    "lingjiandai" | "liutouge" | "liyutang" | "longxugou" | "luyugeng" | "mapodoufu" | "mianlijinzhen" | "mizhilianou" | "molicha" |
    "mujiaren" | "qiankunbiao" | "qinglongzhigui" | "qingtuan" | "shenhuofeiya" | "tanhuadong" | "xiajiao" | "xuanwuzhihuang" | "yougeng" |
    "yuanbaorou" | "yuchandui" | "yuchangen" | "yuchankan" | "yuchankun" | "yuchanli" | "yuchanqian" | "yuchanxun" | "yuchanzhen" |
    "zhiluxiaohu" | "zhuquezhizhang"

type AllCardName = _AllCardName | (string & {})

//--------------------


//所有的由event.trigger()发出的时机信号汇总
type Signal_Trigger = `addShownCardsAfter` | `addToExpansionBefore` | `boss_baonuwash` | `changeHp` | `changeSkillsAfter` | `changeSkillsBefore` | `changeSkillsBegin` | `changeSkillsEnd` | `compare` | `compareCardShowBefore` | `compareFixing` | `damage` | `damageBegin1` | `damageBegin2` | `damageBegin3` | `damageBegin4` | `damageSource` | `damageZero` | `debateShowOpinion` | `die` | `discard` | `dying` | `enterGame` | `eventNeutralized` | `executeDelayCardEffect` | `fellow` | `gameStart` | `gift` | `giftAccept` | `giftAccepted` | `giftDenied` | `giftDeny` | `hideShownCardsAfter` | `jiananUpdate` | `judge` | `judgeFixing` | `juedou` | `loseToDiscardpile` | `phaseAfter` | `phaseBefore` | `phaseBeforeEnd` | `phaseBeforeStart` | `phaseBegin` | `phaseBeginStart` | `phaseChange` | `phaseDiscard` | `phaseDrawBegin1` | `phaseDrawBegin2` | `phaseEnd` | `phaseJudge` | `phaseOver` | `phaseUseAfter` | `phaseUseBefore` | `phaseUseBegin` | `phaseUseEnd` | `recast` | `recastingGain` | `recastingGained` | `recastingLose` | `recastingLost` | `removeCharacterBefore` | `removeSubPlayer` | `respond` | `rewriteDiscardResult` | `rewriteGainResult` | `roundStart` | `shaDamage` | `shaHit` | `shaMiss` | `shaUnhirt` | `showCharacterAfter` | `showCharacterEnd` | `skillAfter` | `subPlayerDie` | `triggerAfter` | `triggerHidden` | `triggerInvisible` | `useCard` | `useCard0` | `useCard1` | `useCard2` | `useSkill` | `washCard` | `wuguRemained` | `yingbian` | `zhuUpdate`;

//所有的带额外时机的事件汇总
type EventWithTrigger = `${_AllCardName}` | `${_AllCardName}Cancel` | `${_AllCardName}ContentAfter` | `${_AllCardName}ContentBefore` | `[skillname]` | `[skillname]ContentAfter` | `[skillname]ContentBefore` | `[skillname]_cost` | `_save` | `addFellowAuto` | `addJudge` | `addToExpansion` | `boss_jingjia` | `callSubPlayer` | `caochuan_gain` | `cardsDiscard` | `cardsGotoOrdering` | `cardsGotoPile` | `cardsGotoSpecial` | `carryOutJunling` | `changeCharacter` | `changeGroup` | `changeHp` | `changeHujia` | `changeVice` | `chessMech` | `chessMechRemove` | `chooseBool` | `chooseButton` | `chooseButtonOL` | `chooseCard` | `chooseCardOL` | `chooseCardTarget` | `chooseCharacter` | `chooseCharacterOL` | `chooseControl` | `chooseCooperationFor` | `chooseJunlingControl` | `chooseJunlingFor` | `choosePlayerCard` | `chooseSkill` | `chooseTarget` | `chooseToCompare` | `chooseToDebate` | `chooseToDisable` | `chooseToDiscard` | `chooseToDuiben` | `chooseToEnable` | `chooseToGive` | `chooseToGuanxing` | `chooseToMove` | `chooseToMoveChess` | `chooseToMove_new` | `chooseToPSS` | `chooseToPlayBeatmap` | `chooseToRespond` | `chooseToUse` | `chooseUseTarget` | `compareMultiple` | `damage` | `die` | `disableEquip` | `disableJudge` | `discard` | `discardPlayerCard` | `discoverCard` | `doubleDraw` | `draw` | `dying` | `enableEquip` | `enableJudge` | `equip` | `equip_${_AllCardName}` | `executeDelayCardEffect` | `exitSubPlayer` | `expandEquip` | `finish_game` | `gain` | `gainMaxHp` | `gainPlayerCard` | `game` | `gameDraw` | `gift` | `guozhanDraw` | `gzzhenxi_use` | `hideCharacter` | `judge` | `link` | `loadMap` | `loadPackage` | `lose` | `loseAsync` | `loseHp` | `loseMaxHp` | `loseToDiscardpile` | `lose_${_AllCardName}` | `lose_[VEquip.name]` | `mayChangeVice` | `moveCard` | `nvzhuang_lose` | `phaseDiscard` | `phaseDraw` | `phaseJieshu` | `phaseJudge` | `phaseLoop` | `phaseZhunbei` | `phaseAny` | `pre_[event.wuxieresult2]` | `pre_[skillname]` | `qinglong_guozhan` | `recast` | `recover` | `removeCharacter` | `replaceChessPlayer` | `replaceEquip` | `replaceHandcards` | `replacePlayer` | `respond` | `showCards` | `showHandcards` | `stratagemCamouflage` | `stratagemInsight` | `swapEquip` | `toggleSubPlayer` | `turnOver` | `useCard` | `useSkill` | `versusDraw` | `viewCards` | `viewCharacter` | `yingbianEffect` | `yingbianZhuzhan` | `zhuque_clear` | `undefined`;

//所有的不带额外时机的事件汇总,即game.createEvent(xxx,false)
type EventWithoutTrigger = `[eventname]Inserted` | `addShownCards` | `arrangeTrigger` | `changeSkills` | `chooseDrawRecover` | `debateCallback` | `delay` | `delayx` | `dieAfter` | `enterGame` | `gainMultiple` | `game` | `hideShownCards` | `judgeCallback` | `leaderView` | `loadMode` | `logSkill` | `logSkillBegin` | `orderingDiscard` | `phase` | `phaseUse` | `qianlidanji_replace` | `replacePlayer` | `replacePlayerSingle` | `replacePlayerTwo` | `shidianyanluo_huanren` | `showCharacter` | `showYexings` | `swapHandcards` | `trigger` | `useCardToExcluded` | `useCardToPlayer` | `useCardToPlayered` | `useCardToTarget` | `useCardToTargeted` | `video` | `waitForPlayer` | `wuxianhuoli_reward` | `year_limit_pop`;

//所有的事件汇总
type AllEvent = EventWithTrigger | EventWithoutTrigger;

//----------------------

//所有的由event派生的额外的时机信号
type Signal_Event = `${EventWithTrigger}Before` | `${EventWithTrigger}Begin` |
    `${EventWithTrigger}End` | `${EventWithTrigger}After` | `${EventWithTrigger}Skipped`

//【最终的所有的总的时机信号】 = 【由事件派生的】 + 【event.trigger()手动触发的】
type Signal = Signal_Event | Signal_Trigger | (string & {})

type EnableSignal1 = 'chooseToUse' | 'chooseToRespond' | 'chooseCard'

//技能的enable
type EnableSignal = 'phaseUse' | EnableSignal1 | ('phaseUse' | EnableSignal1)[]

type Last<T> = T extends [...infer _Rest, infer Value] ? Value : undefined;

/**
 * The historical non-forced `GameEvent#getParent` miss value. It permits the
 * same property reads as its runtime `{}` value, but deliberately exposes no
 * event methods.
 */
interface GameEventParentFallback {
	readonly [key: string]: undefined;
}

type CheckModResult<T extends keyof Mod> = Last<Parameters<Required<Mod>[T]>> | Exclude<ReturnType<Required<Mod>[T]>, void>;

interface CheckMod {
    <T extends string & keyof Mod>(
        ...args: T extends "cardEnabled2"
			? [card: Card | VCard | CardBaseUIData, player: Player, event: GameEvent | GameEventParentFallback | "forceEnable" | "unchanged" | undefined, name: T, skills: Player | string[]]
                | [...Parameters<Required<Mod>[T]>, name: T, player: Player | string[]]
            : [...Parameters<Required<Mod>[T]>, name: T, player: Player | string[]]
    ): CheckModResult<T>
}

interface History_UseSkill {
    /** 技能事件 */
    event: GameEvent,
    /** 技能名 */
    skill: string;
    /** 来源技能 */
    sourceSkill?: string;
    /** 技能目标 */
    targets: Player[] | false;
    /** 技能类型 */
    type?: "global" | "player" | "equip";
}

interface ActionHistory {
    /** 使用卡牌 */
    useCard: GameEvent[],
    /** 响应 */
    respond: GameEvent[],
    /** 跳过 */
    skipped: (GameEvent | string)[],
    /** 失去卡牌 */
    lose: GameEvent[],
    /** 获得卡牌 */
    gain: GameEvent[],
    /** 伤害来源 */
    sourceDamage: GameEvent[],
    /** 造成伤害 */
    damage: GameEvent[],
    /** 自定义的东西 */
    custom: any[],
    /**使用的技能 */
    useSkill: History_UseSkill[]
    /**是否是[我this]的回合 */
    isMe?: boolean
    /**是否一轮的开端 */
    isRound?: boolean
    /**是否跳过本轮 */
    isSkipped?: boolean
}

type Stat = {
    /** 出牌(不同名字的牌单独计数) */
    card: Partial<Record<AllCardName, number>>;
    /** 使用技能（不同名字的技能单独计数） */
    skill: Record<string, number>;
    /** 触发技能（不同名字的技能单独计数） */
    triggerSkill: Record<string, number> & Partial<Record<symbol, number>>;
    /** 是否是[我this]的回合 */
        /** 是否跳过 */
    isSkipped?: boolean;
    isMe?: boolean;
    /**是否一轮的开端 */
    isRound?: boolean;
    /** 伤害 */
    damage?: number;
    /** 受到伤害 */
    damaged?: number;
    /** 摸牌 */
    gain?: number;
    /** 杀敌 */
    kill?: number;
    /** 使用技能次数（不区分统一计数） */
    allSkills?: number;
}

declare interface LeftPaneItem {
    /** 显示名 */
    name: string;
    /** 数据标识 */
    key: string;
    /** 附加属性 */
    attrs?: Record<string, any>;
}

declare interface RightPaneContext {
    /** 是否联机菜单 */
    connectMenu: boolean;
    /** 当前左栏选中项 */
    item: LeftPaneItem;
    /** 启动按钮元素引用 */
    startButtonEl: HTMLElement | null;
}

declare interface menuData {
    /** 左栏数据源 */
    leftPaneData: LeftPaneItem[];
    /** 可选的左栏数据 getter（支持响应式更新） */
    getLeftPaneData?: () => LeftPaneItem[];
    /** 右栏要渲染的配置项列表 */
    getRightPane(ctx: RightPaneContext): SelectConfigData[];
    /** 获取默认选中项的 key */
    getDefaultActiveKey(connectMenu: boolean): string | null;
    /** 右栏使用哪个 Vue 组件渲染 */
    rightPaneComponent?: import("vue").Component;
}
