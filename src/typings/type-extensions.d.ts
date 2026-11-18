/**
 * 导入扩展的配置
 */
declare interface importExtensionConfig {
    /** 扩展名 */
    name: string;
    /** 用于解析用的key，不直接参与游戏逻辑，参与自己定义的解析流程，统一该包的前缀 */
    key?: string;
    /**
     * 是否可编辑该扩展（需要打开显示制作扩展）
     *
     * （都满足条件，则可以开启“编辑此扩展”功能）
     */
    editable?: boolean;
    /**
     * 该扩展菜单的配置
     *
     * 名字："extension_" + key
     *
     * 内容： value
     *
     * (也是游戏编辑器中的选项代码部分)
     */
    config?: Record<string, SelectConfigData>;
    /**
     * 联机配置（目前扩展已经不能联机）
     *
     * 特殊接口：update
     */
    connect?: boolean;
    /**
     * 扩展的包信息。
     *
     * 包括卡牌，技能，人物的代码以及中文翻译
     */
    package: PackageData;
    /**
     * 函数执行时机为游戏数据加载之后、界面加载之前
     *
     * （游戏编辑器中的主代码部分）
     *
     * 注：即选择了玩法模式之后加载的内容部分；
     * @param config 扩展选项/配置
     * @param pack 扩展定义的武将、卡牌和技能等
     */
    content?(config: Record<string, any>, pack: PackageData): void;
    /**
     * 函数执行时机为游戏数据加载之前，且不受禁用扩展的限制，除添加模式外请慎用
     *
     * （也是游戏编辑器中的启动代码部分）
     *
     * 注：game.import添加扩展时就加载，即当前游戏加载菜单界面时就已经加载；
     *
     * 注2：当前扩展联机时，需要直接再此扩展；为了方便扩展，大部分扩展直接在这里扩展；
     * @param data 保存在lib.config中”extension_扩展名“为前缀的配置
     */
    precontent?(data?: Record<string, any>): void;
    /** 删除该扩展后调用 */
    onremove?(): void;
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
    /** 相关文件名 */
    files?: {
        character?: string[],
        card?: string[],
        skill?: string[],
        audio?: string[]
    };
    /**
     * 【特殊】用于game.addMode添加时，
     * 用于显示模式icon，所有的图片路径的imgsrc，指定外层扩展文件名；
     */
    extension?: string;
    /**
     * 对应lib.element,
     * 若里面是项目内的同名字段，将覆盖原方法
     */
    element?: Record<string, any>;
    /**
     * 对应ai
     */
    ai?: Record<string, any>;
    /**
     * 对应ui
     */
    ui?: Record<string, any>;
    /**
     * 对应game
     */
    game?: Record<string, any>;
    /**
     * 对应get
     */
    get?: Record<string, any>;
    /**
     * 可以继续加入更多对象：
     * 这些对象会对应附加在lib中，或替换对应lib位置的对象：
     * 例如：translate，help，skill... ... 或者其他自定义的...
     */
    [key: string]: any;
}

/**
 * 导入玩法的配置
 */
declare interface importPlayConfig {
    /** 扩展名 */
    name: string;
    arenaReady?: Function;
    /**
     * 设置播放录像
     */
    video?: Function;
    /**
     * 设置技能
     * */
    skill?: Record<string, Skill>;
    /**
     * 设置该武将包独有的卡牌（或者是特殊卡牌）
     *
     * */
    card?: Record<string, any>;
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
