//这里主要是声明各种游戏内常用的对象的结构
type listeners = {
    [key in keyof HTMLElementEventMap]?: EventListener;
};

type styleObj = {
    [key in keyof CSSStyleDeclaration]?: string;
}

/**
 * @deprecated
 * key为字符串的Record
 */
type SMap<V> = Record<string, V>;

/** 单体与集合类型 */
type SAAType<T> = T | T[];

type Row_Item = SAAType<Card | Player | string>;

type Row_Item_Option<T = Row_Item> = {
    /**添加的东西，可以是string,card,player或它们的数组 */
    item: T;
    /**行中有多个框，每个框的样式 */
    itemContainerCss?: CSSStyleDeclaration;
    /**每个框中有多个项目，每个项目的样式，比如每个卡的样式 */
    itemCss?: CSSStyleDeclaration;
    /**自定义的方法，可以自定义加完后的一些逻辑 */
    custom?: (itemContainer: HTMLDivElement) => void;
    /**每个框所分配行的总宽度的比例 */
    ratio?: number;
    /**控制每个框中的项目是否可以支持点击 */
    ItemNoclick?: boolean;
    /**点击每个项目的回调函数
     * @param item 当前点击的item
     * @param itemContainer 当前item所在的容器
     * @param AllItemConatainers 所有的容器框
     * @param e 鼠标事件
     */
    clickItem?: (item: HTMLDivElement, itemContainer: HTMLDivElement, AllItemConatainers: HTMLDivElement[], e: MouseEvent) => void;
    /**
     * 点击框的回调事件
     * @param itemContainer 当前点击的框
     * @param item 框中最开始加入的原始的项目
     * @param AllItemConatainers 所有的容器框
     * @param e 鼠标事件
     */
    clickItemContainer?: (itemContainer: HTMLDivElement, item: T, AllItemConatainers: HTMLDivElement[], e: MouseEvent) => void;
    overflow?: 'fold' | 'scroll' | 'hidden';
};

declare type RowItem = Row_Item | Row_Item_Option<Row_Item>;

/** 技能content */
declare type ContentFuncByAll = (event: GameEvent, trigger: GameEvent, player: Player) => Promise<any>;

declare type ContentFuncsByAll = ((event: GameEvent, trigger: GameEvent, player: Player, result: Partial<Result>) => Promise<any>)[];

declare type OldContentFuncByAll = () => void

declare type Game = typeof import('noname').game;

declare type Library = typeof import('noname').lib;

declare type Status = typeof import('noname')._status;

declare type UI = typeof import('noname').ui;

declare type Get = typeof import('noname').get;

declare type AI = typeof import('noname').ai;

declare var lib: Library | undefined;

interface Navigator {
	notification?: {
		confirm(message: string, callback: (index: number) => void, title?: string, buttons?: string[]): void;
	};
}

declare type Button = import('@/library/element/index.js').Button;

declare type Card = import('@/library/element/index.js').Card;

declare type VCard = import('@/library/element/index.js').VCard;

declare type Dialog = import('@/library/element/index.js').Dialog;

declare type GameEvent = import('@/library/element/index.js').GameEvent;

/** An event whose num value domain is not known at a shared runtime boundary. */
declare type RuntimeGameEvent = import('@/library/element/gameEvent.js').GameEvent<import('@/library/element/gameEvent.js').GameEventNumberValue>;

declare type Player = import('@/library/element/index.js').Player;

declare type Control = import('@/library/element/index.js').Control;

declare type Video = import('@/game/index.js').Video;

declare type Videos = import('@/game/index.js').Videos;

declare type GameHistory = import('@/game/index.js').GameHistory;

declare type Sex = 'male' | 'female' | 'dobule' | 'none';

declare type Character = [Sex | "", string, number | string, string[], string[]] | [Sex | "", string, number | string, string[]] | import('@/library/element/character.js').Character;

declare type Select = [begin: number, end: number];

declare interface progress extends HTMLDivElement {
    /** 获取标题 */
    getTitle: () => string;
    /** 更改标题 */
    setTitle: (title: string) => void;
    /** 获取显示的文件名 */
    getFileName: () => string;
    /** 更改显示的文件名 */
    setFileName: (title: string) => void;
    /** 获取进度*/
    getProgressValue: () => number;
    /** 更改进度*/
    setProgressValue: (value: number) => void;
    /** 获取下载文件总数 */
    getProgressMax: () => number;
    /** 修改下载文件总数 */
    setProgressMax: (max: number) => void;
    /** 通过数组自动解析文件名 */
    autoSetFileNameFromArray: (fileNameList: string[]) => void;
}
