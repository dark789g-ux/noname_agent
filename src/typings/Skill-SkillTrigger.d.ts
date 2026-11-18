/** 时机 */
declare interface SkillTrigger {
	/**
	 * 全场任意一名角色
	 *
	 * 代表所有人
	 */
	global?: Signal | Signal[];
	/**
	 * 玩家自己
	 *
	 * 触发时件中，技能拥有者为事件的发起者;
	 *
	 * 注：需要是自己引发的事件；
	 */
	player?: Signal | Signal[];
	/**
	 * 你自己成为目标时
	 */
	target?: Signal | Signal[];
	/**
	 * 来源是你自己时
	 */
	source?: Signal | Signal[];
}
