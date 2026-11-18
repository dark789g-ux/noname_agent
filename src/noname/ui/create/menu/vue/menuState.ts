/**
 * menuState —— 菜单共享状态模块。
 * 从 index.ts 抽取，打破 index.ts ↔ data/*.ts 的循环依赖。
 * 所有 menu 内部模块（index.ts、data/*.ts、editors/*.vue）统一从此导入。
 */

/**
 * 菜单更新回调数组，打开菜单时逐个调用
 */
export const menuUpdates: Function[] = [];

/**
 * 当前激活项的更新回调（由 tab 内部模块通过 setUpdateActive 注入）
 */
export let updateActive: Function;

/**
 * 设置 updateActive 回调
 */
export function setUpdateActive(fun: Function) {
	updateActive = fun;
}

/**
 * 卡牌激活项的更新回调
 */
export let updateActiveCard: Function;

/**
 * 设置 updateActiveCard 回调
 */
export function setUpdateActiveCard(fun: Function) {
	updateActiveCard = fun;
}

/**
 * 菜单初始化钩子数组。
 * 各 data 模块在模块加载时注册（push 闭包，不执行），
 * 由 index.ts 的 menu() 函数在 polyfill 加载后统一遍历执行。
 * 解决 optionsMenuData 等模块顶层副作用过早执行的问题（initSkillConfigPresets 等）。
 */
export const menuInits: (() => void)[] = [];
