/**
 * 菜单的选项的配置
 *
 * config的功能菜单的node._link.config，就是该config
 * 内部代码略复杂，太多UI相关逻辑，看不懂（等日后精进，再继续再战）
 */
declare interface SelectConfigData {
    /** 功能名 */
    name: string;
    /**
     * 【核心】初始化时默认的选项/配置/模式（对应下面item的key）
     */
    init?: boolean | string;
    /**
     * 【核心】二级菜单配置(当前config内容的菜单)
     */
    item?: Record<string, string> | (() => Record<string, string>);
    /**
     * 功能说明
     *
     * 若没有，也不是其他特殊的选项，则显示“设置 + name”
     */
    intro?: string | (() => string);

    /**
     * 显示bar(添加了“withbar”,有一定的居中效果，即当前menu的头部或者尾部)
     *
     * @param node 创建出来的visualBar节点
     * @param item item选项
     * @param create 即内部自定义的createNode方法，一般不直接使用该方法，目前来看，可以内部重新定义覆盖该方法，自己达成创建item列表的方式
     * @param switcher 当前config的item的node节点
     */
    visualBar?: (node: HTMLDivElement, item: Record<string, string>, create: (arg: string) =>  void, switcher?: HTMLDivElement) => void
    /**
     * 显示菜单
     * 显示一个以3列为一行的显示列表（内部实现）
     * @param node 当前配置项的节点
     * @param item 当前node的node._link
     * @param name item选项
     * @param config 当前的config
     */
    visualMenu?: (node: HTMLDivElement, link: any, name: string, config: SelectConfigData) => void;
    /**
     * 文本菜单
     * 当前不存在visualMenu的话，则创建item列表节点，若有该属性则执行
     * @param node
     * @param link
     */
    textMenu?(node: HTMLDivElement, link: string, config: SelectConfigData): void;

    /**
     * 清理游戏，核心选项，应该默认是false(undefined)<--该功能不知是否存在
     *
     * 若没有nopointer配置（false/undefined）,则设置“pointerspan”
     *
     * 通“click”,即当前整个node都可以点击<--这个应该才是真实的功能
     */
    clear?: boolean;
    /** 指定该项没有功能，仅展示，项目内多用于描述上 */
    nopointer?: boolean;
    /**
     * 点击触发事件
     *
     * 若有返回值false，则当前点击事件的toggle切换无效
     */
    onclick?(item: any): void | boolean;
    onclick?(link: any, node: HTMLDivElement): void | boolean;

    /** 当前没有onclick方法时，除了默认game.saveConfig保存数据配置key的数据，可以使用该方法进行数据处理啊 */
    onsave?(reslut: any): void;

    /**
     * 输入框
     *
     * 其输入框的默认值是当前的init属性
     */
    input?: boolean;
    /** 取值true，若没有设置可以进行input输入 */
    fixed?: boolean;
    /** 设置input节点的onblur事件的回调（焦点离开输出框） */
    onblur?(): void;

    /**
     * 用于扩展菜单lib.extensionMenu中(目前未见使用)
     */
    onswitch?(bool: boolean): void;

    /** 核心，更新方法 */
    update?(config: Record<string, any>, map: Record<string, HTMLDivElement>): any;

    /**
     * 在玩法模式选择中：
     *  是否需要“重启”游戏，若为true，则“启”按钮会高亮（添加“glowing”）
     * 在选项中：
     *  每次改变该选项，都会重置当前的ui选项（增加，减少一些功能项）
     */
    restart?: boolean | (() => boolean);
    /** 应该与unfrequent功能时一致的，相反判断，直接显示出来的功能项 */
    frequent?: boolean,
    /** 加入更多中（随着下拉出现），用得较多 */
    unfrequent?: boolean;
    /** 不明，用得很少 */
    content?(bool: boolean): void;

    /** 内部属性，记录当前配置的key */
    _name?: string;

    /**
     * Vue 重构新增：响应式可见性标记。
     * 由 update 函数的适配器 .hide()/.show() 翻转，NonameConfig 的 v-show 响应。
     * 旧版通过 DOM classList 的 "hidden" class 实现，新版改为数据驱动。
     */
    _hidden?: boolean;
}

/**
 * 扩展的包信息
 * 游戏自带编辑器的代码编辑区域的扩展结构：
 * （主要是通过系统内部自带编译器编辑的代码，导入逻辑其实基本一致）
 */
declare interface PackageData {
    /** 扩展制作作者名 */
    author?: string,
    /** 扩展描述 */
    intro?: string,
    /** 讨论地址 */
    diskURL?: string,
    /** 网盘地址 */
    forumURL?: string,
    /** 扩展版本 */
    version?: string,
    /** 扩展在UI中显示的名字 */
    translation?:string;
    /**
     * 不将package中的character、card、skill自动拆包导入
     * @see {@link /apps/core/noname/init/loading.ts} loadExtension `if (extension[4] && !extension[4].nopack)`
     */
    nopack?: boolean;

    /** 武将导入信息 */
    character?: Partial<importCharacterConfig> & Required<Pick<importCharacterConfig, "character" | "translate">>;
    /** 卡牌导入信息 */
    card?: Partial<importCardConfig> & Pick<importCardConfig, "card" | "translate" | "list">;
    /** 技能导入信息 */
    skill?: {
        skill: Record<string, Skill>;
        translate: Record<string, string>;
    };

    /** 相关文件名（扩展所使用的一些图片） */
    files?: {
        character: string[];
        card: string[];
        skill: string[];
    }

    /** 主代码中，pack.code包括以下属性： */
    code?: {
        /** 扩展的config配置信息 */
        config?: Record<string, SelectConfigData>;
        /** 扩展主代码 */
        content?: (config: Record<string, any>, pack: PackageData) => void;
        /** 扩展帮助信息 */
        help?: Record<string, string>;
        /** 扩展启动代码 */
        precontent?: (data?: Record<string, any>) => void;
    }
}
