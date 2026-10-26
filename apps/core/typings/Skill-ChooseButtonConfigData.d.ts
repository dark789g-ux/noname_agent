/**
 * 选择按钮配置
 *
 * 时机：chooseToUse
 *
 * 当你在选择使用时，选择的是技能，若技能有chooseButton设置，则执行player.chooseButton方法:
 *
 * 以下则为调用该chooseButton的相关参数：
 *
 * 将操作返回的“视为”结果卡牌，通过event.backup通过视为卡牌的操作，重新操作该操作（一个绕的逻辑）；
 *
 * 其实质：是一种视为技的操作，弥补一些视为使用某些xxx锦囊时的复杂操作；
 *
 * 在backup执行方法无法触发通信的原因：
	苏婆玛丽奥  11:50:33
	主机不需要执行
	这玩意是直接客机执行的
	执行完了 把总的结果和生成的backup技能发过去；
	即chooseButton的所有方法都是交给客机执行的，主机只负责获取返回的backup信息；

 * 当前使用范围：
 *
 * chooseToUse
 *
 * chooseToRespond 【v1.9.106】
 */
interface ChooseButtonConfigData {
	//player.chooseButton的参数：
	/**
	 * 选择内容的面板
	 *
	 * 需要操作的内容，在这里创建；
	 *
	 * 返回传递给player.chooseButton的参数；
	 *
	 * 其中参数event,为当前chooseToUse事件
	 */
	dialog?(event: GameEvent, player: Player): Dialog;
	/**
	 * 卡牌选择条件
	 *
	 * 既player.chooseButton的filterButton
	 * @param button
	 * @param player
	 */
	filter?(button: Button, player: Player): void;
	/**
	 * ai如何选牌
	 *
	 * 既player.chooseButton的ai
	 * @param button
	 */
	check?(button: Button): number | void | string;
	/**
	 * 选择数目，默认为1
	 *
	 * 既player.chooseButton的selectButton
	 */
	select?: import("@/library/element/Player/type").BroadSelect;

	//成功选择操作后的内容：
	/**
	 * 返回“视为”部分（即当作该选择为视为的操作逻辑）
	 *
	 * 将该返回内容给event.backup，视为当前返回的信息条件作为使用；
	 *
	 * @param links result.links（由get.links获得，一般是指当前面板上的所有可选择按钮的link数据,一般为卡牌信息）
	 * @param player
	 */
	backup?(links: Result['links'] | Partial<Result>, player: Player): Skill;
	/**
	 * 选择时弹出的提示
	 * @param links result.links（由get.links获得，一般是指当前面板上的所有可选择按钮的link数据,一般为卡牌信息）
	 * @param player
	 */
	prompt?(links: Result['links'] | Partial<Result>, player: Player): string;

	/** 过滤确认回调，用于在选择完成后进行二次过滤 */
	filterOk?: () => boolean;
	/** 是否允许全选 */
	allowChooseAll?: boolean;
	/** 是否使用复杂选择模式 */
	complexSelect?: boolean;
	/** 选择规格配置，包含 finalPredicate 等字段 */
	selectionSpec?: SelectionSpec | SelectionSpecFactory;
	/**
	 * 进行额外的选择时：
	 * 【v1.9.105】
	 *
	 * 在chooseButton类出牌阶段技能中调用chooseControl函数而不是chooseButton函数进行第一段选择
	 *
	 * 注1：使用参考  例：神户小鸟【花绽】
	 * ；
	 * 注2：生成中所有选项，记得加上cancel2！
	 *
	 * 注3：其选择结果在：result.control
	 *
	 * 注4：返回的结果是提供给player.chooseControl方法的参数列表；
	 *
	 * 注5：默认是使用配置的dialog方法，返回的dialog，若设有该参数配置，则优先使用它返回的参数列表，从而构建的control；
	 * @param event
	 * @param player
	 */
	chooseControl?(event: GameEvent, player: Player): string[];
}
