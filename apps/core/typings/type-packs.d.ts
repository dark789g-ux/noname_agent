/**
 * 导入武将包的配置
 */
declare interface importCharacterConfig {
    /** 武将包名 */
    name: string;
    /**
     * 设置该武将包是否可以联机
     */
    connect?: boolean;
    /**
     * 设置联机武将禁用列表
     * */
    connectBanned?: string[];
    /**
     * 设置武将基本配置信息
     */
    character: Record<string, Character>;
    /**
     * 设置武将介绍
     * */
    characterIntro?: Record<string, string>;
    /**
     * 设置武将标题（用于写称号或注释）
     * */
    characterTitle?: Record<string, string>;
    /**
     * 设置技能
     * */
    skill?: Record<string, Skill>;
    /**
     * 设置珠联璧合武将
     * */
    perfectPair?: Record<string, string[]>;
    /**
     * 设置指定武将的过滤方法（传入一个mode，用于过滤玩法模式）
     * */
    characterFilter?: Record<string, (mod: string) => boolean>;
    /**
     * 设置在武将包界面分包
     */
    characterSort?: Record<string, Record<string, string[]>>;
    /**
     * 设置该武将包独有的卡牌（或者是特殊卡牌）
     *
     * */
    card?: Record<string, any>;
    /**
     * 设置自定义卡牌类型的排序用的优先级
     * */
    cardType?: Record<string, number>;
    /**
     * 设置动态翻译（本地化）【v1.9.105】
     *
     * 指定lib.dynamicTranslate.xxx为一个函数 即可让技能xxx显示的描述随玩家状态而变化 并实现技能修改等
     *
     * Player:指技能拥有者
     */
    dynamicTranslate?: Record<string, (player: Player) => string>;
    /**
     * 选择武将时，武将左下角可进行替换的武将配置【v1.9.106.3】
     *
     * */
    characterReplace?: Record<string, string[]>;

    translate?: Record<string, string>;
    /**
     * 对应lib.element
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    element?: Record<string, any>;
    /**
     * 对应ai
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    ai?: Record<string, any>;
    /**
     * 对应ui
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    ui?: Record<string, any>;
    /**
     * 对应game
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    game?: Record<string, any>;
    /**
     * 类型：键值对
     *
     * 作用：对应get
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    get?: Record<string, any>;
    /**
     * 帮助内容将显示在菜单－选项－帮助中
     *
     * 游戏编辑器的帮助代码基本示例结构：
     *
     * "帮助条目":
     * ```jsx
     *  <ul>
     *      <li>列表1-条目1
     *      <li>列表1-条目2
     *  </ul>
     *  <ol>
     *      <li>列表2-条目1
     *      <li>列表2-条目2
     *  </ul>
     * ```
     * (目前可显示帮助信息：mode，extension，card卡包，character武将包)
     */
    help?: Record<string, string>;

    [key: string]: any;
}

/**
 * 导入卡牌包的配置
 */
declare interface importCardConfig {
    /** 卡牌包名 */
    name: string;
    /**
     * 设置该卡包是否可以联机
     * */
    connect?: boolean;
    /**
     * 设置卡牌
     * */
    card: Record<string, Card>;
    /**
     * 设置卡牌技能
     * */
    skill: Record<string, Skill>;
    /**
     * 设置从牌堆添加指定卡牌
     * */
    list: CardBaseUIData[];
    /** 卡牌翻译 */
    translate: Record<string, string> | string;
    /**
     * 帮助内容将显示在菜单－选项－帮助中
     *
     * 游戏编辑器的帮助代码基本示例结构：
     *
     * "帮助条目":
     * ```jsx
     *  <ul>
     *      <li>列表1-条目1
     *      <li>列表1-条目2
     *  </ul>
     *  <ol>
     *      <li>列表2-条目1
     *      <li>列表2-条目2
     *  </ul>
     * ```
     * (目前可显示帮助信息：mode，extension，card卡包，character武将包)
     */
    help?: Record<string, string>;

    [key: string]: any;
}

/**
 * 导入玩法模式的配置
 */
declare interface importModeConfig {
    /** 模式名 */
    name: string;
    /** 技能（主要是放些该模式下特有的技能） */
    skill?: Record<string, Skill>;
    /**
     * 武将包
     */
    characterPack?: Record<string, Record<string, Character>>;
    /**
     * 武将分类排序
     */
    characterSort?: Record<string, Record<string, string[]>>;
    /** 卡牌（主要是放些该模式下特有的卡牌） */
    card?: Record<string, Card>;
    /**
     * 卡包
     */
    cardPack?: Record<string, Record<string, string[]>>;
    /**
     * mode的init方法（若有，init是最早启动的方法）
     */
    init?(): void;
    /**
     * mode的start启动方法
     */
    start: ContentFuncByAll | ContentFuncsByAll;
    /**
     * mode的start启动之前的处理方法
     */
    startBefore?(): void;
    /**
     * 重新初始化
     *
     * 在lib.client.reinit中，
     *
     * game.loadModeAsync，读取mode时启用这个初始化。
     *
     * 具体作用：有待考究
     */
    onreinit?(): void;
    /**
     * 对应lib.element
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    element?: Record<string, any>;
    /**
     * 对应ai
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    ai?: Record<string, any>;
    /**
     * 对应ui
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    ui?: Record<string, any>;
    /**
     * 对应game
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    game?: Record<string, any>;

    /**
     * 类型：键值对
     *
     * 作用：对应get
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    get?: Record<string, any>;
    /**
     * 帮助内容将显示在菜单－选项－帮助中
     *
     * 游戏编辑器的帮助代码基本示例结构：
     *
     * "帮助条目":
     * ```jsx
     *  <ul>
     *      <li>列表1-条目1
     *      <li>列表1-条目2
     *  </ul>
     *  <ol>
     *      <li>列表2-条目1
     *      <li>列表2-条目2
     *  </ul>
     * ```
     * (目前可显示帮助信息：mode，extension，card卡包，character武将包)
     */
    help?: Record<string, string>;

    [key: string]: any;
}

/**
 * 导入武将的配置
 */
declare interface importPlayerConfig {
    /** 武将包名 */
    name: string;
    /** 禁用此扩展的模式 */
    forbid: string[];
    /** 可使用模式 */
    mode: string[];
    //自定义是实现核心初始化方法
    init?(): void;
    arenaReady?(): void;
    /**
      * 对应lib.element
      *
      * 若里面是项目内的同名字段，将覆盖原方法
      */
    element?: Record<string, any>;
    /**
     * 对应ai
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    ai?: Record<string, any>;
    /**
     * 对应ui
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    ui?: Record<string, any>;
    /**
     * 对应game
     *
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    game?: Record<string, any>;

    /**
     * 类型：键值对
     *
     * 作用：对应get
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    get?: Record<string, any>;

    [key: string]: any;
}
