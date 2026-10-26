declare interface Result {
	/**
	 * 最终结果
	 *
	 * 大多代表该事件到达这一步骤过程中的结果;
	 * 一般用来标记当前事件是否按预定执行的，即执行成功
	 *
	 * 大部分事件间接接触game.check，一般最终结果不变，大多数是这种
	 *
	 * 其实主要是ok方法会有直接的bool，主要涉及game.check;
	 */
	bool?: boolean | null;

	//choose系
	/** 记录返回当前事件操作过程中的卡牌 */
	cards: Card[];
	/** 记录返回当前事件操作过程中的目标 */
	targets: Player[];
	/** 记录返回当前事件操作过程中的按钮 */
	buttons: ResultButton[];
	/** 记录buttons内所有button.link(即该按钮的类型，link的类型很多，参考按钮的item) */
	links: any[];

	//control系(直接control系列没有result.bool)
	/** control操作面板的选中结果，即该按钮的link，即名字 */
	control: string;
	/** 既control的下标 */
	index: number;

	//ok系
	/** 记录返回当前事件操作过程中，面板按钮的确定ok取消cancel */
	confirm: string;
	/** 一般为触发的“视为”技能 */
	skill: string;
	/**
	 *  当前事件操作的“视为”牌，
	 * 当前有“视为”操作，该card参数特供给视为牌，不需要cards[0]获取视为牌 ；
	 * 判断是否为视为牌：card.isCard，false为视为牌
	 */
	card: Card | VCard | CardBaseUIData;


	cost_data: Record<string, any>;

	[key: string]: any;
}

/**
 * 选择结果会保留对话框中的原始节点。除 Button、Card 外，普通 div 也可
 * 作为可选项；link 只在具体消费边界读取，不要求每个节点都提供。
 */
declare type SelectableResultButton = HTMLDivElement;

/**
 * 联机序列化会将没有专用 itemtype 的 DOM 按钮还原为空普通对象。该对象只
 * 能作为结果回传占位，不能被当作本地可点击节点使用。
 */
declare type SerializedSelectableResultButton = Record<string, never>;

declare type ResultButton = SelectableResultButton | SerializedSelectableResultButton;

/**
 * 选择事件结果的多态类型。
 * 运行时 result/_result 字段在 AI 决策前会被赋值为字符串哨兵：
 * - "ai" 表示需 AI 介入决策
 * - "cancelled" 表示事件被取消
 * - "viewed" 表示查看操作已完成
 * 这些哨兵是内部临时状态，最终会被解析为 Partial<Result>。
 */
type EventResult = Partial<Result> | "ai" | "cancelled" | "viewed";

/**
 * 通用事件结果还会承载玩法内容写入的业务字符串，例如角色名、"shaned" 与 "refuse"。
 * 选择事件应继续使用 EventResult，不能把这些业务字符串当作选择协议哨兵。
 */
type GameEventResult = EventResult | importModeConfig | string;

/**
 * 事件步骤间传递的中间结果还可能保留拼点等流程产生的结果数组，或在联机等待期间为 null。
 */
type GameEventIntermediateResult = GameEventResult | Partial<Result>[] | null;
