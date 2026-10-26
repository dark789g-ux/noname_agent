/**
 * hookTrigger在不同方法中触发的方法接口
 *
 * 注：似乎时用于模式，作为，游戏全局的一些每次都需要触发的方法（算是不实用的一个接口）
 */
declare interface SkillHookTrigger {
	/**
	 * 【hookTrigger相关】
	 *
	 * 之后处理方法
	 *
	 * 在createTrigger中最终步骤中，需要当前没有hookTrigger配置才调用到
	 *
	 * 若返回true时，会触发“triggerAfter”
	 *
	 * @param event
	 * @param player
	 * @param triggername
	 */
	after?(event: GameEvent, player: Player, triggername: string): boolean;
	/**
	 * 【hookTrigger相关】
	 *
	 * 在filterTrigger中执行，过滤发动条件，和filter有些类似，具体功能稍后分析
	 */
	block?(event: GameEvent, player: Player, name: string, skill: string): boolean;
	/**
	 * 【hookTrigger相关】
	 *
	 * 在logSkill中执行，每次触发logSkill都会触发
	 */
	log?: (player: Player, skill: string, targets: Player[]) => void;
}
